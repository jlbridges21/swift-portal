import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { isMissingRequestKeyError, SERVICE_ID_RE } from "@/lib/project-services";

/**
 * Repeated project-request submissions (double click, a retried network call,
 * the back button) must not create a second project, a second estimate or a
 * second round of emails.
 *
 * 1. The form sends a random `request_key` per form load. v127 stores it on the
 *    project with a unique (business_id, request_key) index, so even two
 *    concurrent submissions resolve to one row.
 *    `db` is always createTenantServiceClient(businessId): lookups stay in that business.
 * 2. Before v127 (or for API callers that send no key) a short window catches
 *    the same client asking for the same services at the same address.
 */

export const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

export function parseRequestKey(value: unknown): string | null {
  const key = typeof value === "string" ? value.trim() : "";
  return SERVICE_ID_RE.test(key) ? key.toLowerCase() : null;
}

export type ExistingRequestProject = { id: string; client_id: string | null; project_name: string };

export async function findProjectByRequestKey(
  db: TenantServiceClient,
  requestKey: string | null
): Promise<ExistingRequestProject | null> {
  if (!requestKey) return null;
  const { data, error } = await db
    .from("projects")
    .select("id, client_id, project_name")
    .eq("request_key", requestKey)
    .maybeSingle();
  if (error) {
    if (!isMissingRequestKeyError(error)) console.warn("[request-dedupe] key lookup failed:", error.message);
    return null;
  }
  return (data as ExistingRequestProject | null) ?? null;
}

export async function findRecentDuplicateRequest(
  db: TenantServiceClient,
  input: { clientId: string; propertyAddress: string; serviceType: string },
  now = Date.now()
): Promise<ExistingRequestProject | null> {
  const since = new Date(now - DUPLICATE_WINDOW_MS).toISOString();
  const { data, error } = await db
    .from("projects")
    .select("id, client_id, project_name")
    .eq("client_id", input.clientId)
    .eq("property_address", input.propertyAddress)
    .eq("service_type", input.serviceType)
    .eq("status", "new_request")
    .is("deleted_at", null)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) {
    console.warn("[request-dedupe] window lookup failed:", error.message);
    return null;
  }
  return (data?.[0] as ExistingRequestProject | undefined) ?? null;
}

/**
 * Insert the project with its request key. A unique violation means another
 * submission with the same key won the race: return that project instead.
 * Before v127 the column does not exist, so insert without it.
 */
export async function insertRequestProject<Row extends Record<string, unknown>>(
  db: TenantServiceClient,
  row: Row,
  requestKey: string | null,
  insert: (row: Record<string, unknown>) => Promise<{ data: Record<string, unknown> | null; error: { message?: string; code?: string } | null }>
): Promise<
  | { kind: "created"; project: Record<string, unknown> }
  | { kind: "duplicate"; project: ExistingRequestProject }
  | { kind: "error"; message: string }
> {
  const withKey = requestKey ? { ...row, request_key: requestKey } : row;
  let result = await insert(withKey);
  if (result.error && requestKey && result.error.code === "23505" && /request_key/.test(result.error.message ?? "")) {
    const existing = await findProjectByRequestKey(db, requestKey);
    if (existing) return { kind: "duplicate", project: existing };
  }
  if (result.error && requestKey && isMissingRequestKeyError(result.error)) {
    result = await insert(row);
  }
  if (result.error || !result.data) {
    return { kind: "error", message: result.error?.message || "Could not save your request." };
  }
  return { kind: "created", project: result.data };
}
