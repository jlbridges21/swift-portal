import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function GET() {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const supabase = await createClient();
  let clientQuery = profile.client_id
    ? supabase.from("clients").select("*").eq("id", profile.client_id)
    : null;
  if (clientQuery && profile.business_id) {
    clientQuery = clientQuery.eq("business_id", profile.business_id);
  }
  const { data: client } = clientQuery
    ? await clientQuery.single()
    : { data: null };

  return NextResponse.json({ profile, client });
}

export async function PATCH(request: Request) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { full_name, phone, company, email_notifications_enabled, in_app_notifications_enabled } =
    body;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(profile.role);
  const db = await createTenantServiceClient(tenant.businessId);

  const profileUpdates: Record<string, string | boolean> = {};
  if (full_name !== undefined) profileUpdates.full_name = full_name;
  if (profile.role === "client") {
    if (email_notifications_enabled !== undefined) {
      profileUpdates.email_notifications_enabled = Boolean(email_notifications_enabled);
    }
    if (in_app_notifications_enabled !== undefined) {
      profileUpdates.in_app_notifications_enabled = Boolean(in_app_notifications_enabled);
    }
  }
  if (Object.keys(profileUpdates).length) {
    await db.raw.from("profiles").update(profileUpdates).eq("id", profile.id);
  }

  if (profile.client_id && (phone !== undefined || company !== undefined)) {
    const updates: Record<string, string | null> = {};
    if (phone !== undefined) updates.phone = phone || null;
    if (company !== undefined) updates.company = company || null;
    await db.from("clients").update(updates).eq("id", profile.client_id);
  }

  return NextResponse.json({ success: true });
}
