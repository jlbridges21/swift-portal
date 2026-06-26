import type { ProjectQuote, QuoteLineItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function isPreliminaryQuote(quote: ProjectQuote): boolean {
  return quote.quote_kind === "preliminary" || quote.title.startsWith("Preliminary Estimate");
}

export function getPreliminaryQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  return quotes.find((q) => isPreliminaryQuote(q)) ?? null;
}

export function getMainOfficialQuote(quotes: ProjectQuote[], isAdmin: boolean): ProjectQuote | null {
  const official = quotes.filter((q) => !isPreliminaryQuote(q));
  const visible = isAdmin ? official : official.filter((q) => q.status !== "draft");
  const approved = visible.find((q) => q.status === "approved");
  if (approved) return approved;

  const latestSent = [...visible]
    .filter((q) => q.status === "sent")
    .sort(
      (a, b) =>
        new Date(b.sent_at ?? b.created_at).getTime() -
        new Date(a.sent_at ?? a.created_at).getTime()
    )[0];
  if (latestSent) return latestSent;

  const changesRequested = visible.find((q) => q.status === "changes_requested");
  if (changesRequested) return changesRequested;

  return visible.find((q) => q.status === "draft") ?? null;
}

/** Clients see exactly one proposal — official replaces preliminary when present. */
export function getClientActiveQuote(
  quotes: ProjectQuote[]
): { quote: ProjectQuote; kind: "preliminary" | "official" } | null {
  const official = getMainOfficialQuote(quotes, false);
  if (official) return { quote: official, kind: "official" };

  const preliminary = getPreliminaryQuote(quotes);
  if (preliminary) return { quote: preliminary, kind: "preliminary" };

  return null;
}

export function parseQuoteIncludes(description: string | null | undefined): string[] {
  if (!description) return [];

  const includesMatch = description.match(/Includes\s*\n([\s\S]*?)(?:\n\n|$)/i);
  if (includesMatch) {
    return includesMatch[1]
      .split("\n")
      .map((line) => line.replace(/^[\s•\-–]+/, "").trim())
      .filter(Boolean);
  }

  const bulletLines = description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("•") || line.startsWith("-"))
    .map((line) => line.replace(/^[\s•\-–]+/, "").trim())
    .filter(Boolean);

  return bulletLines;
}

export function getQuoteIntroText(description: string | null | undefined): string | null {
  if (!description) return null;
  const withoutIncludes = description.replace(/\n?\n?Includes\s*\n[\s\S]*/i, "").trim();
  if (!withoutIncludes) return null;
  if (withoutIncludes.toLowerCase().startsWith("includes")) return null;
  return withoutIncludes;
}

export function getPaidLineItems(quote: ProjectQuote): QuoteLineItem[] {
  return (quote.line_items as QuoteLineItem[]).filter((item) => item.amount_cents > 0);
}

export function getQuotePackageName(quote: ProjectQuote): string {
  const paid = getPaidLineItems(quote);
  if (paid.length === 1) return paid[0].description;
  return quote.title
    .replace(/^Preliminary Estimate — /, "")
    .replace(/^Official Proposal — /, "")
    .trim();
}

export function getQuotePriceDisplay(quote: ProjectQuote): {
  showPrice: boolean;
  priceLabel: string;
  priceCents: number;
} {
  const startingNote = quote.notes?.split("\n").find((line) => /starting at|per visit|custom/i.test(line));
  const isCustom = quote.total_cents === 0 || /custom proposal required/i.test(getQuotePackageName(quote));

  if (isCustom) {
    return {
      showPrice: false,
      priceLabel: startingNote || "Custom Proposal Required",
      priceCents: 0,
    };
  }

  if (startingNote) {
    return {
      showPrice: true,
      priceLabel: startingNote,
      priceCents: quote.total_cents,
    };
  }

  return {
    showPrice: true,
    priceLabel: formatCurrency(quote.total_cents),
    priceCents: quote.total_cents,
  };
}

export function formatIncludesBlock(includes: string[]): string {
  if (!includes.length) return "";
  return `Includes\n${includes.map((item) => `• ${item}`).join("\n")}`;
}
