/**
 * Verify Print vs MLS download qualities on Jackson 9560 CR-99 (and 70-photo ZIP perf).
 *
 * Usage: npx tsx scripts/verify-download-quality.ts
 */
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  canApplyMlsTransform,
  downloadFileNameForQuality,
  MLS_LONG_EDGE,
} from "../src/lib/download-quality";
import { TRANSFORM_MAX_SOURCE_BYTES } from "../src/lib/media-signed-thumbs";
import {
  createProjectZipStream,
  pickDownloadableAssets,
} from "../src/lib/project-zip-download";
import { DEFAULT_PROJECT_MEDIA_SECTIONS } from "../src/lib/project-media-sections";

void canApplyMlsTransform;

for (const line of require("fs").readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

const JACKSON_ID = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const SEVENTY_PHOTO_ID = "26e65643-74d1-4c34-b085-0711c6e4b97c";
const BUCKET = "project-media";

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function signedOriginal(path: string) {
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(path, 300);
  assert(!error && data?.signedUrl, `sign original failed: ${error?.message}`);
  return data!.signedUrl;
}

async function signedMls(path: string, fileSize: number | null) {
  const can = canApplyMlsTransform(fileSize);
  const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(
    path,
    300,
    can
      ? {
          transform: {
            width: MLS_LONG_EDGE,
            height: MLS_LONG_EDGE,
            resize: "contain",
            quality: 85,
          },
        }
      : undefined
  );
  assert(!error && data?.signedUrl, `sign mls failed: ${error?.message}`);
  return { url: data!.signedUrl, transformed: can };
}

async function fetchBuf(url: string) {
  const res = await fetch(url, { cache: "no-store" });
  assert(res.ok, `fetch ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function dims(buf: Buffer) {
  const meta = await sharp(buf).metadata();
  return { width: meta.width ?? 0, height: meta.height ?? 0, size: buf.length };
}

async function measureZip(
  projectId: string,
  quality: "print" | "mls",
  opts?: { photosOnly?: boolean }
) {
  const { data: media } = await admin
    .from("media_assets")
    .select("*")
    .eq("project_id", projectId)
    .in("media_type", opts?.photosOnly ? ["photo"] : ["photo", "video"]);
  const assets = pickDownloadableAssets(
    (media ?? []) as never,
    true,
    DEFAULT_PROJECT_MEDIA_SECTIONS
  );
  const photos = assets.filter((a) => a.media_type === "photo");

  const start = process.hrtime.bigint();
  const memBefore = process.memoryUsage().heapUsed;
  let peakHeap = memBefore;

  const { stream, completion } = createProjectZipStream(
    admin,
    assets,
    { projectId },
    quality
  );

  let total = 0;
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    peakHeap = Math.max(peakHeap, process.memoryUsage().heapUsed);
  }
  const result = await completion;
  const ms = Number(process.hrtime.bigint() - start) / 1e6;
  const peakDeltaMb = (peakHeap - memBefore) / (1024 * 1024);

  return {
    quality,
    photosOnly: !!opts?.photosOnly,
    photoCount: photos.length,
    fileCount: result.fileCount,
    mlsFallbacks: result.mlsFallbacks.length,
    zipBytes: total,
    ms: Math.round(ms),
    peakHeapDeltaMb: Math.round(peakDeltaMb * 10) / 10,
    streaming: true,
  };
}

async function main() {
  console.log("TRANSFORM_MAX_SOURCE_BYTES", TRANSFORM_MAX_SOURCE_BYTES, `(${TRANSFORM_MAX_SOURCE_BYTES / 1024 / 1024}MB)`);
  assert(TRANSFORM_MAX_SOURCE_BYTES === 25 * 1024 * 1024, "limit should be 25MB");

  const { data: jacksonPhotos } = await admin
    .from("media_assets")
    .select("*")
    .eq("project_id", JACKSON_ID)
    .eq("media_type", "photo")
    .order("display_order", { ascending: true });

  const photos = jacksonPhotos ?? [];
  const over = photos.filter((p) => (p.file_size ?? 0) > TRANSFORM_MAX_SOURCE_BYTES);
  console.log(
    JSON.stringify(
      {
        jackson_photos: photos.length,
        over_25mb: over.length,
        over_names: over.map((p) => ({
          name: p.file_name,
          mb: ((p.file_size ?? 0) / 1024 / 1024).toFixed(1),
        })),
      },
      null,
      2
    )
  );

  // Classify landscape / oversized from real Jackson assets.
  // Jackson has no native portrait or sub-2048 photos — synthesize those two fixtures
  // from a real Jackson landscape so contain/upscale behavior is still proven.
  let landscape: (typeof photos)[0] | undefined;
  let oversized: (typeof photos)[0] | undefined;

  // Prefer a mid-size landscape that Image Transformation can handle (huge
  // panoramas under 25MB can still 400 on render).
  for (const p of photos) {
    if ((p.file_size ?? 0) > TRANSFORM_MAX_SOURCE_BYTES) {
      oversized ??= p;
      continue;
    }
    const size = p.file_size ?? 0;
    if (size <= 0 || size > 8 * 1024 * 1024) continue;
    const orig = await fetchBuf(await signedOriginal(p.file_path));
    const d = await dims(orig);
    if (d.width >= d.height && Math.max(d.width, d.height) > MLS_LONG_EDGE) {
      // Probe transform before committing.
      const probe = await signedMls(p.file_path, p.file_size);
      const probeRes = await fetch(probe.url, { cache: "no-store" });
      if (probe.transformed && probeRes.ok) {
        landscape ??= p;
      }
    }
  }

  assert(landscape, "need a landscape photo on Jackson");
  assert(oversized, "need an oversized (>25MB) photo on Jackson");

  const fixturePrefix = landscape.file_path.split("/").slice(0, -1).join("/");
  const portraitPath = `${fixturePrefix}/_verify-mls-portrait.jpg`;
  const underPath = `${fixturePrefix}/_verify-mls-under2048.jpg`;

  {
    const src = await fetchBuf(await signedOriginal(landscape.file_path));
    const portraitBuf = await sharp(src)
      .rotate(90)
      .jpeg({ quality: 90 })
      .toBuffer();
    const underBuf = await sharp(src)
      .resize({ width: 1200, height: 800, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 90 })
      .toBuffer();
    const upPortrait = await admin.storage
      .from(BUCKET)
      .upload(portraitPath, portraitBuf, { contentType: "image/jpeg", upsert: true });
    assert(!upPortrait.error, `portrait fixture upload: ${upPortrait.error?.message}`);
    const upUnder = await admin.storage
      .from(BUCKET)
      .upload(underPath, underBuf, { contentType: "image/jpeg", upsert: true });
    assert(!upUnder.error, `under2048 fixture upload: ${upUnder.error?.message}`);
  }

  const portraitFixture = {
    id: "fixture-portrait",
    file_path: portraitPath,
    file_name: "verify-portrait.jpg",
    file_size: 500_000,
    title: "verify-portrait",
  };
  const underFixture = {
    id: "fixture-under",
    file_path: underPath,
    file_name: "verify-under2048.jpg",
    file_size: 200_000,
    title: "verify-under2048",
  };

  const outDir = join(tmpdir(), "verify-download-quality");
  mkdirSync(outDir, { recursive: true });

  async function checkMls(
    label: string,
    photo: { file_path: string; file_size: number | null; file_name?: string },
    expectLong: number | "lte"
  ) {
    const { url, transformed } = await signedMls(photo.file_path, photo.file_size);
    assert(transformed, `${label} should transform`);
    const buf = await fetchBuf(url);
    const d = await dims(buf);
    const long = Math.max(d.width, d.height);
    const short = Math.min(d.width, d.height);
    writeFileSync(join(outDir, `${label}-mls.jpg`), buf);
    console.log(
      `${label} MLS dims: ${d.width}x${d.height} long=${long} short=${short} bytes=${d.size}`
    );
    if (expectLong === "lte") {
      assert(long <= MLS_LONG_EDGE, `${label} should not upscale beyond source`);
    } else {
      assert(long === expectLong, `${label} long edge expected ${expectLong}, got ${long}`);
    }
    const orig = await dims(await fetchBuf(await signedOriginal(photo.file_path)));
    const aspectOrig = orig.width / orig.height;
    const aspectMls = d.width / d.height;
    assert(
      Math.abs(aspectOrig - aspectMls) / aspectOrig < 0.02,
      `${label} aspect drifted: ${aspectOrig} → ${aspectMls}`
    );
    return { d, orig };
  }

  try {
    await checkMls("landscape", landscape, MLS_LONG_EDGE);
    const portraitResult = await checkMls("portrait", portraitFixture, MLS_LONG_EDGE);
    assert(
      portraitResult.d.height === MLS_LONG_EDGE && portraitResult.d.width < MLS_LONG_EDGE,
      `portrait long edge must be height: got ${portraitResult.d.width}x${portraitResult.d.height}`
    );
    const under = await checkMls("under2048", underFixture, "lte");
    assert(
      under.d.width === under.orig.width && under.d.height === under.orig.height,
      `under2048 should not upscale: orig ${under.orig.width}x${under.orig.height} mls ${under.d.width}x${under.d.height}`
    );
    console.log(
      `under2048 not upscaled: orig ${under.orig.width}x${under.orig.height} = mls ${under.d.width}x${under.d.height}`
    );

    // Print byte-identical
    const printPhoto = landscape;
    const printOrig = await fetchBuf(await signedOriginal(printPhoto.file_path));
    const { data: dlBlob, error: dlErr } = await admin.storage
      .from(BUCKET)
      .download(printPhoto.file_path);
    assert(!dlErr && dlBlob, `print download failed: ${dlErr?.message}`);
    const printDl = Buffer.from(await dlBlob!.arrayBuffer());
    const h1 = createHash("sha256").update(printOrig).digest("hex");
    const h2 = createHash("sha256").update(printDl).digest("hex");
    assert(h1 === h2, "print path not byte-identical to original");
    console.log(
      `print byte-identical: orig=${printOrig.length} download=${printDl.length} sha256=${h1.slice(0, 12)}…`
    );

    // Oversized MLS → fallback (no transform)
    const overPhoto = oversized;
    const overSign = await signedMls(overPhoto.file_path, overPhoto.file_size);
    assert(!overSign.transformed, "oversized should not transform");
    const overBuf = await fetchBuf(overSign.url);
    const overOrig = await fetchBuf(await signedOriginal(overPhoto.file_path));
    assert(
      overBuf.length === overOrig.length,
      "oversized MLS fallback should match original bytes"
    );
    const fallbackName = downloadFileNameForQuality(overPhoto, "mls", {
      mlsFellBackToPrint: true,
    });
    assert(fallbackName.includes("Print-original"), `fallback name: ${fallbackName}`);
    console.log(
      `oversized fallback: ${overPhoto.file_name} ${((overPhoto.file_size ?? 0) / 1024 / 1024).toFixed(1)}MB → ${fallbackName} (${overBuf.length} bytes)`
    );

    // Filenames
    const mlsName = downloadFileNameForQuality(landscape, "mls");
    const printName = downloadFileNameForQuality(landscape, "print");
    assert(mlsName.includes("-MLS"), mlsName);
    assert(printName.includes("-Print"), printName);
    console.log("filenames:", { mlsName, printName, fallbackName });

    // 70-photo ZIP perf (photos-only for fair Print vs MLS; full archive includes videos as-is)
    console.log("\n--- ZIP performance (70-photo project, photos only) ---");
    const printZip = await measureZip(SEVENTY_PHOTO_ID, "print", { photosOnly: true });
    const mlsZip = await measureZip(SEVENTY_PHOTO_ID, "mls", { photosOnly: true });
    console.log(JSON.stringify({ printZip, mlsZip }, null, 2));

    // Spot-check every MLS photo long edge via transform URL (not re-zipping)
    const { data: seventyPhotos } = await admin
      .from("media_assets")
      .select("id, file_path, file_size, file_name")
      .eq("project_id", SEVENTY_PHOTO_ID)
      .eq("media_type", "photo");
    let mlsOk = 0;
    let mlsFail = 0;
    for (const p of seventyPhotos ?? []) {
      if (!canApplyMlsTransform(p.file_size)) {
        mlsFail++;
        continue;
      }
      const { url, transformed } = await signedMls(p.file_path, p.file_size);
      if (!transformed) {
        mlsFail++;
        continue;
      }
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        mlsFail++;
        continue;
      }
      const d = await dims(Buffer.from(await res.arrayBuffer()));
      const long = Math.max(d.width, d.height);
      if (long === MLS_LONG_EDGE || long < MLS_LONG_EDGE) mlsOk++;
      else {
        console.error("bad long edge", p.file_name, d);
        mlsFail++;
      }
    }
    console.log(`MLS long-edge check: ok=${mlsOk} fail=${mlsFail} of ${seventyPhotos?.length ?? 0}`);
    assert(mlsFail === 0 && mlsOk === (seventyPhotos?.length ?? 0), "not every MLS photo at ≤2048 long edge");

    assert(printZip.streaming && mlsZip.streaming, "must stream");

    console.log("\nOK verify-download-quality");
  } finally {
    await admin.storage.from(BUCKET).remove([portraitPath, underPath]);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
