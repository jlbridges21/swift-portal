import { NextResponse } from "next/server";
import { assertCronAuthorized, cronDryRunRequested } from "@/lib/cron-auth";
import { runPartnerPayouts } from "@/lib/partner-payout-run";

/**
 * Monthly automated partner payout run (FLOW C transfers).
 *
 * Guard: Authorization: Bearer CRON_SECRET
 * GET /api/cron/partner-payouts
 * GET /api/cron/partner-payouts?dryRun=1 — force dry run (no transfers)
 * GET /api/cron/partner-payouts?execute=1 — request real transfers (still gated by settings)
 *
 * Master switch automated_payouts_enabled must be ON or cron no-ops.
 */
export async function GET(request: Request) {
  const denied = assertCronAuthorized(request);
  if (denied) return denied;

  const url = new URL(request.url);
  const dryRunParam = cronDryRunRequested(request);
  const executeParam = url.searchParams.get("execute") === "1";

  try {
    const result = await runPartnerPayouts({
      triggeredBy: "cron",
      dryRunRequested: dryRunParam ? true : executeParam ? false : undefined,
      executeTransfersRequested: executeParam ? true : undefined,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[cron/partner-payouts] run failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
