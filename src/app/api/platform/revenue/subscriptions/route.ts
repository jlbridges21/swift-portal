import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { listShootPortalSubscriptionPayments } from "@/lib/platform-revenue";

/**
 * Super-admin only. Cross-tenant ShootPortal SaaS subscription ledger.
 * Business admins must receive 403 (middleware + this handler).
 */
export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  try {
    const rows = await listShootPortalSubscriptionPayments({
      businessId: url.searchParams.get("business") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
    });
    const totalCents = rows.reduce((s, r) => s + r.amountPaidCents, 0);
    return NextResponse.json({ rows, totalCents });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load subscription revenue" },
      { status: 500 }
    );
  }
}
