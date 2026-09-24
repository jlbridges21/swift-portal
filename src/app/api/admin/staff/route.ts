import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import type { Profile } from "@/lib/types";
import {
  disableStaffMember,
  getBusinessSeatSnapshot,
  inviteStaffMember,
  listStaffMembers,
  resetStaffPassword,
  updateStaffMember,
} from "@/lib/staff";

function requireBusinessAdmin(profile: Profile) {
  if (!isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return null;
}

export async function GET() {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const denied = requireBusinessAdmin(auth.profile);
  if (denied) return denied;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const [staff, seats] = await Promise.all([
    listStaffMembers(tenant.businessId),
    getBusinessSeatSnapshot(tenant.businessId),
  ]);

  return NextResponse.json({ staff, seats });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const denied = requireBusinessAdmin(auth.profile);
  if (denied) return denied;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    fullName?: string;
    userId?: string;
  };

  // Password reset is a POST action (side-effect email).
  if (body.action === "reset_password") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "userId required." }, { status: 400 });
    }
    const result = await resetStaffPassword({
      businessId: tenant.businessId,
      userId,
      actor: { id: auth.profile.id, email: auth.profile.email },
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email : "";
  const fullName = typeof body.fullName === "string" ? body.fullName : undefined;

  const result = await inviteStaffMember({
    businessId: tenant.businessId,
    email,
    fullName,
    actor: { id: auth.profile.id, email: auth.profile.email },
  });

  if (!result.ok) {
    const status = result.code === "seat_limit" ? 402 : 400;
    return NextResponse.json(
      { error: result.error, code: result.code, seats: result.seats },
      { status }
    );
  }

  return NextResponse.json(result);
}

export async function PATCH(request: Request) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const denied = requireBusinessAdmin(auth.profile);
  if (denied) return denied;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = (await request.json().catch(() => ({}))) as {
    userId?: string;
    fullName?: string;
    email?: string;
    permissions?: unknown;
  };
  const userId = typeof body.userId === "string" ? body.userId : "";
  if (!userId) {
    return NextResponse.json({ error: "userId required." }, { status: 400 });
  }

  const result = await updateStaffMember({
    businessId: tenant.businessId,
    userId,
    fullName: body.fullName,
    email: body.email,
    permissions: body.permissions,
    actor: { id: auth.profile.id, email: auth.profile.email },
  });

  if (!result.ok) {
    const status = result.code === "never_delegable" ? 400 : 400;
    return NextResponse.json(
      { error: result.error, code: result.code, refusedKeys: result.refusedKeys },
      { status }
    );
  }

  return NextResponse.json(result);
}

export async function DELETE(request: Request) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const denied = requireBusinessAdmin(auth.profile);
  if (denied) return denied;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId")?.trim() || "";
  if (!userId) {
    return NextResponse.json({ error: "userId required." }, { status: 400 });
  }

  const result = await disableStaffMember({
    businessId: tenant.businessId,
    userId,
    actor: { id: auth.profile.id, email: auth.profile.email },
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 404 });
  }

  return NextResponse.json(result);
}
