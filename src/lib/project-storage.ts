import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

/** project id → bytes of stored media. Projects with no media are absent (0). */
export type ProjectStorageMap = Record<string, number>;

function isMissingFunction(message: string | undefined): boolean {
  if (!message) return false;
  return /does not exist|schema cache|Could not find the function|PGRST202|42883/i.test(message);
}

const RPC_CHUNK = 500;
const FALLBACK_CHUNK = 100;
const FALLBACK_PAGE = 1000;

/**
 * Live storage per project for a board of cards, in one aggregated query
 * (chunked only for very large boards). Derived at read time from media rows,
 * so uploads and deletes are reflected on the next load.
 *
 * Uses `project_storage_usage` (migration v115: originals + thumbnails). Without
 * the migration, falls back to summing media_assets.file_size (originals only).
 * Never throws — returns null on failure so the indicator hides.
 *
 * Callers must pass only projects the viewer may already see.
 */
export async function loadProjectStorageBytes(
  businessId: string,
  projectIds: string[]
): Promise<ProjectStorageMap | null> {
  const result: ProjectStorageMap = {};
  if (projectIds.length === 0) return result;
  try {
    const db = await createTenantServiceClient(businessId);

    let rpcMissing = false;
    for (let i = 0; i < projectIds.length && !rpcMissing; i += RPC_CHUNK) {
      const { data, error } = await db.raw.rpc("project_storage_usage", {
        p_business_id: businessId,
        p_project_ids: projectIds.slice(i, i + RPC_CHUNK),
      });
      if (error) {
        if (!isMissingFunction(error.message)) {
          console.error("[project-storage] rpc failed", error.message);
          return null;
        }
        rpcMissing = true;
        break;
      }
      for (const row of (data ?? []) as { project_id: string; bytes: number | string }[]) {
        result[row.project_id] = Number(row.bytes) || 0;
      }
    }
    if (!rpcMissing) return result;

    // Pre-v115 fallback: two narrow columns, summed here.
    const fallback: ProjectStorageMap = {};
    for (let i = 0; i < projectIds.length; i += FALLBACK_CHUNK) {
      const chunk = projectIds.slice(i, i + FALLBACK_CHUNK);
      for (let from = 0; ; from += FALLBACK_PAGE) {
        const { data, error } = await db
          .from("media_assets")
          .select("id, project_id, file_size")
          .in("project_id", chunk)
          .order("id", { ascending: true })
          .range(from, from + FALLBACK_PAGE - 1);
        if (error) {
          console.error("[project-storage] fallback failed", error.message);
          return null;
        }
        for (const row of data ?? []) {
          const pid = row.project_id as string;
          fallback[pid] = (fallback[pid] ?? 0) + (Number(row.file_size) || 0);
        }
        if (!data || data.length < FALLBACK_PAGE) break;
      }
    }
    return fallback;
  } catch (err) {
    console.error("[project-storage] load failed", err);
    return null;
  }
}
