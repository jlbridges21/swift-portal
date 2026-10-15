import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-access";
import {
  buildArticles,
  buildChannels,
  buildFunnel,
  buildLifecycles,
  buildOverview,
  buildTimeseries,
  delta,
} from "@/lib/analytics/aggregate";
import { loadDashboard, type DashboardSearchParams } from "@/lib/analytics/dashboard";
import { inRange } from "@/lib/analytics/range";
import { AnalyticsPageHeader } from "@/components/platform/analytics/page-header";
import { BarList, ColumnChart, FunnelChart, TrendChart } from "@/components/platform/analytics/charts";
import { CHANNEL_COLORS, KpiCard, Notice, Panel, RateCard, channelLabel, fmtInt, fmtMoney } from "@/components/platform/analytics/ui";
import { METRICS } from "@/lib/analytics/metrics-dictionary";

export const dynamic = "force-dynamic";

const def = (key: string) => METRICS.find((m) => m.key === key)?.definition;

export default async function AnalyticsOverviewPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const { range, loaded, lifecycles } = await loadDashboard(sp, { withPrevious: true });
  const o = buildOverview(loaded.current, lifecycles);
  const prev = loaded.previous ? buildOverview(loaded.previous, buildLifecycles(loaded.previous)) : null;
  const series = buildTimeseries(loaded.current, lifecycles);
  const channels = buildChannels(loaded.current, lifecycles, "first").sort((a, b) => b.sessions - a.sessions);
  const articles = buildArticles(loaded.current, lifecycles).sort((a, b) => b.pageviews - a.pageviews).slice(0, 6);
  const d = (k: keyof typeof o) => (prev ? delta(o[k] as number, prev[k] as number) : undefined);
  const unknownShare = lifecycles.filter((l) => inRange(l.createdAt, range) && l.attribution?.status !== "attributed").length;

  return (
    <div className="space-y-6">
      <AnalyticsPageHeader title="Overview" range={range} loaded={loaded} />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        <KpiCard label="Unique visitors" value={fmtInt(o.visitors)} delta={d("visitors")} definition={def("visitors")} hint={`${fmtInt(o.consentedVisitors)} consented`} />
        <KpiCard label="Sessions" value={fmtInt(o.sessions)} delta={d("sessions")} definition={def("sessions")} />
        <KpiCard label="Pageviews" value={fmtInt(o.pageviews)} delta={d("pageviews")} definition={def("pageviews")} />
        <KpiCard label="Blog views" value={fmtInt(o.blogViews)} delta={d("blogViews")} definition={def("blog_views")} />
        <KpiCard label="Signup CTA clicks" value={fmtInt(o.ctaClicks)} delta={d("ctaClicks")} definition={def("cta_clicks")} />
        <KpiCard label="Signup started" value={fmtInt(o.signupStarts)} delta={d("signupStarts")} definition={def("signup_starts")} />
        <KpiCard label="Registrations" value={fmtInt(o.registrations)} delta={d("registrations")} definition={def("registrations")} accent />
        <KpiCard label="New trials" value={fmtInt(o.trials)} delta={d("trials")} definition={def("trials")} accent />
        <KpiCard label="Activated" value={fmtInt(o.activated)} delta={d("activated")} definition={def("activated")} accent />
        <KpiCard label="New paid" value={fmtInt(o.newPaid)} delta={d("newPaid")} definition={def("new_paid")} accent />
        <KpiCard label="Subscription revenue" value={fmtMoney(o.revenueCents)} delta={d("revenueCents")} definition={def("revenue")} accent />
        <KpiCard
          label="From attributed accounts"
          value={fmtMoney(o.attributedRevenueCents)}
          definition={def("attributed_revenue")}
          hint={`${fmtMoney(o.unknownRevenueCents)} from Unknown`}
        />
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <RateCard label="Visitor → registration" rate={o.visitorToSignup} definition={def("visitor_to_signup") ?? ""} />
        <RateCard label="Registration → activation" rate={o.signupToActivation} definition={def("signup_to_activation") ?? ""} />
        <RateCard label="Trial → paid" rate={o.trialToPaid} definition={def("trial_to_paid") ?? ""} />
      </div>

      {o.cancellations || o.paymentFailures ? (
        <Notice>
          {fmtInt(o.cancellations)} subscription cancellation{o.cancellations === 1 ? "" : "s"} and {fmtInt(o.paymentFailures)} failed payment
          {o.paymentFailures === 1 ? "" : "s"} recorded in this range (from Stripe billing webhooks).
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Traffic" description="Daily unique visitors and sessions" className="lg:col-span-2">
          <TrendChart
            points={series}
            series={[
              { key: "visitors", label: "Visitors", color: "#4F46E5" },
              { key: "sessions", label: "Sessions", color: "#A855F7" },
            ]}
          />
        </Panel>
        <Panel title="Acquisition funnel" description="Volumes in this range; each stage has its own unit">
          <FunnelChart stages={buildFunnel(o)} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="New trials" description="Self-serve trials started per day">
          <ColumnChart points={series} valueKey="trials" label="Trials" color="#4F46E5" />
        </Panel>
        <Panel title="New paid customers" description="Businesses with their first subscription payment">
          <ColumnChart points={series} valueKey="newPaid" label="Paid customers" color="#10B981" />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel
          title="Traffic sources"
          description="Sessions by acquisition channel"
          actions={
            <Link href={`/platform/analytics/acquisition?range=${range.preset}${range.preset === "custom" ? `&from=${range.startDay}&to=${range.endDay}` : ""}`} className="text-sm font-medium text-indigo-600 hover:underline">
              Details
            </Link>
          }
        >
          <BarList
            rows={channels.filter((c) => c.sessions > 0).map((c) => ({ key: c.channel, label: channelLabel(c.channel), value: c.sessions, color: CHANNEL_COLORS[c.channel], sub: c.registrations ? `${c.registrations} reg.` : undefined }))}
          />
        </Panel>
        <Panel
          title="Top blog articles"
          description="By pageviews in this range"
          actions={
            <Link href={`/platform/analytics/blog?range=${range.preset}${range.preset === "custom" ? `&from=${range.startDay}&to=${range.endDay}` : ""}`} className="text-sm font-medium text-indigo-600 hover:underline">
              All articles
            </Link>
          }
        >
          <BarList
            rows={articles.map((a) => ({ key: a.slug, label: a.title, value: a.pageviews, sub: a.first.registrations ? `${a.first.registrations} reg. (first touch)` : undefined }))}
            empty="No blog views in this range yet."
          />
        </Panel>
      </div>

      {o.registrations ? (
        <p className="text-xs text-muted">
          {fmtInt(unknownShare)} of {fmtInt(o.registrations)} registrations in this range have Unknown attribution (no analytics consent before signup,
          tracking unavailable, or registered before analytics shipped). They are never reassigned to a source.
        </p>
      ) : null}
    </div>
  );
}
