/**
 * "Deliver to client" — the one action a business takes to hand finished media
 * to the project's own client: one email with a one-click link (no password)
 * that opens the project, where they pay (if anything is due) and download.
 *
 * Reuses existing rules: client-visible media filters, the download gate
 * (business default + per-project override), open payment rows, and the
 * one-click access link. No schema change — history lives in activity_logs.
 */
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getAppSettings } from "@/lib/app-settings";
import { sendBrandedEmail } from "@/lib/email";
import { logProjectActivity } from "@/lib/activity";
import { formatCurrency } from "@/lib/utils";
import { getStatusLabel, normalizeStatus } from "@/lib/constants";
import { filterClientMedia, filterClientModels, filterClientTours } from "@/lib/client-media";
import { filterMediaForVideoReviewDelivery, loadVideoReviewVersionMap } from "@/lib/video-review-media";
import {
  filterMediaByClientSections,
  filterModelsByClientSections,
  filterToursByClientSections,
  mediaSectionsFromProject,
} from "@/lib/project-media-sections";
import { effectiveRequireDeliveredForDownloads, resolveProjectDownloadAllowed } from "@/lib/deliverables";
import { loadMarketingPaymentLinks } from "@/lib/marketing/payment-links";
import { setProjectStatus } from "@/lib/status-automation";
import { ensureClientLoginPlaceholder } from "@/lib/portal-activation-server";
import { issueClientAccessUrl } from "@/lib/client-access-link-server";
import {
  CLIENT_LINK_OPENED_ACTIVITY,
  PROJECT_DELIVERY_SENT_ACTIVITY,
  projectPortalBasePath,
} from "@/lib/client-access-link";

export type DeliveryClientIssue = "no_client" | "no_email" | "business_login" | "foreign_login" | null;

export interface DeliverySummary {
  projectId: string;
  projectLabel: string;
  status: string;
  statusLabel: string;
  client: { id: string; name: string; email: string | null } | null;
  /** Why a one-click delivery can't go out yet (null = ready). */
  clientIssue: DeliveryClientIssue;
  media: { photos: number; videos: number; tours: number; models: number; documents: number; total: number };
  /** Required open payments (Marketing Kit add-ons excluded — they never gate downloads). */
  dueCents: number;
  openPaymentCount: number;
  requireDelivered: boolean;
  downloadsUnlocked: boolean;
  /** Downloads are only held by status (nothing due) — offer "Mark as Delivered" in the dialog. */
  canMarkDelivered: boolean;
  /** Pre-check "Mark as Delivered": media is in and the project is at Shoot Complete or later. */
  suggestMarkDelivered: boolean;
  /** Paying unlocks downloads automatically (Stripe → Delivered automation on). */
  payUnlocksDownloads: boolean;
  lastSent: { at: string; to: string | null } | null;
  lastOpenedAt: string | null;
}

type ClientLite = { id: string; name: string | null; full_name: string | null; email: string | null; user_id: string | null };

async function loadPrimaryClient(
  db: Awaited<ReturnType<typeof createTenantServiceClient>>,
  projectId: string,
  legacyClientId: string | null
): Promise<ClientLite | null> {
  const { data: rows } = await db
    .from("project_clients")
    .select("is_primary, clients(id, name, full_name, email, user_id, deleted_at)")
    .eq("project_id", projectId);
  type Row = { is_primary: boolean | null; clients: (ClientLite & { deleted_at: string | null }) | null };
  const live = ((rows ?? []) as unknown as Row[]).filter((r) => r.clients && !r.clients.deleted_at);
  const primary = live.find((r) => r.is_primary)?.clients ?? null;
  if (primary) return primary;
  if (legacyClientId) {
    const { data } = await db
      .from("clients")
      .select("id, name, full_name, email, user_id, deleted_at")
      .eq("id", legacyClientId)
      .maybeSingle();
    if (data && !data.deleted_at) return data as ClientLite;
  }
  return live[0]?.clients ?? null;
}

function projectLabelOf(project: { project_name?: string | null; property_address?: string | null }): string {
  const address = project.property_address?.trim();
  if (address) return address.split(",")[0]!.trim() || address;
  return project.project_name?.trim() || "your project";
}

export async function loadDeliverySummary(businessId: string, projectId: string): Promise<DeliverySummary | null> {
  const db = await createTenantServiceClient(businessId);
  const { data: project } = await db
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) return null;

  const [{ data: media }, { data: tours }, { data: models }, { data: payments }, versionMap, settings, client] =
    await Promise.all([
      db.from("media_assets").select("id, media_type, visibility").eq("project_id", projectId),
      db.from("tours").select("*").eq("project_id", projectId),
      db.from("project_3d_models").select("*").eq("project_id", projectId),
      db.from("payments").select("id, amount, status").eq("project_id", projectId),
      loadVideoReviewVersionMap(db, projectId),
      getAppSettings(businessId),
      loadPrimaryClient(db, projectId, (project.client_id as string | null) ?? null),
    ]);

  const sections = mediaSectionsFromProject(project);
  const visibleMedia = filterMediaByClientSections(
    filterClientMedia(filterMediaForVideoReviewDelivery((media ?? []) as { id: string; media_type: string; visibility: string }[], versionMap, false) as never[]),
    sections,
    false
  ) as { media_type: string }[];
  const visibleTours = filterToursByClientSections(filterClientTours((tours ?? []) as never[]), sections, false);
  const visibleModels = filterModelsByClientSections(filterClientModels((models ?? []) as never[]), sections, false);
  const counts = {
    photos: visibleMedia.filter((m) => m.media_type === "photo").length,
    videos: visibleMedia.filter((m) => m.media_type === "video").length,
    documents: visibleMedia.filter((m) => m.media_type === "document").length,
    tours: visibleTours.length,
    models: visibleModels.length,
  };

  // Required open payment links only; Marketing Kit add-ons never hold downloads.
  const optional = await loadMarketingPaymentLinks(businessId, [projectId]).catch(() => ({}));
  const open = ((payments ?? []) as { id: string; amount: number; status: string }[]).filter(
    (p) => (p.status === "pending" || p.status === "sent") && !(p.id in optional)
  );
  const dueCents = sections.payments ? open.reduce((s, p) => s + (p.amount ?? 0), 0) : 0;

  const status = normalizeStatus(project.status as string);
  const requireDelivered = effectiveRequireDeliveredForDownloads(
    settings.payments.requireDeliveredForDownloads,
    (project as { client_download_access?: unknown }).client_download_access
  );
  const downloadsUnlocked = resolveProjectDownloadAllowed({ projectStatus: status, isAdmin: false, requireDeliveredForDownloads: requireDelivered });

  let clientIssue: DeliveryClientIssue = null;
  if (!client) clientIssue = "no_client";
  else if (!client.email?.trim()) clientIssue = "no_email";
  else {
    const probe = await issueClientAccessUrl({ businessId, clientId: client.id, projectId });
    if (!probe.ok && (probe.reason === "business_login" || probe.reason === "foreign_login")) clientIssue = probe.reason;
  }

  const [{ data: sentRow }, { data: openedRow }] = await Promise.all([
    db
      .from("activity_logs")
      .select("created_at, metadata")
      .eq("project_id", projectId)
      .eq("activity_type", PROJECT_DELIVERY_SENT_ACTIVITY)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db
      .from("activity_logs")
      .select("created_at")
      .eq("project_id", projectId)
      .eq("activity_type", CLIENT_LINK_OPENED_ACTIVITY)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const total = counts.photos + counts.videos + counts.documents + counts.tours + counts.models;
  return {
    projectId,
    projectLabel: projectLabelOf(project),
    status,
    statusLabel: getStatusLabel(status),
    client: client
      ? { id: client.id, name: client.full_name?.trim() || client.name?.trim() || client.email || "Client", email: client.email }
      : null,
    clientIssue,
    media: { ...counts, total },
    dueCents,
    openPaymentCount: sections.payments ? open.length : 0,
    requireDelivered,
    downloadsUnlocked,
    canMarkDelivered: !downloadsUnlocked && dueCents === 0 && status !== "delivered",
    suggestMarkDelivered:
      !downloadsUnlocked &&
      dueCents === 0 &&
      total > 0 &&
      ["shoot_complete_editing", "ready_for_review", "awaiting_payment"].includes(status),
    payUnlocksDownloads: settings.workflow.payments.autoMoveOnStripePaid !== false,
    lastSent: sentRow
      ? {
          at: sentRow.created_at as string,
          to: ((sentRow.metadata as { email?: string } | null)?.email as string | undefined) ?? null,
        }
      : null,
    lastOpenedAt: (openedRow?.created_at as string | undefined) ?? null,
  };
}

function mediaPhrase(m: DeliverySummary["media"]): string {
  const parts: string[] = [];
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (m.photos) parts.push(plural(m.photos, "photo", "photos"));
  if (m.videos) parts.push(plural(m.videos, "video", "videos"));
  if (m.tours) parts.push(plural(m.tours, "virtual tour", "virtual tours"));
  if (m.models) parts.push(plural(m.models, "3D model", "3D models"));
  if (m.documents) parts.push(plural(m.documents, "file", "files"));
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1]}`;
}

/** What the email (and the dialog preview) tells the client to do next. */
export function deliveryEmailCopy(
  summary: DeliverySummary,
  opts: { businessName: string; firstName?: string | null; downloadsWillUnlock: boolean }
): { subject: string; title: string; body: string; ctaLabel: string; secondaryInfo: string } {
  const greeting = opts.firstName ? `Hi ${opts.firstName}, ` : "";
  const what = mediaPhrase(summary.media);
  const ready = what ? `your ${what} for ${summary.projectLabel} ${summary.media.total === 1 ? "is" : "are"} ready` : `${summary.projectLabel} is ready`;
  const unlocked = summary.downloadsUnlocked || opts.downloadsWillUnlock;

  if (summary.dueCents > 0) {
    const amount = formatCurrency(summary.dueCents);
    return {
      subject: `Your media for ${summary.projectLabel} is ready`,
      title: "Your media is ready",
      body: `${greeting}${ready}. ${
        unlocked
          ? `You can view and download everything now. There's a balance of ${amount} you can pay on the same page.`
          : summary.payUnlocksDownloads
            ? `Pay ${amount} on the project page and your full-resolution downloads unlock right away.`
            : `Take a look, and pay the ${amount} balance on the same page.`
      }`,
      ctaLabel: unlocked ? "View & Download" : `View & Pay ${amount}`,
      secondaryInfo: `No account or password needed — the button signs you in on any device. Sent by ${opts.businessName}.`,
    };
  }
  return {
    subject: `Your media for ${summary.projectLabel} is ready`,
    title: "Your media is ready",
    body: `${greeting}${ready}. ${
      unlocked ? "View it online and download everything in one click." : "Take a look — downloads will be available once the project is complete."
    }`,
    ctaLabel: unlocked ? "View & Download" : "View My Media",
    secondaryInfo: `No account or password needed — the button signs you in on any device. Sent by ${opts.businessName}.`,
  };
}

export type DeliverResult =
  | { ok: true; url: string; sentTo?: string; sentAt?: string; summary: DeliverySummary }
  | { ok: false; status: number; error: string };

const ISSUE_COPY: Record<Exclude<DeliveryClientIssue, null>, string> = {
  no_client: "Add a client to this project first.",
  no_email: "Add an email address for this client first.",
  business_login: "This client's email is a business or team login, so it can't get a one-click link. Use a different email for the client.",
  foreign_login: "This client's email is linked to another business and can't get a one-click link here.",
};

/**
 * Send the delivery email (send=true) or just mint the link to copy (send=false).
 * markDelivered moves the project to Delivered first (only offered when nothing
 * is due and downloads are held by status) without the separate status email.
 */
export async function deliverProjectToClient(input: {
  businessId: string;
  projectId: string;
  actorId: string | null;
  send: boolean;
  markDelivered?: boolean;
  note?: string | null;
}): Promise<DeliverResult> {
  let summary = await loadDeliverySummary(input.businessId, input.projectId);
  if (!summary) return { ok: false, status: 404, error: "Project not found." };
  if (summary.clientIssue) return { ok: false, status: 400, error: ISSUE_COPY[summary.clientIssue] };
  const client = summary.client!;

  // Placeholder login (no password) so status emails keep reaching this client too.
  const facts = await ensureClientLoginPlaceholder(client.id, input.businessId);
  if (facts.foreign) return { ok: false, status: 409, error: ISSUE_COPY.foreign_login };

  const willMarkDelivered = Boolean(input.send && input.markDelivered && summary.canMarkDelivered);
  if (willMarkDelivered) {
    await setProjectStatus({
      projectId: input.projectId,
      status: "delivered",
      userId: input.actorId,
      manualOverride: true,
      notifyClient: false,
      activityDescription: "Marked Delivered while sending the project to the client",
    });
    summary = (await loadDeliverySummary(input.businessId, input.projectId)) ?? summary;
  }

  const ctaPath = `${projectPortalBasePath(input.projectId)}${summary.dueCents > 0 && !summary.downloadsUnlocked ? "?tab=pay#payments" : ""}`;
  const issued = await issueClientAccessUrl({
    businessId: input.businessId,
    clientId: client.id,
    projectId: input.projectId,
    path: ctaPath,
  });
  if (!issued.ok) return { ok: false, status: 400, error: "Couldn't create a link for this client. Check their email address." };
  if (!input.send) return { ok: true, url: issued.url, summary };

  const settings = await getAppSettings(input.businessId);
  const firstName = client.name.trim().split(/\s+/)[0] || null;
  const copy = deliveryEmailCopy(summary, {
    businessName: settings.business.businessName,
    firstName: firstName && !firstName.includes("@") ? firstName : null,
    downloadsWillUnlock: false,
  });
  const note = input.note?.trim().slice(0, 1000);

  const result = await sendBrandedEmail({
    businessId: input.businessId,
    to: issued.email,
    subject: copy.subject,
    title: copy.title,
    body: note ? `${copy.body}\n\n${note}` : copy.body,
    projectName: summary.projectLabel,
    secondaryInfo: copy.secondaryInfo,
    ctaLabel: copy.ctaLabel,
    ctaUrl: issued.url,
    emailType: "project_delivery",
    analytics: { emailType: "project_delivery", projectId: input.projectId },
  });
  if (!result.sent && !result.skipped) {
    return { ok: false, status: 502, error: result.error || "The email couldn't be sent. Try again, or copy the link instead." };
  }
  if (result.skipped && result.skipReason === "missing_api_key") {
    return { ok: false, status: 503, error: "Email sending isn't configured. Copy the link and send it yourself." };
  }
  if (result.skipped) {
    return { ok: false, status: 409, error: result.error || "The email was not sent. Copy the link and send it yourself." };
  }

  const sentAt = new Date().toISOString();
  await logProjectActivity(PROJECT_DELIVERY_SENT_ACTIVITY, `Project sent to ${client.name} (${issued.email})`, {
    businessId: input.businessId,
    projectId: input.projectId,
    clientId: client.id,
    userId: input.actorId,
    visibility: "admin",
    idempotencyKey: `delivery:${input.projectId}:${sentAt}`,
    metadata: { email: issued.email, dueCents: summary.dueCents, markedDelivered: willMarkDelivered, withNote: Boolean(note) },
  });

  return {
    ok: true,
    url: issued.url,
    sentTo: issued.email,
    sentAt,
    summary: { ...summary, lastSent: { at: sentAt, to: issued.email } },
  };
}
