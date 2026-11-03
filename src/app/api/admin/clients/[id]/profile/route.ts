import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { loadClientProfileView } from "@/lib/client-profile-view";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Full client profile for the Projects → Client View modal (same data as /admin/clients/[id]). */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi({ area: "clients" });
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const { id } = await params;
  const view = await loadClientProfileView({ businessId: tenant.businessId, profile: auth.profile, clientId: id });
  if (!view) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json(view, { headers: { "Cache-Control": "no-store" } });
}
