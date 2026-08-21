import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function GET(request: Request) {
  try {
    const profile = await requireAdmin();
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const clientId = searchParams.get("id");

    if (clientId) {
      const { data, error } = await db
        .from("clients")
        .select("id, name, email, company")
        .eq("id", clientId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data ? [data] : []);
    }

    let query = db
      .from("clients")
      .select("id, name, email, company")
      .is("deleted_at", null)
      .order("name");

    if (q) {
      const safe = q.replace(/[%_,]/g, "").slice(0, 80);
      if (safe) {
        query = query.or(
          `name.ilike.%${safe}%,email.ilike.%${safe}%,company.ilike.%${safe}%`
        );
      }
      query = query.limit(40);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function POST(request: Request) {
  try {
    const profile = await requireAdmin();
    const body = await request.json();

    if (!body.name || !body.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);

    const { data: client, error } = await db
      .from("clients")
      .insert({
        name: body.name,
        email: body.email,
        phone: body.phone || null,
        company: body.company || null,
        notes: body.notes || null,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (body.password) {
      const { data: authUser, error: authError } = await db.raw.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: { full_name: body.name, role: "client", business_id: businessId },
      });

      if (authError) {
        console.error("Auth user creation failed:", authError.message);
        return NextResponse.json(
          { error: `Client created but portal login failed: ${authError.message}` },
          { status: 207 }
        );
      }

      if (authUser.user) {
        await db
          .from("clients")
          .update({ user_id: authUser.user.id })
          .eq("id", client.id);

        await db.raw
          .from("profiles")
          .update({
            client_id: client.id,
            role: "client",
            email_notifications_enabled: true,
            in_app_notifications_enabled: true,
          })
          .eq("id", authUser.user.id);

        return NextResponse.json({ ...client, user_id: authUser.user.id });
      }
    }

    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireAdmin();
    const body = await request.json();
    const { id, ...updates } = body;

    const allowed = ["name", "email", "phone", "company", "notes", "full_name", "referral_source"];
    const sanitized: Record<string, unknown> = {};
    for (const key of allowed) {
      if (key in updates) sanitized[key] = updates[key];
    }

    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);
    const { data, error } = await db
      .from("clients")
      .update(sanitized)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
