import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { loadBusinessDetail } from "@/lib/platform-dashboard";
import { updateBusinessForPlatform } from "@/lib/platform-onboard";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const detail = await loadBusinessDetail(id);
  if (!detail) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(detail);
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const body = (await request.json()) as {
      name?: string;
      slug?: string;
      customDomain?: string | null;
      plan?: string;
      subscriptionStatus?: string;
      trialEndsAt?: string | null;
    };
    const data = await updateBusinessForPlatform(id, body, {
      id: auth.profile.id,
      email: auth.profile.email,
    });
    return NextResponse.json({ business: data });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update" },
      { status: 400 }
    );
  }
}
