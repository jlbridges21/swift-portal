import { addDays, endOfMonth, startOfMonth, subDays } from "date-fns";
import { Header, PageHeader } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { getProjectHeroPosterUrlMap } from "@/lib/cover";
import { after } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  ShootCalendar,
  type CalendarShoot,
  type CalendarShootsResult,
  type CalendarGoogleResult,
} from "@/components/admin/shoot-calendar";
import type { CalendarCreateProject } from "@/components/admin/shoot-calendar-mobile";
import { isOwnerAdmin, staffCan, visibleProjectIdsFor } from "@/lib/staff-access";
import { getAppSettings } from "@/lib/app-settings";
import {
  getViewerCalendarColors,
  loadViewerGoogleWindow,
  resolveBusinessTimeZone,
  retryAttentionSyncs,
  type ViewerCalendarColorPrefs,
} from "@/lib/google-calendar";
import { externalEventsVisibleTo } from "@/lib/google-calendar-pull";
import { retryOutlookAttentionSyncs } from "@/lib/outlook-calendar";
import { getBusinessOwnerUserId } from "@/lib/staff";
import { loadTeam, resolveMember } from "@/lib/booking/team";
import { computeCalendarTravelLegs, type CalendarLeg } from "@/lib/booking/calendar-travel";
import type { CalendarTeamMember } from "@/components/admin/shoot-calendar";

type ProposalRow = {
  id: string;
  project_id: string;
  proposed_at: string;
  status: string;
  google_sync_status: string | null;
  google_sync_error: string | null;
  end_at?: string | null;
  assigned_user_id?: string | null;
  booking_source?: string | null;
  projects: unknown;
};

type ProposalProject = {
  project_name: string;
  property_address: string;
  service_type: string;
  status: string;
  cover_image_id: string | null;
  cover_image_url: string | null;
  clients: { name: string } | null;
} | null;

/**
 * Shoot Calendar. Only the cheap permission/settings reads are awaited: the page shell, the
 * calendar grid and its controls render from them at once. Shoots, cover images, the
 * create-shoot project list and Google events are each streamed to the client as their own
 * promise, so a slow (or expired, rate-limited, unavailable) Google connection never holds up
 * the grid or the ShootPortal shoots.
 */
export default async function AdminCalendarPage() {
  const { profile, tenant } = await requireAdminPage({ area: "calendar" });
  const db = await createTenantServiceClient(tenant.businessId);
  const owner = isOwnerAdmin(profile);
  const canCreateShoot = staffCan(profile, "scheduling.propose");
  const readOnlyImpersonation = Boolean(tenant.impersonating && !tenant.allowWrites);
  // Same rule as Projects → Calendar and PATCH /api/shoot-proposals update_date.
  const canReschedule = staffCan(profile, "scheduling.confirm") && !readOnlyImpersonation;

  // Read-only impersonation never writes (after() can't read the impersonation cookie, so the
  // tenant client's write guard would not see it — skip the repair outright instead).
  if (owner && !readOnlyImpersonation) {
    // Re-push shoots whose Google sync failed. Runs after the response is sent: each retry is
    // a sequential Google API call, and the page must not wait on them (failures stay flagged
    // on the shoot and are retried again on the next visit).
    after(async () => {
      try {
        await retryAttentionSyncs(tenant.businessId);
      } catch {
        // Best-effort background repair.
      }
      try {
        await retryOutlookAttentionSyncs(tenant.businessId);
      } catch {
        // Best-effort background repair (Outlook, v137).
      }
    });
  }

  // Outlook connection (v137): decides whether to offer "Connect Google Calendar" and whether
  // the owner sees Outlook calendars on the grid.
  const outlookConnectedPromise = owner
    ? db
        .from("outlook_calendar_connections")
        .select("status")
        .maybeSingle()
        .then(({ data, error }) => !error && Boolean(data))
    : Promise.resolve(false);

  // Independent lookups in one parallel batch (all database reads; no Google calls).
  const [gcal, projectIds, settings, calendarColors] = await Promise.all([
    owner
      ? db
          .from("google_calendar_connections")
          .select("status, last_error")
          .maybeSingle()
          .then(({ data }) => data)
      : Promise.resolve(null),
    owner ? Promise.resolve("all" as const) : visibleProjectIdsFor(tenant.businessId, profile),
    getAppSettings(tenant.businessId),
    owner
      ? getViewerCalendarColors(tenant.businessId, profile.id).catch((): ViewerCalendarColorPrefs => ({}))
      : Promise.resolve({} as ViewerCalendarColorPrefs),
  ]);

  let gcalStatus: "disconnected" | "active" | "needs_reconnect" = "disconnected";
  let gcalError: string | null = null;
  if (gcal?.status === "active" || gcal?.status === "needs_reconnect") {
    gcalStatus = gcal.status;
    gcalError = gcal.last_error;
  }
  const googleActive = owner && gcalStatus === "active";
  const outlookConnected = await outlookConnectedPromise;

  const businessTimeZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
  // Google window: this month plus a week either side (covers the month grid, the current
  // week and time-zone edges). Other months are fetched by the client when navigated to.
  const now = new Date();
  const googleWindow = {
    from: subDays(startOfMonth(now), 7).toISOString(),
    to: addDays(endOfMonth(now), 7).toISOString(),
  };
  const NO_MATCH = ["00000000-0000-0000-0000-000000000000"];

  // ── Streamed sources (started now, not awaited) ──────────────────────────
  // Every confirmed/pending shoot: a small set per business (20 rows / ~10 KB measured), so it
  // stays one query; month/week navigation then needs no further shoot requests.
  const BASE_COLUMNS =
    "id, project_id, proposed_at, status, google_sync_status, google_sync_error, projects(project_name, property_address, service_type, status, cover_image_id, cover_image_url, clients(name))";
  const proposalsPromise = (async () => {
    const run = async (columns: string) => {
      let query = db
        .from("shoot_proposals")
        .select(columns)
        .in("status", ["confirmed", "pending"])
        .order("proposed_at", { ascending: true });
      if (projectIds !== "all") {
        query = query.in("project_id", projectIds.length === 0 ? NO_MATCH : projectIds);
      }
      return query;
    };
    // Instant Booking columns (v132) when available; the calendar works without them.
    let result = await run(`${BASE_COLUMNS}, end_at, assigned_user_id, booking_source`);
    if (result.error) result = await run(BASE_COLUMNS);
    if (result.error) throw new Error("shoots unavailable");
    return (result.data ?? []) as unknown as ProposalRow[];
  })();
  const ownerId = await getBusinessOwnerUserId(tenant.businessId);
  const teamRaw = loadTeam(tenant.businessId);
  const teamPromise = teamRaw.then(
    (t) =>
      t.members.map(
        (m): CalendarTeamMember => ({
          userId: m.userId,
          name: m.name,
          avatarUrl: m.avatarUrl,
          bookable: m.profile.bookable,
          color: settings.booking.teamColors[m.userId] ?? null,
        })
      ),
    () => [] as CalendarTeamMember[]
  );
  // Drive time around each shoot: from home or the previous shoot, and home after the last one.
  const travelSource: Promise<Record<string, CalendarLeg>> = Promise.all([proposalsPromise, teamRaw])
    .then(([rows, team]) => {
      const bases = new Map(team.members.map((m) => [m.userId, resolveMember(m, settings).baseAddress]));
      return computeCalendarTravelLegs(db, rows, businessTimeZone, ownerId, (userId) => (userId ? bases.get(userId) ?? null : null));
    })
    .catch(() => ({}));

  const shootsSource: Promise<CalendarShootsResult> = proposalsPromise.then(
    (rows) => ({
      ok: true,
      shoots: rows.map((item): CalendarShoot => {
        const project = item.projects as unknown as ProposalProject;
        return {
          id: item.id,
          project_id: item.project_id,
          proposed_at: item.proposed_at,
          end_at: item.end_at ?? null,
          assigned_user_id: item.assigned_user_id ?? (item.end_at !== undefined ? ownerId : null),
          proposal_status: item.status === "pending" ? "pending" : "confirmed",
          google_sync_status: item.google_sync_status,
          google_sync_error: item.google_sync_error,
          project_name: project?.project_name ?? "Project",
          client_name: project?.clients?.name ?? "Client",
          property_address: project?.property_address ?? "",
          service_type: project?.service_type ?? "",
          status: project?.status ?? "scheduled",
          cover_url: null, // filled in from coversSource
        };
      }),
    }),
    () => {
      console.error("[calendar] shoots unavailable", { businessId: tenant.businessId });
      return { ok: false };
    }
  );

  // Cover thumbnails are only used by Day/Agenda cards and the shoot dialog — never block on them.
  const coversSource: Promise<Record<string, string | null>> = proposalsPromise
    .then((rows) => {
      const coverProjects = new Map<string, { id: string; cover_image_id: string | null; cover_image_url: string | null }>();
      for (const item of rows) {
        const project = item.projects as unknown as ProposalProject;
        if (project && !coverProjects.has(item.project_id)) {
          coverProjects.set(item.project_id, {
            id: item.project_id,
            cover_image_id: project.cover_image_id,
            cover_image_url: project.cover_image_url,
          });
        }
      }
      return getProjectHeroPosterUrlMap([...coverProjects.values()], tenant.businessId);
    })
    .catch(() => ({}));

  const createProjectsSource: Promise<CalendarCreateProject[]> = canCreateShoot
    ? (async () => {
        let projectQuery = db.from("projects").select("id, project_name").order("project_name").limit(100);
        if (projectIds !== "all") {
          projectQuery = projectQuery.in("id", projectIds.length === 0 ? NO_MATCH : projectIds);
        }
        const { data: projectRows } = await projectQuery;
        return (projectRows ?? []).map((row) => ({
          id: row.id as string,
          name: (row.project_name as string) || "Untitled project",
        }));
      })().catch(() => [])
    : Promise.resolve([]);

  const googleSource: Promise<CalendarGoogleResult> | null = googleActive
    ? loadViewerGoogleWindow(tenant.businessId, profile.id, googleWindow.from, googleWindow.to, {
        timeZone: businessTimeZone,
      }).then(
        (loaded) => ({
          connected: loaded.connected,
          calendars: loaded.calendars,
          hiddenCalendarIds: loaded.hiddenCalendarIds,
          loadedCalendarIds: loaded.loadedCalendarIds,
          events: externalEventsVisibleTo(profile.role, loaded.events),
          degraded: loaded.degraded,
          window: googleWindow,
        }),
        () => ({
          connected: true,
          calendars: [],
          hiddenCalendarIds: [],
          loadedCalendarIds: [],
          events: [],
          degraded: true,
          window: googleWindow,
        })
      )
    : null;

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={profile.role === "staff" ? "staff" : "admin"} />
      <main className="app-page app-page-wide mx-auto flex min-h-0 min-w-0 max-w-none flex-col px-3 py-4 sm:px-4 lg:h-[calc(var(--app-height)-4rem)] lg:overflow-hidden lg:px-6">
        {/* Connecting calendars lives in the "Connect calendar" / "My calendars" button below. */}
        <PageHeader title="Shoot Calendar" className="mb-3" />

        {owner && gcalStatus === "needs_reconnect" ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Google Calendar is disconnected{gcalError ? ` (${gcalError})` : ""}. Shoots stay in
            ShootPortal. Reconnect with My calendars below, or in Settings → Integrations, to resume sync.
          </div>
        ) : null}

        <ShootCalendar
          shootsSource={shootsSource}
          coversSource={coversSource}
          googleSource={googleSource}
          createProjectsSource={createProjectsSource}
          canLoadExternal={googleActive}
          canLoadOutlook={owner && outlookConnected}
          isOwner={owner}
          canChooseColors={owner}
          calendarColors={owner ? calendarColors : {}}
          businessTimeZone={businessTimeZone}
          canCreateShoot={canCreateShoot}
          canReschedule={canReschedule}
          teamSource={teamPromise}
          travelSource={travelSource}
        />
      </main>
    </div>
  );
}
