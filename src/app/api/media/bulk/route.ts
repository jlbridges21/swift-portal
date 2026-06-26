import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/server";
import { logMediaEvent, setMediaTags } from "@/lib/media-library";

export async function PATCH(request: Request) {
  try {
    const profile = await requireAdmin();
    const body = await request.json();
    const { action, ids, kind = "media" } = body as {
      action: string;
      ids: string[];
      kind?: string;
      tags?: string[];
      visibility?: string;
      downloadable?: boolean;
      project_id?: string;
      cover_asset_id?: string;
    };

    if (!action || !ids?.length) {
      return NextResponse.json({ error: "action and ids required" }, { status: 400 });
    }

    const supabase = await createServiceClient();

    if (action === "delete") {
      for (const id of ids) {
        const { data: asset } = await supabase.from("media_assets").select("*").eq("id", id).maybeSingle();
        if (asset?.file_path) {
          const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
          await supabase.storage.from(bucket).remove([asset.file_path]);
        }
        await logMediaEvent({
          mediaAssetId: id,
          projectId: asset?.project_id,
          userId: profile.id,
          eventType: "deleted",
          description: "Asset deleted",
        });
        await supabase.from("media_assets").delete().eq("id", id);
      }
      return NextResponse.json({ success: true, deleted: ids.length });
    }

    if (action === "favorite") {
      const table = kind === "tour" ? "tours" : "media_assets";
      await supabase.from(table).update({ is_favorite: true }).in("id", ids);
      return NextResponse.json({ success: true });
    }

    if (action === "unfavorite") {
      const table = kind === "tour" ? "tours" : "media_assets";
      await supabase.from(table).update({ is_favorite: false }).in("id", ids);
      return NextResponse.json({ success: true });
    }

    if (action === "set_tags" && body.tags) {
      for (const id of ids) {
        await setMediaTags(id, body.tags);
        await logMediaEvent({
          mediaAssetId: id,
          userId: profile.id,
          eventType: "tags_updated",
          description: `Tags updated: ${body.tags.join(", ")}`,
        });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "set_visibility" && body.visibility !== undefined) {
      await supabase
        .from("media_assets")
        .update({ visibility: body.visibility })
        .in("id", ids);
      return NextResponse.json({ success: true });
    }

    if (action === "set_downloadable" && body.downloadable !== undefined) {
      await supabase
        .from("media_assets")
        .update({ downloadable: body.downloadable })
        .in("id", ids);
      return NextResponse.json({ success: true });
    }

    if (action === "set_cover" && body.project_id && body.cover_asset_id) {
      await supabase
        .from("projects")
        .update({ cover_image_id: body.cover_asset_id })
        .eq("id", body.project_id);
      await logMediaEvent({
        mediaAssetId: body.cover_asset_id,
        projectId: body.project_id,
        userId: profile.id,
        eventType: "cover_set",
        description: "Set as project cover image",
      });
      return NextResponse.json({ success: true });
    }

    if (action === "download_urls") {
      const urls: { id: string; url: string; file_name: string }[] = [];
      for (const id of ids) {
        const { data: asset } = await supabase.from("media_assets").select("*").eq("id", id).single();
        if (!asset?.file_path) continue;
        const bucket = asset.media_type === "document" ? "project-documents" : "project-media";
        const { data } = await supabase.storage.from(bucket).createSignedUrl(asset.file_path, 3600);
        if (data?.signedUrl) {
          urls.push({ id, url: data.signedUrl, file_name: asset.file_name });
        }
      }
      return NextResponse.json({ urls });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
