import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { invalidateBusinessServicesCache } from "@/lib/business-services";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);
  const { id } = await params;

  const body = (await request.json()) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.name === "string") patch.name = body.name.trim();
  if (typeof body.description === "string" || body.description === null) patch.description = body.description;
  if (body.preliminary_estimate_cents !== undefined) {
    patch.preliminary_estimate_cents =
      body.preliminary_estimate_cents == null ? null : Number(body.preliminary_estimate_cents);
  }
  if (typeof body.starting_label === "string") patch.starting_label = body.starting_label;
  if (body.includes !== undefined) patch.includes = parseStringArray(body.includes);
  if (body.line_items !== undefined) patch.line_items = body.line_items;
  if (typeof body.notes === "string") patch.notes = body.notes;
  if (typeof body.hide_pricing === "boolean") patch.hide_pricing = body.hide_pricing;
  if (typeof body.is_recommended === "boolean") patch.is_recommended = body.is_recommended;
  if (typeof body.is_active === "boolean") patch.is_active = body.is_active;
  if (body.aliases !== undefined) patch.aliases = parseStringArray(body.aliases);
  if (typeof body.display_order === "number") patch.display_order = body.display_order;

  if (typeof patch.name === "string" && patch.line_items === undefined && patch.preliminary_estimate_cents !== undefined) {
    const cents = Number(patch.preliminary_estimate_cents ?? 0);
    patch.line_items = [{ description: patch.name, amount_cents: patch.hide_pricing ? 0 : cents }];
  } else if (patch.preliminary_estimate_cents !== undefined && patch.line_items === undefined) {
    const db = await createTenantServiceClient(tenant.businessId);
    const { data: current } = await db
      .from("business_services")
      .select("name, hide_pricing, line_items")
      .eq("id", id)
      .maybeSingle();
    const name = (patch.name as string | undefined) ?? current?.name ?? "Service";
    const hide = typeof patch.hide_pricing === "boolean" ? patch.hide_pricing : Boolean(current?.hide_pricing);
    const cents = Number(patch.preliminary_estimate_cents ?? 0);
    const items = Array.isArray(current?.line_items) ? current.line_items : [];
    if (items.length <= 1) {
      patch.line_items = [{ description: name, amount_cents: hide ? 0 : cents }];
    }
  }

  const db = await createTenantServiceClient(tenant.businessId);
  const { data, error } = await db.from("business_services").update(patch).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  invalidateBusinessServicesCache(tenant.businessId);
  return NextResponse.json({ service: data });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);
  const { id } = await params;

  const db = await createTenantServiceClient(tenant.businessId);
  const { data: service } = await db
    .from("business_services")
    .select("id, name, aliases")
    .eq("id", id)
    .maybeSingle();
  if (!service) return NextResponse.json({ error: "Service not found" }, { status: 404 });

  const aliases = Array.isArray(service.aliases) ? service.aliases.map(String) : [];
  const names = [...new Set([service.name, ...aliases])];

  const { count: byId } = await db
    .from("projects")
    .select("id", { count: "exact", head: true })
    .eq("service_id", id);

  const { data: byType } = await db.from("projects").select("id").in("service_type", names);
  const used = (byId ?? 0) + (byType ?? []).length;
  if (used > 0) {
    return NextResponse.json(
      {
        error:
          "This service is used on existing projects and cannot be deleted. Deactivate it instead so it stays on historical work but hides from new requests.",
        used,
      },
      { status: 409 }
    );
  }

  const { error } = await db.from("business_services").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  invalidateBusinessServicesCache(tenant.businessId);
  return NextResponse.json({ ok: true });
}
