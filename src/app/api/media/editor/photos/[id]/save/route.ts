import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logMediaEvent } from "@/lib/media-library";
import { isTenantPrefixedStoragePath } from "@/lib/media-upload";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { verifyStorageObject } from "@/lib/upload/storage-verify";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import {
  PHOTO_BUCKET,
  deliveryFieldsFor,
  ensureOriginalVersion,
  isPhotoEditorSchemaMissing,
  loadEditableAsset,
  pruneOldEditVersions,
  type VersionRow,
} from "@/lib/photo-editor/server";
import { PHOTO_EDITOR_MAX_SETTINGS_BYTES, settingsEqual } from "@/lib/photo-editor/shared";

const bodySchema = z.object({
  filePath: z.string().min(1).max(500),
  thumbPath: z.string().max(500).nullable().optional(),
  mimeType: z.enum(["image/jpeg", "image/png"]),
  fileSize: z.number().int().positive(),
  width: z.number().int().positive().nullable().optional(),
  height: z.number().int().positive().nullable().optional(),
  settings: z.record(z.string(), z.unknown()),
  editorVersion: z.string().max(40).optional(),
});

/**
 * POST /api/media/editor/photos/:id/save — "Save to Project".
 * 1. preserve the original as version 1 (first edit only)
 * 2. record the new edited file as the next version
 * 3. point the photo's delivery fields at it (portal, downloads, ZIPs, shares, covers follow)
 * 4. clear the draft — the saved recipe is now the starting point for "Edit again"
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("edit");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;

  const raw = await request.text();
  if (raw.length > PHOTO_EDITOR_MAX_SETTINGS_BYTES + 4000) {
    return NextResponse.json({ error: "These adjustments are too large to save." }, { status: 413 });
  }
  let json: unknown = null;
  try {
    json = JSON.parse(raw);
  } catch {
    /* handled below */
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const body = parsed.data;

  const { asset, schemaMissing } = await loadEditableAsset(db, id);
  if (schemaMissing) return setupRequired();
  if (!asset || !(await canAccessMediaAsset(businessId, profile, asset.project_id))) return notFound();

  const expectedPrefix = asset.project_id ? `${businessId}/${asset.project_id}/` : `${businessId}/library/`;
  const pathOk = (p: string) => isTenantPrefixedStoragePath(p, businessId) && p.startsWith(expectedPrefix) && !p.includes("..");
  if (!pathOk(body.filePath) || (body.thumbPath && !pathOk(body.thumbPath))) {
    return NextResponse.json({ error: "Invalid storage path." }, { status: 400 });
  }

  const verify = await verifyStorageObject(db.raw, PHOTO_BUCKET, body.filePath, {
    projectId: asset.project_id,
    fileName: asset.file_name,
    fileSize: body.fileSize,
    fileType: body.mimeType,
    mediaType: "photo",
  });
  if (!verify.ok) return NextResponse.json({ error: "The edited photo didn't finish uploading. Please try again." }, { status: 400 });

  let original: VersionRow;
  try {
    original = await ensureOriginalVersion(db, asset, profile.id);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Could not preserve the original." }, { status: 500 });
  }

  const { data: last } = await db
    .from("media_asset_versions")
    .select("version_number")
    .eq("media_asset_id", asset.id)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextNumber = Math.max(1, (last?.version_number as number | undefined) ?? 1) + 1;

  const originalName = original.file_name || asset.file_name;
  const ext = body.mimeType === "image/png" ? ".png" : ".jpg";
  const fileName = /\.(jpe?g|png|webp)$/i.test(originalName)
    ? originalName.replace(/\.(jpe?g|png|webp)$/i, (m) => (body.mimeType === "image/jpeg" && /\.jpe?g$/i.test(m) ? m : ext))
    : `${originalName}${ext}`;

  const { data: version, error: versionError } = await db
    .from("media_asset_versions")
    .insert({
      media_asset_id: asset.id,
      version_number: nextNumber,
      kind: "edit",
      file_name: fileName,
      file_path: body.filePath,
      thumbnail_url: body.thumbPath ?? null,
      file_size: body.fileSize,
      mime_type: body.mimeType,
      width: body.width ?? null,
      height: body.height ?? null,
      edit_settings: body.settings,
      editor: "lightcraft",
      editor_version: body.editorVersion ?? null,
      created_by: profile.id,
    })
    .select("*")
    .single();
  if (versionError || !version) {
    if (isPhotoEditorSchemaMissing(versionError)) return setupRequired();
    return NextResponse.json({ error: "Could not save the edited photo. Please try again." }, { status: 500 });
  }

  const { data: updated, error: updateError } = await db
    .from("media_assets")
    .update(deliveryFieldsFor(version as VersionRow, asset))
    .eq("id", asset.id)
    .select("*")
    .single();
  if (updateError || !updated) {
    await db.from("media_asset_versions").delete().eq("id", (version as VersionRow).id);
    return NextResponse.json({ error: "Could not update the photo. Please try again." }, { status: 500 });
  }

  // Clear the draft only if it still matches what was just saved (a newer auto-save from another
  // tab stays as unsaved progress).
  const { data: draft } = await db.from("media_edit_drafts").select("settings").eq("media_asset_id", asset.id).maybeSingle();
  if (!draft || settingsEqual(draft.settings, body.settings)) {
    await db.from("media_edit_drafts").delete().eq("media_asset_id", asset.id);
  }

  await pruneOldEditVersions(db, asset.id, body.filePath);
  await logMediaEvent({
    businessId,
    mediaAssetId: asset.id,
    projectId: asset.project_id,
    userId: profile.id,
    eventType: "edited",
    description: `Edited photo saved (version ${nextNumber})`,
    metadata: { versionId: (version as VersionRow).id, versionNumber: nextNumber },
  });

  return NextResponse.json({ media: updated, versionNumber: nextNumber });
}
