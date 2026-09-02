import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  BULK_HARD_DELETE_MAX,
  BULK_LIFECYCLE_MAX,
  BULK_ROUTE_MAX_DURATION_SECONDS,
  bulkActionBatchCap,
  formatBulkExclusionSummary,
  runBulkBusinessAction,
  type BulkBusinessAction,
} from "@/lib/platform-business-bulk";

export const runtime = "nodejs";
/** Hard-delete batches need room for sequential storage wipes. Cap is BULK_HARD_DELETE_MAX. */
export const maxDuration = BULK_ROUTE_MAX_DURATION_SECONDS;

const ACTIONS = new Set<BulkBusinessAction>([
  "suspend",
  "restore",
  "soft_delete",
  "hard_delete",
]);

/**
 * POST /api/platform/businesses/bulk
 * Body: { action, businessIds: string[], confirm?: string }
 *
 * Hard-delete requires confirm === "DELETE" or confirm === String(eligibleCount).
 * Each business is processed via the existing single-path helpers.
 */
export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as {
    action?: string;
    businessIds?: unknown;
    confirm?: string;
    /** Verification-only: fail this id mid-batch after prior successes. */
    simulateFailId?: string;
  } | null;

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const action = body.action as BulkBusinessAction;
  if (!ACTIONS.has(action)) {
    return NextResponse.json(
      { error: "action must be suspend, restore, soft_delete, or hard_delete." },
      { status: 400 }
    );
  }

  const businessIds = Array.isArray(body.businessIds)
    ? body.businessIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    : [];

  if (businessIds.length === 0) {
    return NextResponse.json({ error: "Select at least one business." }, { status: 400 });
  }

  const cap = bulkActionBatchCap(action);
  if (businessIds.length > cap) {
    return NextResponse.json(
      {
        error: `Batch too large: max ${cap} for ${action} (route timeout ${BULK_ROUTE_MAX_DURATION_SECONDS}s).`,
        maxBatch: cap,
        hardDeleteMax: BULK_HARD_DELETE_MAX,
        lifecycleMax: BULK_LIFECYCLE_MAX,
      },
      { status: 400 }
    );
  }

  // Dry-run eligibility for hard-delete confirm phrase (count of eligible only).
  let eligibleCount = businessIds.length;
  if (action === "hard_delete") {
    const { loadBulkBusinessSnapshots, evaluateBulkEligibility } = await import(
      "@/lib/platform-business-bulk"
    );
    const snaps = await loadBulkBusinessSnapshots(businessIds);
    eligibleCount = businessIds.filter((id) => evaluateBulkEligibility(snaps.get(id), action).ok)
      .length;

    const confirm = typeof body.confirm === "string" ? body.confirm.trim() : "";
    const confirmOk = confirm === "DELETE" || confirm === String(eligibleCount);
    if (!confirmOk) {
      return NextResponse.json(
        {
          error: `Hard-delete requires typing DELETE or the eligible count (${eligibleCount}).`,
          eligibleCount,
          requireConfirm: true,
        },
        { status: 400 }
      );
    }
  }

  try {
    const simulateFailId =
      process.env.PLATFORM_BULK_ALLOW_SIMULATE_FAIL === "1" &&
      typeof body.simulateFailId === "string"
        ? body.simulateFailId
        : null;

    const report = await runBulkBusinessAction({
      action,
      businessIds,
      actor: { id: auth.profile.id, email: auth.profile.email },
      shouldFailId: simulateFailId ? (id) => id === simulateFailId : undefined,
    });

    const exclusionSummary = formatBulkExclusionSummary(report.excludedBeforeConfirm);

    return NextResponse.json({
      ok: true,
      ...report,
      exclusionSummary,
      eligibleCount,
      caps: {
        hardDeleteMax: BULK_HARD_DELETE_MAX,
        lifecycleMax: BULK_LIFECYCLE_MAX,
        maxDurationSeconds: BULK_ROUTE_MAX_DURATION_SECONDS,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Bulk action failed" },
      { status: 400 }
    );
  }
}
