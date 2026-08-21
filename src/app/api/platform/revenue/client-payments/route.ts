import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { listClientPaymentsProcessed } from "@/lib/platform-revenue";

/**
 * Super-admin only. Cross-tenant client→studio payment GMV drill-down.
 * Business admins must receive 403 (middleware + this handler).
 */
export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  try {
    const result = await listClientPaymentsProcessed({
      businessId: url.searchParams.get("business") || undefined,
      from: url.searchParams.get("from") || undefined,
      to: url.searchParams.get("to") || undefined,
      status: url.searchParams.get("status") || "paid",
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load client payments" },
      { status: 500 }
    );
  }
}
