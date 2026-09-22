/**
 * Audit (default) or repair orphan media_assets across ALL businesses.
 *
 *   npx tsx scripts/audit-orphan-media-assets.ts
 *   npx tsx scripts/audit-orphan-media-assets.ts --repair --dry-run
 *   npx tsx scripts/audit-orphan-media-assets.ts --repair --apply
 *
 * --repair without --apply is a dry run. Only rows whose primary file object is
 * missing are deleted. Rows with a real file are never removed.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  checkAssetForOrphan,
  type MediaAssetOrphanRow,
  type OrphanCheckResult,
} from "../src/lib/upload/orphan-media";

function loadEnv() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
  }
}

loadEnv();

const args = new Set(process.argv.slice(2));
const doRepair = args.has("--repair");
const apply = args.has("--apply");
const dryRun = !apply;

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

async function main() {
  const { data: businesses } = await admin.from("businesses").select("id, name, slug");
  const bizName = new Map(
    (businesses ?? []).map((b) => [b.id as string, (b.name as string) || (b.slug as string) || (b.id as string)])
  );

  const { data: projects } = await admin
    .from("projects")
    .select("id, project_name, property_address, business_id, deleted_at");
  const projMeta = new Map(
    (projects ?? []).map((p) => [
      p.id as string,
      {
        name: (p.project_name as string) || (p.property_address as string) || (p.id as string),
        businessId: p.business_id as string,
        deleted: !!p.deleted_at,
      },
    ])
  );

  const { data: assets, error } = await admin
    .from("media_assets")
    .select(
      "id, business_id, project_id, file_name, file_path, storage_path, thumbnail_url, media_type, media_source, created_at, file_size"
    )
    .order("created_at", { ascending: false });

  if (error) throw error;

  const rows = (assets ?? []) as MediaAssetOrphanRow[];
  console.log(`Scanning ${rows.length} media_assets…`);

  const orphans: OrphanCheckResult[] = [];
  const CONCURRENCY = 12;

  for (let i = 0; i < rows.length; i += CONCURRENCY) {
    const batch = rows.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map((row) => checkAssetForOrphan(admin, row)));
    for (const r of results) {
      if (r) orphans.push(r);
    }
    const checked = Math.min(i + CONCURRENCY, rows.length);
    if (checked % 120 === 0 || checked === rows.length) {
      console.log(`  checked ${checked}/${rows.length} (orphans so far: ${orphans.length})`);
    }
  }

  const fileOrphans = orphans.filter((o) => o.file_missing);
  const thumbOnly = orphans.filter((o) => !o.file_missing && o.thumb_missing);

  type Group = {
    business: string;
    business_id: string;
    projects: Record<
      string,
      { project_name: string; deleted: boolean; count: number; files: OrphanCheckResult[] }
    >;
  };
  const byBiz = new Map<string, Group>();
  for (const o of fileOrphans) {
    let g = byBiz.get(o.business_id);
    if (!g) {
      g = {
        business: bizName.get(o.business_id) || o.business_id,
        business_id: o.business_id,
        projects: {},
      };
      byBiz.set(o.business_id, g);
    }
    const pk = o.project_id || "__unassigned__";
    if (!g.projects[pk]) {
      const pm = o.project_id ? projMeta.get(o.project_id) : null;
      g.projects[pk] = {
        project_name: pm?.name || "(unassigned library)",
        deleted: pm?.deleted ?? false,
        count: 0,
        files: [],
      };
    }
    g.projects[pk].count++;
    g.projects[pk].files.push(o);
  }

  const report = {
    scanned: rows.length,
    file_object_missing: fileOrphans.length,
    thumbnail_only_missing: thumbOnly.length,
    by_business: [...byBiz.values()].map((g) => ({
      business: g.business,
      business_id: g.business_id,
      orphan_count: Object.values(g.projects).reduce((n, p) => n + p.count, 0),
      projects: Object.entries(g.projects).map(([id, p]) => ({
        project_id: id,
        project_name: p.project_name,
        project_deleted: p.deleted,
        orphan_count: p.count,
        files: p.files.map((f) => ({
          id: f.id,
          file_name: f.file_name,
          media_type: f.media_type,
          created_at: f.created_at,
          file_size: f.file_size,
          file_path: f.file_path,
          thumb_missing: f.thumb_missing,
        })),
      })),
    })),
  };

  const outPath = resolve("tmp-orphan-media-audit.json");
  writeFileSync(outPath, JSON.stringify(report, null, 2));
  console.log("\n=== ORPHAN AUDIT SUMMARY ===");
  console.log(
    JSON.stringify(
      {
        scanned: report.scanned,
        file_object_missing: report.file_object_missing,
        thumbnail_only_missing: report.thumbnail_only_missing,
        businesses_affected: report.by_business.length,
        by_business: report.by_business.map((b) => ({
          business: b.business,
          orphan_count: b.orphan_count,
          projects: b.projects.map((p) => ({
            project_name: p.project_name,
            deleted: p.project_deleted,
            orphan_count: p.orphan_count,
            files: p.files.map((f) => `${f.file_name} (${f.media_type}, ${f.created_at})`),
          })),
        })),
      },
      null,
      2
    )
  );
  console.log(`\nFull report written to ${outPath}`);

  if (!doRepair) {
    console.log("\nTo repair: npx tsx scripts/audit-orphan-media-assets.ts --repair --dry-run");
    console.log("          npx tsx scripts/audit-orphan-media-assets.ts --repair --apply");
    return;
  }

  console.log(`\n=== REPAIR (${dryRun ? "DRY RUN" : "APPLY"}) ===`);
  const removed: OrphanCheckResult[] = [];
  const skipped: { id: string; reason: string }[] = [];

  for (const orphan of fileOrphans) {
    const { data: row } = await admin
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

    const recheck = await checkAssetForOrphan(admin, row as MediaAssetOrphanRow);
    if (!recheck?.file_missing) {
      skipped.push({ id: orphan.id, reason: "object exists now — refused to delete" });
      continue;
    }

    if (dryRun) {
      removed.push(recheck);
      continue;
    }

    const { error: delErr } = await admin.from("media_assets").delete().eq("id", orphan.id);
    if (delErr) {
      skipped.push({ id: orphan.id, reason: delErr.message });
      continue;
    }
    removed.push(recheck);
  }

  const repairReport = {
    mode: dryRun ? "dry_run" : "applied",
    removed_count: removed.length,
    removed: removed.map((r) => ({
      id: r.id,
      business: bizName.get(r.business_id) || r.business_id,
      project_id: r.project_id,
      project_name: r.project_id ? projMeta.get(r.project_id)?.name : null,
      file_name: r.file_name,
      file_path: r.file_path,
      created_at: r.created_at,
    })),
    skipped,
  };

  const repairPath = resolve("tmp-orphan-media-repair.json");
  writeFileSync(repairPath, JSON.stringify(repairReport, null, 2));
  console.log(JSON.stringify(repairReport, null, 2));
  console.log(`\nRepair report written to ${repairPath}`);
  if (dryRun) {
    console.log("Re-run with --repair --apply to delete the rows above.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
