import { NextResponse } from "next/server";
import { requireBusinessAdmin } from "@/lib/tenant";
import { revokeProjectShare } from "@/lib/project-shares";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; shareId: string }> }
) {
  try {
    const tenant = await requireBusinessAdmin();
    const { id: projectId, shareId } = await params;
    await revokeProjectShare(tenant.businessId, projectId, shareId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not revoke share.";
    const status = message === "Unauthorized" ? 401 : message === "Forbidden" ? 403 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
