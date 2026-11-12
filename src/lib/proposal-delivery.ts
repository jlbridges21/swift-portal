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

/**
 * Archived proposal PDFs live in the documents bucket, which accepts
 * application/pdf. They used to target "project-media", whose MIME allowlist
 * is images/videos only, so every archive upload was rejected; nothing was
 * ever stored there. Permanent delete still sweeps the legacy bucket.
 */
export const PROPOSAL_PDF_BUCKET = "project-documents";
export const LEGACY_PROPOSAL_PDF_BUCKETS = ["project-media"] as const;

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

type StorageErrorLike = { message?: string; statusCode?: string | number; status?: number; name?: string };

function storageStatus(error: StorageErrorLike): number | null {
  const code = Number(error.statusCode);
  if (Number.isFinite(code) && code > 0) return code;
  const status = Number(error.status);
  return Number.isFinite(status) && status > 0 ? status : null;
}

function isAlreadyExists(error: StorageErrorLike | null): boolean {
  if (!error) return false;
  return storageStatus(error) === 409 || /already exists|duplicate/i.test(error.message ?? "");
}

/** Network failures, timeouts, throttling and 5xx. Config errors (MIME, size, auth) are not retried. */
function isTransientStorageError(error: StorageErrorLike): boolean {
  const status = storageStatus(error);
  if (status == null) return true;
  return status >= 500 || status === 429 || status === 408;
}

const STORE_ATTEMPTS = 3;

export type StoreProposalPdfResult = {
  stored: boolean;
  /** Another request (a retry, a second tab, a concurrent download) archived this path first. */
  existed?: boolean;
  error?: string;
};

/**
 * Write-once archive. The path is deterministic per (business, project,
 * quote, sent_at), so retries and concurrent sends land on the same object:
 * the first upload wins and later ones see 409 and keep it. The object's
 * metadata links it back to its business, project and proposal.
 */
export async function storeProposalPdf(
  db: TenantDb,
  path: string,
  bytes: Uint8Array,
  link?: { projectId: string; quoteId: string; sentAt: string }
): Promise<StoreProposalPdfResult> {
  if (!path.startsWith(`${db.businessId}/proposals/`)) {
    console.error("[proposal-pdf] refused archive outside the business prefix", { businessId: db.businessId, path });
    return { stored: false, error: "Invalid archive path" };
  }
  const body = Buffer.from(bytes);
  let last: StorageErrorLike | null = null;
  // Metadata is a convenience; never let it be the reason the archive fails.
  let withMetadata = Boolean(link);
  for (let attempt = 1; attempt <= STORE_ATTEMPTS; attempt++) {
    let error: StorageErrorLike | null = null;
    try {
      const result = await db.raw.storage.from(PROPOSAL_PDF_BUCKET).upload(path, body, {
        contentType: "application/pdf",
        upsert: false,
        cacheControl: "31536000",
        ...(withMetadata && link
          ? {
              metadata: {
                kind: "proposal_pdf",
                business_id: db.businessId,
                project_id: link.projectId,
                quote_id: link.quoteId,
                sent_at: link.sentAt,
              },
            }
          : {}),
      });
      error = result.error as StorageErrorLike | null;
    } catch (thrown) {
      error = { message: thrown instanceof Error ? thrown.message : String(thrown) };
    }
    if (!error) return { stored: true };
    if (isAlreadyExists(error)) return { stored: true, existed: true };
    last = error;
    const transient = isTransientStorageError(error);
    console.error("[proposal-pdf] archive upload failed", {
      bucket: PROPOSAL_PDF_BUCKET,
      path,
      bytes: body.byteLength,
      attempt,
      transient,
      status: storageStatus(error),
      name: error.name,
      message: error.message,
    });
    if (!transient && withMetadata) {
      withMetadata = false;
      continue;
    }
    if (!transient || attempt === STORE_ATTEMPTS) break;
    await new Promise((resolve) => setTimeout(resolve, 250 * 2 ** (attempt - 1)));
  }
  return { stored: false, error: last?.message || "Storage upload failed" };
}

/** Archive the PDF for a sent proposal at its canonical path. */
export function archiveSentProposalPdf(
  db: TenantDb,
  quote: Pick<ProjectQuote, "id" | "project_id" | "sent_at">,
  bytes: Uint8Array
): Promise<StoreProposalPdfResult> {
  if (!quote.sent_at) return Promise.resolve({ stored: false, error: "Proposal has not been sent" });
  return storeProposalPdf(db, proposalPdfPath(db.businessId, quote.project_id, quote.id, quote.sent_at), bytes, {
    projectId: quote.project_id,
    quoteId: quote.id,
    sentAt: quote.sent_at,
  });
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

/**
 * Archived copy when present, else a fresh render — archived on the spot when
 * the proposal was sent (covers proposals sent before archiving worked). When
 * a concurrent request archived first, its copy is returned so every caller
 * serves the same bytes.
 */
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
  const store = await archiveSentProposalPdf(db, args.quote, rendered.bytes);
  const winner = store.existed ? await readStoredProposalPdf(db, args.quote) : null;
  return {
    bytes: winner ?? rendered.bytes,
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
