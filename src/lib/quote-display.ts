import type { ProjectQuote, QuoteLineItem } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function isPreliminaryQuote(quote: ProjectQuote): boolean {
  return quote.quote_kind === "preliminary" || quote.title.startsWith("Preliminary Estimate");
}

export function hasOfficialProposal(quotes: ProjectQuote[]): boolean {
  return quotes.some((q) => !isPreliminaryQuote(q) && q.status !== "draft");
}

function getQuoteRecency(quote: ProjectQuote): number {
  const timestamps = [quote.sent_at, quote.approved_at, quote.created_at].filter(Boolean) as string[];
  return Math.max(...timestamps.map((t) => new Date(t).getTime()));
}

/** The single official proposal clients should see — always the newest non-draft official. */
export function getClientOfficialQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  const officials = quotes.filter((q) => !isPreliminaryQuote(q) && q.status !== "draft");
  if (!officials.length) return null;
  return [...officials].sort((a, b) => getQuoteRecency(b) - getQuoteRecency(a))[0];
}

export function getPreliminaryQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  return quotes.find((q) => isPreliminaryQuote(q)) ?? null;
}

/** Admin workflow: prefer actionable quotes, then latest. */
export function getMainOfficialQuote(quotes: ProjectQuote[], isAdmin: boolean): ProjectQuote | null {
  const official = quotes.filter((q) => !isPreliminaryQuote(q));
  const visible = isAdmin ? official : official.filter((q) => q.status !== "draft");

  if (!isAdmin) {
    return getClientOfficialQuote(quotes);
  }

  const changesRequested = visible.find((q) => q.status === "changes_requested");
  if (changesRequested) return changesRequested;

  const draft = visible.find((q) => q.status === "draft");
  if (draft) return draft;

  return getClientOfficialQuote(quotes);
}

/**
 * Clients see exactly one proposal:
 * - Newest official proposal when one exists (replaces preliminary entirely)
 * - Otherwise the preliminary estimate
 */
export function getClientActiveQuote(
  quotes: ProjectQuote[]
): { quote: ProjectQuote; kind: "preliminary" | "official" } | null {
  const official = getClientOfficialQuote(quotes);
  if (official) return { quote: official, kind: "official" };

  const preliminary = getPreliminaryQuote(quotes);
  if (preliminary) return { quote: preliminary, kind: "preliminary" };

  return null;
}

/** Server-side filter: clients only receive their single active proposal. */
export function getClientVisibleQuotes(
  quotes: ProjectQuote[],
  options?: { showPreliminaryToClients?: boolean }
): ProjectQuote[] {
  const active = getClientActiveQuote(quotes);
  if (!active) return [];
  if (options?.showPreliminaryToClients === false && active.kind === "preliminary") {
    return [];
  }
  return [active.quote];
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
    .replace(/^Preliminary Estimate — /i, "")
    .replace(/^Official Proposal — /i, "")
    .replace(/\s*\([^)]*revised[^)]*\)/i, "")
    .trim();
}

export function getQuotePriceDisplay(quote: ProjectQuote): {
  showPrice: boolean;
  priceLabel: string;
  priceCents: number;
} {
  const startingNote = quote.notes?.split("\n").find((line) => /starting at|per visit|custom/i.test(line));
  const isCustom =
    quote.total_cents === 0 ||
    getPaidLineItems(quote).length === 0 ||
    /custom proposal required/i.test(getQuotePackageName(quote));

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
