/**
 * Permanent Delete for projects and clients (Hide / soft delete lives in soft-delete.ts).
 *
 * The database work runs inside SQL functions from migration v120 (one transaction each,
 * tenant-checked). Storage objects are removed afterwards by the app because Storage is not
 * transactional; a failed object removal is logged and never undoes the database delete.
 *
 * Until v120 is applied the RPCs do not exist: callers get DeleteMigrationMissingError and
 * nothing is deleted.
 */
import type { TenantServiceClient } from "@/lib/supabase/tenant-service";
import { marketingUploadPrefix } from "@/lib/marketing/model";

export type ProjectDeleteMode = "keep_media" | "delete_media";

export function parseProjectDeleteMode(value: unknown): ProjectDeleteMode | null {
  return value === "keep_media" || value === "delete_media" ? value : null;
}

export class DeleteMigrationMissingError extends Error {
  constructor() {
    super("Permanent delete needs database migration v120 (migration-v120-project-client-delete.sql). Nothing was deleted.");
    this.name = "DeleteMigrationMissingError";
  }
}

export class DeleteTargetNotFoundError extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "DeleteTargetNotFoundError";
  }
}

/** Projects with paid (or in-flight bank) invoices can only be hidden, never deleted. */
export class ProjectHasPaidInvoicesError extends Error {
  constructor(public paidCount: number) {
    super(
      `This project has ${paidCount} paid invoice${paidCount === 1 ? "" : "s"}, so it can't be deleted. ` +
        "Paid invoices are kept for your records — you can hide the project instead."
    );
    this.name = "ProjectHasPaidInvoicesError";
  }
}

/** Payment statuses that block a permanent project delete. */
export const PAID_INVOICE_STATUSES = ["paid", "processing"] as const;

/** How many paid / processing payments the project has (0 = deletable). */
export async function countPaidInvoices(db: TenantServiceClient, projectId: string): Promise<number> {
  const { count, error } = await db
    .from("payments")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("status", [...PAID_INVOICE_STATUSES]);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

type RpcError = { code?: string; message?: string; details?: string } | null;

/** PostgREST "function not found" (PGRST202) or Postgres undefined_function (42883). */
export function isMissingRpcError(error: RpcError, fnName: string): boolean {
  if (!error) return false;
  if (error.code === "PGRST202" || error.code === "42883") return true;
  const msg = error.message ?? "";
  return msg.includes(fnName) && /could not find|does not exist/i.test(msg);
}

function isNotFoundRpcError(error: RpcError): boolean {
  return Boolean(error && (error.code === "P0002" || /_not_found/.test(error.message ?? "")));
}

export type StorageRef = { bucket: string; path: string };

export type ProjectDeleteRpcResult = {
  client_id: string | null;
  media: number;
  tours: number;
  models: number;
  storage: StorageRef[] | null;
  tour_thumbnails: string[] | null;
};

export type ProjectDeleteSummary = {
  mode: ProjectDeleteMode;
  media: number;
  tours: number;
  models: number;
  storageObjectsRemoved: number;
  storageObjectsFailed: number;
};

const REMOVABLE_BUCKETS = new Set(["project-media", "project-documents"]);

/** Bucket/path of a Supabase Storage public or signed URL; null for anything else (e.g. Kuula CDN). */
export function storageRefFromUrl(url: string): StorageRef | null {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+)$/);
    if (!match) return null;
    return { bucket: match[1], path: decodeURIComponent(match[2]) };
  } catch {
    return null;
  }
}

/**
 * Group Storage objects to remove by bucket. Only tenant-prefixed paths in the project buckets
 * are accepted, so a malformed row can never point the removal at another business's files.
 */
export function planStorageRemoval(
  businessId: string,
  refs: StorageRef[],
  keep: Iterable<string> = []
): Map<string, string[]> {
  const keepSet = new Set(keep);
  const prefix = `${businessId}/`;
  const byBucket = new Map<string, Set<string>>();
  for (const ref of refs) {
    if (!ref?.bucket || !ref?.path) continue;
    if (!REMOVABLE_BUCKETS.has(ref.bucket)) continue;
    if (!ref.path.startsWith(prefix) || ref.path.includes("..")) continue;
    if (keepSet.has(ref.path)) continue;
    if (!byBucket.has(ref.bucket)) byBucket.set(ref.bucket, new Set());
    byBucket.get(ref.bucket)!.add(ref.path);
  }
  return new Map([...byBucket].map(([b, paths]) => [b, [...paths]]));
}

async function removeStorage(
  db: TenantServiceClient,
  plan: Map<string, string[]>
): Promise<{ removed: number; failed: number }> {
  let removed = 0;
  let failed = 0;
  for (const [bucket, paths] of plan) {
    for (let i = 0; i < paths.length; i += 100) {
      const chunk = paths.slice(i, i + 100);
      const { error } = await db.raw.storage.from(bucket).remove(chunk);
      if (error) {
        failed += chunk.length;
        console.error("[permanent-delete] storage remove failed", { bucket, count: chunk.length, message: error.message });
      } else {
        removed += chunk.length;
      }
    }
  }
  return { removed, failed };
}

/** Marketing Kit uploads (logo / headshot) under the project's folder, minus ones the client's brand profile reuses. */
async function marketingUploadRefs(
  db: TenantServiceClient,
  projectId: string,
  clientId: string | null
): Promise<{ refs: StorageRef[]; keep: string[] }> {
  const prefix = marketingUploadPrefix(db.businessId, projectId);
  const folder = prefix.replace(/\/$/, "");
  const { data, error } = await db.raw.storage.from("project-media").list(folder, { limit: 1000 });
  if (error || !data?.length) return { refs: [], keep: [] };
  const refs = data
    .filter((o) => o.name && o.id) // folders have no id
    .map((o) => ({ bucket: "project-media", path: `${prefix}${o.name}` }));
  let keep: string[] = [];
  if (clientId) {
    const { brandProfileUploads } = await import("@/lib/marketing/server");
    keep = await brandProfileUploads(db, clientId).catch(() => []);
  }
  return { refs, keep };
}

export async function permanentlyDeleteProject(
  db: TenantServiceClient,
  projectId: string,
  mode: ProjectDeleteMode
): Promise<ProjectDeleteSummary> {
  const paid = await countPaidInvoices(db, projectId);
  if (paid > 0) throw new ProjectHasPaidInvoicesError(paid);

  // Read the client before the row goes away (marketing brand-profile uploads must survive).
  const { data: before } = await db.from("projects").select("client_id").eq("id", projectId).maybeSingle();
  const marketing = await marketingUploadRefs(db, projectId, (before?.client_id as string | null) ?? null);

  const { data, error } = await db.raw.rpc("delete_project_v120", {
    p_business_id: db.businessId,
    p_project_id: projectId,
    p_delete_media: mode === "delete_media",
  });
  if (isMissingRpcError(error, "delete_project_v120")) throw new DeleteMigrationMissingError();
  if (isNotFoundRpcError(error)) throw new DeleteTargetNotFoundError("Project not found");
  if (error && /project_has_paid_invoices/.test(error.message ?? "")) {
    throw new ProjectHasPaidInvoicesError(Number(error.details) || 1);
  }
  if (error) throw new Error(error.message);

  const result = (data ?? {}) as ProjectDeleteRpcResult;
  const refs: StorageRef[] = [...marketing.refs];
  if (mode === "delete_media") {
    refs.push(...(result.storage ?? []));
    for (const url of result.tour_thumbnails ?? []) {
      const ref = storageRefFromUrl(url);
      if (ref) refs.push(ref);
    }
  }
  const { removed, failed } = await removeStorage(db, planStorageRemoval(db.businessId, refs, marketing.keep));

  return {
    mode,
    media: result.media ?? 0,
    tours: result.tours ?? 0,
    models: result.models ?? 0,
    storageObjectsRemoved: removed,
    storageObjectsFailed: failed,
  };
}

export type ClientDeleteSummary = { reassignedProjects: number; orphanedProjects: number };

export async function permanentlyDeleteClient(
  db: TenantServiceClient,
  clientId: string
): Promise<ClientDeleteSummary> {
  const { data, error } = await db.raw.rpc("delete_client_v120", {
    p_business_id: db.businessId,
    p_client_id: clientId,
  });
  if (isMissingRpcError(error, "delete_client_v120")) throw new DeleteMigrationMissingError();
  if (isNotFoundRpcError(error)) throw new DeleteTargetNotFoundError("Client not found");
  if (error) throw new Error(error.message);
  const result = (data ?? {}) as { reassigned_projects?: number; orphaned_projects?: number };
  return {
    reassignedProjects: result.reassigned_projects ?? 0,
    orphanedProjects: result.orphaned_projects ?? 0,
  };
}
