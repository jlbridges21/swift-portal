import { NextResponse } from "next/server";
import JSZip from "jszip";
import { createServiceClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/auth";
import { canDownloadDeliverables } from "@/lib/deliverables";
import { filterClientMedia } from "@/lib/client-media";
import { sanitizeStorageFileName } from "@/lib/media-upload";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getProfile();
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: projectId } = await params;
  const supabase = await createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, project_name, property_address, status, client_id")
    .eq("id", projectId)
    .single();

  if (!project) return NextResponse.json({ error: "Project not found." }, { status: 404 });

  const isAdmin = profile.role === "admin";
  if (!isAdmin && !canDownloadDeliverables(project.status)) {
    return NextResponse.json({ error: "Downloads unlock after your final payment is complete." }, { status: 403 });
  }

  if (!isAdmin) {
    const { data: client } = await supabase.from("clients").select("id").eq("user_id", profile.id).maybeSingle();
    const { data: junction } = await supabase
      .from("project_clients")
      .select("client_id")
      .eq("project_id", projectId)
      .eq("client_id", client?.id ?? "")
      .maybeSingle();
    if (project.client_id !== client?.id && !junction) {
      return NextResponse.json({ error: "You don't have access to this project." }, { status: 403 });
    }
  }

  const { data: media } = await supabase
    .from("media_assets")
    .select("*")
    .eq("project_id", projectId)
    .in("media_type", ["photo", "video"])
    .order("display_order");

  const assets = isAdmin ? (media ?? []) : filterClientMedia(media ?? []);
  const downloadable = assets.filter(
    (a) => a.media_source === "upload" && a.file_path && a.media_type !== "document"
  );

  if (!downloadable.length) {
    return NextResponse.json({ error: "No downloadable files" }, { status: 404 });
  }

  const zip = new JSZip();
  const folder = zip.folder("deliverables")!;
  let addedCount = 0;

  for (const asset of downloadable) {
    const bucket = "project-media";
    const { data: blob, error } = await supabase.storage.from(bucket).download(asset.file_path);
    if (error || !blob) continue;
    const buffer = Buffer.from(await blob.arrayBuffer());
    const safeName = sanitizeStorageFileName(asset.file_name || `${asset.id}.bin`);
    folder.file(safeName, buffer);
    addedCount++;
  }

  if (addedCount === 0) {
    return NextResponse.json(
      { error: "No files could be downloaded. Your deliverables may still be processing — try again shortly." },
      { status: 404 }
    );
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  const label = sanitizeStorageFileName(project.project_name || project.property_address.split(",")[0] || "project");
  const filename = `${label}-deliverables.zip`;

  return new NextResponse(new Uint8Array(zipBuffer), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
