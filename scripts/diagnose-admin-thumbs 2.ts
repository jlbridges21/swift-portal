/**
 * Diagnose admin thumbnail signing for a project (no auth — service role).
 * Usage: npx tsx scripts/diagnose-admin-thumbs.ts [projectId]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  signMediaThumbnailUrl,
  TRANSFORM_MAX_SOURCE_BYTES,
  type ThumbSignAsset,
} from "../src/lib/media-signed-thumbs";

function loadEnvLocal() {
  for (const line of readFileSync(resolve(".env.local"), "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq < 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    if (!(k in process.env)) process.env[k] = v;
  }
}

const PROJECT =
  process.argv[2] || "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";

async function main() {
  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env");

  const sb = createClient(url, key, { auth: { persistSession: false } });

  const { data: rows, error } = await sb
    .from("media_assets")
    .select(
      "id, file_path, thumbnail_url, file_size, media_type, media_source, mime_type, file_name, business_id, project_id"
    )
    .eq("project_id", PROJECT)
    .eq("media_type", "photo")
    .order("display_order");

  if (error) throw error;
  console.log(`Project ${PROJECT}: ${rows?.length ?? 0} photos`);
  console.log(`TRANSFORM_MAX_SOURCE_BYTES = ${TRANSFORM_MAX_SOURCE_BYTES}`);

  let ok = 0;
  let nullUrl = 0;

  for (const a of rows ?? []) {
    const signed = await signMediaThumbnailUrl(
      sb,
      "project-media",
      a as ThumbSignAsset
    );

    const thumbDirect = a.thumbnail_url
      ? await sb.storage.from("project-media").createSignedUrl(a.thumbnail_url, 60)
      : null;
    const fileDirect = a.file_path
      ? await sb.storage.from("project-media").createSignedUrl(a.file_path, 60)
      : null;

    const entry = {
      id: a.id,
      file_name: a.file_name,
      mb: Number(((a.file_size ?? 0) / 1024 / 1024).toFixed(2)),
      over25: (a.file_size ?? 0) > TRANSFORM_MAX_SOURCE_BYTES,
      thumbnail_url: a.thumbnail_url,
      file_path: a.file_path,
      resolveThumbUrl: signed ? "URL" : null,
      thumbSignError: thumbDirect?.error?.message ?? null,
      fileSignError: fileDirect?.error?.message ?? null,
      thumbSignedOk: Boolean(thumbDirect?.data?.signedUrl),
      fileSignedOk: Boolean(fileDirect?.data?.signedUrl),
    };
    if (signed) ok++;
    else nullUrl++;
    console.log(JSON.stringify(entry));
  }

  console.log(JSON.stringify({ ok, nullUrl, total: rows?.length ?? 0 }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
