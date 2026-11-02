/**
 * Client View for /admin/projects — pure helpers shared by the server page,
 * the client components, and scripts/verify-client-view.ts.
 *
 * No server-only imports here: this file must stay safe for "use client".
 */
import { PROJECT_STATUSES, type ProjectStatus } from "@/lib/constants";

// ── NEW badge ────────────────────────────────────────────────────────────────

/** Jan 1 2027 12:00 AM Central (CST = UTC−6). Checked at runtime, no redeploy. */
export const CLIENT_VIEW_NEW_BADGE_EXPIRES_AT = "2027-01-01T06:00:00.000Z";

export function isClientViewNewBadgeActive(now: Date | number = Date.now()): boolean {
  const t = typeof now === "number" ? now : now.getTime();
  return t < Date.parse(CLIENT_VIEW_NEW_BADGE_EXPIRES_AT);
}

// ── Saved view preference (per user, cookie so SSR renders the right view) ──

export type ProjectsViewMode = "pipeline" | "client";

export const PROJECTS_VIEW_COOKIE = "sp_projects_view";
export const PROJECTS_VIEW_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

/**
 * Cookie value is `client:<userId>`. Anything else — missing, "pipeline", or a
 * different user on the same browser — means the default Pipeline View.
 */
export function parseProjectsViewCookie(
  value: string | null | undefined,
  userId: string
): ProjectsViewMode {
  if (!value || !userId) return "pipeline";
  return value === `client:${userId}` ? "client" : "pipeline";
}

export function serializeProjectsViewCookie(view: ProjectsViewMode, userId: string): string {
  return view === "client" ? `client:${userId}` : "pipeline";
}

// ── Clients + filtering ─────────────────────────────────────────────────────

export const ALL_CLIENTS = "all";

export interface ClientViewClient {
  id: string;
  name: string;
  company: string | null;
  /** Null when the viewer may not see client contact details. */
  email: string | null;
  phone: string | null;
}

export interface ClientViewProject {
  id: string;
  project_name: string;
  property_address: string;
  service_type: string;
  status: ProjectStatus;
  shoot_date: string | null;
  created_at: string;
  updated_at: string;
  client_id?: string | null;
  confirmedShootAt?: string | null;
}

/** project_id → client ids (primary client_id + project_clients junction). */
export type ProjectClientMap = Record<string, string[]>;

export function clientIdsForProject(
  project: Pick<ClientViewProject, "id" | "client_id">,
  map: ProjectClientMap
): string[] {
  const ids = new Set(map[project.id] ?? []);
  if (project.client_id) ids.add(project.client_id);
  return [...ids];
}

export function filterProjectsByClient<T extends Pick<ClientViewProject, "id" | "client_id">>(
  projects: T[],
  clientId: string,
  map: ProjectClientMap
): T[] {
  if (!clientId || clientId === ALL_CLIENTS) return projects;
  return projects.filter((p) => clientIdsForProject(p, map).includes(clientId));
}

export function countProjectsByClient(
  projects: Pick<ClientViewProject, "id" | "client_id">[],
  map: ProjectClientMap
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const p of projects) {
    for (const id of clientIdsForProject(p, map)) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

export function searchClients<T extends Pick<ClientViewClient, "name" | "company" | "email">>(
  clients: T[],
  query: string
): T[] {
  const q = query.trim().toLowerCase();
  if (!q) return clients;
  return clients.filter((c) =>
    [c.name, c.company, c.email].some((v) => v?.toLowerCase().includes(q))
  );
}

export function filterProjectsByService<T extends Pick<ClientViewProject, "service_type">>(
  projects: T[],
  services: string[]
): T[] {
  if (services.length === 0) return projects;
  return projects.filter((p) => services.includes(p.service_type));
}

// ── Sorting + dates ─────────────────────────────────────────────────────────

export type ClientViewSort = "updated" | "shoot_date" | "newest" | "name";

export const CLIENT_VIEW_SORTS: { value: ClientViewSort; label: string }[] = [
  { value: "updated", label: "Updated" },
  { value: "shoot_date", label: "Shoot date" },
  { value: "newest", label: "Newest" },
  { value: "name", label: "Name" },
];

/** Same rule the Pipeline cards use: confirmed shoot time, else shoot_date. */
export function projectShootAt(
  project: Pick<ClientViewProject, "confirmedShootAt" | "shoot_date">
): string | null {
  return project.confirmedShootAt ?? (project.shoot_date ? `${project.shoot_date}T09:00:00.000Z` : null);
}

export function sortClientViewProjects<T extends ClientViewProject>(
  projects: T[],
  sort: ClientViewSort
): T[] {
  const list = [...projects];
  switch (sort) {
    case "name":
      return list.sort((a, b) => a.project_name.localeCompare(b.project_name));
    case "newest":
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "shoot_date":
      // Soonest first; projects without a date sink to the bottom.
      return list.sort((a, b) => {
        const da = projectShootAt(a);
        const db = projectShootAt(b);
        if (da && db) return da.localeCompare(db);
        if (da) return -1;
        if (db) return 1;
        return b.updated_at.localeCompare(a.updated_at);
      });
    case "updated":
    default:
      return list.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
  }
}

// ── Stage accents (visual only; stages come from PROJECT_STATUSES) ──────────

export const STAGE_ACCENTS: Record<ProjectStatus, { bar: string; tint: string }> = {
  new_request: { bar: "bg-blue-500", tint: "bg-blue-50/60 surface-dark:bg-blue-500/5" },
  quote_sent: { bar: "bg-violet-500", tint: "bg-violet-50/60 surface-dark:bg-violet-500/5" },
  proposal_approved: { bar: "bg-amber-400", tint: "bg-amber-50/60 surface-dark:bg-amber-500/5" },
  scheduled: { bar: "bg-sky-500", tint: "bg-sky-50/60 surface-dark:bg-sky-500/5" },
  shoot_complete_editing: { bar: "bg-indigo-500", tint: "bg-indigo-50/60 surface-dark:bg-indigo-500/5" },
  ready_for_review: { bar: "bg-pink-500", tint: "bg-pink-50/60 surface-dark:bg-pink-500/5" },
  awaiting_payment: { bar: "bg-orange-500", tint: "bg-orange-50/60 surface-dark:bg-orange-500/5" },
  delivered: { bar: "bg-emerald-500", tint: "bg-emerald-50/60 surface-dark:bg-emerald-500/5" },
};

export const CLIENT_VIEW_STAGES = PROJECT_STATUSES;
