/**
 * Bulk platform business lifecycle actions (server).
 *
 * Every mutation goes through the existing single-business helpers in
 * platform-onboard.ts. There is no second deletion path.
 *
 * Caps / timeout: see platform-business-bulk.shared.ts.
 */

import { createServiceClient } from "@/lib/supabase/server";
import {
  hardDeleteBusiness,
  restoreSoftDeletedBusiness,
  setBusinessStatus,
  softDeleteBusiness,
} from "@/lib/platform-onboard";
import {
  bulkActionBatchCap,
  evaluateBulkEligibility,
  BULK_ROUTE_MAX_DURATION_SECONDS,
  type BulkBusinessAction,
  type BulkBusinessSnapshot,
  type BulkItemResult,
  type BulkSkipReason,
} from "@/lib/platform-business-bulk.shared";

export type {
  BulkBusinessAction,
  BulkBusinessSnapshot,
  BulkItemResult,
  BulkSkipReason,
} from "@/lib/platform-business-bulk.shared";

export {
  BULK_HARD_DELETE_MAX,
  BULK_LIFECYCLE_MAX,
  BULK_ROUTE_MAX_DURATION_SECONDS,
  bulkActionBatchCap,
  evaluateBulkEligibility,
  formatBulkExclusionSummary,
} from "@/lib/platform-business-bulk.shared";

export type BulkActionReport = {
  action: BulkBusinessAction;
  processed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  results: BulkItemResult[];
  orphans: string[];
  excludedBeforeConfirm: Array<{
    id: string;
    name: string;
    slug: string;
    reason: BulkSkipReason;
    detail: string;
  }>;
};

export async function loadBulkBusinessSnapshots(
  ids: string[]
): Promise<Map<string, BulkBusinessSnapshot>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, BulkBusinessSnapshot>();
  if (unique.length === 0) return map;

  const raw = await createServiceClient();
  const { data: businesses, error } = await raw
    .from("businesses")
    .select("id, name, slug, status, deleted_at, created_at, is_protected")
    .in("id", unique);
  if (error) throw new Error(error.message);

  const commissionCounts = await Promise.all(
    unique.map(async (id) => {
      const { count } = await raw
        .from("partner_commissions")
        .select("id", { count: "exact", head: true })
        .eq("business_id", id);
      return [id, count ?? 0] as const;
    })
  );
  const commissionMap = new Map(commissionCounts);

  const countTables = ["clients", "projects", "media_assets"] as const;
  for (const b of businesses ?? []) {
    const counts = await Promise.all(
      countTables.map(async (table) => {
        const { count } = await raw
          .from(table)
          .select("id", { count: "exact", head: true })
          .eq("business_id", b.id);
        return count ?? 0;
      })
    );
    map.set(b.id as string, {
      id: b.id as string,
      name: b.name as string,
      slug: b.slug as string,
      status: b.status as string,
      deleted_at: (b.deleted_at as string | null) ?? null,
      created_at: b.created_at as string,
      is_protected: b.is_protected === true,
      hasCommissionHistory: (commissionMap.get(b.id as string) ?? 0) > 0,
      clientCount: counts[0],
      projectCount: counts[1],
      mediaCount: counts[2],
    });
  }
  return map;
}

/**
 * Run a bulk action sequentially. Each item is fully handled by the single-path
 * helper before the next starts. Failures do not abort the batch.
 */
export async function runBulkBusinessAction(args: {
  action: BulkBusinessAction;
  businessIds: string[];
  actor: { id: string; email: string | null };
  shouldFailId?: (id: string) => boolean;
}): Promise<BulkActionReport> {
  const { action, actor } = args;
  const ids = [...new Set(args.businessIds.filter(Boolean))];
  const cap = bulkActionBatchCap(action);
  if (ids.length === 0) {
    throw new Error("Select at least one business.");
  }
  if (ids.length > cap) {
    throw new Error(
      `Batch too large for ${action.replace("_", "-")}: max ${cap} businesses per request (route timeout ${BULK_ROUTE_MAX_DURATION_SECONDS}s).`
    );
  }

  const snaps = await loadBulkBusinessSnapshots(ids);
  const results: BulkItemResult[] = [];
  const orphans: string[] = [];
  const excludedBeforeConfirm: BulkActionReport["excludedBeforeConfirm"] = [];

  for (const id of ids) {
    const snap = snaps.get(id);
    const elig = evaluateBulkEligibility(snap, action);
    if (!elig.ok) {
      const item = {
        id,
        name: snap?.name ?? id,
        slug: snap?.slug ?? "",
        reason: elig.reason,
        detail: elig.detail,
      };
      excludedBeforeConfirm.push(item);
      results.push({
        id,
        name: item.name,
        slug: item.slug,
        outcome: "skipped",
        reason: elig.reason,
        detail: elig.detail,
      });
      continue;
    }

    const name = snap!.name;
    const slug = snap!.slug;

    if (args.shouldFailId?.(id)) {
      results.push({
        id,
        name,
        slug,
        outcome: "failed",
        error: "Simulated mid-batch failure",
      });
      continue;
    }

    try {
      if (action === "hard_delete") {
        const { name: deletedName, orphans: itemOrphans } = await hardDeleteBusiness(id, actor);
        if (itemOrphans.length) {
          orphans.push(...itemOrphans.map((o) => `${deletedName}: ${o}`));
        }
        results.push({
          id,
          name: deletedName,
          slug,
          outcome: "succeeded",
          orphans: itemOrphans,
        });
      } else if (action === "soft_delete") {
        const { name: n } = await softDeleteBusiness(id, actor);
        results.push({ id, name: n, slug, outcome: "succeeded" });
      } else if (action === "suspend") {
        const { name: n } = await setBusinessStatus(id, "suspended", actor);
        results.push({ id, name: n, slug, outcome: "succeeded" });
      } else if (snap!.deleted_at) {
        const { name: n } = await restoreSoftDeletedBusiness(id, actor);
        results.push({ id, name: n, slug, outcome: "succeeded" });
      } else {
        const { name: n } = await setBusinessStatus(id, "active", actor);
        results.push({ id, name: n, slug, outcome: "succeeded" });
      }
    } catch (err) {
      results.push({
        id,
        name,
        slug,
        outcome: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    action,
    processed: results.length,
    succeeded: results.filter((r) => r.outcome === "succeeded").length,
    skipped: results.filter((r) => r.outcome === "skipped").length,
    failed: results.filter((r) => r.outcome === "failed").length,
    results,
    orphans,
    excludedBeforeConfirm,
  };
}
