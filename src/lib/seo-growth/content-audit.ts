import type { CrawlResult } from "@/lib/seo-growth/crawl";
import type { InventoryPage } from "@/lib/seo-growth/inventory";

/**
 * Content refresh checklist per page (System 4). Pure. Flags only what the crawl or the
 * registries show; it never rewrites content. Each item says why it matters.
 */

export type ChecklistItem = {
  id: string;
  kind: "refresh" | "accuracy" | "linking" | "overlap" | "links";
  severity: "warning" | "info";
  title: string;
  why: string;
  detail?: string;
  /** Date this becomes relevant (for scheduled refreshes). */
  dueAt?: string;
};

export type ContentAuditRow = {
  path: string;
  title: string;
  kind: InventoryPage["kind"];
  cluster: string;
  wordCount: number | null;
  publishedAt: string | null;
  factsVerifiedAt: string | null;
  items: ChecklistItem[];
};

const FACTS_STALE_DAYS = 180;

function daysBetween(a: string, b: Date): number {
  return Math.floor((b.getTime() - Date.parse(`${a}T00:00:00Z`)) / 86_400_000);
}

/** Pages whose primary keywords are identical or nearly so (shared significant tokens). */
export function keywordOverlap(a: string, b: string): number {
  const stop = new Set(["for", "the", "and", "a", "to", "of", "how", "best", "software", "in", "vs"]);
  const toks = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t && !stop.has(t)));
  const ta = toks(a);
  const tb = toks(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const t of ta) if (tb.has(t)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

export function auditContent(input: { inventory: readonly InventoryPage[]; crawl: CrawlResult | null; now?: Date }): ContentAuditRow[] {
  const now = input.now ?? new Date();
  const year = now.getUTCFullYear();
  const crawlBy = new Map((input.crawl?.pages ?? []).map((p) => [p.path, p]));
  const brokenByPage = new Map<string, string[]>();
  for (const l of input.crawl?.external ?? []) {
    if (l.result !== "broken") continue;
    for (const s of l.sources) (brokenByPage.get(s) ?? brokenByPage.set(s, []).get(s)!).push(`${l.url} (${l.status ?? "unreachable"})`);
  }
  const content = input.inventory.filter((p) => ["article", "solution", "tool", "resource"].includes(p.kind));

  return content.map((page): ContentAuditRow => {
    const c = crawlBy.get(page.path)?.page ?? null;
    const items: ChecklistItem[] = [];
    const linked = new Set((c?.internalLinks ?? []).map((l) => l.path));

    // Year in the headline: stale once the year turns; schedule the refresh in December.
    for (const y of c?.headlineYears ?? []) {
      if (y < year)
        items.push({
          id: "year-stale",
          kind: "refresh",
          severity: "warning",
          title: `Headline still says ${y}`,
          why: "Searchers skip results that look out of date, and Google may rewrite stale titles.",
          detail: "Re-check facts and prices, then update the year in the title, H1, and SEO title. Set updatedAt only if the content materially changed.",
        });
      else if (y === year && now.getUTCMonth() >= 9)
        items.push({
          id: "year-rollover",
          kind: "refresh",
          severity: "info",
          title: `Headline says ${y}: plan a refresh before January`,
          why: `On January 1 the "${y}" label starts to look dated in search results.`,
          detail: "Re-verify competitor pricing and features in December, then update the year and factsVerifiedAt together.",
          dueAt: `${year}-12-15`,
        });
    }

    const a = page.article;
    if (a?.comparison && a.factsVerifiedAt && daysBetween(a.factsVerifiedAt, now) > FACTS_STALE_DAYS)
      items.push({
        id: "facts-stale",
        kind: "accuracy",
        severity: "warning",
        title: `Competitor facts last verified ${a.factsVerifiedAt}`,
        why: "Software prices and features change often; outdated comparisons erode trust and fairness.",
      });
    if (a?.comparison && !a.factsVerifiedAt)
      items.push({ id: "facts-undated", kind: "accuracy", severity: "info", title: "Comparison has no 'facts verified' date", why: "A visible verification date signals the comparison is maintained." });

    const broken = brokenByPage.get(page.path);
    if (broken?.length)
      items.push({
        id: "broken-external",
        kind: "links",
        severity: "warning",
        title: `${broken.length} broken external link(s)`,
        why: "Broken citations make the page look unmaintained and remove the evidence behind a claim.",
        detail: broken.join("; "),
      });

    const missing = page.expectedLinks.filter((p) => !linked.has(p));
    if (c && missing.length)
      items.push({
        id: "missing-links",
        kind: "linking",
        severity: page.kind === "article" ? "warning" : "info",
        title: `Doesn't link to ${missing.length} closely related page(s)`,
        why: "Registry relationships say these pages belong together; linking them helps readers and spreads authority to commercial pages.",
        detail: missing.join(", "),
      });

    if (c && page.kind === "article" && ["Pricing", "Drone business", "Real estate photography business", "Invoicing and payments"].includes(page.cluster) && ![...linked].some((p) => p.startsWith("/tools/")))
      items.push({
        id: "no-tool-link",
        kind: "linking",
        severity: "info",
        title: "No link to a free calculator or quote builder",
        why: "Readers researching pricing or starting a business are the most likely to use a calculator, which is one step from a trial.",
      });

    if (c?.mentions.reminders)
      items.push({
        id: "claim-reminders",
        kind: "accuracy",
        severity: "info",
        title: `Mentions reminders ${c.mentions.reminders}×: check the ones that describe ShootPortal`,
        why: "ShootPortal's workflow reminders only send when WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE is set in production. If it isn't, claims that ShootPortal sends reminders overstate the product. Mentions of competitors' reminders are fine.",
      });

    // Overlap: another monitored page targets a near-identical primary keyword.
    if (page.primaryKeyword) {
      for (const other of content) {
        if (other.path === page.path || !other.primaryKeyword) continue;
        const sameKind = (other.kind === "solution") === (page.kind === "solution");
        if (!sameKind || keywordOverlap(page.primaryKeyword, other.primaryKeyword) < 0.99) continue;
        items.push({
          id: `overlap-${other.path}`,
          kind: "overlap",
          severity: "warning",
          title: `Targets the same search as ${other.path}`,
          why: "Two pages of the same type chasing one query can split rankings. Give each a distinct intent or merge them.",
          detail: `"${page.primaryKeyword}" vs "${other.primaryKeyword}"`,
        });
      }
    }

    return {
      path: page.path,
      title: page.title,
      kind: page.kind,
      cluster: page.cluster,
      wordCount: c?.wordCount ?? null,
      publishedAt: a?.publishedAt ?? null,
      factsVerifiedAt: a?.factsVerifiedAt ?? null,
      items,
    };
  });
}
