import { NextResponse } from "next/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { scanOutstandingPaymentsForReconciliation } from "@/lib/stripe-payment-reconcile";

/**
 * Scheduled safety net — finds succeeded Stripe client payments with no paid row.
 * GET /api/cron/payment-reconciliation
 * GET /api/cron/payment-reconciliation?dryRun=1
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const dryRun = cronDryRunRequested(request);

  try {
    const result = await scanOutstandingPaymentsForReconciliation({ dryRun });
    return NextResponse.json({
      ok: true,
      dryRun,
      ...result,
    });
  } catch (err) {
    console.error("[cron/payment-reconciliation] failed:", err);
    return NextResponse.json({ error: "Payment reconciliation cron failed" }, { status: 500 });
  }
}
