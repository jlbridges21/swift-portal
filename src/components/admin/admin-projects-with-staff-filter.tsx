"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ProjectPipeline } from "@/components/admin/project-pipeline";
import { ClientViewToggle } from "@/components/admin/client-view/client-view-toggle";
import { ClientView, type ClientViewPermissions } from "@/components/admin/client-view/client-view";
import {
  AdminProjectsStaffFilter,
  projectMatchesStaffFilter,
} from "@/components/admin/admin-projects-staff-filter";
import type { PipelineProjectRow, PipelineStageParam } from "@/lib/admin-project-pipeline";
import type { ProjectStatus } from "@/lib/constants";
import type { ClientViewData } from "@/lib/client-view-data";
import {
  PROJECTS_VIEW_COOKIE,
  PROJECTS_VIEW_COOKIE_MAX_AGE,
  serializeProjectsViewCookie,
  type ProjectsViewMode,
} from "@/lib/client-view";

function saveViewPreference(view: ProjectsViewMode, userId: string) {
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${PROJECTS_VIEW_COOKIE}=${encodeURIComponent(
    serializeProjectsViewCookie(view, userId)
  )}; Path=/admin; Max-Age=${PROJECTS_VIEW_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
}

type StaffOption = { id: string; email: string; full_name: string | null };

export function AdminProjectsWithStaffFilter({
  projects,
  stage,
  stageLabel,
  scrollToStatus,
  filteredCount,
  staff,
  projectStaffIds,
  currentUserId,
  isStaff = false,
  initialView = "pipeline",
  clientView = null,
  clientViewPermissions,
}: {
  projects: PipelineProjectRow[];
  stage?: PipelineStageParam | null;
  stageLabel?: string;
  scrollToStatus?: ProjectStatus;
  filteredCount?: number | null;
  staff: StaffOption[];
  projectStaffIds: Record<string, string[]>;
  currentUserId?: string;
  /** Staff default filter: assigned to me. */
  isStaff?: boolean;
  /** From the saved per-user preference; null/absent → Pipeline View. */
  initialView?: ProjectsViewMode;
  /** Loaded server-side only while Client View is on. */
  clientView?: ClientViewData | null;
  /** When absent the Client View toggle is hidden (e.g. Hidden projects page). */
  clientViewPermissions?: ClientViewPermissions;
}) {
  const router = useRouter();
  const [view, setView] = useState<ProjectsViewMode>(initialView);
  const [refreshing, startRefresh] = useTransition();

  const [staffFilter, setStaffFilter] = useState<string[]>(() =>
    isStaff && currentUserId ? [currentUserId] : []
  );

  const visible = useMemo(
    () =>
      projects.filter((p) =>
        projectMatchesStaffFilter(p.id, staffFilter, projectStaffIds)
      ),
    [projects, staffFilter, projectStaffIds]
  );

  const staffFilteredCount =
    staffFilter.length > 0 ? visible.length : filteredCount ?? null;

  const clientViewOn = Boolean(clientViewPermissions) && view === "client";

  function toggleView() {
    const next: ProjectsViewMode = view === "client" ? "pipeline" : "client";
    setView(next);
    if (currentUserId) saveViewPreference(next, currentUserId);
    // Client View data (clients, hero images) is only loaded when the saved
    // preference says so — refresh once to fetch it.
    if (next === "client" && !clientView) startRefresh(() => router.refresh());
  }

  return (
    <div className="space-y-4">
      <AdminProjectsStaffFilter
        staff={staff}
        projectStaffIds={projectStaffIds}
        onFilterChange={setStaffFilter}
        defaultSelected={isStaff && currentUserId ? [currentUserId] : undefined}
        trailing={
          clientViewPermissions ? (
            <ClientViewToggle on={clientViewOn} onToggle={toggleView} loading={refreshing} />
          ) : null
        }
      />
      {clientViewOn && clientViewPermissions ? (
        <ClientView
          projects={visible}
          data={clientView}
          permissions={clientViewPermissions}
          stage={stage}
          stageLabel={stageLabel}
        />
      ) : (
        <ProjectPipeline
          projects={visible}
          stage={stage}
          stageLabel={stageLabel}
          scrollToStatus={scrollToStatus}
          filteredCount={staffFilteredCount}
        />
      )}
    </div>
  );
}
