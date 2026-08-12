import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";

/**
 * Media reorder:
 * - Photos (preferred): { project_id, folder_id: string|null, ordered_ids: string[] }
 *   → single RPC reorder_media_assets
 * - Tours / legacy video-doc arrows: { items: [{ id, display_order, type }] }
 */
export async function PATCH(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const supabase = await createServiceClient();

  const orderedIds = Array.isArray(body.ordered_ids) ? (body.ordered_ids as unknown[]) : null;
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const folderId =
    body.folder_id === null || body.folder_id === undefined
      ? null
      : typeof body.folder_id === "string"
        ? body.folder_id
        : undefined;

  if (orderedIds) {
    if (!projectId) {
      return NextResponse.json({ error: "project_id is required" }, { status: 400 });
    }
    if (folderId === undefined) {
      return NextResponse.json({ error: "folder_id must be a string or null" }, { status: 400 });
    }
    if (!orderedIds.every((id) => typeof id === "string")) {
      return NextResponse.json({ error: "ordered_ids must be string UUIDs" }, { status: 400 });
    }
    if (orderedIds.length === 0) {
      return NextResponse.json({ success: true });
    }

    const { error } = await supabase.rpc("reorder_media_assets", {
      p_project_id: projectId,
      p_folder_id: folderId,
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
    const { data: row, error: lookupError } = await supabase
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

    const { error } = await supabase
      .from(table)
      .update({ display_order: item.display_order })
      .eq("id", item.id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true });
}
