import { NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  const { data: client } = profile.client_id
    ? await supabase.from("clients").select("*").eq("id", profile.client_id).single()
    : { data: null };

  return NextResponse.json({ profile, client });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { full_name, phone, company } = body;

  const supabase = await createServiceClient();

  if (full_name !== undefined) {
    await supabase.from("profiles").update({ full_name }).eq("id", profile.id);
  }

  if (profile.client_id && (phone !== undefined || company !== undefined)) {
    const updates: Record<string, string | null> = {};
    if (phone !== undefined) updates.phone = phone || null;
    if (company !== undefined) updates.company = company || null;
    await supabase.from("clients").update(updates).eq("id", profile.client_id);
  }

  return NextResponse.json({ success: true });
}
