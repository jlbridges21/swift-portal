import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isOwnerAdmin, visibleProjectIdsFor } from "@/lib/staff-access";

/**
 * Project picker for "Add to Project" on the Clients page: active projects this viewer can
 * see, newest first, optionally filtered by name/address.
 */
export async function GET(request: Request) {
  const auth = await requireAdminApi({ permission: "clients.add_to_projects" });
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const q = (new URL(request.url).searchParams.get("q") ?? "").replace(/[%_,()]/g, "").trim().slice(0, 80);
  const visible = isOwnerAdmin(auth.profile)
    ? ("all" as const)
    : await visibleProjectIdsFor(tenant.businessId, auth.profile);
  if (visible !== "all" && visible.length === 0) return NextResponse.json([]);

  const db = await createTenantServiceClient(tenant.businessId);
  let query = db
    .from("projects")
    .select("id, project_name, property_address, status, client_id, updated_at")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(40);
  if (visible !== "all") query = query.in("id", visible);
  if (q) query = query.or(`project_name.ilike.%${q}%,property_address.ilike.%${q}%`);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? [], { headers: { "Cache-Control": "no-store" } });
}
