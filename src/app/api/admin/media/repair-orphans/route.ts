import { NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/api-auth";
import { getTenantContext, missingTenantResponse } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import {
  checkAssetForOrphan,
  type MediaAssetOrphanRow,
  type OrphanCheckResult,
} from "@/lib/upload/orphan-media";

/**
 * GET  — audit orphan media_assets for this business (no deletes).
 * POST — repair: delete rows whose primary storage object is missing.
 *        Body: { apply?: boolean, ids?: string[] }
 *        Default apply=false (dry run). Never deletes a row whose file still exists.
 */
export async function GET() {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  const report = await scanOrphans(tenant.businessId);
  return NextResponse.json({ success: true, ...report });
}

export async function POST(request: Request) {
  const auth = await requireAdminApi();
  if (!auth.ok) return auth.response;

  const tenant = await getTenantContext();
  if (!tenant) return missingTenantResponse(auth.profile.role);

  let body: { apply?: boolean; ids?: string[] } = {};
  try {
    body = (await request.json()) as { apply?: boolean; ids?: string[] };
  } catch {
    body = {};
  }

  const apply = body.apply === true;
  const idFilter = Array.isArray(body.ids) ? new Set(body.ids.filter((id) => typeof id === "string")) : null;

  const report = await scanOrphans(tenant.businessId);
  const fileOrphans = report.orphans.filter((o) => o.file_missing);
  const targets = idFilter
    ? fileOrphans.filter((o) => idFilter.has(o.id))
    : fileOrphans;

  if (!apply) {
    return NextResponse.json({
      success: true,
      dry_run: true,
      would_remove: targets.length,
      targets,
      thumbnail_only_missing: report.thumbnail_only_missing,
      scanned: report.scanned,
    });
  }

  const db = await createTenantServiceClient(tenant.businessId);
  const removed: OrphanCheckResult[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const orphan of targets) {
    // Re-check immediately before delete — never remove a row whose object appeared.
    const { data: row } = await db
      .from("media_assets")
      .select(
        "id, business_id, project_id, file_name, file_path, storage_path, thumbnail_url, media_type, media_source, created_at, file_size"
      )
      .eq("id", orphan.id)
      .maybeSingle();

    if (!row) {
      skipped.push({ id: orphan.id, reason: "row already gone" });
      continue;
    }

    const recheck = await checkAssetForOrphan(db.raw, row as MediaAssetOrphanRow);
    if (!recheck?.file_missing) {
      skipped.push({
        id: orphan.id,
        reason: "object exists now — refused to delete",
      });
      continue;
    }

    const { error } = await db.from("media_assets").delete().eq("id", orphan.id);
    if (error) {
      skipped.push({ id: orphan.id, reason: error.message });
      continue;
    }
    removed.push(recheck);
  }

  return NextResponse.json({
    success: true,
    dry_run: false,
    removed_count: removed.length,
    removed,
    skipped,
    scanned: report.scanned,
  });
}

async function scanOrphans(businessId: string) {
  const db = await createTenantServiceClient(businessId);
  const { data: assets, error } = await db
    .from("media_assets")
    .select(
      "id, business_id, project_id, file_name, file_path, storage_path, thumbnail_url, media_type, media_source, created_at, file_size"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (assets ?? []) as MediaAssetOrphanRow[];
  const orphans: OrphanCheckResult[] = [];
  const CONCURRENCY = 10;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((row) => checkAssetForOrphan(db.raw, row)));
    for (const r of results) {
      if (r) orphans.push(r);
    }
  }

  const fileOrphans = orphans.filter((o) => o.file_missing);
  const thumbOnly = orphans.filter((o) => !o.file_missing && o.thumb_missing);

  // Group by project for the report
  const byProject = new Map<string, OrphanCheckResult[]>();
  for (const o of fileOrphans) {
    const key = o.project_id || "__unassigned__";
    if (!byProject.has(key)) byProject.set(key, []);
    byProject.get(key)!.push(o);
  }

  return {
    scanned: rows.length,
    file_object_missing: fileOrphans.length,
    thumbnail_only_missing: thumbOnly.length,
    orphans: fileOrphans,
    by_project: [...byProject.entries()].map(([project_id, files]) => ({
      project_id,
      orphan_count: files.length,
      files,
    })),
  };
}
