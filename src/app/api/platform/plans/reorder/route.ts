import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { reorderPlans } from "@/lib/platform-plans";

export async function POST(request: Request) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  try {
    const body = (await request.json()) as { ids?: string[] };
    const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
    if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });
    await reorderPlans(ids, { id: auth.profile.id, email: auth.profile.email });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder" },
      { status: 400 }
    );
  }
}
