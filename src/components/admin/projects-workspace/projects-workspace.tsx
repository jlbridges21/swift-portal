"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EyeOff, FolderKanban, Plus, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CheckboxOption } from "@/components/ui/checkbox-dropdown";
import { ClientView, type ClientViewPermissions } from "@/components/admin/client-view/client-view";
import { ClientViewCalendar } from "@/components/admin/client-view/client-view-calendar";
import { ClientProfileModalProvider } from "@/components/admin/client-view/client-profile-modal";
import { useProjectStageMove } from "@/components/admin/client-view/client-view-shared";
import { STAFF_FILTER_UNASSIGNED, projectMatchesStaffFilter } from "@/components/admin/admin-projects-staff-filter";
import type { PipelineProjectRow, PipelineStageParam } from "@/lib/admin-project-pipeline";
import type { ClientViewData } from "@/lib/client-view-data";
import { PROJECTS_VIEW_COOKIE, PROJECTS_VIEW_COOKIE_MAX_AGE } from "@/lib/client-view";
import { getStatusLabel, type ProjectStatus } from "@/lib/constants";
import type { ProjectStorageMap } from "@/lib/project-storage";
import {
  EMPTY_PROJECT_FILTERS,
  PAYMENT_STATUS_OPTIONS,
  filterProjects,
  isProjectsSort,
  serializeWorkspaceViewCookie,
  sortProjects,
  type ProjectPaymentStatus,
  type ProjectsFilters,
  type ProjectsSort,
  type ProjectsWorkspaceView,
} from "@/lib/projects-workspace";
import { cn } from "@/lib/utils";
import {
  ActiveChips,
  CREATED_PRESETS,
  EMPTY_PANEL,
  FilterPanel,
  FiltersButton,
  ProjectSearch,
  ProjectsViewSelector,
  SHOOT_PRESETS,
  SortSelect,
  StaffDropdown,
  dateRangeIso,
  describeDate,
  isDateActive,
  type ActiveChip,
  type FilterPanelState,
} from "@/components/admin/projects-workspace/projects-toolbar";
import { ProjectsBoard, ProjectsGrid, ProjectsList, useHeroUrls } from "@/components/admin/projects-workspace/projects-views";

type StaffOption = { id: string; email: string; full_name: string | null };

const STAFF_KEY = "admin.projects.staffFilter";
const SORT_KEY = "sp:projects:sort";

function readSession<T>(key: string, storage: "session" | "local"): T | null {
  try {
    const raw = (storage === "session" ? sessionStorage : localStorage).getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeStore(key: string, value: unknown, storage: "session" | "local") {
  try {
    (storage === "session" ? sessionStorage : localStorage).setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked */
  }
}

/**
 * New interface Projects page: Pipeline (default) | List | Client | Grid | Calendar, with
 * Filters, Staff and Sort in one toolbar and Hidden Projects / New Project always on the right.
 * Classic keeps AdminProjectsWithStaffFilter unchanged.
 */
export function ProjectsWorkspace({
  projects,
  stage,
  stageLabel,
  scrollToStatus,
  staff,
  projectStaffIds,
  currentUserId,
  isStaff,
  initialView,
  clientView,
  clientViewPermissions,
  heroUrls,
  storageBytes,
  showDeleted,
  activeCount,
  hiddenCount,
  canCreateProject,
  canSeeHidden,
}: {
  projects: PipelineProjectRow[];
  stage?: PipelineStageParam | null;
  stageLabel?: string;
  scrollToStatus?: ProjectStatus;
  staff: StaffOption[];
  projectStaffIds: Record<string, string[]>;
  currentUserId: string;
  isStaff: boolean;
  initialView: ProjectsWorkspaceView;
  clientView: ClientViewData | null;
  /** Absent on the Hidden projects page (no Client view there). */
  clientViewPermissions?: ClientViewPermissions;
  heroUrls?: Promise<Record<string, string | null>>;
  storageBytes?: Promise<ProjectStorageMap | null>;
  showDeleted: boolean;
  activeCount: number;
  hiddenCount: number;
  canCreateProject: boolean;
  canSeeHidden: boolean;
}) {
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const showClient = Boolean(clientViewPermissions);
  const [view, setView] = useState<ProjectsWorkspaceView>(initialView === "client" && !showClient ? "pipeline" : initialView);
  const [sort, setSort] = useState<ProjectsSort>("updated");
  const [search, setSearch] = useState("");
  const [panel, setPanel] = useState<FilterPanelState>(EMPTY_PANEL);
  const [staffSel, setStaffSel] = useState<string[]>(() => (isStaff ? [currentUserId] : []));

  // Session/local conveniences (staff filter shared with Classic's "Filter by staff").
  useEffect(() => {
    const stored = readSession<string[]>(STAFF_KEY, "session");
    if (Array.isArray(stored) && stored.length) setStaffSel(stored.filter((v) => typeof v === "string"));
    const s = readSession<string>(SORT_KEY, "local");
    if (isProjectsSort(s)) setSort(s);
  }, []);

  function changeView(next: ProjectsWorkspaceView) {
    setView(next);
    const secure = window.location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${PROJECTS_VIEW_COOKIE}=${encodeURIComponent(serializeWorkspaceViewCookie(next, currentUserId))}; Path=/admin; Max-Age=${PROJECTS_VIEW_COOKIE_MAX_AGE}; SameSite=Lax${secure}`;
    // Client view data (clients + junctions) is only loaded server-side when it's the saved view.
    if (next === "client" && !clientView) startRefresh(() => router.refresh());
  }

  const staffOptions: CheckboxOption[] = useMemo(
    () => [
      { value: STAFF_FILTER_UNASSIGNED, label: "Unassigned" },
      ...staff.map((s) => ({ value: s.id, label: s.id === currentUserId ? `${s.full_name || s.email} (me)` : s.full_name || s.email })),
    ],
    [staff, currentUserId]
  );

  function changeStaff(next: string[]) {
    setStaffSel(next);
    writeStore(STAFF_KEY, next, "session");
  }
  function changeSort(next: ProjectsSort) {
    setSort(next);
    writeStore(SORT_KEY, next, "local");
  }

  const staffFiltered = useMemo(
    () => projects.filter((p) => projectMatchesStaffFilter(p.id, staffSel, projectStaffIds)),
    [projects, staffSel, projectStaffIds]
  );
  const { moveProject, projects: moved } = useProjectStageMove(staffFiltered);

  const filters: ProjectsFilters = useMemo(
    () => ({
      ...EMPTY_PROJECT_FILTERS,
      statuses: panel.statuses as ProjectStatus[],
      services: panel.services,
      payments: panel.payments as ProjectPaymentStatus[],
      shoot: dateRangeIso(panel.shoot, SHOOT_PRESETS),
      created: dateRangeIso(panel.created, CREATED_PRESETS),
    }),
    [panel]
  );
  const shown = useMemo(() => sortProjects(filterProjects(moved, filters, search), sort), [moved, filters, search, sort]);
  const serviceOptions = useMemo(() => [...new Set(projects.map((p) => p.service_type).filter(Boolean))].sort(), [projects]);
  const hero = useHeroUrls(heroUrls);

  const panelCount =
    (panel.statuses.length ? 1 : 0) +
    (panel.services.length ? 1 : 0) +
    (panel.payments.length ? 1 : 0) +
    (isDateActive(panel.shoot) ? 1 : 0) +
    (isDateActive(panel.created) ? 1 : 0);
  const filterBadge = panelCount + (staffSel.length ? 1 : 0);

  const clearAll = () => {
    setPanel(EMPTY_PANEL);
    setSearch("");
    changeStaff([]);
  };

  const chips: ActiveChip[] = [];
  const list = (vals: string[], opts: { value: string; label: string }[]) => vals.map((v) => opts.find((o) => o.value === v)?.label ?? v).join(", ");
  if (panel.statuses.length) chips.push({ key: "status", label: panel.statuses.map((s) => getStatusLabel(s)).join(", "), clear: () => setPanel({ ...panel, statuses: [] }) });
  if (panel.services.length) chips.push({ key: "service", label: panel.services.join(", "), clear: () => setPanel({ ...panel, services: [] }) });
  if (panel.payments.length) chips.push({ key: "payment", label: list(panel.payments, PAYMENT_STATUS_OPTIONS), clear: () => setPanel({ ...panel, payments: [] }) });
  if (isDateActive(panel.shoot)) chips.push({ key: "shoot", label: `Shoot: ${describeDate(panel.shoot, SHOOT_PRESETS)}`, clear: () => setPanel({ ...panel, shoot: EMPTY_PANEL.shoot }) });
  if (isDateActive(panel.created)) chips.push({ key: "created", label: `Created: ${describeDate(panel.created, CREATED_PRESETS)}`, clear: () => setPanel({ ...panel, created: EMPTY_PANEL.created }) });
  if (staffSel.length) chips.push({ key: "staff", label: `Staff: ${list(staffSel, staffOptions)}`, clear: () => changeStaff([]) });
  if (search.trim()) chips.push({ key: "q", label: `“${search.trim()}”`, clear: () => setSearch("") });

  const clientMode = view === "client";
  const resultsLabel = `${shown.length.toLocaleString()} project${shown.length === 1 ? "" : "s"}`;
  const canOpenClients = clientViewPermissions?.canOpenClients ?? false;

  const actions = (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {canSeeHidden ? (
        <Link
          href={showDeleted ? "/admin/projects" : "/admin/projects?view=deleted"}
          aria-label={showDeleted ? `Active projects (${activeCount})` : `Hidden projects (${hiddenCount})`}
          className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-2.5 text-sm font-semibold text-heading shadow-sm hover:bg-subtle sm:gap-2 sm:px-3"
          title={showDeleted ? "Back to active projects" : "Hidden projects"}
        >
          {showDeleted ? <FolderKanban className="h-4 w-4 text-muted" aria-hidden /> : <EyeOff className="h-4 w-4 text-muted" aria-hidden />}
          <span className="hidden sm:inline">{showDeleted ? "Active Projects" : "Hidden Projects"}</span>
          <span className="rounded-full bg-subtle px-1.5 text-xs tabular-nums text-muted">{showDeleted ? activeCount : hiddenCount}</span>
        </Link>
      ) : null}
      {!showDeleted && canCreateProject ? (
        <Link
          href="/admin/projects/new"
          aria-label="New project"
          className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent px-2.5 text-sm font-semibold text-accent-foreground shadow-sm hover:opacity-90 min-[400px]:px-3 sm:px-4"
        >
          <Plus className="h-4 w-4" aria-hidden />
          <span className="hidden sm:inline">New Project</span>
          <span className="hidden min-[400px]:inline sm:hidden">New</span>
        </Link>
      ) : null}
    </div>
  );

  return (
    <ClientProfileModalProvider>
      <div className="min-w-0 space-y-3">
        {/* Row 1: views + Hidden/New. Filters, Staff, Sort and search sit on a compact row 2,
            joining row 1 only on very wide screens where everything fits comfortably. */}
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="order-1 min-w-0 flex-1 sm:flex-none">
            <ProjectsViewSelector value={view} onChange={changeView} showClient={showClient} loading={refreshing} />
          </div>
          <div className="order-2 ml-auto min-[1760px]:order-3">{actions}</div>
          <div
            className={cn(
              "order-3 flex w-full min-w-0 items-center gap-2 min-[1760px]:order-2 min-[1760px]:w-auto min-[1760px]:flex-1",
              clientMode && "min-[1760px]:flex-none"
            )}
          >
            {!clientMode ? (
              <>
                <FiltersButton
                  activeCount={filterBadge}
                  resultsLabel={resultsLabel}
                  onClearAll={clearAll}
                  renderPanel={({ includeStaff }) => (
                    <FilterPanel value={{ ...panel, staff: staffSel }} onChange={(v) => {
                      setPanel({ ...v, staff: [] });
                      if (includeStaff && v.staff.join() !== staffSel.join()) changeStaff(v.staff);
                    }} serviceOptions={serviceOptions} staffOptions={staffOptions} includeStaff={includeStaff} />
                  )}
                />
                {staff.length ? <StaffDropdown options={staffOptions} selected={staffSel} onChange={changeStaff} /> : null}
                <SortSelect value={sort} onChange={changeSort} />
                <ProjectSearch value={search} onChange={setSearch} className="min-w-0 flex-1 sm:max-w-xs" />
              </>
            ) : staff.length ? (
              <StaffDropdown options={staffOptions} selected={staffSel} onChange={changeStaff} />
            ) : null}
          </div>
        </div>

        {!clientMode ? <ActiveChips chips={chips} onClearAll={clearAll} /> : null}

        {stage && stageLabel ? (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="inline-flex h-8 items-center gap-1 rounded-lg border border-accent/25 bg-accent-subtle/70 pl-2.5 pr-1 font-medium text-accent">
              Showing: {stageLabel} ({projects.length})
              <Link href="/admin/projects" aria-label="Clear stage filter" className="ml-1 rounded-md px-1.5 hover:bg-accent/10">
                ×
              </Link>
            </span>
          </div>
        ) : null}

        {clientMode && clientViewPermissions ? (
          <ClientView projects={staffFiltered} data={clientView} permissions={clientViewPermissions} stage={stage} stageLabel={stageLabel} storageBytes={storageBytes} />
        ) : shown.length === 0 && view !== "pipeline" ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
            <SearchX className="h-7 w-7 text-muted" aria-hidden />
            <p className="text-sm font-medium text-heading">{projects.length ? "No projects match your filters." : showDeleted ? "No hidden projects." : "No projects yet."}</p>
            {projects.length ? (
              <Button variant="outline" className="min-h-10" onClick={clearAll}>
                Clear filters
              </Button>
            ) : !showDeleted && canCreateProject ? (
              <Link href="/admin/projects/new" className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-accent px-4 text-sm font-semibold text-accent-foreground">
                <Plus className="h-4 w-4" aria-hidden /> New Project
              </Link>
            ) : null}
          </div>
        ) : view === "list" ? (
          <ProjectsList projects={shown} heroUrls={hero} sort={sort} onSort={changeSort} canOpenClients={canOpenClients} onMove={moveProject} />
        ) : view === "grid" ? (
          <ProjectsGrid projects={shown} heroUrls={hero} storageBytes={storageBytes} canOpenClients={canOpenClients} onMove={moveProject} />
        ) : view === "calendar" ? (
          <section className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
            <ClientViewCalendar projects={shown} heroUrls={hero ?? null} showClientName canOpenCalendar={clientViewPermissions?.canOpenCalendar ?? false} />
          </section>
        ) : (
          <>
            {shown.length === 0 && projects.length > 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <SearchX className="h-4 w-4" aria-hidden /> No projects match your filters.
                <button type="button" onClick={clearAll} className="font-semibold text-accent hover:underline">
                  Clear filters
                </button>
              </p>
            ) : null}
            <ProjectsBoard
              projects={shown}
              heroUrls={hero}
              storageBytes={storageBytes}
              canOpenClients={canOpenClients}
              canCreateProject={!showDeleted && canCreateProject}
              onMove={moveProject}
              scrollToStatus={scrollToStatus}
            />
          </>
        )}
      </div>
    </ClientProfileModalProvider>
  );
}
