import { CheckCircle2, XCircle } from "lucide-react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadAnalyticsDiagnostics, loadReport, excludedBusinessIds, includeTestModePayments, serviceRoleConfigured } from "@/lib/analytics/report-data";
import { buildLifecycles, buildOverview } from "@/lib/analytics/aggregate";
import { parseReportRange, reportingTimeZone } from "@/lib/analytics/range";
import { searchConsoleConfig } from "@/lib/analytics/search-console";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import { Notice, Panel, fmtInt } from "@/components/platform/analytics/ui";

export const dynamic = "force-dynamic";

function Status({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      {ok ? <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden /> : <XCircle className="h-4 w-4 text-rose-600" aria-hidden />}
      {children}
    </span>
  );
}

function ago(iso: string | null) {
  if (!iso) return "never";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  if (mins < 48 * 60) return `${Math.round(mins / 60)} h ago`;
  return `${Math.round(mins / 1440)} days ago`;
}

export default async function DiagnosticsPage() {
  await requireSuperAdminPage();
  const root = getPlatformRootDomain();
  const diag = await loadAnalyticsDiagnostics();
  const today = parseReportRange({ range: "today" });
  const report = await loadReport(today, null);
  const overview = buildOverview(report.current, buildLifecycles(report.current));

  const config: [string, React.ReactNode][] = [
    ["Accepted hosts", `${root}, www.${root}`],
    ["Environment", process.env.NODE_ENV],
    ["Service role key", <Status key="srk" ok={serviceRoleConfigured()}>{serviceRoleConfigured() ? "Configured" : "Missing"}</Status>],
    ["Localhost tracking", process.env.NEXT_PUBLIC_ANALYTICS_DEV === "1" && process.env.NODE_ENV !== "production" ? "Enabled (dev)" : "Disabled"],
    ["Reporting timezone", reportingTimeZone()],
    ["Retention", `${Math.max(30, Number(process.env.ANALYTICS_RETENTION_DAYS) || 395)} days`],
    ["Test-mode payments", includeTestModePayments() ? "Included" : "Excluded (live only)"],
    ["Excluded businesses", fmtInt(excludedBusinessIds().size)],
    ["Search Console", searchConsoleConfig() ? "Configured" : "Not connected"],
  ];

  return (
    <div className="space-y-6">
      <Notice>
        Health checks for the analytics pipeline. Only counts and timestamps are shown; no visitor-level records. Ignored events (bots, other hosts,
        rate limits) are never stored, so they can&apos;t be counted here. Check them in the browser instead: every response from{" "}
        <code className="text-xs">/api/analytics/collect</code> carries an <code className="text-xs">X-SP-Analytics</code> header (
        <code className="text-xs">stored</code>, <code className="text-xs">ignored_bot</code>, <code className="text-xs">ignored_host</code>,{" "}
        <code className="text-xs">rate_limited</code>, <code className="text-xs">store_error</code>), and store errors are logged on the server as{" "}
        <code className="text-xs">[analytics] collect store_error</code>.
      </Notice>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Collector configuration">
          <dl className="space-y-2 text-sm">
            {config.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium text-heading">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Database">
          <ul className="space-y-2 text-sm">
            {diag.tables.map((t) => (
              <li key={t.name} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
                <Status ok={t.ok}>
                  <code className="text-xs">{t.name}</code>
                </Status>
                <span className="text-right text-muted">{t.ok ? `${fmtInt(t.rows ?? 0)} rows` : t.error}</span>
              </li>
            ))}
          </ul>
          {diag.error ? <p className="mt-3 text-sm text-rose-700">Query error: {diag.error}</p> : null}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Recent activity" description="Last 24 hours (rolling)">
          <dl className="space-y-2 text-sm">
            {(
              [
                ["Latest event", `${diag.latestEventAt ?? "—"} (${ago(diag.latestEventAt)})`],
                ["Latest session", `${diag.latestSessionAt ?? "—"} (${ago(diag.latestSessionAt)})`],
                ["Latest signup attribution", `${diag.latestAttributionAt ?? "—"} (${ago(diag.latestAttributionAt)})`],
                ["Today's cookieless salt", diag.saltToday === null ? "—" : diag.saltToday ? "Present" : "Not created yet (no cookieless visits today)"],
                ["Pageviews", fmtInt(diag.last24h?.pageviews ?? 0)],
                ["Signup CTA clicks", fmtInt(diag.last24h?.ctaClicks ?? 0)],
                ["Signup page views", fmtInt(diag.last24h?.signupStarts ?? 0)],
                ["Sessions (consented / cookieless)", `${fmtInt(diag.last24h?.sessions ?? 0)} (${fmtInt(diag.last24h?.persistentSessions ?? 0)} / ${fmtInt(diag.last24h?.cookielessSessions ?? 0)})`],
              ] as const
            ).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b border-border/60 pb-1.5">
                <dt className="text-muted">{k}</dt>
                <dd className="text-right font-medium tabular-nums text-heading">{v}</dd>
              </div>
            ))}
          </dl>
        </Panel>
        <Panel title="Reporting self-test" description={`The dashboard's own query for today (${today.startDay}, ${today.tz})`}>
          <ul className="space-y-2 text-sm">
            <li>
              <Status ok={!report.loadError}>{report.loadError ? `Load warnings: ${report.loadError}` : "All report sources loaded"}</Status>
            </li>
            <li>
              <Status ok={report.tablesReady}>{report.tablesReady ? "Analytics tables reachable" : "Analytics tables missing (apply migration v103)"}</Status>
            </li>
            <li className="text-muted">
              Today in reports: {fmtInt(overview.pageviews)} pageviews · {fmtInt(overview.sessions)} sessions · {fmtInt(overview.visitors)} visitors ·{" "}
              {fmtInt(overview.blogViews)} blog views
            </li>
          </ul>
        </Panel>
      </div>
    </div>
  );
}
