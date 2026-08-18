import { NextResponse } from "next/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";

/**
 * Media reorder:
 * - Photos: { project_id, ordered_ids: string[] } → reorder_media_assets RPC
 *   ordered_ids must be the full project photo list in display order.
 * - Tours / video-doc arrows: { items: [{ id, display_order, type }] }
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const body = await request.json().catch(() => ({}));
  const db = await createTenantServiceClient(tenant.businessId);

  const orderedIds = Array.isArray(body.ordered_ids) ? (body.ordered_ids as unknown[]) : null;
  const projectId = typeof body.project_id === "string" ? body.project_id : null;

  if (orderedIds) {
    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }
    if (!orderedIds.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: "ordered_ids must be string UUIDs" }, { status: 400 });
    }
    if (orderedIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    // Tenant-scoped lookup: Tenant B ids are not found. RPC still runs as
    // service_role (v32 short-circuits JWT business check for service_role).
    const { data: rows, error: lookupError } = await db
      .from("media_assets")
      .select("id, project_id, media_type")
      .in("id", orderedIds as string[]);

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!rows || rows.length !== orderedIds.length) {
      return NextResponse.json(
        { error: "One or more photo IDs were not found" },
        { status: 400 }
      );
    }
    for (const row of rows) {
      if (row.project_id !== projectId) {
        return NextResponse.json(
          { error: "One or more photos do not belong to this project" },
          { status: 400 }
        );
      }
      if (row.project_id == null) {
        return NextResponse.json(
          { error: "Cannot reorder unassigned library assets" },
          { status: 400 }
        );
      }
      if (row.media_type !== "photo") {
        return NextResponse.json(
          { error: "ordered_ids must contain only photos" },
          { status: 400 }
        );
      }
    }

    const { error } = await db.raw.rpc("reorder_media_assets", {
      p_project_id: projectId,
      p_ordered_ids: orderedIds,
    });

    if (error) {
      console.error("[media/reorder] RPC failed", error.message);
      return NextResponse.json(
        { error: error.message || "Failed to reorder media" },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true });
  }

  if (!body.items || !Array.isArray(body.items)) {
    return NextResponse.json({ error: "Invalid items" }, { status: 400 });
  }

  for (const item of body.items as { id?: string; display_order?: number; type?: string }[]) {
    if (!item?.id || typeof item.display_order !== "number") {
      return NextResponse.json({ error: "Invalid reorder item" }, { status: 400 });
    }

    const table = item.type === "tour" ? "tours" : "media_assets";
    const { data: row, error: lookupError } = await db
      .from(table)
      .select("id, project_id")
      .eq("id", item.id)
      .maybeSingle();

    if (lookupError || !row) {
      return NextResponse.json({ error: "Item not found" }, { status: 404 });
    }

    if (projectId && row.project_id !== projectId) {
      return NextResponse.json(
        { error: "Item does not belong to the given project" },
        { status: 400 }
      );
    }

    if (table === "media_assets" && row.project_id == null) {
      return NextResponse.json(
        { error: "Cannot reorder unassigned library assets" },
        { status: 400 }
      );
    }

    const { error } = await db
      .from(table)
      .update({ display_order: item.display_order })
      .eq("id", item.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
