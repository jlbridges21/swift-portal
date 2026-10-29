import { requireSuperAdminPage } from "@/lib/admin-access";
import { parseReportRange } from "@/lib/analytics/range";
import { loadConversionSummary } from "@/lib/analytics/conversions";
import type { DashboardSearchParams } from "@/lib/analytics/dashboard";
import { AnalyticsPageHeader } from "@/components/platform/analytics/page-header";
import { KpiCard, Notice, Panel, RateCard, fmtInt } from "@/components/platform/analytics/ui";

export const dynamic = "force-dynamic";

export default async function ConversionsAnalyticsPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  await requireSuperAdminPage();
  const range = parseReportRange(await searchParams);
  const s = await loadConversionSummary(range);

  return (
    <div className="space-y-6">
      <AnalyticsPageHeader title="Signup paths & trial conversion" range={range} />
      {!s.ready ? (
        <Notice tone="warn">Conversion tracking starts once migration v107 has been run. Nothing is backfilled.</Notice>
      ) : (
        <Notice>
          Server-recorded events (signup, checkout, Stripe webhook), each counted once. Counts are events in the selected
          range; rates follow the cohort that started in the range to its outcome, even if that came later.
          {s.truncated ? " Results were truncated — narrow the range." : ""}
        </Notice>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard label="Free trial signups" value={fmtInt(s.counts.trialSignups)} definition="free_trial_started: a self-serve account began its trial." />
        <KpiCard label="Subscribe Now signups" value={fmtInt(s.counts.subscribeSignups)} definition="Accounts created through Subscribe Now / Choose a Plan (no trial)." />
        <KpiCard label="Immediate paid" value={fmtInt(s.counts.immediateActivated)} accent definition="immediate_subscription_activated: a never-trialed account's subscription became active (paid)." />
        <KpiCard label="Trial → paid" value={fmtInt(s.counts.trialConverted)} accent definition="trial_converted_to_paid: first paid ShootPortal invoice for an account that had a trial." />
        <KpiCard label="Plans scheduled in trial" value={fmtInt(s.counts.scheduled)} definition="trial_subscription_scheduled: a trial user picked a plan that bills at trial end." />
        <KpiCard label="Trials ended unpaid" value={fmtInt(s.counts.trialExpiredUnpaid)} definition="Self-serve trials whose trial end fell in the range with no subscription." />
        <KpiCard label="Monthly / annual" value={`${fmtInt(s.intervals.monthly)} / ${fmtInt(s.intervals.annual)}`} definition="Interval of immediate activations + scheduled plans in the range." />
        <KpiCard label="Payments failed" value={fmtInt(s.counts.paymentsFailed)} definition="subscription_payment_failed: failed ShootPortal invoices (one per invoice)." />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RateCard label="Subscribe Now → paid" rate={s.rates.subscribeActivation} definition="Of Subscribe Now accounts created in the range, the share whose subscription activated." />
        <RateCard label="Trial → scheduled plan" rate={s.rates.trialScheduled} definition="Of trials started in the range, the share that scheduled a plan during the trial." />
        <RateCard label="Trial → paid" rate={s.rates.trialToPaid} definition="Of trials started in the range, the share with a first paid invoice so far. Trials still running lower this rate." />
        <RateCard label="Demo checkout → paid/scheduled" rate={s.rates.demoCheckoutToPaid} definition="Of accounts that started checkout from /get-started or a demo link, the share that activated or scheduled." />
      </div>

      <Panel title="Post-demo page (/get-started)" description="Pageviews come from the consented first-party tracker; checkouts are server events">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div><dt className="text-muted">Page views</dt><dd className="text-xl font-semibold text-heading">{fmtInt(s.counts.demoViews)}</dd></div>
          <div><dt className="text-muted">Checkouts started</dt><dd className="text-xl font-semibold text-heading">{fmtInt(s.counts.demoCheckouts)}</dd></div>
          <div><dt className="text-muted">Paid activations</dt><dd className="text-xl font-semibold text-heading">{fmtInt(s.counts.demoActivated)}</dd></div>
        </dl>
      </Panel>

      <Panel title="Trial reminder modals" description="Each admin sees a milestone at most once per trial">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 font-medium">Milestone</th>
              <th className="py-2 text-right font-medium">Viewed</th>
              <th className="py-2 text-right font-medium">Dismissed</th>
            </tr>
          </thead>
          <tbody>
            {s.modals.map((m) => (
              <tr key={m.milestone} className="border-b border-border/60">
                <td className="py-2">Day {m.milestone.replace("day", "")}</td>
                <td className="py-2 text-right tabular-nums">{fmtInt(m.viewed)}</td>
                <td className="py-2 text-right tabular-nums">{fmtInt(m.dismissed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}
