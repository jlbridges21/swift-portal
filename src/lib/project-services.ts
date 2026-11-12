import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { listBusinessServices, rowToServiceTemplate } from "@/lib/business-services";
import {
  FALLBACK_SERVICE_TEMPLATES,
  matchServiceTemplate,
  type ServiceTemplate,
} from "@/lib/service-templates";
import { serviceTypeForNames } from "@/lib/project-service-names";
import type { BusinessServiceRow } from "@/lib/types";

/**
 * Server side of "multiple services per project".
 *
 * - Validates what a form selected against THIS business's catalog. Prices are
 *   never read from the request; templates come from business_services.
 * - Writes project_services links (v127) through the `db` a caller made with
 *   createTenantServiceClient(businessId), so every read and write is scoped
 *   to that business. Every helper degrades to the
 *   pre-v127 behaviour (projects.service_id + service_type only) when the table
 *   does not exist yet.
 */

export const SERVICE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_RE = SERVICE_ID_RE;
export const MAX_SERVICES_PER_PROJECT = 12;

export type SelectedService = {
  /** business_services.id, or null for the empty-catalog fallback / legacy free text. */
  id: string | null;
  name: string;
  template: ServiceTemplate;
  active: boolean;
};

export type ResolveServicesResult =
  | { ok: true; services: SelectedService[]; serviceType: string; primaryServiceId: string | null }
  | { ok: false; status: number; error: string };

function parseList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((v) => String(v ?? "").trim()).filter(Boolean);
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map((v) => String(v ?? "").trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function isMissingProjectServicesError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  const message = error.message ?? "";
  return error.code === "42P01" || error.code === "PGRST205" || /project_services/.test(message);
}

export function isMissingRequestKeyError(error: { message?: string; code?: string } | null | undefined): boolean {
  if (!error) return false;
  return /request_key/.test(error.message ?? "") && error.code !== "23505";
}

/**
 * Resolve the services a create form selected.
 *
 * Accepts `service_ids` (array or JSON string; preferred), `service_names`
 * (empty-catalog fallback), or the legacy single `service_requested` /
 * `service_type` string (API callers, website integrations), which keeps the
 * old fuzzy matching exactly.
 *
 * `keepInactiveIds`: ids already linked to the project being edited. They stay
 * selectable even when the service was deactivated; nothing else inactive can
 * be newly selected.
 */
export async function resolveSelectedServices(
  businessId: string,
  body: Record<string, unknown>,
  options?: { legacyField?: string; keepInactiveIds?: string[] }
): Promise<ResolveServicesResult> {
  const rows = await listBusinessServices(businessId);
  return resolveSelectedServicesFromRows(rows, body, options);
}

/** Pure core of resolveSelectedServices: `rows` is ONE business's catalog. */
export function resolveSelectedServicesFromRows(
  rows: BusinessServiceRow[],
  body: Record<string, unknown>,
  options?: { legacyField?: string; keepInactiveIds?: string[] }
): ResolveServicesResult {
  const ids = [...new Set(parseList(body.service_ids))];
  const names = [...new Set(parseList(body.service_names))];
  const legacy = String(body[options?.legacyField ?? "service_requested"] ?? "").trim();
  if (ids.length > MAX_SERVICES_PER_PROJECT || names.length > MAX_SERVICES_PER_PROJECT) {
    return { ok: false, status: 400, error: `Choose up to ${MAX_SERVICES_PER_PROJECT} services.` };
  }
  const keep = new Set(options?.keepInactiveIds ?? []);

  if (ids.length) {
    if (ids.some((id) => !UUID_RE.test(id))) {
      return { ok: false, status: 400, error: "One of the selected services is not valid." };
    }
    const byId = new Map(rows.map((row) => [row.id, row]));
    const picked: BusinessServiceRow[] = [];
    for (const id of ids) {
      const row = byId.get(id);
      // Unknown here = another business's id or a deleted service. Same answer either way.
      if (!row) return { ok: false, status: 400, error: "One of the selected services is no longer available." };
      if (!row.is_active && !keep.has(row.id)) {
        return { ok: false, status: 400, error: `${row.name} is no longer offered. Please choose another service.` };
      }
      picked.push(row);
    }
    // Catalog order, so line items and sections read the same way every time.
    picked.sort((a, b) => a.display_order - b.display_order || rows.indexOf(a) - rows.indexOf(b));
    const services = picked.map((row) => ({
      id: row.id,
      name: row.name,
      template: rowToServiceTemplate(row),
      active: row.is_active,
    }));
    return done(services);
  }

  if (names.length) {
    const templates = rows.length ? rows.map(rowToServiceTemplate) : FALLBACK_SERVICE_TEMPLATES;
    const services: SelectedService[] = [];
    for (const name of names) {
      const row = rows.find((r) => r.name === name);
      if (row && !row.is_active && !keep.has(row.id)) {
        return { ok: false, status: 400, error: `${row.name} is no longer offered. Please choose another service.` };
      }
      const template = row ? rowToServiceTemplate(row) : templates.find((t) => t.title === name);
      if (!template) return { ok: false, status: 400, error: "One of the selected services is no longer available." };
      services.push({ id: row?.id ?? null, name: template.title, template, active: row ? row.is_active : true });
    }
    return done(services);
  }

  if (legacy) {
    const templates = rows.length ? rows.map(rowToServiceTemplate) : FALLBACK_SERVICE_TEMPLATES;
    const template = matchServiceTemplate(legacy, templates);
    // Legacy single string keeps the value as typed (unchanged behaviour).
    return {
      ok: true,
      services: [{ id: template.dbId ?? null, name: legacy, template, active: true }],
      serviceType: legacy,
      primaryServiceId: rows.length ? (template.dbId ?? null) : null,
    };
  }

  return { ok: false, status: 400, error: "Please choose at least one service." };
}

function done(services: SelectedService[]): ResolveServicesResult {
  if (!services.length) return { ok: false, status: 400, error: "Please choose at least one service." };
  return {
    ok: true,
    services,
    serviceType: serviceTypeForNames(services.map((s) => s.name)),
    primaryServiceId: services.find((s) => s.id)?.id ?? null,
  };
}

export type ProjectServiceLink = { service_id: string; service_name: string; position: number };

/** Replace a project's links with `services` (in order). Returns false when v127 is not applied. */
export async function writeProjectServiceLinks(
  db: TenantServiceClient,
  projectId: string,
  services: Pick<SelectedService, "id" | "name">[]
): Promise<boolean> {
  const linked = services.filter((s): s is { id: string; name: string } => Boolean(s.id));
  const { data: existing, error: readError } = await db
    .from("project_services")
    .select("id, service_id")
    .eq("project_id", projectId);
  if (readError) {
    if (!isMissingProjectServicesError(readError)) {
      console.warn("[project-services] read failed:", readError.message);
    }
    return false;
  }

  const keepIds = new Set(linked.map((s) => s.id));
  const stale = (existing ?? []).filter((row) => !keepIds.has(row.service_id as string)).map((row) => row.id as string);
  if (stale.length) {
    const { error } = await db.from("project_services").delete().eq("project_id", projectId).in("id", stale);
    if (error) console.warn("[project-services] unlink failed:", error.message);
  }
  if (linked.length) {
    const { error } = await db.from("project_services").upsert(
      linked.map((s, position) => ({
        project_id: projectId,
        service_id: s.id,
        service_name: s.name,
        position,
      })),
      { onConflict: "project_id,service_id" }
    );
    if (error) {
      console.warn("[project-services] link failed:", error.message);
      return false;
    }
  }
  return true;
}

/** Links for many projects at once; an empty map (never an error) before v127. */
export async function loadProjectServiceLinks(
  db: TenantServiceClient,
  projectIds: string[]
): Promise<Map<string, ProjectServiceLink[]>> {
  const map = new Map<string, ProjectServiceLink[]>();
  const ids = [...new Set(projectIds.filter(Boolean))];
  if (!ids.length) return map;
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const { data, error } = await db
      .from("project_services")
      .select("project_id, service_id, service_name, position")
      .in("project_id", chunk)
      .order("position", { ascending: true });
    if (error) {
      if (!isMissingProjectServicesError(error)) console.warn("[project-services] load failed:", error.message);
      return map;
    }
    for (const row of data ?? []) {
      const list = map.get(row.project_id as string) ?? [];
      list.push({
        service_id: row.service_id as string,
        service_name: row.service_name as string,
        position: Number(row.position ?? 0),
      });
      map.set(row.project_id as string, list);
    }
  }
  return map;
}

/** Names for display when a project links two or more services; undefined = use service_type. */
export function serviceNamesFromLinks(links: ProjectServiceLink[] | undefined): string[] | undefined {
  if (links && links.length > 1) return links.map((l) => l.service_name);
  return undefined;
}
