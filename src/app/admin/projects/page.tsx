import Link from "next/link";
import { cookies } from "next/headers";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { requireAdminPage } from "@/lib/admin-access";
import { Plus } from "lucide-react";
import { AdminProjectsWithStaffFilter } from "@/components/admin/admin-projects-with-staff-filter";
import {
  loadPipelinePageProjects,
  parsePipelineStageParam,
  PIPELINE_STAGE_CONFIG,
  type PipelineStageParam,
} from "@/lib/admin-project-pipeline";
import { listAssignableStaff, listProjectStaffUserIdsByBusiness } from "@/lib/staff";
import { isOwnerAdmin, staffCan, visibleProjectIdsFor } from "@/lib/staff-access";
import { parseProjectsViewCookie, PROJECTS_VIEW_COOKIE } from "@/lib/client-view";
import { loadClientViewData, loadProjectHeroPosters } from "@/lib/client-view-data";
import { loadProjectStorageBytes } from "@/lib/project-storage";
import { getUiExperience } from "@/lib/ui-rollout-server";
import { parseWorkspaceViewCookie } from "@/lib/projects-workspace";
import { ProjectsWorkspace } from "@/components/admin/projects-workspace/projects-workspace";
import { getAppSettings } from "@/lib/app-settings";
import { resolveBusinessTimeZone } from "@/lib/google-calendar";

interface PageProps {
  searchParams: Promise<{ view?: string; stage?: string; status?: string }>;
}

const LEGACY_STATUS_TO_STAGE: Record<string, PipelineStageParam> = {
  new_request: "new_request",
  quote_sent: "quote",
  shoot_complete_editing: "editing",
  ready_for_review: "in_review",
  awaiting_payment: "awaiting_payment",
};

export default async function AdminProjectsPage({ searchParams }: PageProps) {
  const { profile, tenant } = await requireAdminPage({ area: "projects" });

  const { view, stage: stageParam, status: legacyStatus } = await searchParams;
  const showDeleted = view === "deleted";
  const stage =
    showDeleted
      ? null
      : parsePipelineStageParam(stageParam) ??
        (legacyStatus ? LEGACY_STATUS_TO_STAGE[legacyStatus] ?? null : null);

  const visibleProjectIds = isOwnerAdmin(profile)
    ? ("all" as const)
    : await visibleProjectIdsFor(tenant.businessId, profile);

  const [{ projects, activeCount, hiddenCount, stageCounts }, staffAll, staffMap] =
    await Promise.all([
      loadPipelinePageProjects({
        showDeleted,
        stage,
        profile,
      }),
      listAssignableStaff(tenant.businessId),
      listProjectStaffUserIdsByBusiness(tenant.businessId),
    ]);

  // Staff must not receive the full business assignment graph in SSR HTML —
  // that leaks every project UUID and who is on it. Restrict to visible projects.
  const projectStaffIds: Record<string, string[]> = {};
  const visibleStaffIds = new Set<string>();
  for (const [projectId, userIds] of staffMap.entries()) {
    if (visibleProjectIds !== "all" && !visibleProjectIds.includes(projectId)) continue;
    projectStaffIds[projectId] = userIds;
    for (const uid of userIds) visibleStaffIds.add(uid);
  }
  // Same for the filter dropdown: staff must not see teammates on unseen projects.
  const staff =
    visibleProjectIds === "all"
      ? staffAll
      : staffAll.filter((s) => visibleStaffIds.has(s.id) || s.id === profile.id);

  // Saved per-user view preference. Hidden projects always use the Pipeline View.
  const viewCookie = (await cookies()).get(PROJECTS_VIEW_COOKIE)?.value;
  const savedView = parseProjectsViewCookie(viewCookie, profile.id);
  const inNewShell = (await getUiExperience(profile)).mode === "new";
  // New interface: Pipeline | List | Client | Grid | Calendar (same cookie, compatible format).
  const workspaceView = showDeleted ? "pipeline" : parseWorkspaceViewCookie(viewCookie, profile.id);
  const initialView = showDeleted ? "pipeline" : inNewShell ? (workspaceView === "client" ? "client" : "pipeline") : savedView;

  // Card extras (hero posters, storage) stream in after the board renders —
  // not awaited here, so they never hold up the page. One batch for all cards.
  const heroUrls = loadProjectHeroPosters(tenant.businessId, projects);
  const storageBytes = loadProjectStorageBytes(
    tenant.businessId,
    projects.map((p) => p.id)
  );

  const clientView =
    initialView === "client"
      ? await loadClientViewData({ businessId: tenant.businessId, profile, projects, heroUrls })
      : null;

  const stageConfig = stage ? PIPELINE_STAGE_CONFIG[stage] : null;
  const filteredCount = stage ? stageCounts[stage] : null;
  const isStaff = profile.role === "staff";
  const canCreate = !isStaff || staffCan(profile, "projects.create");

  if (inNewShell) {
    // Calendar view places shoots by the business's configured zone (same as the Shoot Calendar).
    const businessTimeZone = resolveBusinessTimeZone(
      (await getAppSettings(tenant.businessId)).workflow.businessDefaults.timezone
    ).timeZone;
    const owner = isOwnerAdmin(profile);
    return (
      <div className="min-h-screen bg-background">
        <main className="app-page app-page-wide mx-auto max-w-[100vw] px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
          <PageHeader
            title={showDeleted ? "Hidden Projects" : "Projects"}
            description={
              showDeleted
                ? `${hiddenCount} hidden project${hiddenCount === 1 ? "" : "s"}`
                : `${activeCount} active project${activeCount === 1 ? "" : "s"}`
            }
          />
          <ProjectsWorkspace
            projects={projects}
            stage={stage}
            stageLabel={stageConfig?.label}
            scrollToStatus={stageConfig?.scrollToStatus}
            staff={staff}
            projectStaffIds={projectStaffIds}
            currentUserId={profile.id}
            isStaff={isStaff}
            initialView={workspaceView}
            clientView={clientView}
            clientViewPermissions={
              showDeleted
                ? undefined
                : {
                    canCreateProject: canCreate,
                    canCreateClient: staffCan(profile, "clients.create"),
                    canOpenClients: staffCan(profile, "area.clients"),
                    canOpenCalendar: staffCan(profile, "area.calendar"),
                  }
            }
            heroUrls={heroUrls}
            storageBytes={storageBytes}
            showDeleted={showDeleted}
            activeCount={activeCount}
            hiddenCount={hiddenCount}
            canCreateProject={canCreate}
            canSeeHidden={!isStaff}
            businessTimeZone={businessTimeZone}
            bulkPermissions={{
              canEdit: staffCan(profile, "projects.edit"),
              canHide: staffCan(profile, "projects.delete"),
              canManageStaff: staffCan(profile, "projects.manage_staff"),
              // Permanent delete and Restore need business-admin access on the server.
              canDelete: owner && staffCan(profile, "projects.delete"),
              canDeleteMedia: owner && staffCan(profile, "media.delete"),
              canRestore: owner,
            }}
            calendarPermissions={{
              canManageStaff: staffCan(profile, "projects.manage_staff"),
              // Same rule as the Shoot Calendar's drag (PATCH /api/shoot-proposals update_date).
              canReschedule: staffCan(profile, "scheduling.confirm"),
              canEditDate: staffCan(profile, "projects.edit"),
            }}
          />
        </main>
      </div>
    );
  }

  const projectActions = (
    <div className="flex flex-wrap gap-2">
      {!isStaff && (
        <Link href={showDeleted ? "/admin/projects" : "/admin/projects?view=deleted"}>
          <Button variant="outline" size="sm">
            {showDeleted
              ? `Active projects (${activeCount})`
              : `Hidden projects (${hiddenCount})`}
          </Button>
        </Link>
      )}
      {!showDeleted && canCreate && (
        <Link href="/admin/projects/new">
          <Button variant="accent" size="sm">
            <Plus className="h-4 w-4" />
            New Project
          </Button>
        </Link>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={isStaff ? "staff" : "admin"} />
      <main className="app-page app-page-wide mx-auto max-w-[100vw] px-4 py-8 sm:px-6 lg:px-8">
        {/* New interface: Hidden / New Project join the staff-filter toolbar (one row under the
            top bar). Classic keeps them in the page heading, as before. */}
        <PageHeader
          title={showDeleted ? "Hidden Projects" : "Project Pipeline"}
          description={
            showDeleted
              ? `${hiddenCount} hidden project${hiddenCount === 1 ? "" : "s"}`
              : `${activeCount} active project${activeCount === 1 ? "" : "s"}`
          }
        >
          {inNewShell ? null : projectActions}
        </PageHeader>

        <AdminProjectsWithStaffFilter
          projects={projects}
          stage={stage}
          stageLabel={stageConfig?.label}
          scrollToStatus={stageConfig?.scrollToStatus}
          filteredCount={filteredCount}
          staff={staff}
          projectStaffIds={projectStaffIds}
          currentUserId={profile.id}
          isStaff={isStaff}
          initialView={initialView}
          clientView={clientView}
          heroUrls={heroUrls}
          storageBytes={storageBytes}
          toolbarEnd={inNewShell ? projectActions : undefined}
          clientViewPermissions={
            showDeleted
              ? undefined
              : {
                  canCreateProject: canCreate,
                  canCreateClient: staffCan(profile, "clients.create"),
                  canOpenClients: staffCan(profile, "area.clients"),
                  canOpenCalendar: staffCan(profile, "area.calendar"),
                }
          }
        />
      </main>
    </div>
  );
}
