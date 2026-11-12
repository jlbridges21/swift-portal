import type { Payment, ProjectQuote } from "@/lib/types";
import { isPaymentCovered } from "@/lib/payment-status";
import { getProjectActiveQuote } from "@/lib/quote-display";
import { paidCentsForQuote, quoteOutstandingBalanceCents } from "@/lib/payment-quote";

/**
 * The client's money picture for one project, from the payment rows and shared proposals the
 * server already scoped to this viewer (hidden sections arrive as empty lists).
 *
 *   due         — at least one payment link is open (pending / sent): "$X Due", red.
 *   balance     — a shared proposal still has an unpaid balance but no open payment link yet.
 *   review      — a shared official proposal is waiting for the client's approval: blue.
 *   processing  — everything requested is covered, but a bank (ACH) payment hasn't cleared.
 *   paid        — every requested payment is paid and no proposal balance remains: green.
 *   estimate    — only a preliminary estimate / an approved proposal with nothing requested yet.
 *   none        — nothing financial to show.
 *
 * Order matters: an open payment always wins, so one paid invoice never hides another that
 * is still due.
 */
export type PortalFinancialKind = "due" | "balance" | "review" | "processing" | "paid" | "estimate" | "none";

export type PortalFinancialState = {
  kind: PortalFinancialKind;
  /** Sum of open payment links (what the client can pay right now). */
  dueCents: number;
  /** Open payment links, oldest due first. */
  openPayments: Payment[];
  /** Remaining balance on the active shared proposal (deposit flows), if any. */
  balanceCents: number;
  /** Paid + processing. */
  coveredCents: number;
  /** Settled (paid) rows, newest first. */
  paidPayments: Payment[];
  processingPayments: Payment[];
  /** Failed / expired rows with no later open or covered row replacing them. */
  failedPayments: Payment[];
  activeQuote: { quote: ProjectQuote; kind: "preliminary" | "official" } | null;
  awaitingApproval: boolean;
};

export function resolvePortalFinancialState(quotes: ProjectQuote[], payments: Payment[]): PortalFinancialState {
  const live = payments.filter((p) => p.status !== "cancelled" && p.status !== "draft");
  const openPayments = live
    .filter((p) => p.status === "pending" || p.status === "sent")
    .sort((a, b) => (a.due_date ?? a.created_at).localeCompare(b.due_date ?? b.created_at));
  const paidPayments = live
    .filter((p) => p.status === "paid")
    .sort((a, b) => (b.paid_at ?? b.updated_at).localeCompare(a.paid_at ?? a.updated_at));
  const processingPayments = live.filter((p) => p.status === "processing");
  const coveredCents = live.filter((p) => isPaymentCovered(p.status)).reduce((s, p) => s + p.amount, 0);
  const dueCents = openPayments.reduce((s, p) => s + p.amount, 0);
  const failedPayments = live.filter(
    (p) =>
      (p.status === "failed" || p.status === "expired") &&
      !live.some(
        (o) =>
          o.id !== p.id &&
          o.created_at >= p.created_at &&
          (o.quote_id ?? null) === (p.quote_id ?? null) &&
          (o.status === "pending" || o.status === "sent" || isPaymentCovered(o.status))
      )
  );

  const activeQuote = getProjectActiveQuote(quotes, "client");
  const official = activeQuote?.kind === "official" ? activeQuote.quote : null;
  const awaitingApproval = official?.status === "sent";
  const balanceCents =
    official && official.status === "approved" && paidCentsForQuote(payments, official.id) > 0
      ? quoteOutstandingBalanceCents(official, payments)
      : 0;

  let kind: PortalFinancialKind = "none";
  if (openPayments.length > 0) kind = "due";
  else if (awaitingApproval) kind = "review";
  else if (balanceCents > 0) kind = "balance";
  else if (processingPayments.length > 0) kind = "processing";
  else if (coveredCents > 0) kind = "paid";
  else if (activeQuote) kind = "estimate";

  return {
    kind,
    dueCents,
    openPayments,
    balanceCents,
    coveredCents,
    paidPayments,
    processingPayments,
    failedPayments,
    activeQuote,
    awaitingApproval,
  };
}
