import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { invalidateBusinessServicesCache } from "@/lib/business-services";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = (await request.json()) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.map(String) : [];
  if (!ids.length) return NextResponse.json({ error: "ids required" }, { status: 400 });

  const db = await createTenantServiceClient(tenant.businessId);
  for (let i = 0; i < ids.length; i += 1) {
    const { error } = await db
      .from("business_services")
      .update({ display_order: i })
      .eq("id", ids[i]);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  invalidateBusinessServicesCache(tenant.businessId);
  return NextResponse.json({ ok: true });
}
