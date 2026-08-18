import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Tenant-scoped service-role client.
 *
 * `createServiceClient()` uses SUPABASE_SERVICE_ROLE_KEY and **bypasses RLS**.
 * This wrapper re-applies `business_id` on every table query so a missing
 * filter cannot leak or mutate another tenant's rows.
 *
 * Approach: a thin `from()` facade (not a Proxy over the query builder).
 * `select` / `update` / `delete` immediately append `.eq("business_id", …)`
 * then return the **native** supabase-js builder, so further `.eq()`,
 * `.order()`, `.range()`, `.single()`, and `insert().select()` are real
 * methods — not re-wrapped proxies. Insert/upsert inject `business_id`
 * into every row before the request is sent.
 *
 * Tables that are NOT business-scoped — use `.raw`, never `.from()`:
 *   - profiles          (super_admin rows have NULL business_id)
 *   - businesses
 *   - processed_stripe_events
 *   - app_settings      (legacy singleton; live config is business_settings)
 *   - anything under storage (`raw.storage.from(...)`)
 *   - Auth admin APIs   (`raw.auth.admin.*`)
 *   - RPCs              (`raw.rpc(...)`) unless the function itself is tenant-aware
 *
 * `business_integrations` IS business-scoped — use `.from()`.
 */
export interface TenantServiceClient {
  businessId: string;
  /** Deliberate escape hatch for unscoped tables, Auth, Storage, and RPC. */
  raw: SupabaseClient;
  from: SupabaseClient["from"];
}

type RowLike = Record<string, unknown>;

function isPlainRow(value: unknown): value is RowLike {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Stamp `business_id` on insert/upsert payloads.
 * Does not overwrite an already-matching value. Throws if an explicit
 * value belongs to a different business.
 */
export function injectBusinessId<T>(values: T, businessId: string): T {
  const stamp = (row: unknown): unknown => {
    if (!isPlainRow(row)) return row;
    if (!Object.prototype.hasOwnProperty.call(row, "business_id") || row.business_id == null) {
      return { ...row, business_id: businessId };
    }
    if (row.business_id !== businessId) {
      throw new Error(
        `Refusing to write business_id=${String(row.business_id)} through a tenant client scoped to ${businessId}`
      );
    }
    return row;
  };

  if (Array.isArray(values)) {
    return values.map(stamp) as T;
  }
  return stamp(values) as T;
}

export async function createTenantServiceClient(
  businessId: string
): Promise<TenantServiceClient> {
  if (!businessId) {
    throw new Error("createTenantServiceClient requires a businessId");
  }

  const raw = await createServiceClient();

  const from: SupabaseClient["from"] = ((table: string) => {
    const qb = raw.from(table);
    return {
      select: (...args: Parameters<typeof qb.select>) =>
        qb.select(...args).eq("business_id", businessId),
      insert: (values: Parameters<typeof qb.insert>[0], options?: Parameters<typeof qb.insert>[1]) =>
        qb.insert(injectBusinessId(values, businessId), options),
      upsert: (values: Parameters<typeof qb.upsert>[0], options?: Parameters<typeof qb.upsert>[1]) =>
        qb.upsert(injectBusinessId(values, businessId), options),
      update: (values: Parameters<typeof qb.update>[0], options?: Parameters<typeof qb.update>[1]) =>
        qb.update(values, options).eq("business_id", businessId),
      delete: (options?: Parameters<typeof qb.delete>[0]) =>
        qb.delete(options).eq("business_id", businessId),
    };
  }) as SupabaseClient["from"];

  return { businessId, raw, from };
}
