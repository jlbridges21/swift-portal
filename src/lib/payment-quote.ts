import type { Payment, ProjectQuote } from "@/lib/types";
import {
  getQuotePackageName,
  getPaidLineItems,
  parseQuoteIncludes,
  getQuoteIntroText,
} from "@/lib/quote-display";
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

export function paymentDescriptionForQuote(
  quote: ProjectQuote,
  projectName?: string,
  serviceType?: string
): string {
  const name = getQuotePackageName(quote);
  const parts = [projectName, serviceType, name].filter(Boolean);
  return parts.join(" — ");
}

/** Rich Stripe product description built from the active proposal. */
export function paymentProductDescriptionForQuote(
  quote: ProjectQuote,
  options?: { clientName?: string; projectName?: string; serviceType?: string }
): string {
  const lines: string[] = [];

  if (options?.clientName) lines.push(`Client: ${options.clientName}`);
  if (options?.projectName) lines.push(`Project: ${options.projectName}`);
  if (options?.serviceType) lines.push(`Service: ${options.serviceType}`);

  const intro = getQuoteIntroText(quote.description);
  if (intro) lines.push(intro);

  const paidItems = getPaidLineItems(quote);
  if (paidItems.length > 0) {
    lines.push(
      paidItems.map((item) => `${item.description}: ${formatCurrency(item.amount_cents)}`).join("\n")
    );
  }

  const includes = parseQuoteIncludes(quote.description);
  if (includes.length) {
    lines.push(`Includes:\n${includes.map((i) => `• ${i}`).join("\n")}`);
  }

  if (quote.notes && !/archived|superseded/i.test(quote.notes)) {
    lines.push(quote.notes);
  }

  return lines.join("\n\n").slice(0, 500);
}
