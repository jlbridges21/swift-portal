/**
 * New interface Projects page — pure helpers (views, saved view, sorting, filters).
 * Client-safe: no server imports. Classic keeps using lib/client-view.ts as before.
 */
import { projectMatchesServices } from "@/lib/project-service-names";
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/constants";
import type { PipelineProjectRow } from "@/lib/admin-project-pipeline";
import { projectShootAt } from "@/lib/client-view";

// ── Views ───────────────────────────────────────────────────────────────────

export type ProjectsWorkspaceView = "pipeline" | "list" | "client" | "grid" | "calendar";

export const PROJECTS_WORKSPACE_VIEWS: ProjectsWorkspaceView[] = ["pipeline", "list", "client", "grid", "calendar"];

/**
 * Same cookie as Classic (sp_projects_view). Value `<view>:<userId>`; Classic reads only
 * `client:<userId>` and treats everything else as Pipeline, so the formats stay compatible.
 */
export function parseWorkspaceViewCookie(value: string | null | undefined, userId: string): ProjectsWorkspaceView {
  if (!value || !userId) return "pipeline";
  const i = value.lastIndexOf(":");
  if (i < 0 || value.slice(i + 1) !== userId) return "pipeline";
  const view = value.slice(0, i) as ProjectsWorkspaceView;
  return PROJECTS_WORKSPACE_VIEWS.includes(view) ? view : "pipeline";
}

export function serializeWorkspaceViewCookie(view: ProjectsWorkspaceView, userId: string): string {
  return view === "pipeline" ? "pipeline" : `${view}:${userId}`;
}

// ── Payment status (from existing pipeline flags) ───────────────────────────

export type ProjectPaymentStatus = "paid" | "pending" | "none";

export const PAYMENT_STATUS_OPTIONS: { value: ProjectPaymentStatus; label: string }[] = [
  { value: "pending", label: "Invoice pending" },
  { value: "paid", label: "Paid" },
  { value: "none", label: "No payment yet" },
];

/** An open invoice wins over an earlier paid deposit: it's the thing that needs attention. */
export function projectPaymentStatus(p: Pick<PipelineProjectRow, "pendingPayment" | "paid">): ProjectPaymentStatus {
  if (p.pendingPayment) return "pending";
  if (p.paid) return "paid";
  return "none";
}

// ── Sorting ─────────────────────────────────────────────────────────────────

export type ProjectsSort = "updated" | "created_desc" | "created_asc" | "shoot_asc" | "shoot_desc" | "name_asc" | "name_desc";

export const PROJECTS_SORT_OPTIONS: { value: ProjectsSort; label: string }[] = [
  { value: "updated", label: "Recently Updated" },
  { value: "created_desc", label: "Newest Created" },
  { value: "created_asc", label: "Oldest Created" },
  { value: "shoot_asc", label: "Shoot Date: Soonest" },
  { value: "shoot_desc", label: "Shoot Date: Latest" },
  { value: "name_asc", label: "Project Name: A–Z" },
  { value: "name_desc", label: "Project Name: Z–A" },
];

export function isProjectsSort(v: unknown): v is ProjectsSort {
  return PROJECTS_SORT_OPTIONS.some((o) => o.value === v);
}

/** Stable sort; projects without a shoot date always sink to the end for shoot-date sorts. */
export function sortProjects<T extends PipelineProjectRow>(projects: T[], sort: ProjectsSort): T[] {
  const list = [...projects];
  const byUpdated = (a: T, b: T) => b.updated_at.localeCompare(a.updated_at);
  const byName = (a: T, b: T) => a.project_name.localeCompare(b.project_name, undefined, { sensitivity: "base", numeric: true });
  switch (sort) {
    case "created_desc":
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "created_asc":
      return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "shoot_asc":
    case "shoot_desc":
      return list.sort((a, b) => {
        const da = projectShootAt(a);
        const db = projectShootAt(b);
        if (da && db) return sort === "shoot_asc" ? da.localeCompare(db) : db.localeCompare(da);
        if (da) return -1;
        if (db) return 1;
        return byUpdated(a, b);
      });
    case "name_asc":
      return list.sort(byName);
    case "name_desc":
      return list.sort((a, b) => byName(b, a));
    default:
      return list.sort(byUpdated);
  }
}

// ── Filters ─────────────────────────────────────────────────────────────────

export type IsoRange = { from?: string; to?: string };

export type ProjectsFilters = {
  statuses: ProjectStatus[];
  services: string[];
  payments: ProjectPaymentStatus[];
  /** ISO bounds (inclusive) for the shoot date; unscheduled projects never match a set range. */
  shoot: IsoRange;
  created: IsoRange;
};

export const EMPTY_PROJECT_FILTERS: ProjectsFilters = { statuses: [], services: [], payments: [], shoot: {}, created: {} };

export function countActiveProjectFilters(f: ProjectsFilters, hasShootRange: boolean, hasCreatedRange: boolean): number {
  return (f.statuses.length ? 1 : 0) + (f.services.length ? 1 : 0) + (f.payments.length ? 1 : 0) + (hasShootRange ? 1 : 0) + (hasCreatedRange ? 1 : 0);
}

function inRange(iso: string | null, range: IsoRange): boolean {
  if (!range.from && !range.to) return true;
  if (!iso) return false;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return false;
  if (range.from && t < new Date(range.from).getTime()) return false;
  if (range.to && t > new Date(range.to).getTime()) return false;
  return true;
}

function matchesSearch(p: PipelineProjectRow, q: string): boolean {
  if (!q) return true;
  return [p.project_name, p.property_address, p.clients?.name, p.clients?.company, p.service_type]
    .filter(Boolean)
    .some((v) => (v as string).toLowerCase().includes(q));
}

/** All filters combine with AND; values inside one filter combine with OR. */
export function filterProjects<T extends PipelineProjectRow>(projects: T[], f: ProjectsFilters, search = ""): T[] {
  const q = search.trim().toLowerCase();
  return projects.filter(
    (p) =>
      (!f.statuses.length || f.statuses.includes(p.status)) &&
      projectMatchesServices(p, f.services) &&
      (!f.payments.length || f.payments.includes(projectPaymentStatus(p))) &&
      inRange(projectShootAt(p), f.shoot) &&
      inRange(p.created_at, f.created) &&
      matchesSearch(p, q)
  );
}

export const STATUS_OPTIONS = PROJECT_STATUSES.map((s) => ({ value: s.value as string, label: s.label as string }));
