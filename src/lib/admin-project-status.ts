import { normalizeStatus, type ProjectStatus } from "@/lib/constants";
import { getLatestOfficialQuote, isPreliminaryQuote } from "@/lib/quote-display";
import type { Payment, ProjectQuote } from "@/lib/types";

const DEBUG_QUOTE_STATUS = process.env.NODE_ENV === "development";

export type ClientRef = { name: string; company: string | null; deleted_at?: string | null } | null;

export interface AdminProjectBase {
  id?: string;
  status?: ProjectStatus | string;
  deleted_at?: string | null;
  clients?: ClientRef;
}

export interface ProjectQuoteMeta {
  latestOfficial: ProjectQuote | null;
  hasOfficialSent: boolean;
  isOfficialApproved: boolean;
}

export interface ProjectPaymentMeta {
  hasPaid: boolean;
  hasPaymentLinkSent: boolean;
}

export interface ProjectAdminContext {
  quote: ProjectQuoteMeta;
  payment: ProjectPaymentMeta;
}

const QUOTE_NEEDED_STATUSES: ProjectStatus[] = ["new_request", "quote_sent"];
const PAYMENT_LINK_SENT_STATUSES = new Set<Payment["status"]>(["sent", "pending", "paid"]);

export function isActiveProject(project: AdminProjectBase): boolean {
  if (project.deleted_at) return false;
  if (project.clients?.deleted_at) return false;
  return true;
}

export function isDeliveredOrComplete(project: AdminProjectBase): boolean {
  return normalizeStatus(project.status as string) === "delivered";
}

export function buildQuoteMetaForProject(
  projectId: string,
  quotes: ProjectQuote[]
): ProjectQuoteMeta {
  const projectQuotes = quotes.filter((q) => q.project_id === projectId);
  const latestOfficial = getLatestOfficialQuote(projectQuotes);
  const hasOfficialSent =
    latestOfficial !== null &&
    !isPreliminaryQuote(latestOfficial) &&
    latestOfficial.status === "sent";
  const isOfficialApproved = latestOfficial?.status === "approved";

  return { latestOfficial, hasOfficialSent, isOfficialApproved };
}

export function buildPaymentMetaForProject(
  projectId: string,
  payments: Pick<Payment, "project_id" | "status">[]
): ProjectPaymentMeta {
  const projectPayments = payments.filter((p) => p.project_id === projectId);
  const hasPaid = projectPayments.some((p) => p.status === "paid");
  const hasPaymentLinkSent = projectPayments.some((p) => PAYMENT_LINK_SENT_STATUSES.has(p.status));

  return { hasPaid, hasPaymentLinkSent };
}

export function buildProjectAdminContext(
  projectId: string,
  quotes: ProjectQuote[],
  payments: Pick<Payment, "project_id" | "status">[]
): ProjectAdminContext {
  return {
    quote: buildQuoteMetaForProject(projectId, quotes),
    payment: buildPaymentMetaForProject(projectId, payments),
  };
}

function logQuoteDecision(
  project: AdminProjectBase,
  included: boolean,
  bucket: string,
  reason: string
): void {
  if (!DEBUG_QUOTE_STATUS) return;
  console.debug(
    `[admin-project-status] ${bucket} ${included ? "INCLUDE" : "EXCLUDE"} project=${project.id} status=${project.status} — ${reason}`
  );
}

/**
 * Quotes dashboard card + Quote Sent pipeline filter.
 * Active projects in quote_sent with an official proposal sent, waiting on client approval.
 */
export function isQuoteWaitingForApproval(
  project: AdminProjectBase,
  ctx: ProjectAdminContext
): boolean {
  if (!isActiveProject(project)) {
    logQuoteDecision(project, false, "quotes-waiting", "inactive or deleted client");
    return false;
  }
  if (isDeliveredOrComplete(project)) {
    logQuoteDecision(project, false, "quotes-waiting", "delivered/completed");
    return false;
  }
  if (ctx.payment.hasPaid) {
    logQuoteDecision(project, false, "quotes-waiting", "already paid");
    return false;
  }
  if (ctx.quote.isOfficialApproved) {
    logQuoteDecision(project, false, "quotes-waiting", "quote already approved");
    return false;
  }

  const status = normalizeStatus(project.status as string);
  if (status !== "quote_sent") {
    logQuoteDecision(project, false, "quotes-waiting", `status is ${status}, not quote_sent`);
    return false;
  }

  if (!ctx.quote.hasOfficialSent) {
    logQuoteDecision(project, false, "quotes-waiting", "no official quote in sent status");
    return false;
  }

  logQuoteDecision(project, true, "quotes-waiting", "waiting for client approval");
  return true;
}

/** Case A — admin still needs to create/send/revise the official quote. */
export function needsQuoteSent(project: AdminProjectBase, ctx: ProjectAdminContext): boolean {
  if (!isActiveProject(project)) {
    logQuoteDecision(project, false, "needs-quote-sent", "inactive or deleted client");
    return false;
  }
  if (isDeliveredOrComplete(project)) {
    logQuoteDecision(project, false, "needs-quote-sent", "delivered/completed");
    return false;
  }
  if (ctx.payment.hasPaid) {
    logQuoteDecision(project, false, "needs-quote-sent", "already paid");
    return false;
  }
  if (isQuoteWaitingForApproval(project, ctx)) {
    logQuoteDecision(project, false, "needs-quote-sent", "already waiting for client approval");
    return false;
  }
  if (ctx.quote.isOfficialApproved) {
    logQuoteDecision(project, false, "needs-quote-sent", "quote already approved");
    return false;
  }

  const status = normalizeStatus(project.status as string);
  if (!QUOTE_NEEDED_STATUSES.includes(status)) {
    logQuoteDecision(project, false, "needs-quote-sent", `status ${status} not quote-needed`);
    return false;
  }

  const official = ctx.quote.latestOfficial;
  if (!official || isPreliminaryQuote(official)) {
    logQuoteDecision(project, true, "needs-quote-sent", "no official quote yet");
    return true;
  }

  if (official.status === "draft" || official.status === "changes_requested") {
    logQuoteDecision(project, true, "needs-quote-sent", `official quote is ${official.status}`);
    return true;
  }

  logQuoteDecision(project, false, "needs-quote-sent", `official quote status is ${official.status}`);
  return false;
}

/** Case B — client approved quote but payment link not sent yet. */
export function quoteApprovedButNeedsPaymentLink(
  project: AdminProjectBase,
  ctx: ProjectAdminContext
): boolean {
  if (!isActiveProject(project)) {
    logQuoteDecision(project, false, "needs-payment-link", "inactive or deleted client");
    return false;
  }
  if (isDeliveredOrComplete(project)) {
    logQuoteDecision(project, false, "needs-payment-link", "delivered/completed");
    return false;
  }
  if (ctx.payment.hasPaid) {
    logQuoteDecision(project, false, "needs-payment-link", "already paid");
    return false;
  }
  if (ctx.payment.hasPaymentLinkSent) {
    logQuoteDecision(project, false, "needs-payment-link", "payment link already sent");
    return false;
  }
  if (!ctx.quote.isOfficialApproved) {
    logQuoteDecision(project, false, "needs-payment-link", "quote not approved");
    return false;
  }

  logQuoteDecision(project, true, "needs-payment-link", "approved quote needs payment link");
  return true;
}

export function needsQuoteAttention(project: AdminProjectBase, ctx: ProjectAdminContext): boolean {
  return needsQuoteSent(project, ctx) || quoteApprovedButNeedsPaymentLink(project, ctx);
}

export function getQuoteAttentionReason(
  project: AdminProjectBase,
  ctx: ProjectAdminContext
): "needs_quote_sent" | "needs_payment_link" | null {
  if (needsQuoteSent(project, ctx)) return "needs_quote_sent";
  if (quoteApprovedButNeedsPaymentLink(project, ctx)) return "needs_payment_link";
  return null;
}

export function getQuoteAttentionLabelFromReason(
  reason: "needs_quote_sent" | "needs_payment_link"
): string {
  switch (reason) {
    case "needs_quote_sent":
      return "Finish & send quote";
    case "needs_payment_link":
      return "Send payment link";
  }
}

export function isAwaitingPayment(project: AdminProjectBase): boolean {
  if (!isActiveProject(project)) return false;
  return normalizeStatus(project.status as string) === "awaiting_payment";
}

export function isUpcomingShoot(
  project: AdminProjectBase & { id: string },
  upcomingProjectIds: Set<string>
): boolean {
  if (!isActiveProject(project)) return false;
  return upcomingProjectIds.has(project.id);
}
