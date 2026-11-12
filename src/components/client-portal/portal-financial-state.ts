import type { Payment, ProjectQuote } from "@/lib/types";
import { isPaymentCovered } from "@/lib/payment-status";
import { getProjectActiveQuote } from "@/lib/quote-display";
import { paidCentsForQuote, quoteOutstandingBalanceCents } from "@/lib/payment-quote";
import { PRODUCT_LABEL, type MarketingProduct } from "@/lib/marketing/model";

/**
 * The client's money picture for one project, from the payment rows and shared proposals the
 * server already scoped to this viewer (hidden sections arrive as empty lists). One place decides
 * the presentation for the nav button, the gallery banner, the Estimate & Pay page and My Projects.
 *
 * Charges are split by what they are, not by description text:
 *   optional — payment rows created for a Marketing Kit add-on (linked via marketing_kit_purchases)
 *   required — every other payment row (proposal payments, deposits, manual project invoices)
 *
 *   due         — a required payment link is open (pending / sent): "$X Due", red.
 *   review      — a shared official proposal is waiting for the client's approval: blue.
 *   balance     — a shared proposal still has an unpaid balance but no open payment link yet.
 *   checkout    — the only open links are optional Marketing Kit add-ons: "$X Checkout", blue.
 *   processing  — everything requested is covered, but a bank (ACH) payment hasn't cleared.
 *   paid        — every requested payment is paid and no proposal balance remains: green.
 *   estimate    — only a preliminary estimate / an approved proposal with nothing requested yet.
 *   none        — nothing financial to show.
 *
 * Order matters: a required open payment always wins (also when add-ons are open too), so one
 * paid invoice never hides another that is still due, and an add-on never looks like the
 * project is unpaid. Presentation only — no amounts or statuses are changed.
 */
export type PortalFinancialKind = "due" | "balance" | "review" | "checkout" | "processing" | "paid" | "estimate" | "none";

export type OptionalCharge = { payment: Payment; products: MarketingProduct[]; label: string };

export type PortalFinancialState = {
  kind: PortalFinancialKind;
  /** Open required payment links (what the project still needs paid). */
  dueCents: number;
  openPayments: Payment[];
  /** Open optional Marketing Kit add-on links. */
  optionalDueCents: number;
  optionalCharges: OptionalCharge[];
  /** Remaining balance on the active shared proposal (deposit flows), if any. */
  balanceCents: number;
  /** Paid + processing, all charges. */
  coveredCents: number;
  /** Settled (paid) rows, newest first. */
  paidPayments: Payment[];
  processingPayments: Payment[];
  /** Failed / expired rows with no later open or covered row replacing them. */
  failedPayments: Payment[];
  activeQuote: { quote: ProjectQuote; kind: "preliminary" | "official" } | null;
  awaitingApproval: boolean;
};

const isOpen = (p: Payment) => p.status === "pending" || p.status === "sent";

export function optionalChargeLabel(products: MarketingProduct[]): string {
  return products.length ? products.map((p) => PRODUCT_LABEL[p]).join(" + ") : "Marketing Kit add-on";
}

export function resolvePortalFinancialState(
  quotes: ProjectQuote[],
  payments: Payment[],
  /** payment id → add-on products; payments listed here are optional Marketing Kit charges. */
  marketingPaymentLinks: Record<string, MarketingProduct[]> = {}
): PortalFinancialState {
  const live = payments.filter((p) => p.status !== "cancelled" && p.status !== "draft");
  const isOptional = (p: Payment) => Object.prototype.hasOwnProperty.call(marketingPaymentLinks, p.id);
  const byDue = (a: Payment, b: Payment) => (a.due_date ?? a.created_at).localeCompare(b.due_date ?? b.created_at);

  const openPayments = live.filter((p) => isOpen(p) && !isOptional(p)).sort(byDue);
  const optionalCharges = live
    .filter((p) => isOpen(p) && isOptional(p))
    .sort(byDue)
    .map((payment) => {
      const products = marketingPaymentLinks[payment.id] ?? [];
      return { payment, products, label: optionalChargeLabel(products) };
    });
  const paidPayments = live
    .filter((p) => p.status === "paid")
    .sort((a, b) => (b.paid_at ?? b.updated_at).localeCompare(a.paid_at ?? a.updated_at));
  const processingPayments = live.filter((p) => p.status === "processing");
  const coveredCents = live.filter((p) => isPaymentCovered(p.status)).reduce((s, p) => s + p.amount, 0);
  const dueCents = openPayments.reduce((s, p) => s + p.amount, 0);
  const optionalDueCents = optionalCharges.reduce((s, c) => s + c.payment.amount, 0);
  const failedPayments = live.filter(
    (p) =>
      !isOptional(p) &&
      (p.status === "failed" || p.status === "expired") &&
      !live.some(
        (o) =>
          o.id !== p.id &&
          o.created_at >= p.created_at &&
          (o.quote_id ?? null) === (p.quote_id ?? null) &&
          (isOpen(o) || isPaymentCovered(o.status))
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
  else if (optionalCharges.length > 0) kind = "checkout";
  else if (processingPayments.length > 0) kind = "processing";
  else if (coveredCents > 0) kind = "paid";
  else if (activeQuote) kind = "estimate";

  return {
    kind,
    dueCents,
    openPayments,
    optionalDueCents,
    optionalCharges,
    balanceCents,
    coveredCents,
    paidPayments,
    processingPayments,
    failedPayments,
    activeQuote,
    awaitingApproval,
  };
}
