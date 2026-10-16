import { requireSuperAdminPage } from "@/lib/admin-access";
import { buildChannels, buildCtaBreakdown, buildLandingFunnel, buildLandingPages } from "@/lib/analytics/aggregate";
import { SOLUTION_PAGES } from "@/lib/solutions";
import { loadDashboard, type DashboardSearchParams } from "@/lib/analytics/dashboard";
import { AnalyticsPageHeader } from "@/components/platform/analytics/page-header";
import { ModelToggle } from "@/components/platform/analytics/controls";
import { BarList } from "@/components/platform/analytics/charts";
import { CHANNEL_COLORS, Notice, Panel, channelLabel, fmtInt, fmtMoney, fmtPct } from "@/components/platform/analytics/ui";

export const dynamic = "force-dynamic";

export default async function AcquisitionPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const { range, loaded, lifecycles, model } = await loadDashboard(sp);
  const rows = buildChannels(loaded.current, lifecycles, model).sort(
    (a, b) => b.registrations - a.registrations || b.sessions - a.sessions
  );
  const totalSessions = rows.reduce((n, r) => n + r.sessions, 0);
  const solutionPaths = new Set<string>(SOLUTION_PAGES.map((p) => p.path));
  const landing = buildLandingPages(loaded.current, lifecycles)
    .filter((r) => r.entrances > 0 || r.pageviews > 0 || r.firstTouchRegistrations > 0 || r.lastTouchRegistrations > 0)
    .sort((a, b) => Number(solutionPaths.has(b.path)) - Number(solutionPaths.has(a.path)) || b.entrances - a.entrances || b.pageviews - a.pageviews)
    .slice(0, 30);
  const ctaRows = buildCtaBreakdown(loaded.current);
  const seoFunnel = buildLandingFunnel(loaded.current, lifecycles, model, SOLUTION_PAGES.map((p) => p.path));
  const seoTitle = new Map<string, string>(SOLUTION_PAGES.map((p) => [p.path, p.primaryKeyword]));

  const campaigns = new Map<string, { source: string; medium: string; campaign: string; sessions: number }>();
  for (const s of loaded.current.sessions) {
    if (!s.utm_source && !s.utm_campaign) continue;
    const key = `${s.utm_source}|${s.utm_medium}|${s.utm_campaign}`;
    const c = campaigns.get(key) ?? { source: s.utm_source ?? "—", medium: s.utm_medium ?? "—", campaign: s.utm_campaign ?? "—", sessions: 0 };
    c.sessions++;
    campaigns.set(key, c);
  }
  const referrers = new Map<string, number>();
  for (const s of loaded.current.sessions) if (s.referrer_host) referrers.set(s.referrer_host, (referrers.get(s.referrer_host) ?? 0) + 1);

  return (
    <div className="space-y-6">
      <AnalyticsPageHeader title="Acquisition sources" range={range} loaded={loaded}>
        <ModelToggle model={model} />
      </AnalyticsPageHeader>

      <Notice>
        Traffic columns count sessions that started from each channel in this range. Conversion columns credit businesses that registered in this
        range by their <strong>{model === "first" ? "first-touch" : "last-touch (non-direct)"}</strong> source. Revenue is subscription income collected
        in this range from businesses credited to the channel. <strong>Unknown</strong> means no tracking evidence; it is not Direct.
      </Notice>

      <Panel title="Channels" description="Sources are classified from UTM tags first, then the referrer, never guessed">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[56rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Channel</th>
                <th className="py-2 pr-3 text-right font-medium">Sessions</th>
                <th className="py-2 pr-3 text-right font-medium">Share</th>
                <th className="py-2 pr-3 text-right font-medium">Visitors</th>
                <th className="py-2 pr-3 text-right font-medium">CTA clicks</th>
                <th className="py-2 pr-3 text-right font-medium">Registrations</th>
                <th className="py-2 pr-3 text-right font-medium">Trials</th>
                <th className="py-2 pr-3 text-right font-medium">Activated</th>
                <th className="py-2 pr-3 text-right font-medium">Paid</th>
                <th className="py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.channel} className="border-b border-border/70 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="inline-flex items-center gap-2 font-medium text-heading">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ background: CHANNEL_COLORS[r.channel] }} aria-hidden />
                      {channelLabel(r.channel)}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.sessions)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-muted">{fmtPct(totalSessions ? r.sessions / totalSessions : null, 0)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.visitors)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.ctaClicks)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-heading">{fmtInt(r.registrations)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.trials)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.activated)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.paid)}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmtMoney(r.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Registrations by channel" description={`${model === "first" ? "First" : "Last"}-touch credit`}>
          <BarList
            metric={`Registrations (${model === "first" ? "first" : "last"} touch)`}
            rows={rows.filter((r) => r.registrations > 0).map((r) => ({
              key: r.channel,
              label: channelLabel(r.channel),
              value: r.registrations,
              color: CHANNEL_COLORS[r.channel],
              details: [
                { label: "Trials", value: r.trials },
                { label: "Paid", value: r.paid },
                { label: "Revenue", value: r.revenueCents, type: "money" as const },
              ],
            }))}
            empty="No registrations in this range."
          />
        </Panel>
        <Panel title="Top referring sites" description="Session-starting referrer hosts (own domain excluded)">
          <BarList
            metric="Sessions"
            rows={[...referrers.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([host, n]) => ({ key: host, label: host, value: n, color: "#10B981" }))}
            empty="No external referrers in this range."
          />
        </Panel>
      </div>

      <Panel title="Campaigns (UTM)" description="Sessions that arrived with UTM tags">
        {campaigns.size ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Source</th>
                  <th className="py-2 pr-3 font-medium">Medium</th>
                  <th className="py-2 pr-3 font-medium">Campaign</th>
                  <th className="py-2 text-right font-medium">Sessions</th>
                </tr>
              </thead>
              <tbody>
                {[...campaigns.values()].sort((a, b) => b.sessions - a.sessions).map((c) => (
                  <tr key={`${c.source}|${c.medium}|${c.campaign}`} className="border-b border-border/70 last:border-0">
                    <td className="py-2 pr-3 text-heading">{c.source}</td>
                    <td className="py-2 pr-3">{c.medium}</td>
                    <td className="py-2 pr-3">{c.campaign}</td>
                    <td className="py-2 text-right tabular-nums">{fmtInt(c.sessions)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">
            No UTM-tagged sessions yet. Tag links you share, for example{" "}
            <code className="rounded bg-subtle px-1 text-xs">?utm_source=instagram&amp;utm_medium=social&amp;utm_campaign=fall-launch</code>.
          </p>
        )}
      </Panel>
      <Panel
        title="SEO landing pages"
        description={`All Solutions pages, including ones with no traffic yet. Conversions use ${model === "first" ? "first" : "last"}-touch landing page credit`}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-2 pr-3 font-medium">Page</th>
                <th className="py-2 pr-3 text-right font-medium" title="Sessions that started on this page">Entrances</th>
                <th className="py-2 pr-3 text-right font-medium">Visitors</th>
                <th className="py-2 pr-3 text-right font-medium" title="Clicks on signup links on this page">Signup clicks</th>
                <th className="py-2 pr-3 text-right font-medium">Registrations</th>
                <th className="py-2 pr-3 text-right font-medium">Trials</th>
                <th className="py-2 pr-3 text-right font-medium" title="Created a first project">Activated</th>
                <th className="py-2 pr-3 text-right font-medium" title="Made a first subscription payment">Paid</th>
                <th className="py-2 text-right font-medium">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {seoFunnel.map((r) => (
                <tr key={r.path} className="border-b border-border/70 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="block font-medium text-heading">{seoTitle.get(r.path)}</span>
                    <span className="block text-xs text-muted">{r.path}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.entrances)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.visitors)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.ctaClicks)}</td>
                  <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-heading">{fmtInt(r.registrations)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.trials)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.activated)}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.paid)}</td>
                  <td className="py-2.5 text-right tabular-nums">{fmtMoney(r.revenueCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <Panel
        title="Landing pages"
        description="Where sessions started and which pages led to registrations. Solutions pages are listed first."
      >
        {landing.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[52rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Page</th>
                  <th className="py-2 pr-3 text-right font-medium" title="Sessions that started on this page">Entrances</th>
                  <th className="py-2 pr-3 text-right font-medium">Pageviews</th>
                  <th className="py-2 pr-3 text-right font-medium">Visitors</th>
                  <th className="py-2 pr-3 text-right font-medium">CTA clicks</th>
                  <th className="py-2 pr-3 text-right font-medium" title="Registrations whose first tracked visit landed here">Reg. (first touch)</th>
                  <th className="py-2 text-right font-medium" title="Registrations whose last non-direct visit landed here">Reg. (last touch)</th>
                </tr>
              </thead>
              <tbody>
                {landing.map((r) => (
                  <tr key={r.path} className="border-b border-border/70 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-heading">{r.path}</span>
                      {solutionPaths.has(r.path) ? (
                        <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">Solution</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.entrances)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.pageviews)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.visitors)}</td>
                    <td className="py-2.5 pr-3 text-right tabular-nums">{fmtInt(r.ctaClicks)}</td>
                    <td className="py-2.5 pr-3 text-right font-semibold tabular-nums text-heading">{fmtInt(r.firstTouchRegistrations)}</td>
                    <td className="py-2.5 text-right tabular-nums">{fmtInt(r.lastTouchRegistrations)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No tracked page visits in this range yet.</p>
        )}
      </Panel>

      <Panel title="Signup CTAs" description="Clicks on links to /signup, grouped by CTA id (seo:<page>:<placement>, blog:…, signup:<location>)">
        <BarList
          metric="Clicks"
          rows={ctaRows.slice(0, 15).map((c) => ({
            key: c.ctaId,
            label: c.ctaId,
            value: c.clicks,
            sub: c.location,
            details: [{ label: "Pages", value: c.pages }],
          }))}
          empty="No signup CTA clicks in this range."
        />
      </Panel>
    </div>
  );
}
