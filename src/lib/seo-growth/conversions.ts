import {
  buildArticles,
  buildLandingFunnel,
  creditedChannel,
  isSignupCtaClick,
  type AttributionModel,
  type BusinessLifecycle,
  type LandingFunnelRow,
  type ReportInput,
} from "@/lib/analytics/aggregate";
import { isEngagementCtaId } from "@/lib/analytics/engagement";
import { inRange } from "@/lib/analytics/range";
import type { Channel } from "@/lib/analytics/channels";
import type { InventoryPage } from "@/lib/seo-growth/inventory";

/**
 * Organic conversion intelligence (System 5). Pure, and built entirely on the existing
 * first-party analytics math in aggregate.ts (no new collector, no new tracking).
 *
 * Search Console clicks are aggregated by Google and are never joined to visitors here.
 * "Organic" means sessions the first-party collector classified as search referrals.
 */

export const ORGANIC_CHANNELS: readonly Channel[] = ["google_organic", "bing_organic", "other_search"];
const isOrganic = (c: Channel | null | undefined) => !!c && ORGANIC_CHANNELS.includes(c);

/** How much to trust a comparison built on `n` observations. Deliberately conservative. */
export type SampleConfidence = "none" | "too_early" | "directional" | "reasonable";

export function sampleConfidence(n: number): SampleConfidence {
  if (n <= 0) return "none";
  if (n < 30) return "too_early";
  if (n < 200) return "directional";
  return "reasonable";
}

export const SAMPLE_LABELS: Record<SampleConfidence, string> = {
  none: "No data yet",
  too_early: "Too early to judge",
  directional: "Directional only",
  reasonable: "Reasonable sample",
};

export type OrganicPageRow = {
  path: string;
  title: string;
  kind: InventoryPage["kind"];
  /** All sessions that started on this page, any channel. */
  entrances: number;
  organicEntrances: number;
  organicVisitors: number;
  /** Signup CTA clicks on this page during organic sessions. */
  organicSignupClicks: number;
  /** Tool / template interactions on this page during organic sessions. */
  organicEngagement: number;
  /** Businesses registered in range whose first/last touch was organic search landing on this page. */
  first: LandingFunnelRow;
  last: LandingFunnelRow;
  /** Registrations in range that viewed this article at any point (any channel). Articles only. */
  assistedRegistrations: number | null;
  confidence: SampleConfidence;
};

export type OrganicSummary = {
  sessions: number;
  organicSessions: number;
  organicVisitors: number;
  organicSignupClicks: number;
  registrations: number;
  organicFirstTouch: number;
  organicLastTouch: number;
  /** Registrations in range with no usable attribution (consent declined, no tracked visit, etc.). */
  unknownAttribution: number;
  confidence: SampleConfidence;
};

function organicLifecycles(lifecycles: BusinessLifecycle[], model: AttributionModel) {
  return lifecycles.filter((l) => l.attribution?.status === "attributed" && isOrganic(creditedChannel(l, model)));
}

export function buildOrganicConversions(input: ReportInput, lifecycles: BusinessLifecycle[], inventory: readonly InventoryPage[]) {
  const organicSessionIds = new Set(input.sessions.filter((s) => isOrganic(s.channel)).map((s) => s.id));
  const organicInput: ReportInput = {
    ...input,
    sessions: input.sessions.filter((s) => organicSessionIds.has(s.id)),
    events: input.events.filter((e) => organicSessionIds.has(e.session_id)),
  };
  const paths = inventory.filter((p) => p.monitor).map((p) => p.path);
  const firstRows = new Map(buildLandingFunnel(organicInput, organicLifecycles(lifecycles, "first"), "first", paths).map((r) => [r.path, r]));
  const lastRows = new Map(buildLandingFunnel(organicInput, organicLifecycles(lifecycles, "last"), "last", paths).map((r) => [r.path, r]));
  const assisted = new Map(buildArticles(input, lifecycles).map((a) => [`/blog/${a.slug}`, a.assisted.registrations]));

  const allEntrances = new Map<string, number>();
  for (const s of input.sessions) allEntrances.set(s.landing_path, (allEntrances.get(s.landing_path) ?? 0) + 1);
  const engagement = new Map<string, number>();
  for (const e of organicInput.events) if (e.event_type === "cta_click" && isEngagementCtaId(e.cta_id)) engagement.set(e.path, (engagement.get(e.path) ?? 0) + 1);

  const rows: OrganicPageRow[] = inventory
    .filter((p) => p.monitor)
    .map((p) => {
      const first = firstRows.get(p.path)!;
      const last = lastRows.get(p.path)!;
      return {
        path: p.path,
        title: p.title,
        kind: p.kind,
        entrances: allEntrances.get(p.path) ?? 0,
        organicEntrances: first.entrances,
        organicVisitors: first.visitors,
        organicSignupClicks: first.ctaClicks,
        organicEngagement: engagement.get(p.path) ?? 0,
        first,
        last,
        assistedRegistrations: p.kind === "article" ? assisted.get(p.path) ?? 0 : null,
        confidence: sampleConfidence(first.entrances),
      };
    });

  const cohort = lifecycles.filter((l) => inRange(l.createdAt, input.range));
  const summary: OrganicSummary = {
    sessions: input.sessions.length,
    organicSessions: organicInput.sessions.length,
    organicVisitors: new Set(organicInput.sessions.map((s) => s.visitor_key)).size,
    organicSignupClicks: organicInput.events.filter(isSignupCtaClick).length,
    registrations: cohort.length,
    organicFirstTouch: cohort.filter((l) => l.attribution?.status === "attributed" && isOrganic(creditedChannel(l, "first"))).length,
    organicLastTouch: cohort.filter((l) => l.attribution?.status === "attributed" && isOrganic(creditedChannel(l, "last"))).length,
    unknownAttribution: cohort.filter((l) => l.attribution?.status !== "attributed").length,
    confidence: sampleConfidence(organicInput.sessions.length),
  };
  return { summary, rows };
}
