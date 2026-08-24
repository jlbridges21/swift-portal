import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { allowClientPortalRecovery } from "@/lib/client-portal-recovery-rate-limit";
import {
  getClientPortalAccountStatus,
  sendClientPortalPasswordReset,
  setClientPortalTempPassword,
} from "@/lib/client-portal-recovery";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

type RouteParams = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const { id } = await params;
  const status = await getClientPortalAccountStatus(id, tenant.businessId);
  if (!status) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  return NextResponse.json({ status });
}

export async function POST(request: Request, { params }: RouteParams) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const { id: clientId } = await params;

  let body: { action?: string; confirm?: string; password?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    body = {};
  }

  if (typeof body.password === "string" && body.password.length > 0) {
    return NextResponse.json(
      { error: "Password cannot be supplied — use send_reset or set_temp_password." },
      { status: 400 }
    );
  }

  const actor = { id: auth.profile.id, email: auth.profile.email };

  try {
    if (body.action === "send_reset") {
      if (
        !allowClientPortalRecovery({
          businessId: tenant.businessId,
          clientId,
          action: "send_reset",
          actorId: actor.id,
        })
      ) {
        return NextResponse.json(
          { error: "Too many attempts. Try again in a few minutes." },
          { status: 429 }
        );
      }
      const result = await sendClientPortalPasswordReset(clientId, tenant.businessId, actor);
      return NextResponse.json(result);
    }

    if (body.action === "set_temp_password") {
      if (
        !allowClientPortalRecovery({
          businessId: tenant.businessId,
          clientId,
          action: "set_temp_password",
          actorId: actor.id,
        })
      ) {
        return NextResponse.json(
          { error: "Too many attempts. Try again in a few minutes." },
          { status: 429 }
        );
      }
      const result = await setClientPortalTempPassword(
        clientId,
        tenant.businessId,
        actor,
        typeof body.confirm === "string" ? body.confirm : ""
      );
      return NextResponse.json(result);
    }

    return NextResponse.json({ error: "Unknown action." }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Recovery failed" },
      { status: 400 }
    );
  }
}
