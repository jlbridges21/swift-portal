import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { FILE_SIZE_LIMITS } from "@/lib/brand";
import { buildStoragePath, buildThumbnailStoragePath } from "@/lib/media-upload";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import { PHOTO_BUCKET, loadEditableAsset } from "@/lib/photo-editor/server";

const bodySchema = z.object({
  mimeType: z.enum(["image/jpeg", "image/png"]),
  fileSize: z.number().int().positive(),
  thumbExt: z.enum(["webp", "jpg"]).optional(),
});

/**
 * POST /api/media/editor/photos/:id/save/sign — signed upload URLs for a finished edit.
 * The rendered file goes straight from the browser to Storage (no 4.5 MB function body limit);
 * nothing changes for clients until /save commits it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("edit");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (parsed.data.fileSize > FILE_SIZE_LIMITS.photo) {
    return NextResponse.json({ error: "The edited photo is larger than the photo size limit." }, { status: 413 });
  }

  const { asset, schemaMissing } = await loadEditableAsset(db, id);
  if (schemaMissing) return setupRequired();
  if (!asset || !(await canAccessMediaAsset(businessId, profile, asset.project_id))) return notFound();

  const ext = parsed.data.mimeType === "image/png" ? "png" : "jpg";
  const base = (asset.file_name || "photo").replace(/\.[^.]+$/, "") || "photo";
  const filePath = buildStoragePath({ businessId, projectId: asset.project_id, fileName: `${base}-edited.${ext}` });
  const thumbPath = buildThumbnailStoragePath(filePath, parsed.data.thumbExt ?? "webp");

  const [file, thumb] = await Promise.all([
    db.raw.storage.from(PHOTO_BUCKET).createSignedUploadUrl(filePath),
    db.raw.storage.from(PHOTO_BUCKET).createSignedUploadUrl(thumbPath),
  ]);
  if (file.error || !file.data) {
    return NextResponse.json({ error: "Could not prepare the upload. Please try again." }, { status: 500 });
  }
  return NextResponse.json({
    bucket: PHOTO_BUCKET,
    filePath,
    token: file.data.token,
    thumbPath: thumb.data ? thumbPath : null,
    thumbToken: thumb.data?.token ?? null,
  });
}
