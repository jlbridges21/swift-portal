import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { restoreClient, softDeleteClient } from "@/lib/soft-delete";
import { getTenantContext, LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const profile = await requireAdmin();
    const { id } = await params;
    const tenant = await getTenantContext();
    const businessId = tenant?.businessId ?? LEGACY_DEFAULT_BUSINESS_ID; // TODO(tenant): require tenant on client delete
    await softDeleteClient(id, profile.id, businessId);
    return NextResponse.json({ success: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to hide client";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    await requireAdmin();
    const { id } = await params;
    const body = await request.json();

    if (body.action === "restore") {
      const tenant = await getTenantContext();
      const businessId = tenant?.businessId ?? LEGACY_DEFAULT_BUSINESS_ID; // TODO(tenant): require tenant on client restore
      await restoreClient(id, businessId);
      return NextResponse.json({ success: true, restored: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to restore client";
    if (message === "Unauthorized") {
      return NextResponse.json({ error: message }, { status: 401 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
