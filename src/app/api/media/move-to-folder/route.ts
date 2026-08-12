import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";

/**
 * Move selected photos into a folder (or unfiled when folder_id is null).
 * Assigns display_order at the end of the destination folder.
 */
export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => ({}));
  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const folderId =
    body.folder_id === null
      ? null
      : typeof body.folder_id === "string"
        ? body.folder_id
        : undefined;
  const photoIds = Array.isArray(body.photo_ids) ? (body.photo_ids as unknown[]) : null;

  if (!projectId || folderId === undefined || !photoIds) {
    return NextResponse.json(
      { error: "project_id, folder_id (string|null), and photo_ids are required" },
      { status: 400 }
    );
  }
  if (!photoIds.every((id) => typeof id === "string") || photoIds.length === 0) {
    return NextResponse.json({ error: "photo_ids must be a non-empty string array" }, { status: 400 });
  }

  const supabase = await createServiceClient();

  if (folderId) {
    const { data: folder } = await supabase
      .from("media_folders")
      .select("id, project_id")
      .eq("id", folderId)
      .maybeSingle();
    if (!folder || folder.project_id !== projectId) {
      return NextResponse.json({ error: "Folder does not belong to this project" }, { status: 400 });
    }
  }

  const { data: assets, error: assetsError } = await supabase
    .from("media_assets")
    .select("id, project_id, media_type, folder_id")
    .in("id", photoIds as string[]);

  if (assetsError) {
    return NextResponse.json({ error: assetsError.message }, { status: 500 });
  }

  if (!assets || assets.length !== photoIds.length) {
    return NextResponse.json(
      { error: "One or more photo IDs were not found" },
      { status: 400 }
    );
  }

  for (const asset of assets) {
    if (asset.project_id !== projectId) {
      return NextResponse.json(
        { error: "One or more photos do not belong to this project" },
        { status: 400 }
      );
    }
    if (asset.project_id == null) {
      return NextResponse.json(
        { error: "Cannot move unassigned library assets into folders" },
        { status: 400 }
      );
    }
    if (asset.media_type !== "photo") {
      return NextResponse.json(
        { error: "Only photos can be moved into folders" },
        { status: 400 }
      );
    }
  }

  let maxOrderQuery = supabase
    .from("media_assets")
    .select("display_order")
    .eq("project_id", projectId)
    .eq("media_type", "photo")
    .order("display_order", { ascending: false })
    .limit(1);

  if (folderId === null) {
    maxOrderQuery = maxOrderQuery.is("folder_id", null);
  } else {
    maxOrderQuery = maxOrderQuery.eq("folder_id", folderId);
  }

  const { data: maxRow } = await maxOrderQuery.maybeSingle();
  let nextOrder = (maxRow?.display_order ?? -1) + 1;

  // Preserve relative selection order from photo_ids
  for (const id of photoIds as string[]) {
    const { error } = await supabase
      .from("media_assets")
      .update({ folder_id: folderId, display_order: nextOrder++ })
      .eq("id", id)
      .eq("project_id", projectId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, moved: photoIds.length, folder_id: folderId });
}
