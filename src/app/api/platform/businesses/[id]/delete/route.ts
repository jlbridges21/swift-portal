import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { softDeleteBusiness } from "@/lib/platform-onboard";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const { name } = await softDeleteBusiness(id, { id: auth.profile.id, email: auth.profile.email });
    const q = new URLSearchParams({ notice: "soft_deleted", name });
    return NextResponse.json({ ok: true, redirect: `/platform?${q.toString()}` });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete" },
      { status: 400 }
    );
  }
}
