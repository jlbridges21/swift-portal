import { requireSuperAdminPage } from "@/lib/admin-access";
import { METRICS } from "@/lib/analytics/metrics-dictionary";
import { reportingTimeZone } from "@/lib/analytics/range";
import { Notice, Panel } from "@/components/platform/analytics/ui";

export const dynamic = "force-dynamic";

export default async function DefinitionsPage() {
  await requireSuperAdminPage();
  return (
    <div className="space-y-6">
      <Notice>
        Reporting timezone: <strong>{reportingTimeZone()}</strong> (set <code className="text-xs">ANALYTICS_REPORTING_TZ</code>). Revenue is live-mode
        only unless <code className="text-xs">ANALYTICS_INCLUDE_TEST_MODE=1</code>. Full design notes: <code className="text-xs">docs/ANALYTICS.md</code>.
      </Notice>
      <div className="grid gap-4 lg:grid-cols-2">
        {METRICS.map((m) => (
          <Panel key={m.key} title={m.name}>
            <p className="text-sm text-heading">{m.definition}</p>
            <dl className="mt-3 grid gap-2 text-sm">
              {(
                [
                  ["Numerator", m.numerator],
                  ["Denominator", m.denominator],
                  ["Source of truth", m.source],
                  ["Deduplication", m.dedupe],
                  ["Date range", m.dateBehavior],
                  ["Known limitations", m.limitations],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([k, v]) => (
                  <div key={k} className="grid grid-cols-[8.5rem_1fr] gap-2">
                    <dt className="text-xs font-medium uppercase tracking-wide text-muted">{k}</dt>
                    <dd className="text-muted">{v}</dd>
                  </div>
                ))}
            </dl>
          </Panel>
        ))}
      </div>
    </div>
  );
}
