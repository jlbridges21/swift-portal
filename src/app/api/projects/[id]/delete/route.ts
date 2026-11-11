import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { logProjectActivity } from "@/lib/activity";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { resolveProjectAccess } from "@/lib/project-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  DeleteMigrationMissingError,
  DeleteTargetNotFoundError,
  ProjectHasPaidInvoicesError,
  parseProjectDeleteMode,
  permanentlyDeleteProject,
} from "@/lib/permanent-delete";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Permanently delete a project (Hide is DELETE /api/projects/[id]).
 * Body: { mode: "keep_media" | "delete_media" }.
 * keep_media needs projects.delete; delete_media also needs media.delete.
 * Refused with 409 { code: "has_paid_invoices" } when the project has paid / processing
 * payments — those projects can only be hidden.
 * Works for visible and hidden projects. The project's client is never modified.
 */
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const body = (await request.json().catch(() => null)) as { mode?: unknown } | null;
    const mode = parseProjectDeleteMode(body?.mode);
    if (!mode) {
      return NextResponse.json({ error: "Choose whether to keep or delete the project's media." }, { status: 400 });
    }

    const profile = await requireAdmin(
      mode === "delete_media"
        ? { permission: ["projects.delete", "media.delete"], requireAll: true }
        : { permission: "projects.delete" }
    );
    const { id } = await params;
    const tenant = await getTenantContext();
    if (!tenant) return missingTenantResponse(profile.role);
    // Hidden (soft-deleted) projects can be deleted too. includeDeleted only lets an
    // owner/admin of this business through for hidden rows (same rule as Unhide);
    // visible projects keep the normal staff assignment check.
    const access = await resolveProjectAccess(profile, id, {
      includeDeleted: true,
      tenantBusinessId: tenant.businessId,
    });
    if (!access.allowed || access.kind !== "admin") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const db = await createTenantServiceClient(tenant.businessId);
    const { data: project } = await db
      .from("projects")
      .select("id, project_name, property_address, client_id")
      .eq("id", id)
      .maybeSingle();
    if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const summary = await permanentlyDeleteProject(db, id, mode);

    await logProjectActivity(
      "project_deleted",
      `Project "${project.project_name || project.property_address || id}" was permanently deleted${
        mode === "delete_media" ? " with its media" : " (media kept)"
      }`,
      {
        businessId: tenant.businessId,
        userId: profile.id,
        clientId: (project.client_id as string | null) ?? null,
        visibility: "admin",
        metadata: { project_id: id, ...summary },
      }
    ).catch(() => null);

    return NextResponse.json({ success: true, ...summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete project";
    if (message === "Unauthorized") return NextResponse.json({ error: message }, { status: 401 });
    if (message === "Forbidden") {
      return NextResponse.json({ error: "You don't have permission to delete this project." }, { status: 403 });
    }
    if (err instanceof DeleteTargetNotFoundError) return NextResponse.json({ error: message }, { status: 404 });
    if (err instanceof ProjectHasPaidInvoicesError) {
      return NextResponse.json(
        { error: message, code: "has_paid_invoices", paidInvoices: err.paidCount },
        { status: 409 }
      );
    }
    if (err instanceof DeleteMigrationMissingError) {
      return NextResponse.json({ error: message, code: "migration_required" }, { status: 503 });
    }
    console.error("[projects/delete]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
