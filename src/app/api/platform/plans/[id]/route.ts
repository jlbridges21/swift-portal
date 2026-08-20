import { NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/api-auth";
import { updatePlan } from "@/lib/platform-plans";
import { createServiceClient } from "@/lib/supabase/server";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const raw = await createServiceClient();
  const { data, error } = await raw.from("plans").select("*").eq("id", id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ plan: data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdminApi();
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    const body = await request.json();
    const plan = await updatePlan(id, body, { id: auth.profile.id, email: auth.profile.email });
    return NextResponse.json({ plan });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update plan" },
      { status: 400 }
    );
  }
}
