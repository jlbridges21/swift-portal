import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import {
  EDITABLE_ASSET_COLUMNS,
  buildEditorPhotos,
  isPhotoEditorSchemaMissing,
  type EditableAssetRow,
} from "@/lib/photo-editor/server";
import { isEditablePhotoAsset, safeReturnTo, type PhotoEditorSessionPayload } from "@/lib/photo-editor/shared";
import { UNFILED_FOLDER_LABEL } from "@/lib/project-zip-assets";

type SessionRow = {
  id: string;
  project_id: string | null;
  folder_id: string | null;
  scope: PhotoEditorSessionPayload["scope"];
  media_ids: string[];
  active_media_id: string | null;
  return_to: string | null;
};

/** GET /api/media/editor/sessions/:id — photos (in session order) with drafts and status. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("view");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return notFound("Editing session not found");

  const { data, error } = await db
    .from("photo_edit_sessions")
    .select("id, project_id, folder_id, scope, media_ids, active_media_id, return_to")
    .eq("id", id)
    .maybeSingle();
  if (error) return isPhotoEditorSchemaMissing(error) ? setupRequired() : NextResponse.json({ error: error.message }, { status: 500 });
  const session = data as SessionRow | null;
  if (!session) return notFound("Editing session not found");
  if (session.project_id && !(await canAccessMediaAsset(businessId, profile, session.project_id))) {
    return notFound("Editing session not found");
  }

  const { data: assetRows } = await db.from("media_assets").select(EDITABLE_ASSET_COLUMNS).in("id", session.media_ids);
  const byId = new Map(((assetRows ?? []) as EditableAssetRow[]).map((r) => [r.id, r]));
  const ordered: EditableAssetRow[] = [];
  const allowed = new Map<string, boolean>();
  for (const mediaId of session.media_ids) {
    const row = byId.get(mediaId);
    if (!row || !isEditablePhotoAsset(row)) continue;
    const key = row.project_id ?? "__none__";
    if (!allowed.has(key)) allowed.set(key, await canAccessMediaAsset(businessId, profile, row.project_id));
    if (allowed.get(key)) ordered.push(row);
  }

  const [photos, projectRes, folderRes] = await Promise.all([
    buildEditorPhotos(db, ordered),
    session.project_id
      ? db.from("projects").select("project_name").eq("id", session.project_id).maybeSingle()
      : Promise.resolve({ data: null }),
    session.folder_id
      ? db.from("media_folders").select("name").eq("id", session.folder_id).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const fallbackReturn = session.project_id ? `/admin/projects/${session.project_id}#photos` : "/admin/media";
  const payload: PhotoEditorSessionPayload = {
    id: session.id,
    projectId: session.project_id,
    projectName: (projectRes.data as { project_name?: string } | null)?.project_name ?? null,
    folderId: session.folder_id,
    folderName:
      (folderRes.data as { name?: string } | null)?.name ?? (session.scope === "unfiled" ? UNFILED_FOLDER_LABEL : null),
    scope: session.scope,
    activeMediaId: session.active_media_id,
    returnTo: safeReturnTo(session.return_to, fallbackReturn),
    photos,
    missingCount: session.media_ids.length - photos.length,
  };
  return NextResponse.json(payload, { headers: { "Cache-Control": "private, no-store" } });
}

/** PATCH — remember which photo was open, so reopening the session resumes there. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await editorRouteContext("view");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);
  const { id } = await params;
  const parsed = z.object({ activeMediaId: z.string().uuid() }).safeParse(await request.json().catch(() => null));
  if (!parsed.success || !z.string().uuid().safeParse(id).success) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const { data: session } = await db
    .from("photo_edit_sessions")
    .select("id, project_id, media_ids")
    .eq("id", id)
    .maybeSingle();
  if (!session) return notFound("Editing session not found");
  if (session.project_id && !(await canAccessMediaAsset(businessId, profile, session.project_id as string))) {
    return notFound("Editing session not found");
  }
  if (!(session.media_ids as string[]).includes(parsed.data.activeMediaId)) {
    return NextResponse.json({ error: "Photo is not in this session." }, { status: 400 });
  }
  await db
    .from("photo_edit_sessions")
    .update({ active_media_id: parsed.data.activeMediaId, updated_at: new Date().toISOString() })
    .eq("id", id);
  return NextResponse.json({ ok: true });
}
