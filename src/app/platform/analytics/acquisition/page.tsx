import { requireSuperAdminPage } from "@/lib/admin-access";
import { buildChannels } from "@/lib/analytics/aggregate";
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
            rows={rows.filter((r) => r.registrations > 0).map((r) => ({ key: r.channel, label: channelLabel(r.channel), value: r.registrations, color: CHANNEL_COLORS[r.channel] }))}
            empty="No registrations in this range."
          />
        </Panel>
        <Panel title="Top referring sites" description="Session-starting referrer hosts (own domain excluded)">
          <BarList
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
    </div>
  );
}
