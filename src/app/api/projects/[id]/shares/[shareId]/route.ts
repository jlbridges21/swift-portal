import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import {
  resolveShareAccessWindow,
  revokeProjectShare,
  updateProjectShareExpiry,
  type ShareExpiryPreset,
} from "@/lib/project-shares";
import { canAccessProject } from "@/lib/project-access";
import { isOwnerAdmin, staffCan } from "@/lib/staff-access";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    const profile = await getProfile();
    if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.email"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id: projectId, shareId } = await params;
    if (!(await canAccessProject(profile, projectId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    await revokeProjectShare(tenant.businessId, projectId, shareId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not remove share.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    const profile = await getProfile();
    if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.email"))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    const { id: projectId, shareId } = await params;
    if (!(await canAccessProject(profile, projectId))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const body = (await request.json()) as {
      expiryPreset?: ShareExpiryPreset;
      customAccessStartsAt?: string | null;
      customAccessExpiresAt?: string | null;
    };

    const preset = body.expiryPreset ?? "30days";
    const accessFields = resolveShareAccessWindow(preset, {
      startsAt: body.customAccessStartsAt,
      expiresAt: body.customAccessExpiresAt,
    });

    const share = await updateProjectShareExpiry(
      tenant.businessId,
      projectId,
      shareId,
      accessFields
    );

    return NextResponse.json({ share });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not update share.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
