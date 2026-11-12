"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Calendar, CreditCard, MapPin, Plus, User } from "lucide-react";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import { ProjectStorageLabel } from "@/components/admin/project-card-extras";
import {
  formatCardDate,
  ProjectActionsButton,
  ServicePill,
  StagePill,
  type ClientViewProjectRow,
} from "@/components/admin/client-view/client-view-shared";
import { CLIENT_VIEW_STAGES, STAGE_ACCENTS } from "@/lib/client-view";
import type { ProjectStatus } from "@/lib/constants";
import type { ProjectStorageMap } from "@/lib/project-storage";
import { projectPaymentStatus, type ProjectsSort } from "@/lib/projects-workspace";
import { cn } from "@/lib/utils";

type Move = (project: ClientViewProjectRow, next: ProjectStatus) => void;

/** Resolve the streamed hero-poster map (undefined while loading). */
export function useHeroUrls(promise?: Promise<Record<string, string | null>>) {
  const [urls, setUrls] = useState<Record<string, string | null> | null | undefined>(undefined);
  useEffect(() => {
    if (!promise) {
      setUrls(null);
      return;
    }
    let live = true;
    promise.then((m) => live && setUrls(m)).catch(() => live && setUrls(null));
    return () => {
      live = false;
    };
  }, [promise]);
  return urls;
}

function heroFor(urls: Record<string, string | null> | null | undefined, id: string): string | null | undefined {
  if (urls === undefined) return undefined;
  return urls ? urls[id] ?? null : null;
}

function PaymentBadge({ project, floating = false }: { project: ClientViewProjectRow; floating?: boolean }) {
  const status = projectPaymentStatus(project);
  if (status !== "pending") return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold text-orange-700 surface-dark:text-orange-300",
        floating ? "bg-white/95 shadow-sm surface-dark:bg-card/95" : "bg-orange-50 surface-dark:bg-orange-500/10"
      )}
    >
      <CreditCard className="h-3 w-3" aria-hidden /> Invoice pending
    </span>
  );
}

function Hero({ url, className, sizes }: { url: string | null | undefined; className: string; sizes: string }) {
  if (url === undefined) return <div className={cn("animate-pulse bg-slate-200/80 surface-dark:bg-border/80", className)} />;
  return <ProjectCoverImage src={url} sizes={sizes} className={cn("[&_img]:pointer-events-none", className)} />;
}

// ── Pipeline ────────────────────────────────────────────────────────────────

function PipelineCard({
  project,
  heroUrl,
  storageBytes,
  canOpenClients,
  onMove,
}: {
  project: ClientViewProjectRow;
  heroUrl: string | null | undefined;
  storageBytes?: Promise<ProjectStorageMap | null>;
  canOpenClients: boolean;
  onMove: Move;
}) {
  const date = formatCardDate(project);
  return (
    <article className="group relative overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
      <Link href={`/admin/projects/${project.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
        <Hero url={heroUrl} sizes="(max-width: 640px) 70vw, 280px" className="aspect-[16/8] w-full" />
        <div className="space-y-1 px-3 pb-2.5 pt-2.5">
          <h4 className="line-clamp-2 pr-6 text-sm font-semibold leading-snug text-heading group-hover:text-accent">{project.project_name}</h4>
          {project.property_address && project.property_address !== project.project_name ? (
            <p className="flex items-center gap-1.5 text-xs text-muted" title={project.property_address}>
              <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{project.property_address}</span>
            </p>
          ) : null}
          {project.clients?.name ? (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate">{project.clients.name}</span>
            </p>
          ) : null}
          <div className="flex min-w-0 flex-wrap items-center gap-1.5 pt-1">
            <ServicePill service={project.service_type} />
            <PaymentBadge project={project} />
          </div>
          <div className="flex items-center gap-2 pr-8 pt-1 text-xs text-muted">
            <p className="flex min-w-0 items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {date ? <span className="truncate text-foreground">{date}</span> : <span className="truncate">Not scheduled</span>}
            </p>
            <ProjectStorageLabel projectId={project.id} storage={storageBytes} className="ml-auto text-[11px]" />
          </div>
        </div>
      </Link>
      <ProjectActionsButton project={project} onMove={onMove} canOpenClients={canOpenClients} className="absolute bottom-1.5 right-1.5" />
    </article>
  );
}

/**
 * Kanban over the real workflow statuses. Cards inside a column follow the chosen sort;
 * dragging a card only changes its status (same PATCH as before), never a manual position.
 */
export function ProjectsBoard({
  projects,
  heroUrls,
  storageBytes,
  canOpenClients,
  canCreateProject,
  onMove,
  scrollToStatus,
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null | undefined;
  storageBytes?: Promise<ProjectStorageMap | null>;
  canOpenClients: boolean;
  canCreateProject: boolean;
  onMove: Move;
  scrollToStatus?: ProjectStatus;
}) {
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  useEffect(() => {
    if (!scrollToStatus) return;
    document.querySelector(`[data-stage="${scrollToStatus}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [scrollToStatus]);

  return (
    <div className="-mx-4 overflow-x-auto overscroll-x-contain scroll-smooth px-4 pb-3 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8 [scrollbar-width:thin]">
      <div className="flex min-w-max items-start gap-3">
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
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("projectId");
                setOverColumn(null);
                setDraggingId(null);
                const project = projects.find((p) => p.id === id);
                if (project && project.status !== stage.value) onMove(project, stage.value);
              }}
              className={cn(
                "flex w-[17rem] shrink-0 flex-col rounded-2xl border transition-colors xl:w-[18rem]",
                accent.tint,
                isOver ? "border-accent ring-2 ring-accent/20" : "border-border/70"
              )}
            >
              <header className="flex items-center gap-2 px-3 pb-2 pt-3">
                <span className={cn("h-5 w-1 shrink-0 rounded-full", accent.bar)} aria-hidden />
                <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-heading" title={stage.label}>
                  {stage.label}
                </h3>
                <span className="shrink-0 rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-muted">{items.length}</span>
              </header>

              <div className="flex flex-col gap-2.5 px-2.5 pb-2.5">
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
                    <PipelineCard
                      project={project}
                      heroUrl={heroFor(heroUrls, project.id)}
                      storageBytes={storageBytes}
                      canOpenClients={canOpenClients}
                      onMove={onMove}
                    />
                  </div>
                ))}
                {items.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border/80 bg-card/40 px-3 py-3 text-center text-xs text-muted">
                    {isOver ? "Drop to move here" : "No projects"}
                  </p>
                ) : null}
                {canCreateProject ? (
                  <Link
                    href={`/admin/projects/new?status=${stage.value}`}
                    className="flex h-9 items-center justify-center gap-1.5 rounded-xl text-sm font-medium text-muted transition-colors hover:bg-card/80 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <Plus className="h-4 w-4" aria-hidden /> Add Project
                  </Link>
                ) : null}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ── List ────────────────────────────────────────────────────────────────────

type Column = { label: string; asc?: ProjectsSort; desc?: ProjectsSort; className?: string };

function SortHeader({ col, sort, onSort }: { col: Column; sort: ProjectsSort; onSort: (s: ProjectsSort) => void }) {
  const sortable = col.asc || col.desc;
  const active = sort === col.asc ? "asc" : sort === col.desc ? "desc" : null;
  if (!sortable) return <th className={cn("px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide text-muted", col.className)}>{col.label}</th>;
  return (
    <th className={cn("px-3 py-2.5 text-left", col.className)} aria-sort={active === "asc" ? "ascending" : active === "desc" ? "descending" : "none"}>
      <button
        type="button"
        onClick={() => onSort(active === "desc" && col.asc ? col.asc : (col.desc ?? col.asc)!)}
        className={cn("inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide hover:text-heading", active ? "text-accent" : "text-muted")}
      >
        {col.label}
        {active === "asc" ? <ArrowUp className="h-3 w-3" aria-hidden /> : active === "desc" ? <ArrowDown className="h-3 w-3" aria-hidden /> : null}
      </button>
    </th>
  );
}

const PAYMENT_LABEL = { paid: "Paid", pending: "Invoice pending", none: "—" } as const;

export function ProjectsList({
  projects,
  heroUrls,
  sort,
  onSort,
  canOpenClients,
  onMove,
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null | undefined;
  sort: ProjectsSort;
  onSort: (s: ProjectsSort) => void;
  canOpenClients: boolean;
  onMove: Move;
}) {
  const router = useRouter();
  const updated = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
  const columns: Column[] = [
    { label: "Project", asc: "name_asc", desc: "name_desc", className: "w-auto" },
    { label: "Client", className: "hidden w-[15%] lg:table-cell" },
    { label: "Service", className: "hidden w-[11%] xl:table-cell" },
    { label: "Status", className: "hidden w-[17%] md:table-cell" },
    { label: "Shoot date", asc: "shoot_asc", desc: "shoot_desc", className: "hidden w-[14%] sm:table-cell" },
    { label: "Payment", className: "hidden w-[12%] lg:table-cell" },
    { label: "Updated", desc: "updated", className: "hidden w-[11%] xl:table-cell" },
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <table className="w-full table-fixed text-sm">
        <thead className="border-b border-border bg-subtle/60">
          <tr>
            {columns.map((c) => (
              <SortHeader key={c.label} col={c} sort={sort} onSort={onSort} />
            ))}
            <th className="w-12 px-2" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {projects.map((p) => {
            const date = formatCardDate(p);
            const pay = projectPaymentStatus(p);
            return (
              <tr key={p.id} onClick={() => router.push(`/admin/projects/${p.id}`)} className="cursor-pointer transition-colors hover:bg-subtle/60">
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <Hero url={heroFor(heroUrls, p.id)} sizes="72px" className="hidden h-11 w-16 shrink-0 rounded-lg sm:block" />
                    <div className="min-w-0">
                      <Link href={`/admin/projects/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-heading hover:text-accent">
                        {p.project_name}
                      </Link>
                      <p className="truncate text-xs text-muted">{p.property_address || p.clients?.name || "—"}</p>
                      <div className="mt-1 md:hidden">
                        <StagePill status={p.status} />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden truncate px-3 py-2.5 text-muted lg:table-cell">{p.clients?.name ?? "—"}</td>
                <td className="hidden px-3 py-2.5 xl:table-cell">
                  <ServicePill service={p.service_type} />
                </td>
                <td className="hidden px-3 py-2.5 md:table-cell">
                  <StagePill status={p.status} />
                </td>
                <td className="hidden truncate px-3 py-2.5 text-muted sm:table-cell">{date ?? "Not scheduled"}</td>
                <td className={cn("hidden px-3 py-2.5 text-xs lg:table-cell", pay === "pending" ? "font-semibold text-orange-600" : pay === "paid" ? "text-emerald-700 surface-dark:text-emerald-300" : "text-muted")}>
                  {PAYMENT_LABEL[pay]}
                </td>
                <td className="hidden truncate px-3 py-2.5 text-xs text-muted xl:table-cell">{updated.format(new Date(p.updated_at))}</td>
                <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <ProjectActionsButton project={p} onMove={onMove} canOpenClients={canOpenClients} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Grid ────────────────────────────────────────────────────────────────────

export function ProjectsGrid({
  projects,
  heroUrls,
  storageBytes,
  canOpenClients,
  onMove,
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null | undefined;
  storageBytes?: Promise<ProjectStorageMap | null>;
  canOpenClients: boolean;
  onMove: Move;
}) {
  return (
    <ul className="grid min-w-0 grid-cols-1 gap-4 min-[480px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {projects.map((p) => {
        const date = formatCardDate(p);
        return (
          <li key={p.id} className="min-w-0">
            <article className="group relative h-full overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow hover:shadow-md">
              <Link href={`/admin/projects/${p.id}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent">
                <div className="relative">
                  <Hero url={heroFor(heroUrls, p.id)} sizes="(min-width: 1536px) 18vw, (min-width: 1024px) 30vw, 90vw" className="aspect-[16/10] w-full" />
                  <span className="absolute left-2 top-2">
                    <StagePill status={p.status} className="bg-card/95 shadow-sm" />
                  </span>
                  <span className="absolute right-2 top-2">
                    <PaymentBadge project={p} floating />
                  </span>
                </div>
                <div className="space-y-1 px-3.5 pb-3 pt-2.5">
                  <h3 className="truncate pr-6 text-sm font-semibold text-heading group-hover:text-accent" title={p.project_name}>
                    {p.project_name}
                  </h3>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{p.property_address || "—"}</span>
                  </p>
                  {p.clients?.name ? (
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <User className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{p.clients.name}</span>
                    </p>
                  ) : null}
                  <div className="flex min-w-0 items-center gap-2 pr-8 pt-1">
                    <ServicePill service={p.service_type} />
                    <span className="flex min-w-0 items-center gap-1 text-xs text-muted">
                      <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
                      <span className="truncate">{date ?? "Not scheduled"}</span>
                    </span>
                  </div>
                  <ProjectStorageLabel projectId={p.id} storage={storageBytes} className="block text-[11px]" />
                </div>
              </Link>
              <ProjectActionsButton project={p} onMove={onMove} canOpenClients={canOpenClients} className="absolute bottom-2 right-2" />
            </article>
          </li>
        );
      })}
    </ul>
  );
}
