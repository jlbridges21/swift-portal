import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { isOwnerAdmin } from "@/lib/staff-access";
import type { Profile } from "@/lib/types";
import {
  demoteAdminToStaff,
  disableStaffMember,
  getBusinessOwnerUserId,
  getBusinessSeatSnapshot,
  inviteStaffMember,
  listTeamMembers,
  promoteStaffToAdmin,
  resetStaffPassword,
  updateStaffMember,
} from "@/lib/staff";

function requireBusinessAdmin(profile: Profile) {
  if (!isOwnerAdmin(profile)) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const auth = await requireAdminApi({ adminOnly: true });
  if (!auth.ok) return auth.response;
  const denied = requireBusinessAdmin(auth.profile);
  if (denied) return denied;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const includeDisabled =
    new URL(request.url).searchParams.get("includeDisabled") === "1";

  const [staff, seats, ownerUserId] = await Promise.all([
    listTeamMembers(tenant.businessId, { includeDisabled }),
    getBusinessSeatSnapshot(tenant.businessId),
    getBusinessOwnerUserId(tenant.businessId),
  ]);

  return NextResponse.json({ staff, seats, ownerUserId });
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
    permissions?: unknown;
  };

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

  if (body.action === "promote_admin") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "userId required." }, { status: 400 });
    }
    const result = await promoteStaffToAdmin({
      businessId: tenant.businessId,
      userId,
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

  if (body.action === "demote_staff") {
    const userId = typeof body.userId === "string" ? body.userId : "";
    if (!userId) {
      return NextResponse.json({ error: "userId required." }, { status: 400 });
    }
    const result = await demoteAdminToStaff({
      businessId: tenant.businessId,
      userId,
      actor: { id: auth.profile.id, email: auth.profile.email },
      permissions: body.permissions,
    });
    if (!result.ok) {
      const status = result.code === "owner_protected" ? 403 : 400;
      return NextResponse.json(
        { error: result.error, code: result.code, seats: result.seats },
        { status }
      );
    }
    return NextResponse.json(result);
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
    return NextResponse.json(
      { error: result.error, code: result.code, refusedKeys: result.refusedKeys },
      { status: 400 }
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
    const status = result.code === "owner_protected" ? 403 : 404;
    return NextResponse.json({ error: result.error, code: result.code }, { status });
  }

  return NextResponse.json(result);
}
