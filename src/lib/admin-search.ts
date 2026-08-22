/**
 * Admin global search across clients, projects, leads, and media.
 *
 * SECURITY:
 * - Always use createTenantServiceClient(businessId) — never unscoped service client.
 * - Never accept a client-supplied business_id; tenant comes from session.
 * - Admin-only (callers must requireAdmin). Not exposed in the client portal.
 *
 * Message bodies are intentionally excluded — conversations are sensitive and
 * full-text over them is a separate product decision.
 */

import type { TenantServiceClient } from "@/lib/supabase/tenant-service";

export const ADMIN_SEARCH_MIN_CHARS = 2;
export const ADMIN_SEARCH_LIMIT_PER_TYPE = 10;

export type AdminSearchHit = {
  id: string;
  type: "client" | "project" | "lead" | "media";
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
  /** Deliberate: message bodies are not indexed. */
  messagesIndexed: false;
};

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

export async function runAdminSearch(
  db: TenantServiceClient,
  rawQuery: string
): Promise<AdminSearchResults> {
  const q = sanitizeSearchQuery(rawQuery);
  if (q.length < ADMIN_SEARCH_MIN_CHARS) {
    return { clients: [], projects: [], leads: [], media: [], messagesIndexed: false };
  }

  const phoneDigits = normalizePhoneDigits(q);
  const limit = ADMIN_SEARCH_LIMIT_PER_TYPE;

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

  const { data: matchingClients } = await db
    .from("clients")
    .select("id, name")
    .is("deleted_at", null)
    .or(clientOrParts.join(","))
    .limit(40);

  const clientIds = (matchingClients ?? []).map((c) => c.id as string);
  const clientNameById = new Map(
    (matchingClients ?? []).map((c) => [c.id as string, c.name as string])
  );

  const projectOr = [
    ilikeClause("project_name", q),
    ilikeClause("property_address", q),
    ilikeClause("service_type", q),
  ];
  if (clientIds.length) {
    projectOr.push(`client_id.in.(${clientIds.join(",")})`);
  }

  const [clientsRes, projectsRes, leadsRes, mediaRes] = await Promise.all([
    db
      .from("clients")
      .select("id, name, full_name, email, phone, company, updated_at, created_at")
      .is("deleted_at", null)
      .or(clientOrParts.join(","))
      .limit(limit * 2),
    db
      .from("projects")
      .select(
        "id, project_name, property_address, service_type, client_id, updated_at, created_at, clients(name)"
      )
      .is("deleted_at", null)
      .or(projectOr.join(","))
      .limit(limit * 2),
    db
      .from("leads")
      .select("id, name, email, phone, created_at")
      .or(leadOrParts.join(","))
      .limit(limit * 2),
    db
      .from("media_assets")
      .select("id, title, file_name, created_at, updated_at")
      .or(`${ilikeClause("title", q)},${ilikeClause("file_name", q)}`)
      .limit(limit * 2),
  ]);

  const clients: AdminSearchHit[] = sortHits(
    (clientsRes.data ?? []).map((row) => {
      const score = rankText(q, row.name, row.full_name, row.email, row.phone, row.company);
      const phoneBoost =
        phoneDigits.length >= 3 &&
        normalizePhoneDigits(String(row.phone ?? "")).includes(phoneDigits)
          ? 50
          : 0;
      return {
        id: row.id as string,
        type: "client" as const,
        title: (row.name as string) || (row.full_name as string) || "Client",
        subtitle: [row.email, row.company, row.phone].filter(Boolean).join(" · ") || null,
        href: `/admin/clients/${row.id}`,
        score: score + phoneBoost,
        updatedAt: (row.updated_at as string) || (row.created_at as string) || null,
      };
    })
  ).slice(0, limit);

  const projects: AdminSearchHit[] = sortHits(
    (projectsRes.data ?? []).map((row) => {
      const clientName =
        (row.clients as { name?: string } | null)?.name ||
        (row.client_id ? clientNameById.get(row.client_id as string) : null) ||
        null;
      const score = rankText(
        q,
        row.project_name,
        row.property_address,
        row.service_type,
        clientName
      );
      return {
        id: row.id as string,
        type: "project" as const,
        title: (row.project_name as string) || "Project",
        subtitle:
          [row.property_address, clientName, row.service_type].filter(Boolean).join(" · ") || null,
        href: `/admin/projects/${row.id}`,
        score,
        updatedAt: (row.updated_at as string) || (row.created_at as string) || null,
      };
    })
  ).slice(0, limit);

  const leads: AdminSearchHit[] = sortHits(
    (leadsRes.data ?? []).map((row) => {
      const score = rankText(q, row.name, row.email, row.phone);
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

  const media: AdminSearchHit[] = sortHits(
    (mediaRes.data ?? []).map((row) => {
      const score = rankText(q, row.title, row.file_name);
      const title = (row.title as string) || (row.file_name as string) || "Media";
      return {
        id: row.id as string,
        type: "media" as const,
        title,
        subtitle: row.file_name && row.file_name !== title ? (row.file_name as string) : null,
        href: `/admin/media?q=${encodeURIComponent(title.slice(0, 60))}`,
        score,
        updatedAt: (row.updated_at as string) || (row.created_at as string) || null,
      };
    })
  ).slice(0, limit);

  return { clients, projects, leads, media, messagesIndexed: false };
}
