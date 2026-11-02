"use client";

import { useState } from "react";
import Link from "next/link";
import { Calendar, CheckCircle2, CreditCard, MapPin, User } from "lucide-react";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import { CLIENT_VIEW_STAGES, STAGE_ACCENTS } from "@/lib/client-view";
import type { ProjectStatus } from "@/lib/constants";
import { cn } from "@/lib/utils";
import {
  formatCardDate,
  ProjectActionsButton,
  ServicePill,
  type ClientViewProjectRow,
} from "@/components/admin/client-view/client-view-shared";

export function ClientViewBoard({
  projects,
  heroUrls,
  showClientName,
  canOpenClients,
  onMove,
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null;
  showClientName: boolean;
  canOpenClients: boolean;
  onMove: (project: ClientViewProjectRow, next: ProjectStatus) => void;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  function handleDrop(e: React.DragEvent, status: ProjectStatus) {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("projectId");
    setOverColumn(null);
    setDraggingId(null);
    const project = projects.find((p) => p.id === projectId);
    if (project && project.status !== status) onMove(project, status);
  }

  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-3 sm:-mx-5 sm:px-5 [scrollbar-width:thin]">
      <div className="flex min-w-max gap-3">
        {CLIENT_VIEW_STAGES.map((stage) => {
          const items = projects.filter((p) => p.status === stage.value);
          const accent = STAGE_ACCENTS[stage.value];
          const isOver = overColumn === stage.value;
          return (
            <section
              key={stage.value}
              data-stage={stage.value}
              aria-label={`${stage.label}, ${items.length} project${items.length === 1 ? "" : "s"}`}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setOverColumn(stage.value);
              }}
              onDragLeave={() => setOverColumn(null)}
              onDrop={(e) => handleDrop(e, stage.value)}
              className={cn(
                "flex w-[16.5rem] shrink-0 flex-col rounded-2xl border transition-colors sm:w-[17.5rem]",
                accent.tint,
                isOver ? "border-accent ring-2 ring-accent/20" : "border-border/70"
              )}
            >
              <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                <span className={cn("h-5 w-1 shrink-0 rounded-full", accent.bar)} aria-hidden />
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-heading" title={stage.label}>
                  {stage.label}
                </h3>
                <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted">
                  {items.length}
                </span>
              </header>

              <div className="flex min-h-[14rem] flex-1 flex-col gap-3 px-2.5 pb-3">
                {items.map((project) => (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("projectId", project.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDraggingId(project.id);
                    }}
                    onDragEnd={() => {
                      setDraggingId(null);
                      setOverColumn(null);
                    }}
                    className={cn("cursor-grab active:cursor-grabbing", draggingId === project.id && "opacity-50")}
                  >
                    <ClientProjectCard
                      project={project}
                      heroUrl={heroUrls ? heroUrls[project.id] ?? null : undefined}
                      showClientName={showClientName}
                      canOpenClients={canOpenClients}
                      onMove={onMove}
                    />
                  </div>
                ))}

                {items.length === 0 ? (
                  <div className="flex flex-1 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/50 px-4 py-8 text-center">
                    <CheckCircle2 className="h-7 w-7 text-muted/60" aria-hidden />
                    <p className="mt-2 text-sm font-medium text-heading">No projects yet</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {stage.value === "delivered"
                        ? "Completed projects will appear here."
                        : "Drag a project here to move it."}
                    </p>
                  </div>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function ClientProjectCard({
  project,
  heroUrl,
  showClientName,
  canOpenClients,
  onMove,
}: {
  project: ClientViewProjectRow;
  /** undefined = still loading. */
  heroUrl: string | null | undefined;
  showClientName: boolean;
  canOpenClients: boolean;
  onMove: (project: ClientViewProjectRow, next: ProjectStatus) => void;
}) {
  const date = formatCardDate(project);
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/admin/projects/${project.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
        {heroUrl === undefined ? (
          <div className="aspect-[16/10] w-full animate-pulse bg-slate-200/80 surface-dark:bg-border/80" />
        ) : (
          <ProjectCoverImage src={heroUrl} sizes="(max-width: 640px) 70vw, 280px" className="aspect-[16/10] w-full" />
        )}
        <div className="space-y-1.5 p-3 pb-2.5">
          <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-heading group-hover:text-accent">
            {project.project_name}
          </h4>
          {project.property_address ? (
            <p className="flex items-center gap-1.5 text-xs text-muted" title={project.property_address}>
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{project.property_address}</span>
            </p>
          ) : null}
          {showClientName && project.clients?.name ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{project.clients.name}</span>
            </p>
          ) : null}
          <ServicePill service={project.service_type} />
          <p className="flex items-center gap-1.5 pr-8 pt-0.5 text-xs text-muted">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {date ? <span className="text-foreground">{date}</span> : <span>Not scheduled</span>}
          </p>
        </div>
      </Link>
      {project.pendingPayment ? (
        <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/95 px-2 py-0.5 text-[11px] font-medium text-orange-600 shadow-sm">
          <CreditCard className="h-3 w-3" aria-hidden /> Invoice pending
        </span>
      ) : null}
      <ProjectActionsButton
        project={project}
        onMove={onMove}
        canOpenClients={canOpenClients}
        className="absolute bottom-1.5 right-1.5"
      />
    </article>
  );
}
