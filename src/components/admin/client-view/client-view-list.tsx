"use client";

import Link from "next/link";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import { cn, formatDate } from "@/lib/utils";
import { ProjectStorageLabel } from "@/components/admin/project-card-extras";
import type { ProjectStorageMap } from "@/lib/project-storage";
import type { ProjectStatus } from "@/lib/constants";
import {
  formatCardDate,
  ProjectActionsButton,
  ServicePill,
  StagePill,
  type ClientViewProjectRow,
} from "@/components/admin/client-view/client-view-shared";

// Package + Updated columns only at xl, where there is room beside the client sidebar.
const GRID =
  "md:grid-cols-[minmax(0,1fr)_9.5rem_6.5rem_2.5rem] xl:grid-cols-[minmax(0,1fr)_10.5rem_minmax(0,10rem)_6.5rem_6rem_2.5rem]";

/** Same projects as the board, as rows — follows the selected sort. */
export function ClientViewList({
  projects,
  heroUrls,
  storageBytes,
  showClientName,
  canOpenClients,
  onMove,
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null;
  storageBytes?: Promise<ProjectStorageMap | null>;
  showClientName: boolean;
  canOpenClients: boolean;
  onMove: (project: ClientViewProjectRow, next: ProjectStatus) => void;
}) {
  if (projects.length === 0) {
    return <ClientViewEmpty message="No projects to show." />;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <div className={cn("hidden gap-3 border-b border-border bg-slate-50/80 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted surface-dark:bg-subtle/80 md:grid", GRID)}>
        <span>Project</span>
        <span>Stage</span>
        <span className="hidden xl:block">Package</span>
        <span>Shoot date</span>
        <span className="hidden xl:block">Updated</span>
        <span className="sr-only">Actions</span>
      </div>
      <ul className="divide-y divide-border">
        {projects.map((project) => {
          const date = formatCardDate(project);
          return (
            <li key={project.id} className="relative bg-card transition-colors hover:bg-slate-50/80 surface-dark:hover:bg-subtle/60">
              <Link
                href={`/admin/projects/${project.id}`}
                className={cn("grid grid-cols-[4rem_minmax(0,1fr)] items-center gap-3 px-3 py-2.5 pr-12 md:pr-3", GRID)}
              >
                <div className="flex min-w-0 items-center gap-3 max-md:contents">
                  {heroUrls ? (
                    <ProjectCoverImage src={heroUrls[project.id]} sizes="64px" className="h-11 w-16 shrink-0 rounded-md" />
                  ) : (
                    <div className="h-11 w-16 shrink-0 animate-pulse rounded-md bg-slate-200/80 surface-dark:bg-border/80" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-heading">{project.project_name}</p>
                    <p className="truncate text-xs text-muted">
                      {[showClientName ? project.clients?.name : null, project.property_address]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5 md:hidden">
                      <StagePill status={project.status} />
                      {date ? <span className="text-[11px] text-muted">{date}</span> : null}
                      <ProjectStorageLabel projectId={project.id} storage={storageBytes} className="text-[11px]" />
                    </div>
                  </div>
                </div>
                <div className="hidden min-w-0 md:block">
                  <StagePill status={project.status} />
                </div>
                <div className="hidden min-w-0 xl:block">
                  <ServicePill service={project.service_type} />
                </div>
                <span className="hidden whitespace-nowrap text-xs text-foreground md:block">
                  {date ?? <span className="text-muted">Not scheduled</span>}
                  <ProjectStorageLabel projectId={project.id} storage={storageBytes} className="mt-0.5 flex text-[11px]" />
                </span>
                <span className="hidden text-xs text-muted xl:block">{formatDate(project.updated_at)}</span>
              </Link>
              <ProjectActionsButton
                project={project}
                onMove={onMove}
                canOpenClients={canOpenClients}
                className="absolute right-2 top-1/2 -translate-y-1/2"
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ClientViewEmpty({ message, children }: { message: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border px-4 py-14 text-center">
      <p className="text-sm font-medium text-heading">{message}</p>
      {children}
    </div>
  );
}
