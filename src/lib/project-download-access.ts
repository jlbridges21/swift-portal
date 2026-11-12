import type { SupabaseClient } from "@supabase/supabase-js";
import {
  effectiveRequireDeliveredForDownloads,
  parseProjectDownloadAccess,
  type ProjectDownloadAccess,
} from "@/lib/deliverables";

type FromClient = { from: SupabaseClient["from"] };

/**
 * Reads projects.client_download_access (v124). Kept as its own small query so the
 * download routes keep working, as "default", on a database without the migration.
 * Callers must pass a tenant-scoped client and a project they have already authorized.
 */
export async function loadProjectDownloadAccess(
  db: FromClient,
  projectId: string | null | undefined
): Promise<ProjectDownloadAccess> {
  if (!projectId) return "default";
  const { data, error } = await db
    .from("projects")
    .select("client_download_access")
    .eq("id", projectId)
    .maybeSingle();
  if (error || !data) return "default";
  return parseProjectDownloadAccess((data as { client_download_access?: unknown }).client_download_access);
}

/** Business setting + project override → whether clients must wait for Delivered. */
export async function resolveProjectRequireDelivered(
  db: FromClient,
  projectId: string | null | undefined,
  businessRequiresDelivered: boolean
): Promise<boolean> {
  const access = await loadProjectDownloadAccess(db, projectId);
  return effectiveRequireDeliveredForDownloads(businessRequiresDelivered, access);
}

export function isMissingDownloadAccessColumnError(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message?.includes("client_download_access"));
}
