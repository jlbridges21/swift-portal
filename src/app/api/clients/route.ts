import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdmin } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createPortalInvite } from "@/lib/portal-activation-server";
import {
  canAccessClient,
  isOwnerAdmin,
  visibleClientIdsFor,
} from "@/lib/staff-access";

export async function GET(request: Request) {
  try {
    const profile = await requireAdmin({ area: "clients" });
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const businessId = tenant.businessId;
    const db = await createTenantServiceClient(businessId);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") ?? "").trim();
    const clientId = searchParams.get("id");

    const clientScope = isOwnerAdmin(profile)
      ? ("all" as const)
      : await visibleClientIdsFor(businessId, profile);

    if (clientId) {
      if (!(await canAccessClient(businessId, profile, clientId))) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const { data, error } = await db
        .from("clients")
        .select("id, name, email, company")
        .eq("id", clientId)
        .is("deleted_at", null)
        .maybeSingle();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json(data ? [data] : []);
    }

    if (clientScope !== "all" && clientScope.length === 0) {
      return NextResponse.json([]);
    }

    let query = db
      .from("clients")
      .select("id, name, email, company")
      .is("deleted_at", null)
      .order("name");

    if (clientScope !== "all") {
      query = query.in("id", clientScope);
    }

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
    const profile = await requireAdmin({ permission: 'clients.create' });
    const body = await request.json();

    if (!body.name || !body.email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }
    if (typeof body.password === "string" && body.password) {
      return NextResponse.json(
        { error: "Client passwords can't be set by the business. Send a portal invite instead." },
        { status: 400 }
      );
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

    if (body.send_portal_invite === true && client.email) {
      // Owners never set client passwords — the client chooses one from the invite.
      const invite = await createPortalInvite({
        businessId,
        clientId: client.id,
        send: true,
        actorId: profile.id,
        source: "owner",
      });
      if (!invite.ok) {
        return NextResponse.json(
          { ...client, error: `Client created but the portal invite failed: ${invite.error}` },
          { status: 207 }
        );
      }
    }

    return NextResponse.json(client);
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}

export async function PATCH(request: Request) {
  try {
    const profile = await requireAdmin({ permission: 'clients.edit' });
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
