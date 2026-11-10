import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import { buildVersionSummaries, loadEditableAsset } from "@/lib/photo-editor/server";

/** GET /api/media/editor/photos/:id/versions — original + saved edits, newest first (business only). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("view");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;
  const { asset, schemaMissing } = await loadEditableAsset(db, id);
  if (schemaMissing) return setupRequired();
  if (!asset || !(await canAccessMediaAsset(businessId, profile, asset.project_id))) return notFound();
  const versions = await buildVersionSummaries(db, asset);
  return NextResponse.json(
    { editStatus: asset.edit_status ?? "unedited", versions },
    { headers: { "Cache-Control": "private, no-store" } }
  );
}
