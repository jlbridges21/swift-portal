import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { requireAdminPage } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { formatDate } from "@/lib/utils";
import { Plus } from "lucide-react";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { PushNotificationsCard } from "@/components/admin/push-notifications-card";
import { AdminOpsDashboard } from "@/components/admin/admin-ops-dashboard";
import { SetupChecklistCard } from "@/components/admin/setup-checklist-card";
import { fetchAdminDashboardData } from "@/lib/admin-dashboard";
import { loadSetupChecklistSnapshot } from "@/lib/setup-checklist";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { BusinessAnalytics } from "@/components/admin/dashboard-analytics/business-analytics";
import { defaultAnalyticsRange, safeTimeZone } from "@/lib/dashboard-analytics";
import { loadDashboardAnalytics } from "@/lib/dashboard-analytics-server";
import { SubscribeSaveCard } from "@/components/admin/subscribe-save-card";
import { offerDisplayForBusiness } from "@/lib/intro-offer-server";
import { assertActivePlanKey } from "@/lib/entitlements";
import { requestNowMs, type OfferDisplay } from "@/lib/intro-offer";

export default async function AdminDashboard() {
  // Double-gate: middleware also redirects staff off /admin, but page must refuse
  // independently so a middleware miss never loads business-wide command-center data.
  const { profile, tenant } = await requireAdminPage({ adminOnly: true });

  const supabase = await createClient();
  const bid = tenant.businessId;

  // Analytics use the business timezone for calendar days (default: last 30 days ending today).
  // They start as soon as settings resolve, in parallel with the operational queries.
  const settingsPromise = getAppSettings(bid);
  const analyticsPromise = settingsPromise.then(async (s) => {
    const timeZone = safeTimeZone(s.workflow.businessDefaults.timezone);
    const range = defaultAnalyticsRange(timeZone);
    try {
      return { range, data: await loadDashboardAnalytics(bid, range, timeZone) };
    } catch (err) {
      console.error("[admin dashboard] analytics failed to load", err);
      return { range, data: null };
    }
  });

  const [{ data: recentProjects }, { data: recentActivity }, dashboardData, settings, checklist, analytics] =
    await Promise.all([
      supabase
        .from("projects")
        .select("*, clients(name, company, deleted_at)")
        .eq("business_id", bid)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("activity_logs")
        .select("*, projects(id, project_name)")
        .eq("business_id", bid)
        .order("created_at", { ascending: false })
        .limit(12),
      fetchAdminDashboardData(bid),
      settingsPromise,
      loadSetupChecklistSnapshot(bid),
      analyticsPromise,
    ]);

  const brand = getPortalBrandFromSettings(settings);

  // Trial owners only (never staff, never support impersonation, never paying accounts).
  let introOffer: OfferDisplay | null = null;
  if (tenant.business.subscription_status === "trialing" && !tenant.impersonating) {
    try {
      const plan = await assertActivePlanKey(tenant.business.plan || "studio");
      introOffer = await offerDisplayForBusiness(
        { id: bid, subscription_status: tenant.business.subscription_status, trial_ends_at: tenant.business.trial_ends_at },
        { monthlyCents: plan.price_monthly_cents, annualPerMonthCents: plan.price_annual_cents }
      );
    } catch (err) {
      console.warn("[admin dashboard] subscribe & save card skipped", err instanceof Error ? err.message : err);
    }
  }

  return (
    <div className="min-h-screen w-full bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto w-full max-w-7xl min-w-0 overflow-x-hidden px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Command Center"
          description={`What needs your attention today, ${profile.full_name?.split(" ")[0] || "there"}?`}
          className="min-w-0"
        >
          <Link href="/admin/projects/new">
            <Button variant="accent" size="sm" className="min-h-11">
              <Plus className="h-4 w-4" /> New Project
            </Button>
          </Link>
        </PageHeader>

        {introOffer ? <SubscribeSaveCard offer={introOffer} nowMs={requestNowMs()} /> : null}

        {checklist.incomplete ? (
          <SetupChecklistCard
            items={checklist.items}
            incomplete={checklist.incomplete}
            linkToSettings
          />
        ) : null}

        <PushNotificationsCard />

        <AdminOpsDashboard data={dashboardData} />

        {analytics.data ? (
          <BusinessAnalytics
            initial={analytics.data}
            today={analytics.range.to}
            primaryColor={brand.primaryColor}
            accentColor={brand.accentColor}
          />
        ) : (
          <p className="mt-10 rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
            Business analytics could not be loaded. Refresh the page to try again.
          </p>
        )}

        <div className="mt-10 grid w-full max-w-full min-w-0 gap-8 lg:grid-cols-3">
          <div className="min-w-0 lg:col-span-2">
            <Card className="w-full max-w-full overflow-hidden">
              <CardHeader className="flex min-w-0 flex-row items-center justify-between gap-2">
                <CardTitle className="min-w-0">Recent Projects</CardTitle>
                <Link href="/admin/projects" className="shrink-0 text-sm text-accent hover:underline">
                  View all
                </Link>
              </CardHeader>
              <CardContent className="min-w-0 space-y-3">
                {(() => {
                  const visibleRecent = (recentProjects ?? []).filter(
                    (project) =>
                      !project.deleted_at &&
                      !(project.clients as { deleted_at?: string | null } | null)?.deleted_at
                  );
                  if (!visibleRecent.length) {
                    return <p className="py-6 text-center text-sm text-muted">No projects yet</p>;
                  }
                  return visibleRecent.map((project) => (
                    <Link key={project.id} href={`/admin/projects/${project.id}`} className="block min-w-0">
                      <div className="flex min-w-0 flex-col gap-2 rounded-lg border border-border p-4 transition-colors hover:bg-slate-50 surface-dark:hover:bg-subtle sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                        <div className="min-w-0 flex-1 overflow-hidden">
                          <p className="font-medium text-heading break-words whitespace-normal">{project.project_name}</p>
                          <p className="mt-0.5 text-xs text-muted break-words whitespace-normal">
                            {(project.clients as { name: string })?.name} · {formatDate(project.created_at)}
                          </p>
                        </div>
                        <StatusBadge status={project.status} className="max-w-full shrink-0 self-start whitespace-normal sm:text-right" />
                      </div>
                    </Link>
                  ));
                })()}
              </CardContent>
            </Card>
          </div>

          <Card className="w-full max-w-full min-w-0 overflow-hidden">
            <CardHeader className="min-w-0">
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="min-w-0 overflow-hidden">
              <ActivityFeed logs={recentActivity ?? []} />
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
