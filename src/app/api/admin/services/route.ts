import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  invalidateBusinessServicesCache,
  listBusinessServices,
  slugifyServiceName,
  type BusinessServiceRow,
} from "@/lib/business-services";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

function parseLineItems(value: unknown): { description: string; amount_cents: number }[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    const row = item as { description?: unknown; amount_cents?: unknown };
    return {
      description: String(row.description ?? ""),
      amount_cents: Number(row.amount_cents ?? 0),
    };
  });
}

export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const services = await listBusinessServices(tenant.businessId, { bypassCache: true });
  return NextResponse.json({ services });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = (await request.json()) as Record<string, unknown>;
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const db = await createTenantServiceClient(tenant.businessId);
  const existing = await listBusinessServices(tenant.businessId, { bypassCache: true });
  let slug = slugifyServiceName(String(body.slug ?? name));
  const slugs = new Set(existing.map((row) => row.slug));
  if (slugs.has(slug)) {
    let n = 2;
    while (slugs.has(`${slug}_${n}`)) n += 1;
    slug = `${slug}_${n}`;
  }

  const cents =
    body.preliminary_estimate_cents == null ? null : Number(body.preliminary_estimate_cents);
  const hidePricing = Boolean(body.hide_pricing);
  const lineItems = parseLineItems(body.line_items);
  const resolvedLineItems =
    lineItems.length > 0
      ? lineItems
      : [{ description: name, amount_cents: hidePricing ? 0 : cents ?? 0 }];

  const { data, error } = await db
    .from("business_services")
    .insert({
      name,
      slug,
      description: body.description ? String(body.description) : null,
      preliminary_estimate_cents: hidePricing ? 0 : cents,
      starting_label: body.starting_label ? String(body.starting_label) : hidePricing ? "Custom Quote" : "",
      includes: parseStringArray(body.includes),
      line_items: resolvedLineItems,
      notes: body.notes ? String(body.notes) : "",
      hide_pricing: hidePricing,
      is_recommended: Boolean(body.is_recommended),
      display_order:
        body.display_order == null
          ? existing.length
          : Number(body.display_order),
      is_active: body.is_active === false ? false : true,
      aliases: parseStringArray(body.aliases).length ? parseStringArray(body.aliases) : [name],
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  invalidateBusinessServicesCache(tenant.businessId);
  return NextResponse.json({ service: data as BusinessServiceRow });
}
