import Link from "next/link";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { loadDashboard, type DashboardSearchParams } from "@/lib/analytics/dashboard";
import { inRange } from "@/lib/analytics/range";
import { AnalyticsPageHeader } from "@/components/platform/analytics/page-header";
import { Notice, Panel, channelLabel, fmtInt, fmtMoney } from "@/components/platform/analytics/ui";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

const UNKNOWN_REASONS: Record<string, string> = {
  no_consented_visitor_cookie: "No analytics consent / not tracked",
  visitor_has_no_tracked_visits: "Consented, but no tracked visits",
};

function Touch({ channel, source, campaign, landing }: { channel: string | null; source: string | null; campaign: string | null; landing: string | null }) {
  return (
    <div>
      <p className="font-medium text-heading">{channelLabel(channel)}</p>
      <p className="text-xs text-muted">
        {[source, campaign].filter(Boolean).join(" · ") || "—"}
        {landing ? <span className="block truncate">{landing}</span> : null}
      </p>
    </div>
  );
}

export default async function AccountsAnalyticsPage({ searchParams }: { searchParams: Promise<DashboardSearchParams> }) {
  await requireSuperAdminPage();
  const sp = await searchParams;
  const { range, loaded, lifecycles } = await loadDashboard(sp);
  const rows = lifecycles.filter((l) => inRange(l.createdAt, range)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const attributed = rows.filter((r) => r.attribution?.status === "attributed").length;

  return (
    <div className="space-y-6">
      <AnalyticsPageHeader title="Account attribution" range={range} loaded={loaded} />
      <Notice>
        Self-serve businesses registered in this range ({fmtInt(rows.length)}; {fmtInt(attributed)} attributed). Platform-created, protected, and
        excluded businesses are not listed. Attribution is captured once at signup and never edited afterwards.
      </Notice>
      <Panel title="Registrations" description="Lifecycle dates come from businesses, projects, and Stripe subscription payments">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[78rem] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-3 font-medium">Business</th>
                  <th className="py-2 pr-3 font-medium">First touch</th>
                  <th className="py-2 pr-3 font-medium">Last touch</th>
                  <th className="py-2 pr-3 font-medium">Articles</th>
                  <th className="py-2 pr-3 font-medium">Signup CTA</th>
                  <th className="py-2 pr-3 font-medium">Registered</th>
                  <th className="py-2 pr-3 font-medium">Trial</th>
                  <th className="py-2 pr-3 font-medium">First project</th>
                  <th className="py-2 pr-3 font-medium">First paid</th>
                  <th className="py-2 pr-3 font-medium">Status</th>
                  <th className="py-2 text-right font-medium">Revenue (all time)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((l) => {
                  const a = l.attribution;
                  const ok = a?.status === "attributed";
                  return (
                    <tr key={l.id} className="border-b border-border/70 align-top last:border-0">
                      <td className="py-2.5 pr-3">
                        <Link href={`/platform/businesses/${l.id}`} className="font-medium text-heading hover:underline">
                          {l.name}
                        </Link>
                        <span className="block text-xs text-muted">{l.slug}</span>
                      </td>
                      {ok ? (
                        <>
                          <td className="max-w-[12rem] py-2.5 pr-3">
                            <Touch channel={a.ft_channel} source={a.ft_utm_source ?? a.ft_referrer_host} campaign={a.ft_utm_campaign} landing={a.ft_landing_path} />
                          </td>
                          <td className="max-w-[12rem] py-2.5 pr-3">
                            <Touch channel={a.lt_channel} source={a.lt_utm_source ?? a.lt_referrer_host} campaign={a.lt_utm_campaign} landing={a.lt_landing_path} />
                          </td>
                          <td className="max-w-[14rem] py-2.5 pr-3 text-xs">
                            {a.first_article_slug ? (
                              <>
                                <span className="block truncate">First: {a.first_article_slug}</span>
                                {a.last_article_slug && a.last_article_slug !== a.first_article_slug ? <span className="block truncate">Last: {a.last_article_slug}</span> : null}
                                <span className="text-muted">{(a.articles_viewed ?? []).length} read</span>
                              </>
                            ) : (
                              <span className="text-muted">None</span>
                            )}
                          </td>
                          <td className="py-2.5 pr-3 text-xs">{a.signup_cta_id ? `${a.signup_cta_id} (${a.signup_cta_location})` : <span className="text-muted">—</span>}</td>
                        </>
                      ) : (
                        <td colSpan={4} className="py-2.5 pr-3 text-xs text-muted">
                          Unknown · {a ? UNKNOWN_REASONS[a.unknown_reason ?? ""] ?? a.unknown_reason : "Registered before analytics, or snapshot missing"}
                        </td>
                      )}
                      <td className="py-2.5 pr-3 whitespace-nowrap">{formatDate(l.createdAt)}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{l.trialStartedAt ? `Until ${formatDate(l.trialEndsAt!)}` : "—"}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{l.activatedAt ? formatDate(l.activatedAt) : "—"}</td>
                      <td className="py-2.5 pr-3 whitespace-nowrap">{l.firstPaidAt ? formatDate(l.firstPaidAt) : "—"}</td>
                      <td className="py-2.5 pr-3 text-xs">{l.subscriptionStatus ?? "—"}</td>
                      <td className="py-2.5 text-right tabular-nums">{fmtMoney(l.revenueCentsAllTime)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-muted">No self-serve registrations in this range.</p>
        )}
      </Panel>
    </div>
  );
}
