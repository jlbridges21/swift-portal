import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import {
  enableClientPortalAccess,
  ensureClientPortalLink,
  getClientPortalStatus,
} from "@/lib/client-portal-link";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
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

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);
  const businessId = tenant.businessId;
  const result = await enableClientPortalAccess(id, password, businessId);
  if (!result.hasPortal) {
    return NextResponse.json({ error: result.message }, { status: 400 });
  }

  return NextResponse.json({
    success: true,
    has_portal: true,
    user_id: result.userId,
    created: result.created ?? false,
    message: result.message,
  });
}
