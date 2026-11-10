import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { logMediaEvent } from "@/lib/media-library";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import { deliveryFieldsFor, loadEditableAsset, type VersionRow } from "@/lib/photo-editor/server";

const bodySchema = z.object({
  /** A version id, or "original". */
  versionId: z.union([z.literal("original"), z.string().uuid()]),
});

/**
 * POST /api/media/editor/photos/:id/restore — choose which version clients receive
 * ("Restore original" or an earlier edit). No files are deleted; it can be switched back.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("edit");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const { asset, schemaMissing } = await loadEditableAsset(db, id);
  if (schemaMissing) return setupRequired();
  if (!asset || !(await canAccessMediaAsset(businessId, profile, asset.project_id))) return notFound();

  let q = db.from("media_asset_versions").select("*").eq("media_asset_id", asset.id);
  q = parsed.data.versionId === "original" ? q.eq("kind", "original") : q.eq("id", parsed.data.versionId);
  const { data: version } = await q.maybeSingle();
  if (!version) {
    if (parsed.data.versionId === "original") {
      return NextResponse.json({ error: "This photo is already showing its original." }, { status: 409 });
    }
    return notFound("Version not found");
  }

  const { data: updated, error } = await db
    .from("media_assets")
    .update(deliveryFieldsFor(version as VersionRow, asset))
    .eq("id", asset.id)
    .select("*")
    .single();
  if (error || !updated) return NextResponse.json({ error: "Could not change the version." }, { status: 500 });

  const v = version as VersionRow;
  await logMediaEvent({
    businessId,
    mediaAssetId: asset.id,
    projectId: asset.project_id,
    userId: profile.id,
    eventType: v.kind === "original" ? "edit_reverted" : "edit_version_restored",
    description: v.kind === "original" ? "Restored the original photo" : `Restored edited version ${v.version_number}`,
    metadata: { versionId: v.id, versionNumber: v.version_number },
  });
  return NextResponse.json({ media: updated });
}
