import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { ensureClientPortalLink, getClientPortalStatus } from "@/lib/client-portal-link";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);
  const businessId = tenant.businessId;
  const status = await getClientPortalStatus([id], businessId);
  const linked = await ensureClientPortalLink(id, businessId);
  if (!linked.linked && linked.message === "Client not found") {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }
  const row = status.get(id) ?? { hasPortal: false, userId: null };

  return NextResponse.json({
    has_portal: linked.hasPortal || row.hasPortal,
    user_id: linked.userId ?? row.userId,
    linked: linked.linked,
    message: linked.message,
  });
}

/**
 * Retired: businesses no longer set client passwords. Use
 * POST /api/clients/[id]/portal-invite (send or copy an activation link).
 */
export async function POST() {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  return NextResponse.json(
    { error: "Client passwords can't be set by the business. Send a portal invite instead." },
    { status: 410 }
  );
}
