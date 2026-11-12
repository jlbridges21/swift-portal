import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { estimateInputForQuote, estimateReference } from "@/lib/estimate-pdf";
import { renderEstimatePdfOnServer } from "@/lib/estimate-pdf-server";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { notifyProjectClients, type NotifyEmailResult } from "@/lib/notifications";
import { portalLink, resolveProjectMessageTemplate } from "@/lib/workflow";
import type { AppSettings } from "@/lib/app-settings";
import type { ProjectQuote } from "@/lib/types";

/**
 * Official proposal delivery: render the PDF on the server with the same
 * builder the editor previews, keep one immutable copy per send, and email it
 * to the project's clients through the normal notification rules.
 */

type TenantDb = Awaited<ReturnType<typeof createTenantServiceClient>>;

export const PROPOSAL_PDF_BUCKET = "project-media";

export function proposalPdfFolder(businessId: string, projectId: string, quoteId: string): string {
  return `${businessId}/proposals/${projectId}/${quoteId}`;
}

/** Prefix for a project's proposal PDFs (permanent project delete clears it). */
export function proposalPdfProjectPrefix(businessId: string, projectId: string): string {
  return `${businessId}/proposals/${projectId}/`;
}

/** One file per send. A later revision is a different quote id, so it never overwrites this. */
export function proposalPdfPath(
  businessId: string,
  projectId: string,
  quoteId: string,
  sentAt: string
): string {
  const stamp = new Date(sentAt).toISOString().replace(/[^0-9]/g, "");
  return `${proposalPdfFolder(businessId, projectId, quoteId)}/sent-${stamp}.pdf`;
}

export function proposalPdfFilename(quoteId: string): string {
  return `${estimateReference(quoteId)}.pdf`;
}

type ProjectPdfContext = {
  projectName: string;
  propertyAddress: string;
  clientName: string;
};

async function loadProjectPdfContext(db: TenantDb, projectId: string): Promise<ProjectPdfContext> {
  const { data } = await db
    .from("projects")
    .select("project_name, property_address, clients(name, full_name)")
    .eq("id", projectId)
    .maybeSingle();
  const row = (data ?? {}) as {
    project_name?: string | null;
    property_address?: string | null;
    clients?: { name?: string | null; full_name?: string | null } | { name?: string | null; full_name?: string | null }[] | null;
  };
  const client = Array.isArray(row.clients) ? row.clients[0] : row.clients;
  return {
    projectName: row.project_name || "",
    propertyAddress: row.property_address || "",
    // Same fallback the admin editor uses for its preview.
    clientName: client?.full_name || client?.name || "Client",
  };
}

export async function renderProposalPdf(args: {
  businessId: string;
  quote: ProjectQuote;
  appSettings: AppSettings;
  timeZone?: string | null;
  db?: TenantDb;
}): Promise<{ bytes: Uint8Array; context: ProjectPdfContext }> {
  const db = args.db ?? (await createTenantServiceClient(args.businessId));
  const context = await loadProjectPdfContext(db, args.quote.project_id);
  const brand = getPortalBrandFromSettings(args.appSettings);
  const payments = args.appSettings.workflow.payments;
  const input = estimateInputForQuote({
    brand,
    quote: args.quote,
    clientName: context.clientName,
    projectName: context.projectName,
    propertyAddress: context.propertyAddress,
    depositFallback: {
      depositMode: payments.depositMode,
      depositPercent: payments.depositPercent,
      depositAmountCents: payments.depositAmountCents,
    },
    timeZone: args.timeZone ?? null,
  });
  const origin = await getBusinessPortalOriginById(args.businessId).catch(() => null);
  const bytes = await renderEstimatePdfOnServer(input, { logoUrl: brand.logoUrl, origin });
  return { bytes, context };
}

function isAlreadyExists(error: { message?: string; statusCode?: string | number } | null): boolean {
  if (!error) return false;
  return String(error.statusCode) === "409" || /already exists|duplicate/i.test(error.message ?? "");
}

/** Write-once. An existing file at the path wins, so a retry cannot replace what was sent. */
export async function storeProposalPdf(
  db: TenantDb,
  path: string,
  bytes: Uint8Array
): Promise<{ stored: boolean; error?: string }> {
  const { error } = await db.raw.storage
    .from(PROPOSAL_PDF_BUCKET)
    .upload(path, Buffer.from(bytes), { contentType: "application/pdf", upsert: false });
  if (!error || isAlreadyExists(error as { message?: string; statusCode?: string })) return { stored: true };
  console.error("[proposal-pdf] snapshot upload failed", { path, message: error.message });
  return { stored: false, error: error.message };
}

async function downloadPdf(db: TenantDb, path: string): Promise<Uint8Array | null> {
  const { data, error } = await db.raw.storage.from(PROPOSAL_PDF_BUCKET).download(path);
  if (error || !data) return null;
  return new Uint8Array(await data.arrayBuffer());
}

/**
 * The PDF stored when this proposal was sent. Prefers the file for the
 * current sent_at, else the newest file for the quote. Null when the proposal
 * was sent before snapshots existed, or never sent.
 */
export async function readStoredProposalPdf(
  db: TenantDb,
  quote: Pick<ProjectQuote, "id" | "project_id" | "sent_at">
): Promise<Uint8Array | null> {
  if (quote.sent_at) {
    const exact = await downloadPdf(db, proposalPdfPath(db.businessId, quote.project_id, quote.id, quote.sent_at));
    if (exact) return exact;
  }
  const folder = proposalPdfFolder(db.businessId, quote.project_id, quote.id);
  const { data, error } = await db.raw.storage.from(PROPOSAL_PDF_BUCKET).list(folder, { limit: 100 });
  if (error || !data?.length) return null;
  const newest = data
    .filter((file) => file.id && file.name.endsWith(".pdf"))
    .map((file) => file.name)
    .sort()
    .pop();
  return newest ? downloadPdf(db, `${folder}/${newest}`) : null;
}

/** Stored copy when present, else a fresh render (and store it if the proposal was sent). */
export async function ensureProposalPdf(args: {
  businessId: string;
  quote: ProjectQuote;
  appSettings: AppSettings;
  timeZone?: string | null;
}): Promise<{ bytes: Uint8Array; stored: boolean; storeError?: string; projectName: string }> {
  const db = await createTenantServiceClient(args.businessId);
  const existing = args.quote.sent_at ? await readStoredProposalPdf(db, args.quote) : null;
  if (existing) {
    const context = await loadProjectPdfContext(db, args.quote.project_id);
    return { bytes: existing, stored: true, projectName: context.projectName };
  }
  const rendered = await renderProposalPdf({ ...args, db });
  if (!args.quote.sent_at) return { bytes: rendered.bytes, stored: false, projectName: rendered.context.projectName };
  const store = await storeProposalPdf(
    db,
    proposalPdfPath(args.businessId, args.quote.project_id, args.quote.id, args.quote.sent_at),
    rendered.bytes
  );
  return {
    bytes: rendered.bytes,
    stored: store.stored,
    storeError: store.error,
    projectName: rendered.context.projectName,
  };
}

export type ProposalEmailSummary = {
  /** Portal clients the notification rules picked. */
  recipients: number;
  sent: { userId: string; email: string }[];
  failed: { userId: string; email: string; error: string }[];
  /** Opted out, no email on file, or this email is turned off in Automated Emails. */
  skipped: { userId: string; email: string; reason: string }[];
  /** True when an earlier identical request already sent this email. */
  duplicate: boolean;
};

export type ProposalDelivery = {
  pdf: { attached: boolean; stored: boolean; error?: string };
  email: ProposalEmailSummary;
};

const SKIP_REASONS = new Set(["opted_out", "email_turned_off", "no_email", "business_not_live", "missing_api_key"]);

function summarize(results: NotifyEmailResult[], recipients: number, duplicate: boolean): ProposalEmailSummary {
  const summary: ProposalEmailSummary = { recipients, sent: [], failed: [], skipped: [], duplicate };
  for (const result of results) {
    if (result.role !== "client") continue;
    if (result.sent) {
      summary.sent.push({ userId: result.userId, email: result.email });
    } else if (result.reason && SKIP_REASONS.has(result.reason) && result.reason !== "missing_api_key") {
      summary.skipped.push({ userId: result.userId, email: result.email, reason: result.reason });
    } else {
      summary.failed.push({
        userId: result.userId,
        email: result.email,
        error: result.error || result.reason || "The email provider did not accept the message.",
      });
    }
  }
  return summary;
}

/**
 * Notify the project's clients (same recipients as before: the project's
 * linked portal clients, honoring opt-outs and Automated Emails) with the PDF
 * attached. In-app rows are created on the first send only.
 */
export async function emailProposalToClients(args: {
  businessId: string;
  quote: ProjectQuote;
  appSettings: AppSettings;
  pdfBytes: Uint8Array | null;
  projectName: string;
  /** In-app title, kept per caller as before. */
  title: string;
  /** Fallback in-app/email message when no workflow template is set. */
  fallbackBody?: string;
  /** Retry: email only, to these users. */
  retryUserIds?: string[];
}): Promise<ProposalEmailSummary> {
  const businessName = args.appSettings.business.businessName;
  const projectLabel = args.projectName || args.quote.title;
  const link = `/dashboard/projects/${args.quote.project_id}#quote`;
  const body = await resolveProjectMessageTemplate(
    args.appSettings.workflow,
    "proposal_ready",
    args.quote.project_id,
    {
      project_name: projectLabel,
      portal_link: await portalLink(link, args.businessId),
    },
    args.fallbackBody ||
      `${businessName} prepared a proposal for ${projectLabel}. The PDF is attached for your records — review and accept it in your portal.`
  );
  const retry = Boolean(args.retryUserIds);
  const result = await notifyProjectClients({
    businessId: args.businessId,
    type: "quote_sent",
    eventKey: "official_proposal_sent",
    title: args.title,
    body,
    link,
    projectId: args.quote.project_id,
    emailSubject: `Your Proposal from ${businessName} — ${projectLabel}`,
    emailCtaLabel: "Review & Accept Proposal",
    attachments: args.pdfBytes
      ? [
          {
            filename: proposalPdfFilename(args.quote.id),
            content: Buffer.from(args.pdfBytes),
            contentType: "application/pdf",
          },
        ]
      : undefined,
    ...(retry
      ? { skipInApp: true, onlyUserIds: args.retryUserIds }
      : { idempotencyKey: `proposal-email:${args.quote.id}:${args.quote.sent_at ?? "unsent"}` }),
  });
  return summarize(result.emails, result.recipients, result.skippedReason === "duplicate");
}
