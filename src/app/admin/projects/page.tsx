import Link from "next/link";
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

  const stageConfig = stage ? PIPELINE_STAGE_CONFIG[stage] : null;
  const filteredCount = stage ? stageCounts[stage] : null;
  const isStaff = profile.role === "staff";
  const canCreate = !isStaff || staffCan(profile, "projects.create");

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={isStaff ? "staff" : "admin"} />
      <main className="mx-auto max-w-[100vw] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title={showDeleted ? "Hidden Projects" : "Project Pipeline"}
          description={
            showDeleted
              ? `${hiddenCount} hidden project${hiddenCount === 1 ? "" : "s"}`
              : `${activeCount} active project${activeCount === 1 ? "" : "s"}`
          }
        >
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
        />
      </main>
    </div>
  );
}
