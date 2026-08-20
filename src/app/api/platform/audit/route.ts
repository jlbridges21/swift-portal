import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { loadPlatformAudit } from "@/lib/platform-dashboard";

export async function GET(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const url = new URL(request.url);
  try {
    const rows = await loadPlatformAudit({
      actor: url.searchParams.get("actor") ?? undefined,
      action: url.searchParams.get("action") ?? undefined,
      businessId: url.searchParams.get("business") ?? undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    });
    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load audit" },
      { status: 500 }
    );
  }
}
