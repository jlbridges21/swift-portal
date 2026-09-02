/**
 * Shared bulk-action types + pure eligibility (safe for client components).
 * Mutations live in platform-business-bulk.ts (server-only).
 */

export const BULK_HARD_DELETE_MAX = 5;
export const BULK_LIFECYCLE_MAX = 25;
/** Matches the bulk route `maxDuration` export. */
export const BULK_ROUTE_MAX_DURATION_SECONDS = 300;

export type BulkBusinessAction = "suspend" | "restore" | "soft_delete" | "hard_delete";

export type BulkBusinessSnapshot = {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
  created_at: string;
  is_protected: boolean;
  hasCommissionHistory: boolean;
  clientCount: number;
  projectCount: number;
  mediaCount: number;
};

export type BulkSkipReason =
  | "protected"
  | "commission_history"
  | "already_soft_deleted"
  | "not_soft_deleted"
  | "already_suspended"
  | "not_restorable"
  | "not_found";

export type BulkItemResult =
  | {
      id: string;
      name: string;
      slug: string;
      outcome: "succeeded";
      orphans?: string[];
    }
  | {
      id: string;
      name: string;
      slug: string;
      outcome: "skipped";
      reason: BulkSkipReason;
      detail: string;
    }
  | {
      id: string;
      name: string;
      slug: string;
      outcome: "failed";
      error: string;
    };

export function bulkActionBatchCap(action: BulkBusinessAction): number {
  return action === "hard_delete" ? BULK_HARD_DELETE_MAX : BULK_LIFECYCLE_MAX;
}

export function evaluateBulkEligibility(
  snap: BulkBusinessSnapshot | undefined,
  action: BulkBusinessAction
): { ok: true } | { ok: false; reason: BulkSkipReason; detail: string } {
  if (!snap) {
    return { ok: false, reason: "not_found", detail: "Business not found." };
  }

  if (action === "hard_delete") {
    if (snap.is_protected) {
      return {
        ok: false,
        reason: "protected",
        detail: "Protected production businesses cannot be hard-deleted.",
      };
    }
    if (snap.hasCommissionHistory) {
      return {
        ok: false,
        reason: "commission_history",
        detail:
          "Cannot hard-delete a business with partner commission history. Soft-delete instead; the ledger must remain reconstructable.",
      };
    }
    return { ok: true };
  }

  if (action === "soft_delete") {
    if (snap.is_protected) {
      return {
        ok: false,
        reason: "protected",
        detail: "Protected production businesses cannot be deleted from the console.",
      };
    }
    if (snap.deleted_at) {
      return {
        ok: false,
        reason: "already_soft_deleted",
        detail: "Business is already soft-deleted.",
      };
    }
    return { ok: true };
  }

  if (action === "restore") {
    if (snap.is_protected && snap.deleted_at) {
      return {
        ok: false,
        reason: "protected",
        detail: "Protected production businesses cannot be restored this way.",
      };
    }
    if (snap.deleted_at) return { ok: true };
    if (snap.status === "suspended") return { ok: true };
    return {
      ok: false,
      reason: "not_restorable",
      detail: "Business is not soft-deleted or suspended.",
    };
  }

  if (snap.deleted_at) {
    return {
      ok: false,
      reason: "already_soft_deleted",
      detail: "Restore this business before changing status.",
    };
  }
  if (snap.status === "suspended") {
    return {
      ok: false,
      reason: "already_suspended",
      detail: "Business is already suspended.",
    };
  }
  return { ok: true };
}

export function formatBulkExclusionSummary(
  excluded: Array<{ name: string; reason: BulkSkipReason; detail: string }>
): string | null {
  if (excluded.length === 0) return null;
  const parts = excluded.map((e) => {
    if (e.reason === "protected") return `${e.name} (protected)`;
    if (e.reason === "commission_history") return `${e.name} (has commission history)`;
    return `${e.name} (${e.detail})`;
  });
  return `${excluded.length} cannot be included: ${parts.join(", ")}`;
}
