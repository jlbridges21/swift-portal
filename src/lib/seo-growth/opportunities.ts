import type { ContentAuditRow } from "@/lib/seo-growth/content-audit";
import { CONTENT_GAPS, GAP_ACTION_LABELS } from "@/lib/seo-growth/content-gaps";
import type { OrganicPageRow } from "@/lib/seo-growth/conversions";
import type { PageHealth, SiteCheck } from "@/lib/seo-growth/health";
import type { InventoryPage } from "@/lib/seo-growth/inventory";

/**
 * SEO Opportunity Intelligence (System 2). Pure: every opportunity is derived from inputs
 * passed in, and carries the evidence that produced it. No traffic, ranking, or conversion
 * gains are predicted.
 *
 * Evidence types:
 *  - google:    measured by Google (URL Inspection, Search Analytics)
 *  - analytics: measured by ShootPortal's first-party analytics
 *  - site:      our own crawl of the live site (facts about the page, not performance)
 *  - research:  public search research and product review; not validated by performance data
 *
 * Priority is an INTERNAL HEURISTIC, not a forecast:
 *   score = (impact × 2 + commercial value) × confidence ÷ effort
 *   impact 1–5 (rule severity), commercial value 0–3 (page role), confidence high 1 /
 *   medium 0.75 / low 0.5, effort low 1 / medium 1.5 / high 2.5.
 *   High ≥ 7, Medium ≥ 4, otherwise Low.
 */

export type EvidenceType = "google" | "analytics" | "site" | "research";
export type OppCategory = "indexing" | "technical" | "search-results" | "linking" | "content" | "refresh" | "conversion" | "gap" | "authority";
export type Level = "high" | "medium" | "low";

export type GscPageRow = { path: string; clicks: number; impressions: number; ctr: number | null; position: number | null };
export type GscPageQueryRow = GscPageRow & { query: string };
export type GscInput = { pages: GscPageRow[]; pageQueries: GscPageQueryRow[]; startDay: string; endDay: string };

export type Opportunity = {
  id: string;
  rule: string;
  title: string;
  category: OppCategory;
  evidenceType: EvidenceType;
  pages: string[];
  why: string;
  evidence: string[];
  benefit: string;
  businessRelevance: string;
  effort: Level;
  confidence: Level;
  impact: number;
  commercialValue: number;
  action: string;
  guidance: string[];
  score: number;
  priority: Level;
  /** For scheduled work (e.g. year rollover). */
  dueAt?: string;
};

export const CATEGORY_LABELS: Record<OppCategory, string> = {
  indexing: "Indexing",
  technical: "Technical",
  "search-results": "Search results",
  linking: "Internal links",
  content: "Content quality",
  refresh: "Content refresh",
  conversion: "Conversion",
  gap: "Content gap",
  authority: "Authority",
};

export const EVIDENCE_LABELS: Record<EvidenceType, string> = {
  google: "Measured by Google",
  analytics: "Measured on site",
  site: "Site audit",
  research: "Research-based",
};

const CONF_W: Record<Level, number> = { high: 1, medium: 0.75, low: 0.5 };
const EFFORT_W: Record<Level, number> = { low: 1, medium: 1.5, high: 2.5 };

export function priorityScore(impact: number, commercialValue: number, confidence: Level, effort: Level): { score: number; priority: Level } {
  const score = Math.round(((impact * 2 + commercialValue) * CONF_W[confidence] * 10) / EFFORT_W[effort]) / 10;
  return { score, priority: score >= 7 ? "high" : score >= 4 ? "medium" : "low" };
}

type Draft = Omit<Opportunity, "score" | "priority">;

function finalize(d: Draft): Opportunity {
  return { ...d, ...priorityScore(d.impact, d.commercialValue, d.confidence, d.effort) };
}

const fmt = (n: number) => n.toLocaleString("en-US");
const pct = (v: number | null) => (v === null ? "—" : `${(v * 100).toFixed(1)}%`);

/** Expected CTR floor by position, used only to flag unusually low CTR (heuristic). */
function lowCtr(position: number, ctr: number): boolean {
  if (position <= 3) return ctr < 0.05;
  if (position <= 10) return ctr < 0.015;
  return false;
}

export type OpportunityInput = {
  inventory: readonly InventoryPage[];
  health: PageHealth[] | null;
  siteChecks: SiteCheck[];
  content: ContentAuditRow[];
  gsc: GscInput | null;
  organic: OrganicPageRow[] | null;
  inspectedAt: string | null;
  now?: Date;
};

export function buildOpportunities(input: OpportunityInput): Opportunity[] {
  const out: Draft[] = [];
  const now = input.now ?? new Date();
  const byPath = new Map(input.inventory.map((p) => [p.path, p]));
  const health = input.health ?? [];
  const checkedOn = input.inspectedAt ? input.inspectedAt.slice(0, 10) : null;

  // ---------------------------------------------------------------- indexing (Google)
  const inspected = health.filter((h) => h.page.monitor && !["not_checked", "error"].includes(h.google.state));
  const notIndexed = inspected.filter((h) => ["waiting", "unknown_to_google"].includes(h.google.state));
  if (inspected.length && notIndexed.length) {
    const ranked = [...notIndexed].sort((a, b) => b.page.commercialValue - a.page.commercialValue || b.site.contextualInbound - a.site.contextualInbound);
    const home = health.find((h) => h.path === "/");
    const newestArticle = input.inventory.reduce<string | null>((m, p) => (p.article && (!m || p.article.publishedAt > m) ? p.article.publishedAt : m), null);
    const homeCrawl = home?.google.lastCrawlTime?.slice(0, 10) ?? null;
    const evidence = [
      `${notIndexed.length} of ${inspected.length} monitored pages are not in Google's index (URL Inspection${checkedOn ? `, ${checkedOn}` : ""}).`,
      `${notIndexed.filter((h) => h.google.state === "waiting").length} are "Discovered – currently not indexed" (known, not yet crawled); ${notIndexed.filter((h) => h.google.state === "unknown_to_google").length} are unknown to Google.`,
      "The site check found nothing blocking indexing on these pages: they return 200, self-canonical, no noindex, allowed by robots.txt, listed in the sitemap.",
    ];
    if (homeCrawl && newestArticle && homeCrawl < newestArticle)
      evidence.push(`Google last crawled the homepage on ${homeCrawl}, before the newest content was published (${newestArticle}), so it hasn't seen the homepage's links to it.`);
    out.push({
      id: "indexing:request-priority",
      rule: "not-indexed",
      title: "Get the most valuable pages crawled by Google",
      category: "indexing",
      evidenceType: "google",
      pages: ranked.slice(0, 12).map((h) => h.path),
      why: "A page can't earn search traffic until Google indexes it. On a new domain, Google crawls slowly and decides what to crawl first based on signals like internal and external links.",
      evidence,
      benefit: "Makes pages eligible to appear in search at all. Doesn't guarantee rankings.",
      businessRelevance: "Landing pages and calculators are the closest pages to a free trial, so they come first.",
      effort: "low",
      confidence: "high",
      impact: 5,
      commercialValue: 3,
      action: 'Use "Request indexing" in Search Console\'s URL Inspection tool, starting with the homepage and then the pages listed here in order (Google allows roughly 10 requests per day).',
      guidance: [
        "Search Console → URL Inspection → paste the URL → Request indexing. Start with the homepage so Google re-reads its links to the new pages.",
        "Do 8–10 per day, in the order listed. Re-check this dashboard after a few days.",
        "There is no supported bulk indexing API for normal pages, and resubmitting the sitemap repeatedly doesn't speed things up.",
        "Expect days to weeks. \"Discovered – currently not indexed\" on a weeks-old domain is normal and isn't an error.",
      ],
    });
  }

  for (const h of health) {
    const crit = h.issues.filter((i) => i.severity === "critical");
    if (!crit.length) continue;
    out.push({
      id: `technical:critical:${h.path}`,
      rule: "critical-issue",
      title: `Fix: ${crit[0]!.title.toLowerCase()} (${h.path})`,
      category: crit.some((i) => i.source === "google") ? "indexing" : "technical",
      evidenceType: crit.some((i) => i.source === "google") ? "google" : "site",
      pages: [h.path],
      why: "This stops the page from appearing in search, no matter how good its content is.",
      evidence: crit.map((i) => `${i.title}: ${i.detail}`),
      benefit: "Removes a blocker to indexing.",
      businessRelevance: h.page.commercialValue >= 2 ? "High-intent page close to a trial signup." : "Supporting page.",
      effort: "low",
      confidence: "high",
      impact: 5,
      commercialValue: h.page.commercialValue,
      action: crit[0]!.fix ?? "Inspect the page and correct the directive or response.",
      guidance: crit.map((i) => i.fix).filter((x): x is string => !!x),
    });
  }

  for (const h of health.filter((x) => x.google.state === "crawled_not_indexed")) {
    out.push({
      id: `indexing:crawled-not-indexed:${h.path}`,
      rule: "crawled-not-indexed",
      title: `Google crawled ${h.path} but didn't index it`,
      category: "indexing",
      evidenceType: "google",
      pages: [h.path],
      why: "Google read the page and decided it isn't worth indexing yet. This is usually about distinctness and usefulness, not a technical error.",
      evidence: [`Coverage: ${h.google.coverageState ?? "—"}; last crawl ${h.google.lastCrawlTime?.slice(0, 10) ?? "—"}.`],
      benefit: "Turns a page Google has seen into one that can rank.",
      businessRelevance: h.page.commercialValue >= 2 ? "High-intent page." : "Supporting page.",
      effort: "medium",
      confidence: "medium",
      impact: 4,
      commercialValue: h.page.commercialValue,
      action: "Make the page clearly more useful than similar pages (original examples, screenshots, a direct answer at the top), add links from indexed pages, then request indexing again.",
      guidance: [],
    });
  }

  // ---------------------------------------------------------------- search results (Google performance)
  if (input.gsc) {
    const range = `${input.gsc.startDay} to ${input.gsc.endDay}`;
    const queriesFor = (path: string) =>
      input.gsc!.pageQueries
        .filter((q) => q.path === path)
        .sort((a, b) => b.impressions - a.impressions)
        .slice(0, 5);
    for (const p of input.gsc.pages) {
      const inv = byPath.get(p.path);
      if (!inv || p.position === null || p.ctr === null) continue;
      if (p.impressions >= 100 && lowCtr(p.position, p.ctr)) {
        out.push({
          id: `search:low-ctr:${p.path}`,
          rule: "low-ctr",
          title: `People see ${p.path} in search but rarely click`,
          category: "search-results",
          evidenceType: "google",
          pages: [p.path],
          why: "The page already ranks. A title and description that match what searchers want can earn more clicks from the same position.",
          evidence: [
            `${fmt(p.impressions)} impressions, ${fmt(p.clicks)} clicks, CTR ${pct(p.ctr)} at average position ${p.position.toFixed(1)} (${range}).`,
            ...queriesFor(p.path).map((q) => `Query "${q.query}": ${fmt(q.impressions)} impr., pos. ${q.position?.toFixed(1) ?? "—"}`),
          ],
          benefit: "More clicks from rankings the page already has.",
          businessRelevance: inv.commercialValue >= 2 ? "High-intent page." : "Supporting page.",
          effort: "low",
          confidence: p.impressions >= 500 ? "high" : "medium",
          impact: 3,
          commercialValue: inv.commercialValue,
          action: "Rewrite the SEO title and meta description to reflect the top queries and the page's specific value. Keep the URL and H1 intent.",
          guidance: ["Change one page at a time and compare 28 days before and after (Google reports CTR with a 2–3 day delay)."],
        });
      }
      if (p.impressions >= 50 && p.position >= 8 && p.position <= 20) {
        out.push({
          id: `search:striking:${p.path}`,
          rule: "striking-distance",
          title: `${p.path} ranks just off page one`,
          category: "content",
          evidenceType: "google",
          pages: [p.path],
          why: "Pages at positions 8–20 get impressions but few clicks. Better coverage of the queries Google already associates with them is often the quickest content win.",
          evidence: [
            `Average position ${p.position.toFixed(1)}, ${fmt(p.impressions)} impressions (${range}).`,
            ...queriesFor(p.path).map((q) => `Query "${q.query}": ${fmt(q.impressions)} impr., pos. ${q.position?.toFixed(1) ?? "—"}`),
          ],
          benefit: "Potential move onto page one for queries the page already ranks for. Not guaranteed.",
          businessRelevance: inv.commercialValue >= 2 ? "High-intent page." : "Supporting page.",
          effort: "medium",
          confidence: "medium",
          impact: 4,
          commercialValue: inv.commercialValue,
          action: "Check whether the page answers each listed query directly. Add or sharpen sections, examples, and internal links for any that are missing.",
          guidance: [],
        });
      }
    }
    // Cannibalization: one query, several monitored pages with real impressions.
    const byQuery = new Map<string, GscPageQueryRow[]>();
    for (const q of input.gsc.pageQueries) if (q.impressions >= 10 && byPath.has(q.path)) (byQuery.get(q.query) ?? byQuery.set(q.query, []).get(q.query)!).push(q);
    for (const [query, rows] of byQuery) {
      if (rows.length < 2) continue;
      out.push({
        id: `search:overlap:${query}`,
        rule: "query-overlap",
        title: `Several pages compete for "${query}"`,
        category: "content",
        evidenceType: "google",
        pages: rows.map((r) => r.path),
        why: "When Google rotates between pages for one query, neither may rank as well as one clear page would.",
        evidence: rows.map((r) => `${r.path}: ${fmt(r.impressions)} impr., pos. ${r.position?.toFixed(1) ?? "—"} (${range})`),
        benefit: "Clearer signals about which page should rank.",
        businessRelevance: "Keeps the commercial page (if any) as the destination for vendor-intent queries.",
        effort: "medium",
        confidence: "medium",
        impact: 3,
        commercialValue: Math.max(...rows.map((r) => byPath.get(r.path)?.commercialValue ?? 0)),
        action: "Decide which page owns this intent (docs/SEO-KEYWORD-MAP.md), make the others link to it with that anchor, and narrow their focus.",
        guidance: [],
      });
    }
  }

  // ---------------------------------------------------------------- internal links (site)
  const weak = health.filter((h) => h.page.kind === "solution" && h.site.contextualInbound <= 3);
  if (weak.length) {
    out.push({
      id: "linking:landing-pages",
      rule: "weak-landing-links",
      title: `Link to ${weak.length} landing page${weak.length === 1 ? "" : "s"} from more articles`,
      category: "linking",
      evidenceType: "site",
      pages: weak.map((h) => h.path),
      why: "Landing pages convert best, but they're linked mainly from navigation. Contextual links from relevant articles help Google discover them and understand what they're about.",
      evidence: weak.map((h) => `${h.path}: in-content links from ${h.site.contextualInbound} page(s)${h.site.contextualInboundFrom.length ? ` (${h.site.contextualInboundFrom.join(", ")})` : ""}`),
      benefit: "Better discovery and topical signals for commercial pages.",
      businessRelevance: "Landing pages are where trials start.",
      effort: "low",
      confidence: "medium",
      impact: 3,
      commercialValue: 3,
      action: "Add one natural, descriptive link to each page from 2–3 closely related articles (use the page's primary keyword as anchor text).",
      guidance: weak.map((h) => {
        const candidates = input.inventory
          .filter((p) => p.kind === "article" && (p.cluster === h.page.cluster || h.page.expectedLinks.includes(p.path)) && !h.site.contextualInboundFrom.includes(p.path))
          .map((p) => p.path)
          .slice(0, 3);
        return `${h.path} ← ${candidates.length ? candidates.join(", ") : "pick the closest articles in its cluster"}`;
      }),
    });
  }
  const orphans = health.filter((h) => h.issues.some((i) => i.id === "site-orphan"));
  if (orphans.length) {
    out.push({
      id: "linking:orphans",
      rule: "orphan-pages",
      title: `${orphans.length} page${orphans.length === 1 ? " is" : "s are"} only reachable from navigation`,
      category: "linking",
      evidenceType: "site",
      pages: orphans.map((h) => h.path),
      why: "Pages linked only from the header or footer get weaker signals than pages linked from related content.",
      evidence: orphans.map((h) => `${h.path}: 0 in-content links`),
      benefit: "Easier discovery for readers and crawlers.",
      businessRelevance: "Hubs route visitors to tools and templates that lead to trials.",
      effort: "low",
      confidence: "medium",
      impact: 2,
      commercialValue: Math.max(...orphans.map((h) => h.page.commercialValue)),
      action: "Add a contextual link from at least one related article or landing page.",
      guidance: [],
    });
  }
  const missing = input.content.filter((c) => c.items.some((i) => i.id === "missing-links"));
  if (missing.length) {
    out.push({
      id: "linking:expected",
      rule: "missing-expected-links",
      title: `${missing.length} page${missing.length === 1 ? "" : "s"} don't link to their closest landing page or calculator`,
      category: "linking",
      evidenceType: "site",
      pages: missing.map((c) => c.path),
      why: "The registries say these pages belong together. A missing link is a missed next step for the reader.",
      evidence: missing.map((c) => `${c.path} → ${c.items.find((i) => i.id === "missing-links")!.detail}`),
      benefit: "Moves readers from research toward the product.",
      businessRelevance: "Each link points at a page one step from a trial.",
      effort: "low",
      confidence: "medium",
      impact: 3,
      commercialValue: 2,
      action: "Add the missing links where they fit naturally in the body copy.",
      guidance: [],
    });
  }

  // ---------------------------------------------------------------- refresh & accuracy (site)
  const broken = input.content.filter((c) => c.items.some((i) => i.id === "broken-external"));
  if (broken.length) {
    out.push({
      id: "refresh:broken-external",
      rule: "broken-external",
      title: "Replace broken source links",
      category: "refresh",
      evidenceType: "site",
      pages: broken.map((c) => c.path),
      why: "Broken citations make an article look unmaintained and remove the evidence behind a claim.",
      evidence: broken.map((c) => `${c.path}: ${c.items.find((i) => i.id === "broken-external")!.detail}`),
      benefit: "Trust and accuracy.",
      businessRelevance: "Comparison articles rely on cited sources for credibility.",
      effort: "low",
      confidence: "high",
      impact: 2,
      commercialValue: 2,
      action: "Find the current source page and update the link and claim, or remove the claim.",
      guidance: [],
    });
  }
  const rollover = input.content.filter((c) => c.items.some((i) => i.id === "year-rollover" || i.id === "year-stale"));
  if (rollover.length) {
    const stale = rollover.some((c) => c.items.some((i) => i.id === "year-stale"));
    const due = rollover.flatMap((c) => c.items).find((i) => i.dueAt)?.dueAt;
    out.push({
      id: "refresh:year",
      rule: "year-in-headline",
      title: stale ? `${rollover.length} headlines show last year` : `Plan the ${now.getUTCFullYear() + 1} refresh for ${rollover.length} dated headlines`,
      category: "refresh",
      evidenceType: "site",
      pages: rollover.map((c) => c.path),
      why: "Titles with a year are attractive while current and look stale once the year turns. The refresh is only honest if the facts are re-verified.",
      evidence: rollover.map((c) => `${c.path}: ${c.items.find((i) => i.id.startsWith("year-"))!.title}`),
      benefit: "Keeps click-through from search results, and keeps comparisons accurate.",
      businessRelevance: "Most are comparison articles read by people choosing software.",
      effort: "medium",
      confidence: "high",
      impact: stale ? 4 : 2,
      commercialValue: 2,
      action: "In mid-December, re-check competitor pricing and features, update facts and factsVerifiedAt, then change the year. Set updatedAt only for material changes.",
      guidance: ["Don't change publishedAt.", "Don't bump the year without re-verifying facts."],
      dueAt: stale ? undefined : due,
    });
  }
  const reminders = input.content.filter((c) => c.items.some((i) => i.id === "claim-reminders"));
  if (reminders.length) {
    out.push({
      id: "accuracy:reminders",
      rule: "claim-verification",
      title: "Confirm reminder emails are on in production, or soften the claim",
      category: "content",
      evidenceType: "site",
      pages: reminders.map((c) => c.path),
      why: "These pages mention reminders, some of them describing ShootPortal's own reminder emails. In code, those only send when WORKFLOW_REMINDER_ANCHOR_NOT_BEFORE is set in production (docs/TECHNICAL-SEO-AUDIT.md). The phrase check also matches competitor descriptions, so review each mention.",
      evidence: reminders.map((c) => `${c.path}: ${c.items.find((i) => i.id === "claim-reminders")!.title}`),
      benefit: "Accurate product claims. Trial users who expect reminders should get them.",
      businessRelevance: "Unmet expectations during a trial hurt activation.",
      effort: "low",
      confidence: "medium",
      impact: 3,
      commercialValue: 2,
      action: "Check the Vercel production env var. If it's unset and should stay that way, remove or qualify the reminder mentions.",
      guidance: [],
    });
  }

  // ---------------------------------------------------------------- conversion (first-party)
  for (const r of input.organic ?? []) {
    const inv = byPath.get(r.path);
    if (!inv) continue;
    if (r.organicEntrances >= 30 && r.organicSignupClicks === 0 && inv.commercialValue >= 1) {
      out.push({
        id: `conversion:no-clicks:${r.path}`,
        rule: "organic-no-cta",
        title: `Search visitors land on ${r.path} but none click to sign up`,
        category: "conversion",
        evidenceType: "analytics",
        pages: [r.path],
        why: "The page attracts search visitors but doesn't move them toward a trial.",
        evidence: [`${fmt(r.organicEntrances)} organic entrances, 0 signup CTA clicks, ${fmt(r.organicEngagement)} tool/template interactions (first-party analytics).`],
        benefit: "More trials from existing traffic.",
        businessRelevance: "Direct path to trial signups.",
        effort: "low",
        confidence: r.organicEntrances >= 200 ? "medium" : "low",
        impact: 3,
        commercialValue: inv.commercialValue,
        action: "Add a contextual CTA where the reader's problem is solved (not only at the end), matched to the page's intent.",
        guidance: ["Small samples: treat this as a prompt to review the page, not proof that it underperforms."],
      });
    }
  }

  // ---------------------------------------------------------------- authority (research)
  if (inspected.length && notIndexed.length / inspected.length >= 0.5) {
    out.push({
      id: "authority:links",
      rule: "earn-links",
      title: "Earn a few relevant links from other sites",
      category: "authority",
      evidenceType: "research",
      pages: ["/", "/tools", "/resources"],
      why: "On a new domain, links from established, relevant sites are one of the main ways Google discovers pages and decides to crawl more of them.",
      evidence: [
        `${notIndexed.length} of ${inspected.length} monitored pages aren't indexed yet, with no on-page blockers found.`,
        "Free calculators and templates are the kind of assets other photographers, educators, and communities link to.",
      ],
      benefit: "Faster crawling and more authority over time. Exact impact isn't measurable in advance.",
      businessRelevance: "Referral visitors from photography communities are also qualified prospects.",
      effort: "high",
      confidence: "medium",
      impact: 4,
      commercialValue: 2,
      action: "Pursue a handful of genuine placements: the partner program's members linking to the tools, software directories (G2, Capterra), drone and real estate photography communities, and podcast or guest appearances.",
      guidance: ["Avoid paid link schemes and mass directory submissions: they violate Google's spam policies."],
    });
  }

  // ---------------------------------------------------------------- content gaps (research)
  for (const g of CONTENT_GAPS) {
    out.push({
      id: `gap:${g.id}`,
      rule: "content-gap",
      title: `${GAP_ACTION_LABELS[g.action]}: ${g.topic}`,
      category: "gap",
      evidenceType: "research",
      pages: [g.target],
      why: g.why,
      evidence: g.evidence,
      benefit: "A new, distinct search intent the site doesn't answer yet. Demand isn't measured.",
      businessRelevance: g.productFit,
      effort: g.effort,
      confidence: g.confidence,
      impact: g.businessRelevance === "high" ? 3 : 2,
      commercialValue: g.businessRelevance === "high" ? 2 : 1,
      action: g.intent,
      guidance: [`Checked ${g.checkedAt}. Re-validate with Search Console queries once the site has impressions.`],
    });
  }

  // ---------------------------------------------------------------- site-wide failures
  for (const c of input.siteChecks) {
    if (c.ok !== false || c.severity === "info") continue;
    out.push({
      id: `technical:site:${c.id}`,
      rule: "site-check",
      title: c.title,
      category: "technical",
      evidenceType: c.id.startsWith("gsc-") ? "google" : "site",
      pages: ["/"],
      why: "Site-wide problems affect every page's discovery.",
      evidence: [c.detail],
      benefit: "Removes a site-wide blocker.",
      businessRelevance: "Affects all marketing pages.",
      effort: "low",
      confidence: "high",
      impact: c.severity === "critical" ? 5 : 3,
      commercialValue: 3,
      action: c.id === "external-links" ? "See the broken source links item." : "Fix the configuration and refresh this report.",
      guidance: [],
    });
  }

  return out
    .filter((d, i, all) => all.findIndex((x) => x.id === d.id) === i)
    .filter((d) => !(d.id === "technical:site:external-links" && out.some((x) => x.id === "refresh:broken-external")))
    .map(finalize)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}
