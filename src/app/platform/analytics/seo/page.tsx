import { requireSuperAdminPage } from "@/lib/admin-access";
import { parseReportRange, addDays } from "@/lib/analytics/range";
import type { DashboardSearchParams } from "@/lib/analytics/dashboard";
import { loadSearchConsole } from "@/lib/analytics/search-console";
import { getAllArticles } from "@/lib/blog/registry";
import { AnalyticsPageHeader } from "@/components/platform/analytics/page-header";
import { BarList, TrendChart } from "@/components/platform/analytics/charts";
import { KpiCard, Notice, Panel, fmtInt, fmtPct } from "@/components/platform/analytics/ui";

export const dynamic = "force-dynamic";

const pos = (p: number | null) => (p === null ? "—" : p.toFixed(1));

export default async function SeoPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  await requireSuperAdminPage();
  const range = parseReportRange(await searchParams);
  const result = await loadSearchConsole(range.startDay, range.endDay);

  if (result.status === "not_configured") {
    return (
      <div className="space-y-6">
        <AnalyticsPageHeader title="SEO performance" range={range} />
        <Panel title="Google Search Console: Not connected" description="Nothing on this tab is estimated. It stays empty until Google data is connected.">
          <ol className="list-decimal space-y-2 pl-5 text-sm text-heading">
            <li>
              In Google Cloud, create (or pick) a project, enable the <strong>Google Search Console API</strong>, and create a{" "}
              <strong>service account</strong>. Create a JSON key for it.
            </li>
            <li>
              In Search Console, open the shootportal.app property → Settings → Users and permissions → <strong>Add user</strong>. Paste the service
              account&apos;s email and give it <strong>Restricted</strong> (read-only) permission.
            </li>
            <li>
              Add three server-only environment variables in Vercel and redeploy:
              <ul className="mt-1 list-disc space-y-1 pl-5 text-muted">
                <li>
                  <code className="text-xs">GSC_SITE_URL</code>: <code className="text-xs">sc-domain:shootportal.app</code> for a Domain property, or{" "}
                  <code className="text-xs">https://www.shootportal.app/</code> for a URL-prefix property (must match exactly).
                </li>
                <li>
                  <code className="text-xs">GSC_CLIENT_EMAIL</code>: the service account&apos;s <code className="text-xs">client_email</code>.
                </li>
                <li>
                  <code className="text-xs">GSC_PRIVATE_KEY</code>: the key&apos;s <code className="text-xs">private_key</code> (keep the <code className="text-xs">\n</code> line breaks).
                </li>
              </ul>
            </li>
          </ol>
          <p className="mt-4 text-xs text-muted">
            Access is read-only (scope <code>webmasters.readonly</code>). Tokens are minted server-side and never reach the browser. Results are cached
            for 6 hours, and Google&apos;s data lags 2–3 days.
          </p>
        </Panel>
      </div>
    );
  }

  if (result.status === "error") {
    return (
      <div className="space-y-6">
        <AnalyticsPageHeader title="SEO performance" range={range} />
        <Notice tone="warn">
          Search Console is configured but the request failed: {result.message}. Check that the service account was added to the property and that
          GSC_SITE_URL matches the property exactly.
        </Notice>
      </div>
    );
  }

  const { report } = result;
  const titles = new Map(getAllArticles().map((a) => [a.slug, a.title]));
  const articlePages = report.pages.filter((p) => p.articleSlug);
  const dayCount = report.daily.length;
  const filled = Array.from({ length: Math.max(range.days.length, 1) }, (_, i) => {
    const day = addDays(range.startDay, i);
    const d = report.daily.find((x) => x.date === day);
    return { day, clicks: d?.clicks ?? 0, impressions: d?.impressions ?? 0 };
  });

  return (
    <div className="space-y-6">
      <AnalyticsPageHeader title="SEO performance" range={range} />
      <Notice>
        Google Search Console data for <code className="text-xs">{result.siteUrl}</code>, aggregated by Google (Pacific Time days, 2–3 day delay;{" "}
        {dayCount} day{dayCount === 1 ? "" : "s"} available in this range). Search clicks will not equal first-party sessions.
      </Notice>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Search clicks" value={fmtInt(report.totals.clicks)} />
        <KpiCard label="Impressions" value={fmtInt(report.totals.impressions)} />
        <KpiCard label="Average CTR" value={fmtPct(report.totals.ctr)} />
        <KpiCard label="Average position" value={pos(report.totals.position)} />
      </div>
      <Panel title="Search trend" description="Daily clicks and impressions from Google Search">
        <TrendChart
          points={filled}
          series={[
            { key: "impressions", label: "Impressions", color: "#A855F7" },
            { key: "clicks", label: "Clicks", color: "#4F46E5" },
          ]}
        />
      </Panel>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Top queries" description="Site-wide, by clicks">
          <BarList
            metric="Clicks"
            rows={report.queries.slice(0, 15).map((q) => ({
              key: q.query,
              label: q.query,
              value: q.clicks,
              sub: `${fmtInt(q.impressions)} impr.`,
              details: [
                { label: "Impressions", value: q.impressions },
                { label: "CTR", value: q.ctr, type: "pct" as const },
                { label: "Avg. position", value: q.position, type: "decimal" as const },
              ],
            }))} empty="No queries reported for this range." />
        </Panel>
        <Panel title="Top landing pages" description="By clicks">
          <BarList
            metric="Clicks"
            rows={report.pages.slice(0, 15).map((p) => ({
              key: p.page,
              label: p.path,
              value: p.clicks,
              sub: `pos. ${pos(p.position)}`,
              details: [
                { label: "Impressions", value: p.impressions },
                { label: "CTR", value: p.ctr, type: "pct" as const },
                { label: "Avg. position", value: p.position, type: "decimal" as const },
              ],
            }))} empty="No pages reported for this range." />
        </Panel>
      </div>
      <Panel title="Blog articles in Google Search" description="Per-article performance and the queries Google associates with each URL">
        {articlePages.length ? (
          <div className="space-y-4">
            {articlePages.map((p) => (
              <details key={p.page} className="rounded-xl border border-border p-4">
                <summary className="flex cursor-pointer flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="font-medium text-heading">{titles.get(p.articleSlug!) ?? p.path}</span>
                  <span className="tabular-nums text-muted">
                    {fmtInt(p.clicks)} clicks · {fmtInt(p.impressions)} impr. · CTR {fmtPct(p.ctr)} · pos. {pos(p.position)}
                  </span>
                </summary>
                <ul className="mt-3 space-y-1 text-sm">
                  {(report.articleQueries[p.articleSlug!] ?? []).map((q) => (
                    <li key={q.query} className="flex justify-between gap-3 border-b border-border/60 py-1 last:border-0">
                      <span className="text-heading">{q.query}</span>
                      <span className="tabular-nums text-muted">
                        {fmtInt(q.clicks)} / {fmtInt(q.impressions)} · pos. {pos(q.position)}
                      </span>
                    </li>
                  ))}
                  {!(report.articleQueries[p.articleSlug!] ?? []).length ? <li className="text-muted">No query rows (Google omits rare or anonymized queries).</li> : null}
                </ul>
              </details>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No blog URLs appeared in Google Search for this range yet.</p>
        )}
      </Panel>
    </div>
  );
}
