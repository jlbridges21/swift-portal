"use client";

import { useMemo, useState } from "react";
import { ProjectPipeline } from "@/components/admin/project-pipeline";
import {
  AdminProjectsStaffFilter,
  projectMatchesStaffFilter,
} from "@/components/admin/admin-projects-staff-filter";
import type { PipelineProjectRow, PipelineStageParam } from "@/lib/admin-project-pipeline";
import type { ProjectStatus } from "@/lib/constants";

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
}) {
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

  return (
    <div className="space-y-4">
      <AdminProjectsStaffFilter
        staff={staff}
        projectStaffIds={projectStaffIds}
        onFilterChange={setStaffFilter}
        defaultSelected={isStaff && currentUserId ? [currentUserId] : undefined}
      />
      <ProjectPipeline
        projects={visible}
        stage={stage}
        stageLabel={stageLabel}
        scrollToStatus={scrollToStatus}
        filteredCount={staffFilteredCount}
      />
    </div>
  );
}
