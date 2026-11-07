import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { loadBusinessEconomicsHistory } from "@/lib/platform-economics";

/** Storage / egress / payment history for one business (super admin drill-down). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  try {
    return NextResponse.json(await loadBusinessEconomicsHistory(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Load failed" }, { status: 500 });
  }
}
