import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { recordEgress } from "@/lib/egress-metering";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import { PHOTO_BUCKET, editorSourceFor, getVersions, loadEditableAsset } from "@/lib/photo-editor/server";

const SOURCE_URL_TTL_SECONDS = 60 * 30;

/**
 * GET /api/media/editor/photos/:id/source — short-lived signed URL for the ORIGINAL file
 * (the editor re-applies adjustments to it; it never stacks edits on an edited JPEG).
 * The browser fetches it straight from Storage; the bytes are metered as signed delivery.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("view");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;

  const { asset, schemaMissing } = await loadEditableAsset(db, id);
  if (schemaMissing) return setupRequired();
  if (!asset || !(await canAccessMediaAsset(businessId, profile, asset.project_id))) return notFound();

  const source = editorSourceFor(asset, await getVersions(db, [asset.id]));
  const { data, error } = await db.raw.storage.from(PHOTO_BUCKET).createSignedUrl(source.filePath, SOURCE_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    return NextResponse.json({ error: "This photo's file could not be found." }, { status: 404 });
  }
  recordEgress(businessId, "signed_delivery", source.fileSize ?? 0);
  return NextResponse.json(
    { url: data.signedUrl, mimeType: source.mimeType, fileSize: source.fileSize },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
