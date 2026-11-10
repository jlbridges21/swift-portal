import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import { isPhotoEditorSchemaMissing, loadEditableAsset } from "@/lib/photo-editor/server";
import { PHOTO_EDITOR_MAX_SETTINGS_BYTES } from "@/lib/photo-editor/shared";

const bodySchema = z.object({ settings: z.record(z.string(), z.unknown()) });

/**
 * PUT /api/media/editor/photos/:id/draft — auto-save in-progress adjustments.
 * Only a small JSON recipe is stored; nothing is rendered and nothing a client can see changes.
 */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("edit");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;

  const text = await request.text();
  if (text.length > PHOTO_EDITOR_MAX_SETTINGS_BYTES) {
    return NextResponse.json({ error: "These adjustments are too large to save." }, { status: 413 });
  }
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* handled below */
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) return NextResponse.json({ error: "Invalid adjustments." }, { status: 400 });

  const { asset, schemaMissing } = await loadEditableAsset(db, id);
  if (schemaMissing) return setupRequired();
  if (!asset || !(await canAccessMediaAsset(businessId, profile, asset.project_id))) return notFound();

  const { data: existing, error: readError } = await db
    .from("media_edit_drafts")
    .select("revision")
    .eq("media_asset_id", asset.id)
    .maybeSingle();
  if (readError) {
    return isPhotoEditorSchemaMissing(readError) ? setupRequired() : NextResponse.json({ error: readError.message }, { status: 500 });
  }

  const now = new Date().toISOString();
  const revision = ((existing?.revision as number | undefined) ?? 0) + 1;
  const { error } = existing
    ? await db
        .from("media_edit_drafts")
        .update({ settings: parsed.data.settings, revision, updated_by: profile.id, updated_at: now })
        .eq("media_asset_id", asset.id)
    : await db.from("media_edit_drafts").insert({
        media_asset_id: asset.id,
        settings: parsed.data.settings,
        revision,
        updated_by: profile.id,
        updated_at: now,
      });
  if (error) return NextResponse.json({ error: "Could not save your progress." }, { status: 500 });
  return NextResponse.json({ revision, updatedAt: now });
}

/** DELETE — discard unsaved progress (back to the last version saved to the project). */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("edit");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;
  const { asset, schemaMissing } = await loadEditableAsset(db, id);
  if (schemaMissing) return setupRequired();
  if (!asset || !(await canAccessMediaAsset(businessId, profile, asset.project_id))) return notFound();
  await db.from("media_edit_drafts").delete().eq("media_asset_id", asset.id);
  return NextResponse.json({ ok: true });
}
