import { addMonths, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin-access";
import { getProjectHeroPosterUrl } from "@/lib/cover";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { ShootCalendar, type CalendarShoot } from "@/components/admin/shoot-calendar";
import { isOwnerAdmin, visibleProjectIdsFor } from "@/lib/staff-access";
import { getAppSettings } from "@/lib/app-settings";
import {
  loadExternalEventsForOwner,
  resolveBusinessTimeZone,
  retryAttentionSyncs,
} from "@/lib/google-calendar";
import { externalEventsVisibleTo, type ExternalCalendarEvent } from "@/lib/google-calendar-pull";
import Link from "next/link";

export default async function AdminCalendarPage() {
  const { profile, tenant } = await requireAdminPage({ area: "calendar" });
  const db = await createTenantServiceClient(tenant.businessId);
  const owner = isOwnerAdmin(profile);

  let gcalStatus: "disconnected" | "active" | "needs_reconnect" = "disconnected";
  let gcalError: string | null = null;
  if (owner) {
    const { data: gcal } = await db
      .from("google_calendar_connections")
      .select("status, last_error")
      .maybeSingle();
    if (gcal?.status === "active" || gcal?.status === "needs_reconnect") {
      gcalStatus = gcal.status;
      gcalError = gcal.last_error;
    }
    try {
      await retryAttentionSyncs(tenant.businessId);
    } catch {
      // Retry must not block the calendar page.
    }
  }

  const projectIds = isOwnerAdmin(profile)
    ? ("all" as const)
    : await visibleProjectIdsFor(tenant.businessId, profile);

  let proposalsQuery = db
    .from("shoot_proposals")
    .select(
      "id, project_id, proposed_at, projects(project_name, property_address, service_type, status, cover_image_id, cover_image_url, clients(name))"
    )
    .eq("status", "confirmed")
    .order("proposed_at", { ascending: true });

  if (projectIds !== "all") {
    if (projectIds.length === 0) {
      proposalsQuery = proposalsQuery.in("project_id", [
        "00000000-0000-0000-0000-000000000000",
      ]);
    } else {
      proposalsQuery = proposalsQuery.in("project_id", projectIds);
    }
  }

  const { data: confirmed } = await proposalsQuery;

  const settings = await getAppSettings(tenant.businessId);
  const businessTimeZone = resolveBusinessTimeZone(settings.workflow.businessDefaults.timezone).timeZone;
  const windowStart = startOfMonth(subMonths(new Date(), 1));
  const windowEnd = endOfMonth(addMonths(new Date(), 1));

  let externalEvents: ExternalCalendarEvent[] = [];
  let externalDegraded = false;
  if (owner && gcalStatus === "active") {
    const loaded = await loadExternalEventsForOwner(
      tenant.businessId,
      windowStart.toISOString(),
      windowEnd.toISOString()
    );
    externalEvents = externalEventsVisibleTo(profile.role, loaded.events);
    externalDegraded = loaded.degraded;
  }

  const shoots: CalendarShoot[] = await Promise.all(
    (confirmed ?? []).map(async (item) => {
      const project = item.projects as unknown as {
        project_name: string;
        property_address: string;
        service_type: string;
        status: string;
        cover_image_id: string | null;
        cover_image_url: string | null;
        clients: { name: string } | null;
      } | null;

      const cover_url = project
        ? await getProjectHeroPosterUrl(
            db.raw,
            {
              id: item.project_id,
              cover_image_id: project.cover_image_id,
              cover_image_url: project.cover_image_url,
            },
            tenant.businessId
          )
        : null;

      return {
        id: item.id,
        project_id: item.project_id,
        proposed_at: item.proposed_at,
        project_name: project?.project_name ?? "Project",
        client_name: project?.clients?.name ?? "Client",
        property_address: project?.property_address ?? "",
        service_type: project?.service_type ?? "",
        status: project?.status ?? "scheduled",
        cover_url,
      };
    })
  );

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={profile.role === "staff" ? "staff" : "admin"} />
      <main className="mx-auto max-w-6xl px-4 py-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8 lg:px-8">
        <PageHeader
          title="Shoot Calendar"
          description="Month, week, and agenda views — drag to reschedule on desktop, tap to edit"
        >
          {owner && gcalStatus !== "active" ? (
            <Link href="/admin/settings#settings-integrations">
              <Button variant="outline" size="sm">
                {gcalStatus === "needs_reconnect" ? "Reconnect Google Calendar" : "Connect Google Calendar"}
              </Button>
            </Link>
          ) : null}
        </PageHeader>

        {owner && gcalStatus === "needs_reconnect" ? (
          <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            Google Calendar is disconnected{gcalError ? ` (${gcalError})` : ""}. Confirmed shoots stay in
            ShootPortal. Reconnect from Settings → Integrations to resume pushing events.
          </div>
        ) : null}

        <ShootCalendar
          shoots={shoots}
          externalEvents={externalEvents}
          externalDegraded={externalDegraded}
          canLoadExternal={owner && gcalStatus === "active"}
          businessTimeZone={businessTimeZone}
          externalWindow={
            owner && gcalStatus === "active"
              ? { from: windowStart.toISOString(), to: windowEnd.toISOString() }
              : null
          }
        />
      </main>
    </div>
  );
}
