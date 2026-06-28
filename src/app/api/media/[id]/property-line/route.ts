import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireAdminApi } from "@/lib/api-auth";
import { buildMediaStoragePath } from "@/lib/media-upload";
import { logMediaEvent, setMediaTags, getMediaTags } from "@/lib/media-library";
import {
  parsePropertyLineAnnotation,
  stripPropertyLineTitleSuffix,
  type PropertyLineAnnotation,
} from "@/lib/property-line/annotation";
import { buildPropertyLineFileName } from "@/lib/property-line/filename";

async function syncProjectRelations(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  projectId: string | null
) {
  if (!projectId) return { client_id: null, property_id: null };
  const { data: project } = await supabase
    .from("projects")
    .select("client_id, property_id")
    .eq("id", projectId)
    .single();
  return {
    client_id: project?.client_id ?? null,
    property_id: project?.property_id ?? null,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const supabase = await createServiceClient();

  const { data: asset, error } = await supabase
    .from("media_assets")
    .select("id, title, file_name, project_id, property_line_base_media_id, property_line_data")
    .eq("id", id)
    .single();

  if (error || !asset) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const tags = await getMediaTags(asset.id);
  const annotation = parsePropertyLineAnnotation(asset.property_line_data);

  if (annotation && asset.property_line_base_media_id) {
    return NextResponse.json({
      baseMediaId: asset.property_line_base_media_id,
      editMediaId: asset.id,
      annotation,
      title: asset.title || asset.file_name,
      fileName: asset.file_name,
      projectId: asset.project_id,
      tags,
    });
  }

  const { data: derived } = await supabase
    .from("media_assets")
    .select("id, title, file_name, project_id, property_line_data")
    .eq("property_line_base_media_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (derived) {
    const derivedAnnotation = parsePropertyLineAnnotation(derived.property_line_data);
    if (derivedAnnotation) {
      return NextResponse.json({
        baseMediaId: id,
        editMediaId: derived.id,
        annotation: derivedAnnotation,
        title: derived.title || derived.file_name,
        fileName: derived.file_name,
        projectId: derived.project_id ?? asset.project_id,
        tags: await getMediaTags(derived.id),
      });
    }
  }

  return NextResponse.json({
    baseMediaId: id,
    editMediaId: null,
    annotation: null,
    title: asset.title || asset.file_name,
    fileName: asset.file_name,
    projectId: asset.project_id,
    tags,
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const { id: _routeMediaId } = await params;
  const formData = await request.formData();

  const file = formData.get("file");
  const annotationRaw = formData.get("annotation");
  const baseMediaId = String(formData.get("baseMediaId") || "");
  let editMediaId = formData.get("editMediaId") ? String(formData.get("editMediaId")) : null;
  const projectIdRaw = formData.get("projectId");
  const sourceTitle = String(formData.get("sourceTitle") || "");
  const sourceFileName = String(formData.get("sourceFileName") || "photo.jpg");

  if (!(file instanceof Blob) || file.size === 0) {
    return NextResponse.json({ error: "Rendered image file is required." }, { status: 400 });
  }

  let annotation: PropertyLineAnnotation | null = null;
  try {
    annotation = parsePropertyLineAnnotation(
      typeof annotationRaw === "string" ? JSON.parse(annotationRaw) : annotationRaw
    );
  } catch {
    return NextResponse.json({ error: "Invalid annotation data." }, { status: 400 });
  }

  if (!annotation || annotation.points.length < 3) {
    return NextResponse.json({ error: "At least three points are required." }, { status: 400 });
  }

  if (!baseMediaId) {
    return NextResponse.json({ error: "Base media id is required." }, { status: 400 });
  }

  const supabase = await createServiceClient();
  const projectId = projectIdRaw && String(projectIdRaw) !== "" ? String(projectIdRaw) : null;
  const relations = await syncProjectRelations(supabase, projectId);

  if (!editMediaId) {
    const { data: existingDerived } = await supabase
      .from("media_assets")
      .select("id")
      .eq("property_line_base_media_id", baseMediaId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingDerived) {
      editMediaId = existingDerived.id;
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const bucket = "project-media";

  if (editMediaId) {
    const { data: existing, error: fetchError } = await supabase
      .from("media_assets")
      .select("*")
      .eq("id", editMediaId)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: "Property line asset not found." }, { status: 404 });
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(existing.file_path, buffer, {
        upsert: true,
        contentType: "image/jpeg",
      });

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const { data: updated, error: updateError } = await supabase
      .from("media_assets")
      .update({
        property_line_base_media_id: baseMediaId,
        property_line_data: annotation,
        file_size: buffer.length,
        mime_type: "image/jpeg",
        project_id: projectId ?? existing.project_id,
        client_id: relations.client_id ?? existing.client_id,
        property_id: relations.property_id ?? existing.property_id,
        updated_at: new Date().toISOString(),
      })
      .eq("id", editMediaId)
      .select()
      .single();

    if (updateError || !updated) {
      return NextResponse.json({ error: updateError?.message || "Update failed." }, { status: 500 });
    }

    await setMediaTags(editMediaId, ["property-line"]);
    await logMediaEvent({
      mediaAssetId: editMediaId,
      projectId: updated.project_id,
      userId: auth.profile?.id,
      eventType: "property_line_updated",
      description: "Property line annotation updated",
    });

    return NextResponse.json({ media: updated, updated: true });
  }

  const { data: baseAsset } = await supabase
    .from("media_assets")
    .select("project_id, client_id, property_id")
    .eq("id", baseMediaId)
    .single();

  const resolvedProjectId = projectId ?? baseAsset?.project_id ?? null;
  const resolvedRelations = resolvedProjectId
    ? await syncProjectRelations(supabase, resolvedProjectId)
    : relations;

  const fileName = buildPropertyLineFileName(sourceFileName);
  const filePath = buildMediaStoragePath(resolvedProjectId, fileName);
  const displayTitle = `${stripPropertyLineTitleSuffix(sourceTitle || sourceFileName)} (Property Line)`;

  const { error: uploadError } = await supabase.storage.from(bucket).upload(filePath, buffer, {
    upsert: false,
    contentType: "image/jpeg",
  });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: created, error: insertError } = await supabase
    .from("media_assets")
    .insert({
      project_id: resolvedProjectId,
      client_id: resolvedRelations.client_id,
      property_id: resolvedRelations.property_id,
      file_name: fileName,
      file_path: filePath,
      storage_path: filePath,
      file_size: buffer.length,
      mime_type: "image/jpeg",
      media_type: "photo",
      media_source: "upload",
      title: displayTitle,
      property_line_base_media_id: baseMediaId,
      property_line_data: annotation,
    })
    .select()
    .single();

  if (insertError || !created) {
    return NextResponse.json({ error: insertError?.message || "Create failed." }, { status: 500 });
  }

  await setMediaTags(created.id, ["property-line"]);
  await logMediaEvent({
    mediaAssetId: created.id,
    projectId: created.project_id,
    userId: auth.profile?.id,
    eventType: "property_line_created",
    description: "Property line image created",
    metadata: { baseMediaId },
  });

  if (resolvedProjectId) {
    const { data: project } = await supabase
      .from("projects")
      .select("cover_image_id")
      .eq("id", resolvedProjectId)
      .single();
    if (!project?.cover_image_id) {
      await supabase.from("projects").update({ cover_image_id: created.id }).eq("id", resolvedProjectId);
    }
  }

  return NextResponse.json({ media: created, updated: false });
}
