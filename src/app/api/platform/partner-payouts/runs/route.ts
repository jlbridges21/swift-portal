import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import {
  getPartnerPayoutRunWithItems,
  listPartnerPayoutRuns,
  runPartnerPayouts,
} from "@/lib/partner-payout-run";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const runId = url.searchParams.get("runId")?.trim();
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20)));

  try {
    if (runId) {
      const detail = await getPartnerPayoutRunWithItems(runId);
      if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
      return NextResponse.json(detail);
    }
    const runs = await listPartnerPayoutRuns(limit);
    return NextResponse.json({ runs });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Load failed." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun === true || body.dry_run === true;
    const execute =
      body.executeTransfers === true ||
      body.execute === true ||
      body.execute_transfers === true;
    const partnerId = body.partnerId ?? body.partner_id ?? null;
    const periodKey = body.periodKey ?? body.period_key ?? undefined;
    const skipAutomationGate = body.skipAutomationGate === true;

    const result = await runPartnerPayouts({
      triggeredBy: "manual",
      triggeredByUserId: auth.profile.id,
      triggeredByEmail: auth.profile.email,
      dryRunRequested: dryRun ? true : execute ? false : true,
      executeTransfersRequested: execute ? true : dryRun ? false : undefined,
      partnerIds: partnerId ? [String(partnerId)] : undefined,
      periodKey: periodKey ? String(periodKey) : undefined,
      skipAutomationGate,
    });

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Run failed." },
      { status: 500 }
    );
  }
}
