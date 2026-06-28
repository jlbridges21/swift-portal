import type { ProjectQuote, QuoteLineItem, QuoteStatus } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export const ARCHIVED_QUOTE_NOTE = "Archived — superseded by a newer official proposal.";

export function isPreliminaryQuote(quote: ProjectQuote): boolean {
  return quote.quote_kind === "preliminary" || quote.title.startsWith("Preliminary Estimate");
}

export function isArchivedQuote(quote: ProjectQuote): boolean {
  return /archived.*superseded|superseded by a newer/i.test(quote.notes ?? "");
}

export function getQuoteRecencyTimestamp(quote: ProjectQuote): number {
  const ts = quote.updated_at || quote.created_at;
  return new Date(ts).getTime();
}

export function sortQuotesByRecency(quotes: ProjectQuote[]): ProjectQuote[] {
  return [...quotes].sort((a, b) => getQuoteRecencyTimestamp(b) - getQuoteRecencyTimestamp(a));
}

/** Non-archived quotes, newest first. */
export function getNonArchivedQuotes(quotes: ProjectQuote[]): ProjectQuote[] {
  return sortQuotesByRecency(quotes.filter((q) => !isArchivedQuote(q)));
}

const CLIENT_VISIBLE_OFFICIAL_STATUSES: QuoteStatus[] = ["sent", "approved", "changes_requested"];

/**
 * Single active estimate/proposal for a project.
 * Admin sees the newest non-archived quote (including drafts).
 * Client sees the newest client-visible official, otherwise the preliminary.
 */
export function getProjectActiveQuote(
  quotes: ProjectQuote[],
  audience: "admin" | "client"
): { quote: ProjectQuote; kind: "preliminary" | "official" } | null {
  const active = getNonArchivedQuotes(quotes);
  if (!active.length) return null;

  if (audience === "admin") {
    const latest = active[0];
    return {
      quote: latest,
      kind: isPreliminaryQuote(latest) ? "preliminary" : "official",
    };
  }

  const visibleOfficial = active.filter(
    (q) => !isPreliminaryQuote(q) && CLIENT_VISIBLE_OFFICIAL_STATUSES.includes(q.status)
  );
  if (visibleOfficial.length) {
    return { quote: visibleOfficial[0], kind: "official" };
  }

  const preliminary = active.find((q) => isPreliminaryQuote(q));
  if (preliminary) return { quote: preliminary, kind: "preliminary" };

  return null;
}

export function hasOfficialProposal(quotes: ProjectQuote[]): boolean {
  return getNonArchivedQuotes(quotes).some(
    (q) => !isPreliminaryQuote(q) && q.status !== "draft"
  );
}

/** Newest non-archived official quote, or null. */
export function getLatestOfficialQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  return getNonArchivedQuotes(quotes).find((q) => !isPreliminaryQuote(q)) ?? null;
}

/** Newest non-archived preliminary quote, or null. */
export function getLatestPreliminaryQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  return getNonArchivedQuotes(quotes).find((q) => isPreliminaryQuote(q)) ?? null;
}

/** @deprecated Use getProjectActiveQuote or getLatestOfficialQuote */
export function getClientOfficialQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  const active = getProjectActiveQuote(quotes, "client");
  return active?.kind === "official" ? active.quote : getLatestOfficialQuote(quotes);
}

/** @deprecated Use getLatestPreliminaryQuote */
export function getPreliminaryQuote(quotes: ProjectQuote[]): ProjectQuote | null {
  return getLatestPreliminaryQuote(quotes);
}

/** @deprecated Use getProjectActiveQuote */
export function getMainOfficialQuote(quotes: ProjectQuote[], isAdmin: boolean): ProjectQuote | null {
  const active = getProjectActiveQuote(quotes, isAdmin ? "admin" : "client");
  if (!active || active.kind === "preliminary") {
    return isAdmin ? getLatestOfficialQuote(quotes) : null;
  }
  return active.quote;
}

/** @deprecated Use getProjectActiveQuote */
export function getClientActiveQuote(
  quotes: ProjectQuote[]
): { quote: ProjectQuote; kind: "preliminary" | "official" } | null {
  return getProjectActiveQuote(quotes, "client");
}

/** Server-side filter: clients only receive their single active proposal. */
export function getClientVisibleQuotes(
  quotes: ProjectQuote[],
  options?: { showPreliminaryToClients?: boolean }
): ProjectQuote[] {
  const active = getProjectActiveQuote(quotes, "client");
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
