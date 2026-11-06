import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createPortalInvite, getClientPortalAccess } from "@/lib/portal-activation-server";
import { allowClientPortalRecovery } from "@/lib/client-portal-recovery-rate-limit";

type RouteParams = { params: Promise<{ id: string }> };

/** Portal access state for one client: active | not_activated | invite_sent. */
export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const { id } = await params;
  const access = await getClientPortalAccess(id, tenant.businessId);
  if (!access) return NextResponse.json({ error: "Client not found" }, { status: 404 });
  return NextResponse.json(access, { headers: { "Cache-Control": "no-store" } });
}

/**
 * action "send": email an activation link to the client's address on file.
 * action "link": return an activation link to copy (not emailed, not logged as sent).
 * Owners never choose or see a client password.
 */
export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { action?: unknown; project_id?: unknown };
  const action = body.action === "send" ? "send" : body.action === "link" ? "link" : null;
  if (!action) return NextResponse.json({ error: "Unknown action." }, { status: 400 });

  if (
    action === "send" &&
    !allowClientPortalRecovery({
      businessId: tenant.businessId,
      clientId: id,
      action: "send_reset",
      actorId: auth.profile.id,
    })
  ) {
    return NextResponse.json({ error: "Too many invites. Try again in a few minutes." }, { status: 429 });
  }

  const projectId = typeof body.project_id === "string" && body.project_id ? body.project_id : null;
  const result = await createPortalInvite({
    businessId: tenant.businessId,
    clientId: id,
    send: action === "send",
    actorId: auth.profile.id,
    source: "owner",
    projectId,
    nextPath: projectId ? `/dashboard/projects/${projectId}` : null,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  const access = await getClientPortalAccess(id, tenant.businessId);
  return NextResponse.json({ url: result.url, sentTo: result.sentTo ?? null, access });
}
