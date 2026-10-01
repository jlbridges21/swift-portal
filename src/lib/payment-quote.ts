import type { Payment, ProjectQuote } from "@/lib/types";
import { getServicePaymentDescription } from "@/lib/service-templates";
import { formatCurrency } from "@/lib/utils";
import type { PaymentAutomationSettings } from "@/lib/workflow-settings";

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
  depositMode: PaymentAutomationSettings["depositMode"];
  depositPercent: number;
  depositAmountCents: number;
  allowClientPayInFull: boolean;
  payment: Pick<Payment, "status">;
  quoteTotalCents: number;
  paidCents: number;
}): boolean {
  if (options.depositMode === "none" || !options.allowClientPayInFull) return false;
  if (options.paidCents > 0) return false;
  if (!isOpenPaymentStatus(options.payment.status)) return false;
  if (options.quoteTotalCents <= 0) return false;
  return resolveDepositCharge(options.quoteTotalCents, options).isDeposit;
}

/**
 * Checkout buttons for an open deposit.
 * Paying the full total requires allowClientPayInFull.
 * Returning to the deposit does not: a row sitting above the deposit still
 * offers "Pay the deposit instead" after that option is turned off.
 */
export function clientPayChoice(options: {
  depositMode: PaymentAutomationSettings["depositMode"];
  depositPercent: number;
  depositAmountCents: number;
  allowClientPayInFull: boolean;
  payment: Pick<Payment, "amount" | "status">;
  quoteTotalCents: number;
  paidCents: number;
}): { depositCents: number; totalCents: number; rowIsFull: boolean; offerPayInFull: boolean } | null {
  if (options.depositMode === "none") return null;
  if (options.paidCents > 0) return null;
  if (!isOpenPaymentStatus(options.payment.status)) return null;
  if (options.quoteTotalCents <= 0) return null;
  const charge = resolveDepositCharge(options.quoteTotalCents, options);
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
