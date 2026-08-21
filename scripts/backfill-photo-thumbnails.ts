/**
 * One-shot backfill: generate stored photo grid thumbnails for existing assets.
 *
 * Why a script (not lazy-on-request):
 *   - Swift has ~180–204 photos; a single operator run is feasible.
 *   - Lazy generation would make the first grid paint still download 10–25MB originals
 *     for every tile until each finishes — the exact pain we are fixing.
 *   - Supabase Image Transformations fail above 25MB, so on-the-fly transform cannot
 *     cover drone originals.
 *
 * Usage:
 *   npx tsx scripts/backfill-photo-thumbnails.ts
 *   npx tsx scripts/backfill-photo-thumbnails.ts --business-id=<uuid>
 *   npx tsx scripts/backfill-photo-thumbnails.ts --limit=20 --dry-run
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { buildThumbnailStoragePath } from "../src/lib/media-upload";

const LONG_EDGE = 400;
const WEBP_QUALITY = 72;
const BUCKET = "project-media";

function loadEnv() {
  const env: Record<string, string> = {};
  try {
    for (const line of readFileSync(join(process.cwd(), ".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* ignore */
  }
  return env;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function main() {
  const env = { ...loadEnv(), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const businessId = arg("business-id");
  const limit = Number(arg("limit") ?? "0") || 0;
  const dryRun = hasFlag("dry-run");

  const sb = createClient(url, key, { auth: { persistSession: false } });

  let query = sb
    .from("media_assets")
    .select("id, business_id, file_path, file_name, file_size, thumbnail_url, media_type")
    .eq("media_type", "photo")
    .is("thumbnail_url", null)
    .not("file_path", "is", null)
    .order("created_at", { ascending: true });

  if (businessId) query = query.eq("business_id", businessId);
  if (limit > 0) query = query.limit(limit);

  const { data: assets, error } = await query;
  if (error) {
    console.error("Query failed:", error.message);
    process.exit(1);
  }

  console.log(
    `Backfill photo thumbnails: ${assets?.length ?? 0} candidates` +
      (businessId ? ` (business ${businessId})` : "") +
      (dryRun ? " [dry-run]" : "")
  );

  let ok = 0;
  let fail = 0;

  for (const asset of assets ?? []) {
    if (!asset.file_path || !asset.business_id) {
      fail++;
      continue;
    }

    const thumbPath = buildThumbnailStoragePath(asset.file_path, "webp");
    console.log(
      `→ ${asset.id} ${((asset.file_size ?? 0) / 1e6).toFixed(2)}MB → ${thumbPath}`
    );

    if (dryRun) {
      ok++;
      continue;
    }

    try {
      const { data: blob, error: dlErr } = await sb.storage.from(BUCKET).download(asset.file_path);
      if (dlErr || !blob) throw new Error(dlErr?.message ?? "download failed");

      const input = Buffer.from(await blob.arrayBuffer());
      const out = await sharp(input, { failOn: "none" })
        .rotate()
        .resize({
          width: LONG_EDGE,
          height: LONG_EDGE,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY })
        .toBuffer();

      const { error: upErr } = await sb.storage.from(BUCKET).upload(thumbPath, out, {
        contentType: "image/webp",
        upsert: true,
        cacheControl: "86400",
      });
      if (upErr) throw new Error(upErr.message);

      const { error: dbErr } = await sb
        .from("media_assets")
        .update({ thumbnail_url: thumbPath })
        .eq("id", asset.id)
        .eq("business_id", asset.business_id);
      if (dbErr) throw new Error(dbErr.message);

      console.log(`  ok ${out.length} bytes`);
      ok++;
    } catch (e) {
      console.error(`  FAIL`, e instanceof Error ? e.message : e);
      fail++;
    }
  }

  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
