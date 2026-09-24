/**
 * Admin global search across clients, projects, leads, media, staff, video
 * reviews, 3D models, and shared links.
 *
 * SECURITY:
 * - Always use createTenantServiceClient(businessId) — never unscoped service client.
 * - Never accept a client-supplied business_id; tenant comes from session.
 * - Callers must pass AdminSearchScope derived from the viewer profile.
 * - Staff results are hard-scoped to assigned projects + area permissions.
 * - Message bodies are intentionally excluded.
 */

import type { TenantServiceClient } from "@/lib/supabase/tenant-service";

export const ADMIN_SEARCH_MIN_CHARS = 2;
export const ADMIN_SEARCH_LIMIT_PER_TYPE = 10;

export type AdminSearchHitType =
  | "client"
  | "project"
  | "lead"
  | "media"
  | "staff"
  | "video_review"
  | "model_3d"
  | "share";

export type AdminSearchHit = {
  id: string;
  type: AdminSearchHitType;
  title: string;
  subtitle: string | null;
  href: string;
  score: number;
  updatedAt: string | null;
};

export type AdminSearchResults = {
  clients: AdminSearchHit[];
  projects: AdminSearchHit[];
  leads: AdminSearchHit[];
  media: AdminSearchHit[];
  staff: AdminSearchHit[];
  videoReviews: AdminSearchHit[];
  models3d: AdminSearchHit[];
  shares: AdminSearchHit[];
  /** Deliberate: message bodies are not indexed. */
  messagesIndexed: false;
};

/** Viewer scope — computed server-side from the session profile. */
export type AdminSearchScope = {
  /** Owner admin / super_admin see everything in-tenant. */
  isOwnerAdmin: boolean;
  /** "all" or explicit project UUID list. */
  visibleProjectIds: "all" | string[];
  areas: {
    clients: boolean;
    projects: boolean;
    media: boolean;
    /** Leads stay owner-admin only. */
    leads: boolean;
  };
  /** Staff entity search — owner admin only (staff_management never-delegable). */
  canSearchStaff: boolean;
  moneyView: boolean;
};

export function emptyAdminSearchResults(): AdminSearchResults {
  return {
    clients: [],
    projects: [],
    leads: [],
    media: [],
    staff: [],
    videoReviews: [],
    models3d: [],
    shares: [],
    messagesIndexed: false,
  };
}

/**
 * Sanitize for PostgREST filters. Keep commas/spaces (addresses) —
 * wildcards and quotes are stripped; values are always double-quoted in clauses.
 */
export function sanitizeSearchQuery(raw: string): string {
  return raw.replace(/[%_"]/g, "").trim().slice(0, 80);
}

export function normalizePhoneDigits(raw: string): string {
  return raw.replace(/[^0-9]+/g, "");
}

/** Quote an ilike pattern for PostgREST `.or()` filters. */
function ilikeClause(column: string, query: string): string {
  const pattern = `%${query}%`;
  return `${column}.ilike."${pattern.replace(/"/g, "")}"`;
}

function rankText(query: string, ...fields: (string | null | undefined)[]): number {
  const q = query.toLowerCase();
  let best = 0;
  for (const field of fields) {
    if (!field) continue;
    const v = field.toLowerCase();
    if (v === q) best = Math.max(best, 300);
    else if (v.startsWith(q)) best = Math.max(best, 200);
    else if (v.includes(q)) best = Math.max(best, 100);
  }
  return best;
}

function sortHits(hits: AdminSearchHit[]): AdminSearchHit[] {
  return [...hits].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aT = a.updatedAt ? Date.parse(a.updatedAt) : 0;
    const bT = b.updatedAt ? Date.parse(b.updatedAt) : 0;
    return bT - aT;
  });
}

function filterByVisibleProjects<T extends { project_id?: string | null }>(
  rows: T[],
  visible: "all" | string[]
): T[] {
  if (visible === "all") return rows;
  const set = new Set(visible);
  return rows.filter((r) => r.project_id && set.has(r.project_id));
}

async function loadClientIdsOnProjects(
  db: TenantServiceClient,
  projectIds: string[]
): Promise<Set<string>> {
  if (!projectIds.length) return new Set();
  const ids = new Set<string>();
  const { data: projects } = await db
    .from("projects")
    .select("id, client_id")
    .in("id", projectIds)
    .is("deleted_at", null);
  for (const p of projects ?? []) {
    if (p.client_id) ids.add(p.client_id as string);
  }
  const { data: junction } = await db
    .from("project_clients")
    .select("client_id")
    .in("project_id", projectIds);
  for (const j of junction ?? []) {
    if (j.client_id) ids.add(j.client_id as string);
  }
  return ids;
}

export async function runAdminSearch(
  db: TenantServiceClient,
  rawQuery: string,
  scope: AdminSearchScope
): Promise<AdminSearchResults> {
  const q = sanitizeSearchQuery(rawQuery);
  if (q.length < ADMIN_SEARCH_MIN_CHARS) {
    return emptyAdminSearchResults();
  }

  if (scope.visibleProjectIds !== "all" && scope.visibleProjectIds.length === 0) {
    return emptyAdminSearchResults();
  }

  const phoneDigits = normalizePhoneDigits(q);
  const limit = ADMIN_SEARCH_LIMIT_PER_TYPE;
  const projectScopeFilter =
    scope.visibleProjectIds === "all" ? null : scope.visibleProjectIds;

  const clientOrParts = [
    ilikeClause("name", q),
    ilikeClause("full_name", q),
    ilikeClause("email", q),
    ilikeClause("phone", q),
    ilikeClause("company", q),
  ];
  if (phoneDigits.length >= 3) {
    clientOrParts.push(ilikeClause("phone_digits", phoneDigits));
  }

  const leadOrParts = [
    ilikeClause("name", q),
    ilikeClause("email", q),
    ilikeClause("phone", q),
  ];
  if (phoneDigits.length >= 3) {
    leadOrParts.push(ilikeClause("phone_digits", phoneDigits));
  }

  const { data: matchingClients } = scope.areas.clients
    ? await db
        .from("clients")
        .select("id, name")
        .is("deleted_at", null)
        .or(clientOrParts.join(","))
        .limit(40)
    : { data: [] as { id: string; name: string }[] };

  let clientIds = (matchingClients ?? []).map((c) => c.id as string);
  const clientNameById = new Map(
    (matchingClients ?? []).map((c) => [c.id as string, c.name as string])
  );

  let allowedClientIds: Set<string> | null = null;
  if (!scope.isOwnerAdmin && scope.areas.clients && projectScopeFilter) {
    allowedClientIds = await loadClientIdsOnProjects(db, projectScopeFilter);
    clientIds = clientIds.filter((id) => allowedClientIds!.has(id));
  }

  const projectOr = [
    ilikeClause("project_name", q),
    ilikeClause("property_address", q),
    ilikeClause("service_type", q),
  ];
  if (clientIds.length) {
    projectOr.push(`client_id.in.(${clientIds.join(",")})`);
  }

  const wantProjects = scope.areas.projects;
  const wantClients = scope.areas.clients;
  const wantMedia = scope.areas.media;
  const wantLeads = scope.areas.leads;
  const wantStaff = scope.canSearchStaff;
  const wantProjectChildren = wantProjects;

  let projectsQuery = db
    .from("projects")
    .select(
      "id, project_name, property_address, service_type, client_id, updated_at, created_at, clients(name)"
    )
    .is("deleted_at", null)
    .or(projectOr.join(","))
    .limit(limit * 3);
  if (projectScopeFilter) {
    projectsQuery = projectsQuery.in("id", projectScopeFilter);
  }

  const runClients = async () => {
    if (!wantClients) return { data: [] as Record<string, unknown>[] };
    if (allowedClientIds && allowedClientIds.size === 0) {
      return { data: [] as Record<string, unknown>[] };
    }
    let cq = db
      .from("clients")
      .select("id, name, full_name, email, phone, company, updated_at, created_at")
      .is("deleted_at", null)
      .or(clientOrParts.join(","))
      .limit(limit * 3);
    if (allowedClientIds) {
      cq = cq.in("id", [...allowedClientIds]);
    }
    return cq;
  };

  const [
    clientsRes,
    projectsRes,
    leadsRes,
    mediaRes,
    staffRes,
    reviewsRes,
    modelsRes,
    sharesRes,
  ] = await Promise.all([
    runClients(),
    wantProjects ? projectsQuery : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    wantLeads
      ? db
          .from("leads")
          .select("id, name, email, phone, created_at")
          .or(leadOrParts.join(","))
          .limit(limit * 2)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    wantMedia
      ? (() => {
          let mq = db
            .from("media_assets")
            .select("id, title, file_name, project_id, created_at, updated_at")
            .or(`${ilikeClause("title", q)},${ilikeClause("file_name", q)}`)
            .limit(limit * 3);
          if (projectScopeFilter) {
            mq = mq.in("project_id", projectScopeFilter);
          }
          return mq;
        })()
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    wantStaff
      ? db.raw
          .from("profiles")
          .select("id, full_name, email, updated_at, created_at")
          .eq("business_id", db.businessId)
          .eq("role", "staff")
          .is("disabled_at", null)
          .or(`${ilikeClause("full_name", q)},${ilikeClause("email", q)}`)
          .limit(limit * 2)
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    wantProjectChildren
      ? (() => {
          let rq = db
            .from("video_reviews")
            .select("id, title, project_id, updated_at, created_at, projects(project_name)")
            .or(ilikeClause("title", q))
            .limit(limit * 3);
          if (projectScopeFilter) {
            rq = rq.in("project_id", projectScopeFilter);
          }
          return rq;
        })()
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    wantProjectChildren
      ? (() => {
          let mq = db
            .from("project_3d_models")
            .select(
              "id, title, project_id, provider, updated_at, created_at, projects(project_name)"
            )
            .or(ilikeClause("title", q))
            .limit(limit * 3);
          if (projectScopeFilter) {
            mq = mq.in("project_id", projectScopeFilter);
          }
          return mq;
        })()
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    wantProjectChildren
      ? (() => {
          let sq = db
            .from("project_shares")
            .select(
              "id, email, project_id, invited_at, last_accessed_at, revoked_at, projects(project_name)"
            )
            .is("revoked_at", null)
            .or(ilikeClause("email", q))
            .limit(limit * 3);
          if (projectScopeFilter) {
            sq = sq.in("project_id", projectScopeFilter);
          }
          return sq;
        })()
      : Promise.resolve({ data: [] as Record<string, unknown>[] }),
  ]);

  const clients: AdminSearchHit[] = sortHits(
    ((clientsRes as { data?: Record<string, unknown>[] }).data ?? []).map((row) => {
      const score = rankText(
        q,
        row.name as string,
        row.full_name as string,
        row.email as string,
        row.phone as string,
        row.company as string
      );
      const phoneBoost =
        phoneDigits.length >= 3 &&
        normalizePhoneDigits(String(row.phone ?? "")).includes(phoneDigits)
          ? 50
          : 0;
      return {
        id: row.id as string,
        type: "client" as const,
        title: (row.name as string) || (row.full_name as string) || "Client",
        subtitle:
          [row.email, row.company, row.phone].filter(Boolean).join(" · ") || null,
        href: `/admin/clients/${row.id}`,
        score: score + phoneBoost,
        updatedAt: (row.updated_at as string) || (row.created_at as string) || null,
      };
    })
  ).slice(0, limit);

  const projects: AdminSearchHit[] = sortHits(
    ((projectsRes as { data?: Record<string, unknown>[] }).data ?? []).map((row) => {
      const clientName =
        (row.clients as { name?: string } | null)?.name ||
        (row.client_id ? clientNameById.get(row.client_id as string) : null) ||
        null;
      const score = rankText(
        q,
        row.project_name as string,
        row.property_address as string,
        row.service_type as string,
        clientName
      );
      return {
        id: row.id as string,
        type: "project" as const,
        title: (row.project_name as string) || "Project",
        subtitle:
          [row.property_address, clientName, row.service_type].filter(Boolean).join(" · ") ||
          null,
        href: `/admin/projects/${row.id}`,
        score,
        updatedAt: (row.updated_at as string) || (row.created_at as string) || null,
      };
    })
  ).slice(0, limit);

  const leads: AdminSearchHit[] = sortHits(
    ((leadsRes as { data?: Record<string, unknown>[] }).data ?? []).map((row) => {
      const score = rankText(q, row.name as string, row.email as string, row.phone as string);
      const phoneBoost =
        phoneDigits.length >= 3 &&
        normalizePhoneDigits(String(row.phone ?? "")).includes(phoneDigits)
          ? 50
          : 0;
      return {
        id: row.id as string,
        type: "lead" as const,
        title: (row.name as string) || "Lead",
        subtitle: [row.email, row.phone].filter(Boolean).join(" · ") || null,
        href: `/admin/leads?q=${encodeURIComponent(q)}`,
        score: score + phoneBoost,
        updatedAt: (row.created_at as string) || null,
      };
    })
  ).slice(0, limit);

  const mediaRows = filterByVisibleProjects(
    ((mediaRes as { data?: Record<string, unknown>[] }).data ?? []) as {
      id: string;
      title?: string;
      file_name?: string;
      project_id?: string | null;
      updated_at?: string;
      created_at?: string;
    }[],
    scope.visibleProjectIds
  );
  const media: AdminSearchHit[] = sortHits(
    mediaRows.map((row) => {
      const score = rankText(q, row.title, row.file_name);
      const title = row.title || row.file_name || "Media";
      return {
        id: row.id,
        type: "media" as const,
        title,
        subtitle: row.file_name && row.file_name !== title ? row.file_name : null,
        href: `/admin/media?q=${encodeURIComponent(title.slice(0, 60))}`,
        score,
        updatedAt: row.updated_at || row.created_at || null,
      };
    })
  ).slice(0, limit);

  const staff: AdminSearchHit[] = sortHits(
    ((staffRes as { data?: Record<string, unknown>[] }).data ?? []).map((row) => {
      const score = rankText(q, row.full_name as string, row.email as string);
      return {
        id: row.id as string,
        type: "staff" as const,
        title: (row.full_name as string) || (row.email as string) || "Staff",
        subtitle: (row.email as string) || null,
        href: `/admin/settings#settings-staff`,
        score,
        updatedAt: (row.updated_at as string) || (row.created_at as string) || null,
      };
    })
  ).slice(0, limit);

  const videoReviews: AdminSearchHit[] = sortHits(
    filterByVisibleProjects(
      ((reviewsRes as { data?: Record<string, unknown>[] }).data ?? []) as {
        id: string;
        title?: string;
        project_id?: string;
        updated_at?: string;
        created_at?: string;
        projects?: { project_name?: string } | null;
      }[],
      scope.visibleProjectIds
    ).map((row) => {
      const projectName = row.projects?.project_name ?? null;
      const score = rankText(q, row.title, projectName);
      return {
        id: row.id,
        type: "video_review" as const,
        title: row.title || "Video review",
        subtitle: projectName,
        href: `/admin/projects/${row.project_id}/reviews/${row.id}`,
        score,
        updatedAt: row.updated_at || row.created_at || null,
      };
    })
  ).slice(0, limit);

  const models3d: AdminSearchHit[] = sortHits(
    filterByVisibleProjects(
      ((modelsRes as { data?: Record<string, unknown>[] }).data ?? []) as {
        id: string;
        title?: string;
        provider?: string;
        project_id?: string;
        updated_at?: string;
        created_at?: string;
        projects?: { project_name?: string } | null;
      }[],
      scope.visibleProjectIds
    ).map((row) => {
      const projectName = row.projects?.project_name ?? null;
      const score = rankText(q, row.title, row.provider, projectName);
      return {
        id: row.id,
        type: "model_3d" as const,
        title: row.title || "3D model",
        subtitle: [projectName, row.provider].filter(Boolean).join(" · ") || null,
        href: `/admin/projects/${row.project_id}#models`,
        score,
        updatedAt: row.updated_at || row.created_at || null,
      };
    })
  ).slice(0, limit);

  const shares: AdminSearchHit[] = sortHits(
    filterByVisibleProjects(
      ((sharesRes as { data?: Record<string, unknown>[] }).data ?? []) as {
        id: string;
        email?: string;
        project_id?: string;
        invited_at?: string;
        last_accessed_at?: string;
        projects?: { project_name?: string } | null;
      }[],
      scope.visibleProjectIds
    ).map((row) => {
      const projectName = row.projects?.project_name ?? null;
      const score = rankText(q, row.email, projectName);
      return {
        id: row.id,
        type: "share" as const,
        title: row.email || "Shared link",
        subtitle: projectName ? `Shared on ${projectName}` : "Shared link",
        href: `/admin/projects/${row.project_id}`,
        score,
        updatedAt: row.last_accessed_at || row.invited_at || null,
      };
    })
  ).slice(0, limit);

  return {
    clients,
    projects,
    leads,
    media,
    staff,
    videoReviews,
    models3d,
    shares,
    messagesIndexed: false,
  };
}

/** Settings entry ids that require money.view for staff (defense in depth). */
export const MONEY_SETTINGS_ENTRY_IDS = new Set([
  "payments",
  "download-gate",
  "download-quality",
  "services",
  "instant-preliminary",
]);
