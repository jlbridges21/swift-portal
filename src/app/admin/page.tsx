import { requireAdminPage } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { PushNotificationsCard } from "@/components/admin/push-notifications-card";
import { SetupChecklistCard } from "@/components/admin/setup-checklist-card";
import { CommandCenter, type ActivityLogRow, type UpcomingShootCard } from "@/components/admin/command-center/command-center";
import { fetchAdminDashboardData } from "@/lib/admin-dashboard";
import { loadSetupChecklistSnapshot } from "@/lib/setup-checklist";
import { getPortalBrandFromSettings } from "@/lib/portal-brand";
import { defaultAnalyticsRange, safeTimeZone, todayInZone } from "@/lib/dashboard-analytics";
import { loadDashboardAnalytics } from "@/lib/dashboard-analytics-server";
import { loadBusinessStorageUsage, loadCommandCenterSummary } from "@/lib/command-center-server";
import { getProjectHeroPosterUrlMap } from "@/lib/cover";
import { getUiExperience } from "@/lib/ui-rollout-server";
import { ClassicDashboard } from "@/components/admin/classic/classic-dashboard";

export default async function AdminDashboard() {
  // Double-gate: middleware also redirects staff off /admin, but page must refuse
  // independently so a middleware miss never loads business-wide command-center data.
  const { profile, tenant } = await requireAdminPage({ adminOnly: true });

  // Classic interface keeps the original dashboard (same data, original presentation).
  const experience = await getUiExperience(profile);
  if (experience.mode === "classic") return <ClassicDashboard profile={profile} tenant={tenant} />;

  const supabase = await createClient();
  const bid = tenant.businessId;

  // Analytics use the business timezone for calendar days (default: last 30 days ending today).
  // They start as soon as settings resolve, in parallel with the operational queries.
  const settingsPromise = getAppSettings(bid);
  const analyticsPromise = settingsPromise.then(async (s) => {
    const timeZone = safeTimeZone(s.workflow.businessDefaults.timezone);
    const range = defaultAnalyticsRange(timeZone);
    const [data, summary] = await Promise.all([
      loadDashboardAnalytics(bid, range, timeZone).catch((err) => {
        console.error("[admin dashboard] analytics failed to load", err);
        return null;
      }),
      loadCommandCenterSummary(bid, range, timeZone).catch((err) => {
        console.error("[admin dashboard] summary failed to load", err);
        return null;
      }),
    ]);
    return { range, timeZone, today: todayInZone(timeZone), data, summary };
  });

  const [{ data: recentActivity }, dashboardData, settings, checklist, analytics, storage] = await Promise.all([
    supabase
      .from("activity_logs")
      .select("*, projects(id, project_name)")
      .eq("business_id", bid)
      .order("created_at", { ascending: false })
      .limit(50),
    fetchAdminDashboardData(bid),
    settingsPromise,
    loadSetupChecklistSnapshot(bid),
    analyticsPromise,
    loadBusinessStorageUsage(bid),
  ]);

  const brand = getPortalBrandFromSettings(settings);

  const nextShoots = dashboardData.upcomingShoots.slice(0, 3);
  const heroMap = await getProjectHeroPosterUrlMap(
    nextShoots.map((p) => ({ id: p.id, cover_image_id: p.cover_image_id, cover_image_url: p.cover_image_url })),
    bid
  ).catch(() => ({}) as Record<string, string | null>);
  // Formatted here in the business timezone so server and browser render the same text.
  // A shoot with only a date (no confirmed time) shows the date alone.
  const tz = analytics.timeZone;
  const upcoming: UpcomingShootCard[] = nextShoots.map((p) => {
    const dateOnly = Boolean(p.shoot_date) && p.shootAt === `${p.shoot_date}T09:00:00.000Z`;
    const when = dateOnly ? new Date(`${p.shoot_date}T12:00:00.000Z`) : new Date(p.shootAt);
    return {
      id: p.id,
      title: p.property_address?.trim() || p.project_name,
      service: p.service_type,
      dateLabel: when.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        timeZone: dateOnly ? "UTC" : tz,
      }),
      timeLabel: dateOnly ? "Time TBD" : when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }),
      heroUrl: heroMap[p.id] ?? null,
    };
  });

  // Subscribe & Save is promoted once, in the trial banner above every admin page (admin/layout).

  return (
    <CommandCenter
      firstName={profile.full_name?.split(" ")[0] || "there"}
      today={analytics.today}
      primaryColor={brand.primaryColor}
      accentColor={brand.accentColor}
      initialAnalytics={analytics.data}
      initialSummary={analytics.summary}
      storage={storage}
      counts={{
        newRequests: dashboardData.counts.newRequests,
        quotesWaiting: dashboardData.counts.quotesWaiting,
        upcomingShoots: dashboardData.counts.upcomingShoots,
        editingQueue: dashboardData.counts.editingQueue,
        inReview: dashboardData.counts.inReview,
        awaitingPayment: dashboardData.counts.awaitingPayment,
      }}
      upcoming={upcoming}
      activity={(recentActivity ?? []) as ActivityLogRow[]}
      notices={
        <>
          {checklist.incomplete ? (
            <SetupChecklistCard items={checklist.items} incomplete={checklist.incomplete} linkToSettings />
          ) : null}
          <PushNotificationsCard />
        </>
      }
    />
  );
}
