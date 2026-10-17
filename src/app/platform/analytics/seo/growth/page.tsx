import type { ReactNode } from "react";
import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadSeoGrowth, type SeoGrowthData } from "@/lib/seo-growth/data";
import { CONTENT_GAPS, GAP_ACTION_LABELS, NOT_PURSUED, RESEARCH_IDEAS, topicMap } from "@/lib/seo-growth/content-gaps";
import { KIND_LABELS } from "@/lib/seo-growth/inventory";
import { SEO_CHANGES } from "@/lib/seo-growth/changelog";
import { MAX_INSPECTIONS } from "@/lib/seo-growth/url-inspection";
import type { HealthStatus } from "@/lib/seo-growth/health";
import { KpiCard, Notice, Panel, fmtInt, fmtMoney, fmtPct } from "@/components/platform/analytics/ui";
import { TrendChart } from "@/components/platform/analytics/charts";
import { GROWTH_VIEWS, GrowthTabs, RefreshButton, type GrowthView } from "@/components/platform/seo-growth/nav";
import { HEALTH_COLORS, HEALTH_LABELS, HealthBadge, SampleBadge } from "@/components/platform/seo-growth/badges";
import { OpportunityList } from "@/components/platform/seo-growth/opportunity-list";
import { PageHealthTable } from "@/components/platform/seo-growth/page-health-table";
import { ContentTable } from "@/components/platform/seo-growth/content-table";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";
// A cold cache crawls the site and calls URL Inspection (~15–30s); warm loads are fast.
export const maxDuration = 60;

function when(iso: string | null | undefined) {
  if (!iso) return "never";
  return new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default async function SeoGrowthPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const view: GrowthView = GROWTH_VIEWS.some((v) => v.key === sp.view) ? (sp.view as GrowthView) : "overview";
  const data = await loadSeoGrowth();

  const reviews = Object.fromEntries(data.reviews);
  const rows = data.opportunities.map((o) => ({ ...o, review: reviews[o.id] ?? null }));
  const open = rows.filter((r) => (r.review?.status ?? "open") === "open");
  const needPages = data.health.filter((h) => h.page.monitor && (h.status === "critical" || h.status === "attention")).length;
  const contentItems = data.content.filter((c) => c.items.length).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">SEO growth engine</h2>
          <p className="text-xs text-muted">
            Site crawl {when(data.crawl?.finishedAt)} · Google inspection {data.inspection?.status === "ok" ? when(data.inspection.checkedAt) : data.gscConfigured ? "unavailable" : "not connected"} · cached up to 24h
          </p>
        </div>
        <RefreshButton />
      </div>
      <GrowthTabs view={view} counts={{ opportunities: open.length, indexing: needPages, content: contentItems }} />
      <div className="mt-6 space-y-6">
        {data.warnings.length ? <Notice tone="warn">Some sources could not be loaded: {data.warnings.join(" · ")}</Notice> : null}
        {view === "overview" ? <Overview data={data} open={open} /> : null}
        {view === "opportunities" ? <Opportunities data={data} rows={rows} /> : null}
        {view === "indexing" ? <Indexing data={data} /> : null}
        {view === "content" ? <Content data={data} /> : null}
        {view === "gaps" ? <Gaps /> : null}
        {view === "conversions" ? <Conversions data={data} /> : null}
        {view === "roadmap" ? <Roadmap data={data} rows={rows} /> : null}
      </div>
    </div>
  );
}

type Rows = Parameters<typeof OpportunityList>[0]["rows"];

// ---------------------------------------------------------------------------- overview

function Overview({ data, open }: { data: SeoGrowthData; open: Rows }) {
  const monitored = data.health.filter((h) => h.page.monitor);
  const inspected = monitored.filter((h) => !["not_checked", "error"].includes(h.google.state));
  const indexed = inspected.filter((h) => h.google.state === "indexed").length;
  const counts = (["healthy", "attention", "critical", "unknown"] as HealthStatus[]).map((s) => ({ s, n: monitored.filter((h) => h.status === s).length }));
  const high = open.filter((o) => o.priority === "high");
  const historyPoints = Object.values(
    Object.fromEntries(data.history.map((h) => [h.at.slice(0, 10), { day: h.at.slice(0, 10), indexed: h.indexed, waiting: h.waiting + h.unknown }]))
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Indexed by Google"
          accent
          value={inspected.length ? `${indexed} / ${inspected.length}` : "—"}
          hint={inspected.length ? "Monitored pages, per URL Inspection" : data.gscConfigured ? "Inspection unavailable" : "Search Console not connected"}
          definition="Google's own report for each URL. Being in the sitemap or loading fine does not mean a page is indexed."
        />
        <KpiCard label="Pages needing attention" value={fmtInt(monitored.filter((h) => h.status === "critical" || h.status === "attention").length)} hint={`${counts[2]!.n} critical`} />
        <KpiCard label="High-priority opportunities" value={fmtInt(high.length)} hint={`${open.length} open in total`} definition="Priority is an internal heuristic, not a traffic forecast." />
        <KpiCard
          label="Search clicks (28 days)"
          value={data.gscTotals ? fmtInt(data.gscTotals.clicks) : "—"}
          hint={data.gscTotals ? `${fmtInt(data.gscTotals.impressions)} impressions · ${data.gsc?.startDay} to ${data.gsc?.endDay}` : "Search Console not connected"}
          definition="Google Search Console, aggregated by Google with a 2–3 day delay."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Next best actions" description="Open opportunities, highest priority first">
          {open.length ? <OpportunityList rows={open.slice(0, 5)} origin={data.origin} compact /> : <p className="text-sm text-muted">No open opportunities.</p>}
          <Link href="/platform/analytics/seo/growth?view=opportunities" className="mt-4 inline-block text-sm font-semibold text-indigo-600 hover:underline">
            See all {open.length} opportunities →
          </Link>
        </Panel>
        <div className="space-y-6">
          <Panel title="Page health" description={`${monitored.length} monitored marketing pages`}>
            <div className="flex h-3 overflow-hidden rounded-full bg-subtle" role="img" aria-label={counts.map((c) => `${HEALTH_LABELS[c.s]}: ${c.n}`).join(", ")}>
              {counts.map((c) =>
                c.n ? <span key={c.s} style={{ width: `${(c.n / Math.max(1, monitored.length)) * 100}%`, background: HEALTH_COLORS[c.s] }} title={`${HEALTH_LABELS[c.s]}: ${c.n}`} /> : null
              )}
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              {counts.map((c) => (
                <li key={c.s} className="flex items-center justify-between gap-2">
                  <HealthBadge status={c.s} />
                  <span className="tabular-nums text-heading">{c.n}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-muted">
              &ldquo;Needs attention&rdquo; includes pages Google hasn&apos;t crawled yet. On a new domain that is expected, not a defect.
            </p>
          </Panel>
          <Panel title="Index coverage over time" description="Recorded each time Google inspection runs">
            {historyPoints.length >= 2 ? (
              <TrendChart
                points={historyPoints}
                height={160}
                series={[
                  { key: "indexed", label: "Indexed", color: "#10B981" },
                  { key: "waiting", label: "Not yet indexed", color: "#94A3B8" },
                ]}
              />
            ) : (
              <p className="text-sm text-muted">
                {historyPoints.length === 1
                  ? `First snapshot on ${historyPoints[0]!.day}: ${historyPoints[0]!.indexed} indexed. A trend appears after the next check.`
                  : "No snapshots yet. One is saved each time Google inspection runs (at most once a day)."}
              </p>
            )}
          </Panel>
        </div>
      </div>

      <Panel title="Data sources" description="Where every number on these pages comes from">
        <ul className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Source
            name="Google URL Inspection"
            ok={data.inspection?.status === "ok"}
            detail={data.inspection?.status === "ok" ? `${data.inspection.results.length} URLs · ${when(data.inspection.checkedAt)} (max ${MAX_INSPECTIONS}/run, 24h cache)` : data.gscConfigured ? "Configured, but the request failed" : "Not connected"}
            kind="Measured by Google"
          />
          <Source
            name="Google Search performance"
            ok={!!data.gscTotals}
            detail={data.gscTotals ? `${fmtInt(data.gscTotals.impressions)} impressions in 28 days. ${data.gscTotals.impressions < 1000 ? "Too little for keyword-level decisions yet." : ""}` : "Not connected"}
            kind="Measured by Google"
          />
          <Source
            name="Site crawl"
            ok={!!data.crawl}
            detail={data.crawl ? `${data.crawl.pages.length} pages, ${data.crawl.external.length} external links checked · ${when(data.crawl.finishedAt)}` : "Unavailable"}
            kind="Site audit"
          />
          <Source
            name="First-party analytics"
            ok={data.analyticsReady}
            detail={data.organic ? `${fmtInt(data.organic.summary.sessions)} sessions, ${fmtInt(data.organic.summary.organicSessions)} from search (90 days)` : "Analytics tables not installed"}
            kind="Measured on site"
          />
        </ul>
      </Panel>
    </>
  );
}

function Source({ name, ok, detail, kind }: { name: string; ok: boolean; detail: string; kind: string }) {
  return (
    <li className="rounded-xl border border-border p-3">
      <p className="flex items-center gap-2 font-medium text-heading">
        <span className={cn("h-2 w-2 rounded-full", ok ? "bg-emerald-500" : "bg-slate-300")} aria-hidden />
        {name}
      </p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{kind}</p>
    </li>
  );
}

// ---------------------------------------------------------------------------- opportunities

function Opportunities({ data, rows }: { data: SeoGrowthData; rows: Rows }) {
  return (
    <>
      <Notice>
        <strong>Data-backed</strong> items come from Google or ShootPortal&apos;s own analytics. <strong>Site audit</strong> items describe the pages themselves.{" "}
        <strong>Research-based</strong> items come from search research and aren&apos;t validated by performance data yet. No item predicts traffic or rankings.
      </Notice>
      <OpportunityList rows={rows} origin={data.origin} />
      <Panel title="How priority works" description="An internal heuristic for ordering work, not a forecast">
        <p className="text-sm text-muted">
          Score = (impact × 2 + commercial value) × confidence ÷ effort. <strong>Impact</strong> (1–5) reflects how much the issue limits search visibility or conversion.{" "}
          <strong>Commercial value</strong> (0–3) is the page&apos;s role: 3 for landing and core pages, 2 for calculators and comparison articles, 1 for guides and templates.{" "}
          <strong>Confidence</strong>: high 1, medium 0.75, low 0.5. <strong>Effort</strong>: low 1, medium 1.5, high 2.5. A score of 7 or more is high priority; 4 or more is medium.
        </p>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------- indexing

function Indexing({ data }: { data: SeoGrowthData }) {
  return (
    <>
      {data.inspection?.status !== "ok" ? (
        <Notice tone="warn">
          Google URL Inspection is {data.gscConfigured ? "unavailable right now" : "not connected"}. The table shows site checks only. A page passing site checks may still not be indexed.
        </Notice>
      ) : null}
      <Panel title="Site-wide checks">
        <ul className="divide-y divide-border">
          {data.checks.map((c) => (
            <li key={c.id} className="flex items-start gap-3 py-2 text-sm">
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", c.ok === true ? "bg-emerald-500" : c.ok === false ? (c.severity === "critical" ? "bg-rose-500" : "bg-amber-500") : "bg-slate-300")} aria-hidden />
              <span>
                <span className="font-medium text-heading">{c.title}</span>
                <span className="block break-words text-xs text-muted">{c.detail}</span>
              </span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel
        title="Pages"
        description="Google's index status (when connected) alongside what the site returns. Click a row for details and fixes."
      >
        <PageHealthTable rows={data.health.filter((h) => h.page.monitor)} />
      </Panel>
      <Panel title="About indexing">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>Being in the sitemap or returning a 200 doesn&apos;t mean Google indexed a page. Only the Google column reflects Google&apos;s index.</li>
          <li>&ldquo;Discovered, not crawled yet&rdquo; means Google knows the URL and hasn&apos;t fetched it. On a new domain this can take weeks.</li>
          <li>Use &ldquo;Request indexing&rdquo; in Search Console for individual important URLs (roughly 10 per day). There is no supported bulk indexing API for normal pages.</li>
        </ul>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------- content

function Content({ data }: { data: SeoGrowthData }) {
  const map = topicMap(data.inventory);
  return (
    <>
      <Panel title="Optimization checklist" description="Automated checks for landing pages, articles, calculators, and templates. Recommendations only: nothing is rewritten automatically.">
        <ContentTable rows={data.content} origin={data.origin} />
      </Panel>
      <Panel title="Topic map" description="Monitored content grouped by cluster (docs/SEO-KEYWORD-MAP.md)">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {map.map((c) => (
            <div key={c.cluster} className="rounded-xl border border-border p-3">
              <p className="text-sm font-semibold text-heading">{c.cluster}</p>
              <p className="mt-0.5 text-xs text-muted">
                {Object.entries(c.kinds)
                  .map(([k, n]) => `${n} ${KIND_LABELS[k as keyof typeof KIND_LABELS].toLowerCase()}${n === 1 ? "" : "s"}`)
                  .join(" · ")}
              </p>
              <ul className="mt-2 space-y-0.5">
                {c.pages.map((p) => (
                  <li key={p.path} className="truncate font-mono text-xs text-muted" title={p.title}>
                    {p.path}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------- gaps

function Gaps() {
  return (
    <>
      <Notice>
        Everything on this tab is <strong>research-based</strong>: public search results and product review, dated when checked. No search volumes are claimed. Re-validate
        against Search Console queries once the site has meaningful impressions.
      </Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        {CONTENT_GAPS.map((g) => (
          <article key={g.id} className="rounded-2xl border border-dashed border-violet-200 bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-violet-700">{GAP_ACTION_LABELS[g.action]}</p>
            <h3 className="mt-1 text-base font-semibold text-heading">{g.topic}</h3>
            <p className="mt-1 text-sm text-muted">{g.intent}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <Item label="Why">{g.why}</Item>
              <Item label="ShootPortal fit">{g.productFit}</Item>
              <Item label="Evidence">
                <ul className="list-disc space-y-0.5 pl-4">
                  {g.evidence.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </Item>
              <Item label="Target">
                <span className="font-mono text-xs">{g.target}</span>
              </Item>
            </dl>
            <p className="mt-3 text-xs text-muted">
              Effort {g.effort} · confidence {g.confidence} · business relevance {g.businessRelevance} · checked {g.checkedAt}
            </p>
          </article>
        ))}
      </div>
      <Panel title="Considered and not recommended" description="Kept here so they aren't proposed again">
        <ul className="space-y-2 text-sm">
          {NOT_PURSUED.map((n) => (
            <li key={n.topic}>
              <span className="font-medium text-heading">{n.topic}.</span> <span className="text-muted">{n.reason}</span>
            </li>
          ))}
        </ul>
      </Panel>
      <Panel title="Original research roadmap" description="Ideas for publishing genuinely new data. Nothing has been collected; no figures exist yet.">
        <div className="grid gap-4 md:grid-cols-2">
          {RESEARCH_IDEAS.map((r) => (
            <div key={r.id} className="rounded-xl border border-border p-4 text-sm">
              <p className="font-semibold text-heading">{r.title}</p>
              <p className="mt-1 text-muted">{r.question}</p>
              <dl className="mt-2 space-y-1.5">
                <Item label="Method">{r.method}</Item>
                <Item label="Ethics">{r.ethics}</Item>
                <Item label="Output">{r.output}</Item>
                <Item label="Needs">{r.dependsOn}</Item>
              </dl>
            </div>
          ))}
        </div>
      </Panel>
    </>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-muted">{children}</dd>
    </div>
  );
}

// ---------------------------------------------------------------------------- conversions

function Conversions({ data }: { data: SeoGrowthData }) {
  if (!data.organic) {
    return <Notice tone="warn">First-party analytics tables aren&apos;t available, so organic conversions can&apos;t be shown. Nothing here is estimated.</Notice>;
  }
  const { summary, rows } = data.organic;
  const active = rows.filter((r) => r.entrances > 0 || r.first.registrations > 0 || r.last.registrations > 0 || (r.assistedRegistrations ?? 0) > 0).sort((a, b) => b.organicEntrances - a.organicEntrances || b.entrances - a.entrances);
  return (
    <>
      <Notice>
        First-party analytics, {data.organicRange.startDay} to {data.organicRange.endDay}. &ldquo;Organic&rdquo; means visits the collector classified as coming from a search engine.
        Search Console clicks are counted by Google and are never joined to individual visitors, so the two numbers won&apos;t match.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Organic sessions" value={fmtInt(summary.organicSessions)} hint={`${fmtPct(summary.sessions ? summary.organicSessions / summary.sessions : null)} of ${fmtInt(summary.sessions)} sessions`} />
        <KpiCard label="Signup clicks from search" value={fmtInt(summary.organicSignupClicks)} hint={`${fmtInt(summary.organicVisitors)} organic visitors`} />
        <KpiCard label="Registrations (first touch search)" value={fmtInt(summary.organicFirstTouch)} hint={`Last touch: ${fmtInt(summary.organicLastTouch)} · of ${fmtInt(summary.registrations)} total`} />
        <KpiCard label="Unknown attribution" value={fmtInt(summary.unknownAttribution)} hint="Registrations with no usable visit record" definition="Consent declined, no tracked visit, or signup from another device. Never reassigned to a page." />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted">
        Sample size: <SampleBadge confidence={summary.confidence} />
        <span>Differences between pages aren&apos;t meaningful until each page has a few hundred organic sessions.</span>
      </div>
      <Panel title="Pages that bring search visitors" description="Entrances, signup clicks, and businesses credited to each page">
        {active.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="text-left text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-border">
                  <th className="py-2 pr-3 font-medium">Page</th>
                  <th className="px-2 py-2 text-right font-medium">All entrances</th>
                  <th className="px-2 py-2 text-right font-medium">Organic entrances</th>
                  <th className="px-2 py-2 text-right font-medium">Signup clicks</th>
                  <th className="px-2 py-2 text-right font-medium">Tool / template uses</th>
                  <th className="px-2 py-2 text-right font-medium" title="Businesses whose first visit was organic search landing on this page">First touch</th>
                  <th className="px-2 py-2 text-right font-medium" title="Businesses whose last visit before signup was organic search landing on this page">Last touch</th>
                  <th className="px-2 py-2 text-right font-medium" title="Registrations that viewed this article at any point (any channel)">Assisted</th>
                  <th className="px-2 py-2 text-right font-medium">Paid (FT)</th>
                  <th className="px-2 py-2 text-right font-medium">Revenue (FT)</th>
                  <th className="py-2 pl-2 font-medium">Sample</th>
                </tr>
              </thead>
              <tbody>
                {active.map((r) => (
                  <tr key={r.path} className="border-b border-border/60">
                    <td className="py-2 pr-3 font-mono text-xs text-heading">{r.path}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.entrances)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.organicEntrances)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.organicSignupClicks)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.organicEngagement)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.first.registrations)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.last.registrations)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{r.assistedRegistrations === null ? "—" : fmtInt(r.assistedRegistrations)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtInt(r.first.paid)}</td>
                    <td className="px-2 py-2 text-right tabular-nums">{fmtMoney(r.first.revenueCents)}</td>
                    <td className="py-2 pl-2">
                      <SampleBadge confidence={r.confidence} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No monitored page has recorded entrances or credited signups in this period yet.</p>
        )}
      </Panel>
      <Panel title="Reading these numbers">
        <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
          <li>First touch credits the page where a business&apos;s first tracked visit began; last touch, the visit just before signup. Assisted counts any article viewed before signup.</li>
          <li>Only visitors who allowed persistent analytics can be linked to a later signup. Everyone else stays &ldquo;unknown&rdquo;, and nothing is guessed.</li>
          <li>Revenue is subscription payments collected in the period from businesses credited to the page.</li>
          <li>The Acquisition and Blog tabs show the same data for all channels.</li>
        </ul>
      </Panel>
    </>
  );
}

// ---------------------------------------------------------------------------- roadmap

function Roadmap({ data, rows }: { data: SeoGrowthData; rows: Rows }) {
  const open = rows.filter((r) => (r.review?.status ?? "open") === "open");
  const now = open.filter((r) => r.priority === "high" && !r.dueAt);
  const next = open.filter((r) => r.priority === "medium" && !r.dueAt);
  const later = open.filter((r) => r.priority === "low" || r.dueAt);
  const done = rows.filter((r) => r.review?.status === "reviewed");
  return (
    <>
      <div className="grid gap-4 lg:grid-cols-3">
        <Column title="Now" hint="High priority" items={now} />
        <Column title="Next" hint="Medium priority" items={next} />
        <Column title="Later" hint="Low priority or scheduled" items={later} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Done in code" description="Shipped changes. Live checks reflect them after deploy and the next refresh.">
          {SEO_CHANGES.length ? (
            <ul className="space-y-2 text-sm">
              {SEO_CHANGES.map((c) => (
                <li key={c.title} className="rounded-lg border border-border p-3">
                  <p className="font-medium text-heading">{c.title}</p>
                  <p className="mt-0.5 text-muted">{c.detail}</p>
                  <p className="mt-1 font-mono text-xs text-muted">
                    {c.date} · {c.pages.join(", ")}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">Nothing recorded yet.</p>
          )}
          {done.length ? (
            <>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">Marked reviewed</p>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {done.map((r) => (
                  <li key={r.id}>✓ {r.title}</li>
                ))}
              </ul>
            </>
          ) : null}
        </Panel>
        <Panel title="Operating rhythm" description="A repeatable process for the next 1, 6, and 12 months">
          <ol className="space-y-3 text-sm">
            <li>
              <p className="font-medium text-heading">Weekly (15 minutes)</p>
              <p className="text-muted">Refresh checks. Request indexing for up to 10 priority URLs a day until they&apos;re indexed. Work the top item in &ldquo;Now&rdquo;.</p>
            </li>
            <li>
              <p className="font-medium text-heading">Monthly</p>
              <p className="text-muted">
                Review Search performance. Once pages earn impressions, low-CTR and near-page-one opportunities appear here automatically. Check broken links and the content checklist.
              </p>
            </li>
            <li>
              <p className="font-medium text-heading">Quarterly</p>
              <p className="text-muted">Re-verify competitor facts in comparison articles. Re-check content gaps against real queries. Ship one research-backed asset.</p>
            </li>
            <li>
              <p className="font-medium text-heading">Every December</p>
              <p className="text-muted">Refresh year-dated headlines, but only after re-verifying the facts.</p>
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted">Data so far: {data.gscTotals ? `${fmtInt(data.gscTotals.impressions)} search impressions in 28 days` : "Search Console not connected"}.</p>
        </Panel>
      </div>
    </>
  );
}

function Column({ title, hint, items }: { title: string; hint: string; items: Rows }) {
  return (
    <section className="rounded-2xl border border-border bg-subtle/40 p-3">
      <div className="mb-2 flex items-baseline justify-between px-1">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        <span className="text-xs text-muted">
          {hint} · {items.length}
        </span>
      </div>
      <ul className="space-y-2">
        {items.map((r) => (
          <li key={r.id} className="rounded-xl border border-border bg-card p-3 shadow-sm">
            <p className="text-sm font-medium text-heading">{r.title}</p>
            <p className="mt-1 text-xs text-muted">
              Effort {r.effort} · {r.evidenceType === "research" ? "research-based" : r.evidenceType === "site" ? "site audit" : "data-backed"}
              {r.dueAt ? ` · due ${r.dueAt}` : ""}
            </p>
          </li>
        ))}
        {!items.length ? <li className="px-1 py-4 text-center text-xs text-muted">Nothing here.</li> : null}
      </ul>
      <Link href="/platform/analytics/seo/growth?view=opportunities" className="mt-2 block px-1 text-xs font-semibold text-indigo-600 hover:underline">
        Open in Opportunities →
      </Link>
    </section>
  );
}
