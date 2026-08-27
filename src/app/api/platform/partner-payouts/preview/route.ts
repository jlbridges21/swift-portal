import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { previewPartnerPayoutRun } from "@/lib/partner-payout-run";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const partnerId = url.searchParams.get("partnerId")?.trim();
  const periodKey = url.searchParams.get("periodKey")?.trim() || undefined;

  try {
    const preview = await previewPartnerPayoutRun({
      partnerIds: partnerId ? [partnerId] : undefined,
      periodKey,
    });
    return NextResponse.json(preview);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Preview failed." },
      { status: 500 }
    );
  }
}
