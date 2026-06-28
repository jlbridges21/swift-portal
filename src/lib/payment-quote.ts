import type { Payment, ProjectQuote } from "@/lib/types";
import { getQuotePackageName } from "@/lib/quote-display";

export function getPaymentForQuote(payments: Payment[], quoteId: string): Payment | null {
  return payments.find((p) => p.quote_id === quoteId) ?? null;
}

export function canCreatePaymentFromQuote(quote: ProjectQuote): boolean {
  if (quote.quote_kind === "preliminary") return false;
  if (quote.title.startsWith("Preliminary Estimate")) return false;
  if (quote.total_cents <= 0) return false;
  return quote.status === "approved" || quote.status === "sent";
}

export function paymentDescriptionForQuote(quote: ProjectQuote, projectName?: string): string {
  const name = getQuotePackageName(quote);
  return projectName ? `${projectName} — ${name}` : name;
}
