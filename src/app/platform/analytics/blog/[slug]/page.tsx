import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { buildArticleDetail } from "@/lib/analytics/aggregate";
import { loadDashboard, type DashboardSearchParams } from "@/lib/analytics/dashboard";
import { getArticle } from "@/lib/blog/registry";
import { AnalyticsPageHeader } from "@/components/platform/analytics/page-header";
import { BarList, TrendChart } from "@/components/platform/analytics/charts";
import { CHANNEL_COLORS, KpiCard, Panel, channelLabel, fmtInt, fmtMoney, fmtPct } from "@/components/platform/analytics/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ArticleAnalyticsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<DashboardSearchParams>;
}) {
  await requireSuperAdminPage();
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();
  const sp = await searchParams;
  const { range, loaded, lifecycles } = await loadDashboard(sp);
  const detail = buildArticleDetail(loaded.current, lifecycles, slug);
  if (!detail) notFound();
  const { row } = detail;
  const rangeQuery = `?range=${range.preset}${range.preset === "custom" ? `&from=${range.startDay}&to=${range.endDay}` : ""}`;

  const groups = [
    { key: "first", label: "First touch", c: row.first, note: "This article was the first one they read." },
    { key: "last", label: "Last touch", c: row.last, note: "This article was the last one they read before signing up." },
    { key: "assisted", label: "Assisted", c: row.assisted, note: "They read this article at some point before signing up." },
  ];

  return (
    <div className="space-y-6">
      <Link href={`/platform/analytics/blog${rangeQuery}`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-heading">
        <ArrowLeft className="h-4 w-4" aria-hidden /> All articles
      </Link>
      <AnalyticsPageHeader title={article.title} range={range} loaded={loaded}>
        <a href={`/blog/${slug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:underline">
          View article <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      </AnalyticsPageHeader>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Unique visitors" value={fmtInt(row.visitors)} hint={`${fmtInt(row.consentedVisitors)} consented`} />
        <KpiCard label="Sessions" value={fmtInt(row.sessions)} />
        <KpiCard label="Pageviews" value={fmtInt(row.pageviews)} />
        <KpiCard label="Signup CTA clicks" value={fmtInt(row.ctaClicks)} hint={row.sessions ? `${fmtPct(row.ctaClicks / row.sessions)} of sessions` : undefined} />
        <KpiCard label="Primary keyword" value={<span className="text-base">{article.primaryKeyword}</span>} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="Traffic trend" description="Daily pageviews and visitors for this article" className="lg:col-span-2">
          <TrendChart
            points={detail.daily}
            series={[
              { key: "pageviews", label: "Pageviews", color: "#4F46E5" },
              { key: "visitors", label: "Visitors", color: "#A855F7" },
            ]}
          />
        </Panel>
        <Panel title="Traffic sources" description="Channels of sessions that viewed this article">
          <BarList rows={detail.sources.map((s) => ({ key: s.channel, label: channelLabel(s.channel), value: s.sessions, color: CHANNEL_COLORS[s.channel] }))} />
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {groups.map((g) => (
          <Panel key={g.key} title={`${g.label} conversions`} description={g.note}>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              {(
                [
                  ["Registrations", fmtInt(g.c.registrations)],
                  ["Trials", fmtInt(g.c.trials)],
                  ["Activated", fmtInt(g.c.activated)],
                  ["Paying", fmtInt(g.c.paid)],
                  ["Revenue in range", fmtMoney(g.c.revenueCents)],
                  ["Reg. → paid", fmtPct(g.c.registrations ? g.c.paid / g.c.registrations : null)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="rounded-xl bg-subtle/70 p-3">
                  <dt className="text-xs text-muted">{k}</dt>
                  <dd className="mt-0.5 text-lg font-semibold tabular-nums text-heading">{v}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Panel title="CTA interactions" description="Signup links clicked on this article">
          <BarList rows={detail.ctas.map((c) => ({ key: `${c.ctaId}|${c.location}`, label: `${c.ctaId} · ${c.location}`, value: c.clicks }))} empty="No CTA clicks in this range." />
        </Panel>
        <Panel title="Attributed accounts" description="Businesses registered in this range whose journey included this article" className="lg:col-span-2">
          {detail.accounts.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-3 font-medium">Business</th>
                    <th className="py-2 pr-3 font-medium">Role of this article</th>
                    <th className="py-2 pr-3 font-medium">Registered</th>
                    <th className="py-2 pr-3 font-medium">Activated</th>
                    <th className="py-2 font-medium">Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.accounts.map((a) => (
                    <tr key={a.lifecycle.id} className="border-b border-border/70 last:border-0">
                      <td className="py-2 pr-3">
                        <Link href={`/platform/businesses/${a.lifecycle.id}`} className="font-medium text-heading hover:underline">
                          {a.lifecycle.name}
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-muted">
                        {[a.firstTouch && "First touch", a.lastTouch && "Last touch", a.assisted && !a.firstTouch && !a.lastTouch && "Assisted"].filter(Boolean).join(" · ")}
                      </td>
                      <td className="py-2 pr-3">{formatDate(a.lifecycle.createdAt)}</td>
                      <td className="py-2 pr-3">{a.lifecycle.activatedAt ? formatDate(a.lifecycle.activatedAt) : "—"}</td>
                      <td className="py-2">{a.lifecycle.firstPaidAt ? formatDate(a.lifecycle.firstPaidAt) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted">No attributed registrations involved this article in this range.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
