import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { hardDeleteBusiness } from "@/lib/platform-onboard";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { confirm?: string };
  if (body.confirm !== "DELETE") {
    return NextResponse.json({ error: "Type DELETE to confirm hard-delete." }, { status: 400 });
  }
  try {
    const { name, orphans } = await hardDeleteBusiness(id, { id: auth.profile.id, email: auth.profile.email });
    const q = new URLSearchParams({ notice: "deleted", name });
    return NextResponse.json({ ok: true, redirect: `/platform?${q.toString()}`, orphans });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to hard-delete" },
      { status: 400 }
    );
  }
}
