import type { Payment, ProjectQuote } from "@/lib/types";
import { getQuotePackageName } from "@/lib/quote-display";
import { formatCurrency } from "@/lib/utils";

export function getPaymentForQuote(payments: Payment[], quoteId: string): Payment | null {
  return payments.find((p) => p.quote_id === quoteId) ?? null;
}

export function canCreatePaymentFromQuote(quote: ProjectQuote): boolean {
  if (quote.quote_kind === "preliminary") return false;
  if (quote.title.startsWith("Preliminary Estimate")) return false;
  if (quote.total_cents <= 0) return false;
  return quote.status === "approved" || quote.status === "sent";
}

/** Short Stripe product name (checkout title). */
export function paymentDescriptionForQuote(
  quote: ProjectQuote,
  projectName?: string,
  serviceType?: string
): string {
  const service = serviceType?.trim() || getQuotePackageName(quote);
  const label = projectName?.trim() ? `${projectName.trim()} · ${service}` : service;
  return label.slice(0, 250);
}

/**
 * Optional Stripe product description — plain text, kept short.
 * Stripe checkout does not render rich formatting; avoid long blocks.
 */
export function paymentProductDescriptionForQuote(
  quote: ProjectQuote,
  options?: { clientName?: string; projectName?: string; serviceType?: string }
): string | undefined {
  const service = options?.serviceType?.trim() || getQuotePackageName(quote);
  const total = formatCurrency(quote.total_cents);
  const parts = [
    options?.clientName ? `Client: ${options.clientName}` : null,
    options?.projectName ? `Project: ${options.projectName}` : null,
    `Service: ${service}`,
    `Total: ${total}`,
  ].filter(Boolean);

  const text = parts.join(" · ");
  return text.length > 0 ? text.slice(0, 250) : undefined;
}
