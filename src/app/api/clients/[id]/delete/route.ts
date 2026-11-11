import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { canAccessClient } from "@/lib/staff-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  DeleteMigrationMissingError,
  DeleteTargetNotFoundError,
  permanentlyDeleteClient,
} from "@/lib/permanent-delete";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Permanently delete a client (Hide is DELETE /api/clients/[id]).
 * Removes the client record and what is only theirs (notes, messages, brand profile,
 * project assignments). Their projects and media are kept; projects with no other
 * assigned client are left with no client.
 */
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const profile = await requireAdmin({ permission: "clients.delete" });
    const { id } = await params;
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    if (!(await canAccessClient(tenant.businessId, profile, id))) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = await createTenantServiceClient(tenant.businessId);
    const { data: client } = await db
      .from("clients")
      .select("id, name, full_name, email")
      .eq("id", id)
      .maybeSingle();
    if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const summary = await permanentlyDeleteClient(db, id);

    await logProjectActivity(
      "client_deleted",
      `Client "${client.full_name || client.name || client.email || id}" was permanently deleted`,
      {
        businessId: tenant.businessId,
        userId: profile.id,
        visibility: "admin",
        metadata: { deleted_client_id: id, ...summary },
      }
    ).catch(() => null);

    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete client";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    if (message === "Forbidden") {
      return NextResponse.json({ error: "You don't have permission to delete clients." }, { status: 403 });
    }
    if (err instanceof DeleteTargetNotFoundError) return NextResponse.json({ error: message }, { status: 404 });
    if (err instanceof DeleteMigrationMissingError) {
      return NextResponse.json({ error: message, code: "migration_required" }, { status: 503 });
    }
    console.error("[clients/delete]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
