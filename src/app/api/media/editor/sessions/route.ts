import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canAccessMediaAsset } from "@/lib/staff-access";
import { editorRouteContext, notFound, setupRequired } from "@/lib/photo-editor/route-context";
import {
  EDITABLE_ASSET_COLUMNS,
  isPhotoEditorSchemaMissing,
  type EditableAssetRow,
} from "@/lib/photo-editor/server";
import {
  PHOTO_EDITOR_MAX_PHOTOS,
  isEditablePhotoAsset,
  safeReturnTo,
  type PhotoEditorScope,
} from "@/lib/photo-editor/shared";
import { UNFILED_FOLDER_SCOPE } from "@/lib/project-zip-assets";

const bodySchema = z.object({
  projectId: z.string().uuid().nullable().optional(),
  mediaIds: z.array(z.string().uuid()).max(1000).optional(),
  /** A folder id, or "unfiled" for General Photos. Requires projectId. */
  folderId: z.string().max(64).nullable().optional(),
  activeMediaId: z.string().uuid().nullable().optional(),
  returnTo: z.string().max(300).optional(),
});

/**
 * POST /api/media/editor/sessions — open photos in the editor.
 * Either `mediaIds` (single / selection, order preserved) or `folderId` (every photo in
 * that folder, in gallery order — folders are flat, so nothing nested is included).
 * Videos and unsupported files are skipped and counted so the UI can say so.
 */
export async function POST(request: Request) {
  const ctx = await editorRouteContext("view");
  if (!ctx.ok) return ctx.response;
  const { profile, businessId } = ctx;
  const db = await createTenantServiceClient(businessId);

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { projectId, mediaIds, folderId, activeMediaId } = parsed.data;

  let scope: PhotoEditorScope;
  let rows: EditableAssetRow[] = [];
  let folderRowId: string | null = null;
  let requested = 0;

  if (folderId) {
    if (!projectId) return NextResponse.json({ error: "Project is required." }, { status: 400 });
    if (!(await canAccessMediaAsset(businessId, profile, projectId))) return notFound("Folder not found");
    let q = db
      .from("media_assets")
      .select(EDITABLE_ASSET_COLUMNS)
      .eq("project_id", projectId)
      .eq("media_type", "photo");
    if (folderId === UNFILED_FOLDER_SCOPE) {
      scope = "unfiled";
      q = q.is("folder_id", null);
    } else {
      const { data: folder } = await db
        .from("media_folders")
        .select("id, project_id")
        .eq("id", folderId)
        .maybeSingle();
      if (!folder || folder.project_id !== projectId) return notFound("Folder not found");
      scope = "folder";
      folderRowId = folder.id as string;
      q = q.eq("folder_id", folder.id);
    }
    const { data, error } = await q
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(2000);
    if (error) return isPhotoEditorSchemaMissing(error) ? setupRequired() : NextResponse.json({ error: error.message }, { status: 500 });
    rows = (data ?? []) as EditableAssetRow[];
    requested = rows.length;
  } else {
    const ids = Array.from(new Set(mediaIds ?? []));
    if (!ids.length) return NextResponse.json({ error: "Choose at least one photo." }, { status: 400 });
    scope = ids.length === 1 ? "single" : "selection";
    requested = ids.length;
    const { data, error } = await db.from("media_assets").select(EDITABLE_ASSET_COLUMNS).in("id", ids);
    if (error) return isPhotoEditorSchemaMissing(error) ? setupRequired() : NextResponse.json({ error: error.message }, { status: 500 });
    const byId = new Map(((data ?? []) as EditableAssetRow[]).map((r) => [r.id, r]));
    rows = ids.map((id) => byId.get(id)).filter((r): r is EditableAssetRow => Boolean(r));
  }

  // Staff project scoping, per distinct project.
  const allowed = new Map<string, boolean>();
  const accessible: EditableAssetRow[] = [];
  for (const row of rows) {
    const key = row.project_id ?? "__none__";
    if (!allowed.has(key)) allowed.set(key, await canAccessMediaAsset(businessId, profile, row.project_id));
    if (allowed.get(key)) accessible.push(row);
  }

  const editable = accessible.filter(isEditablePhotoAsset);
  const skipped = requested - editable.length;
  if (!editable.length) {
    return NextResponse.json(
      {
        error:
          requested === 0
            ? "There are no photos here to edit yet."
            : "None of these files can be opened in the Photo Editor. JPEG, PNG and WebP photos are supported.",
      },
      { status: 422 }
    );
  }

  const trimmed = editable.slice(0, PHOTO_EDITOR_MAX_PHOTOS);
  const sessionProjectId = projectId ?? (new Set(trimmed.map((r) => r.project_id)).size === 1 ? trimmed[0].project_id : null);
  const fallbackReturn = sessionProjectId
    ? `/admin/projects/${sessionProjectId}${folderId ? `?folder=${encodeURIComponent(folderId)}` : ""}#photos`
    : "/admin/media";

  const { data: session, error: insertError } = await db
    .from("photo_edit_sessions")
    .insert({
      project_id: sessionProjectId,
      folder_id: folderRowId,
      scope,
      media_ids: trimmed.map((r) => r.id),
      active_media_id: activeMediaId && trimmed.some((r) => r.id === activeMediaId) ? activeMediaId : trimmed[0].id,
      return_to: safeReturnTo(parsed.data.returnTo, fallbackReturn),
      created_by: profile.id,
    })
    .select("id")
    .single();

  if (insertError || !session) {
    if (isPhotoEditorSchemaMissing(insertError)) return setupRequired();
    return NextResponse.json({ error: insertError?.message || "Could not open the editor." }, { status: 500 });
  }

  return NextResponse.json({
    id: session.id,
    count: trimmed.length,
    skipped,
    trimmed: editable.length - trimmed.length,
  });
}
