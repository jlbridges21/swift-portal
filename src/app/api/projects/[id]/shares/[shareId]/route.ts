import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { requireBusinessAdmin } from "@/lib/tenant";
import {
  resolveShareAccessWindow,
  revokeProjectShare,
  updateProjectShareExpiry,
  type ShareExpiryPreset,
} from "@/lib/project-shares";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    await getProfile();
    const tenant = await requireBusinessAdmin();
    const { id: projectId, shareId } = await params;
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
    await getProfile();
    const tenant = await requireBusinessAdmin();
    const { id: projectId, shareId } = await params;
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
