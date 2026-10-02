import type { Payment, ProjectQuote } from "@/lib/types";
import { getServicePaymentDescription } from "@/lib/service-templates";
import { formatCurrency } from "@/lib/utils";
import type { DepositMode, PaymentAutomationSettings } from "@/lib/workflow-settings";

export type DepositTerms = Pick<
  PaymentAutomationSettings,
  "depositMode" | "depositPercent" | "depositAmountCents"
>;

export type QuoteDepositColumns = {
  deposit_mode?: DepositMode | null;
  deposit_percent?: number | null;
  deposit_amount_cents?: number | null;
};

/**
 * Quote terms win when they were captured. NULL deposit_mode is a legacy quote
 * and still uses the business setting. 'none' is an explicit full-total proposal.
 */
export function resolveQuoteDepositTerms(
  quote: QuoteDepositColumns | null | undefined,
  business: DepositTerms
): DepositTerms {
  if (quote?.deposit_mode == null) {
    return {
      depositMode: business.depositMode,
      depositPercent: business.depositPercent,
      depositAmountCents: business.depositAmountCents,
    };
  }
  return {
    depositMode: quote.deposit_mode,
    depositPercent: quote.deposit_percent ?? 0,
    depositAmountCents: quote.deposit_amount_cents ?? 0,
  };
}

export function depositTermColumns(terms: DepositTerms): {
  deposit_mode: DepositMode;
  deposit_percent: number | null;
  deposit_amount_cents: number | null;
} {
  return {
    deposit_mode: terms.depositMode,
    deposit_percent: terms.depositMode === "percent" ? terms.depositPercent : null,
    deposit_amount_cents: terms.depositMode === "amount" ? terms.depositAmountCents : null,
  };
}

/** Explicit proposal terms from a request body. Null when the caller omitted them. */
export function parseExplicitDepositTerms(body: {
  deposit_mode?: unknown;
  deposit_percent?: unknown;
  deposit_amount_cents?: unknown;
}): DepositTerms | null {
  const mode = body.deposit_mode;
  if (mode !== "none" && mode !== "percent" && mode !== "amount") return null;
  const percent = typeof body.deposit_percent === "number" ? body.deposit_percent : Number(body.deposit_percent);
  const amount = typeof body.deposit_amount_cents === "number" ? body.deposit_amount_cents : Number(body.deposit_amount_cents);
  return {
    depositMode: mode,
    depositPercent: Number.isFinite(percent) ? Math.round(percent) : 0,
    depositAmountCents: Number.isFinite(amount) ? Math.round(amount) : 0,
  };
}

/** Same resolver as the charge, so the proposal text cannot disagree with the payment. */
export function quotePaymentTermsText(totalCents: number, terms: DepositTerms): string {
  const total = formatCurrency(totalCents);
  const charge = resolveDepositCharge(totalCents, terms);
  if (!charge.isDeposit) {
    return `Total ${total}. Full amount due on approval.`;
  }
  const due = formatCurrency(charge.amountCents);
  const remaining = formatCurrency(totalCents - charge.amountCents);
  if (terms.depositMode === "percent") {
    return `Total ${total}. ${terms.depositPercent}% deposit of ${due} due on approval. Remaining balance ${remaining}.`;
  }
  return `Total ${total}. Deposit of ${due} due on approval. Remaining balance ${remaining}.`;
}

export function isOpenPaymentStatus(status: string): boolean {
  return status === "pending" || status === "sent" || status === "draft";
}

export function paymentsForQuote(payments: Payment[], quoteId: string): Payment[] {
  return payments.filter((p) => p.quote_id === quoteId);
}

export function paidCentsForQuote(payments: Payment[], quoteId: string): number {
  return paymentsForQuote(payments, quoteId)
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);
}

/** Quote total minus paid amounts. A deposit leaves a balance even when its row is paid. */
export function quoteOutstandingBalanceCents(
  quote: Pick<ProjectQuote, "id" | "total_cents">,
  payments: Payment[]
): number {
  return Math.max(0, quote.total_cents - paidCentsForQuote(payments, quote.id));
}

export function openPaymentForQuote(payments: Payment[], quoteId: string): Payment | null {
  return paymentsForQuote(payments, quoteId).find((p) => isOpenPaymentStatus(p.status)) ?? null;
}

export function getPaymentForQuote(payments: Payment[], quoteId: string): Payment | null {
  return payments.find((p) => p.quote_id === quoteId) ?? null;
}

export function canCreatePaymentFromQuote(quote: ProjectQuote): boolean {
  if (quote.quote_kind === "preliminary") return false;
  if (quote.title.startsWith("Preliminary Estimate")) return false;
  if (quote.total_cents <= 0) return false;
  return quote.status === "approved" || quote.status === "sent";
}

/**
 * Deposit due for a quote. A configured deposit that is $0 or not strictly
 * below the quote total charges the full total instead.
 */
export function resolveDepositCharge(
  totalCents: number,
  settings: Pick<PaymentAutomationSettings, "depositMode" | "depositPercent" | "depositAmountCents">
): { amountCents: number; isDeposit: boolean; fallback: string | null } {
  if (totalCents <= 0 || settings.depositMode === "none") {
    return { amountCents: Math.max(0, totalCents), isDeposit: false, fallback: null };
  }

  let deposit = 0;
  if (settings.depositMode === "percent") {
    const pct = settings.depositPercent;
    if (!Number.isInteger(pct) || pct < 1 || pct > 99) {
      return {
        amountCents: totalCents,
        isDeposit: false,
        fallback: `Deposit percent ${String(pct)} is outside 1–99. Charging the full total.`,
      };
    }
    deposit = Math.round((totalCents * pct) / 100);
  } else {
    deposit = Math.round(settings.depositAmountCents);
  }

  if (deposit <= 0) {
    return {
      amountCents: totalCents,
      isDeposit: false,
      fallback: "Deposit was $0. Charging the full total.",
    };
  }
  if (deposit >= totalCents) {
    return {
      amountCents: totalCents,
      isDeposit: false,
      fallback: `Deposit of ${deposit} cents is not below the quote total of ${totalCents} cents. Charging the full total.`,
    };
  }
  return { amountCents: deposit, isDeposit: true, fallback: null };
}

export function depositPaymentDescription(depositCents: number, totalCents: number): string {
  return `Deposit of ${formatCurrency(depositCents)} due now. Full project total ${formatCurrency(totalCents)}.`.slice(0, 250);
}

export function fullPaymentDescription(totalCents: number): string {
  return `Payment in full. Project total ${formatCurrency(totalCents)}.`.slice(0, 250);
}

export function clientCanChoosePayInFull(options: {
  terms: DepositTerms;
  allowClientPayInFull: boolean;
  payment: Pick<Payment, "status">;
  quoteTotalCents: number;
  paidCents: number;
}): boolean {
  if (options.terms.depositMode === "none" || !options.allowClientPayInFull) return false;
  if (options.paidCents > 0) return false;
  if (!isOpenPaymentStatus(options.payment.status)) return false;
  if (options.quoteTotalCents <= 0) return false;
  return resolveDepositCharge(options.quoteTotalCents, options.terms).isDeposit;
}

/**
 * Checkout buttons for an open deposit.
 * Paying the full total requires allowClientPayInFull.
 * Returning to the deposit does not: a row sitting above the deposit still
 * offers "Pay the deposit instead" after that option is turned off.
 */
export function clientPayChoice(options: {
  terms: DepositTerms;
  allowClientPayInFull: boolean;
  payment: Pick<Payment, "amount" | "status">;
  quoteTotalCents: number;
  paidCents: number;
}): { depositCents: number; totalCents: number; rowIsFull: boolean; offerPayInFull: boolean } | null {
  if (options.terms.depositMode === "none") return null;
  if (options.paidCents > 0) return null;
  if (!isOpenPaymentStatus(options.payment.status)) return null;
  if (options.quoteTotalCents <= 0) return null;
  const charge = resolveDepositCharge(options.quoteTotalCents, options.terms);
  if (!charge.isDeposit) return null;
  const aboveDeposit = options.payment.amount > charge.amountCents;
  const offerPayInFull = clientCanChoosePayInFull(options);
  if (!offerPayInFull && !aboveDeposit) return null;
  return {
    depositCents: charge.amountCents,
    totalCents: options.quoteTotalCents,
    rowIsFull: options.payment.amount >= options.quoteTotalCents,
    offerPayInFull,
  };
}

function streetFromAddress(propertyAddress: string): string {
  return propertyAddress.split(",")[0]?.trim() || propertyAddress.trim();
}

/** Stripe checkout title: "Client Name - Street - Service" */
export function paymentLinkTitle(
  clientName: string,
  propertyAddress: string,
  serviceType: string
): string {
  const street = streetFromAddress(propertyAddress);
  return [clientName.trim(), street, serviceType.trim()].filter(Boolean).join(" - ").slice(0, 250);
}

/** @deprecated Use paymentLinkTitle */
export function paymentDescriptionForQuote(
  _quote: ProjectQuote,
  projectName?: string,
  serviceType?: string,
  clientName?: string,
  propertyAddress?: string
): string {
  if (clientName && propertyAddress && serviceType) {
    return paymentLinkTitle(clientName, propertyAddress, serviceType);
  }
  return (projectName?.trim() || serviceType?.trim() || "Project payment").slice(0, 250);
}

export function defaultPaymentLinkDescription(serviceType?: string): string {
  if (!serviceType?.trim()) {
    return "Professional aerial media package for the selected property.";
  }
  return getServicePaymentDescription(serviceType);
}
