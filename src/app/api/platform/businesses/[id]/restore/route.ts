import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { restoreSoftDeletedBusiness } from "@/lib/platform-onboard";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const { name } = await restoreSoftDeletedBusiness(id, {
      id: auth.profile.id,
      email: auth.profile.email,
    });
    return NextResponse.json({
      ok: true,
      redirect: `/platform/businesses/${id}?notice=restored&name=${encodeURIComponent(name)}`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to restore" },
      { status: 400 }
    );
  }
}
