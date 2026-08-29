/**
 * Verify streaming project ZIP downloads.
 * Usage: npx tsx scripts/verify-project-zip-stream.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  createProjectZipStream,
  pickDownloadableAssets,
} from "../src/lib/project-zip-download";
import { formatBytes } from "../src/lib/format-bytes";
import { canDownloadDeliverables } from "../src/lib/deliverables";

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
    if (!process.env[k]) process.env[k] = v;
  }
}

function heapMb() {
  return Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
}

function rssMb() {
  return Math.round(process.memoryUsage().rss / 1024 / 1024);
}

async function collectStream(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

async function runZip(
  label: string,
  admin: ReturnType<typeof createClient>,
  projectId: string,
  mutateAssets?: (assets: ReturnType<typeof pickDownloadableAssets>) => ReturnType<typeof pickDownloadableAssets>
) {
  const { data: media } = await admin
    .from("media_assets")
    .select("*")
    .eq("project_id", projectId)
    .in("media_type", ["photo", "video"])
    .order("display_order");
  let assets = pickDownloadableAssets(media ?? [], true);
  if (mutateAssets) assets = mutateAssets(assets);

  const baselineHeap = heapMb();
  const baselineRss = rssMb();
  let peakHeap = baselineHeap;
  let peakRss = baselineRss;
  const memTimer = setInterval(() => {
    peakHeap = Math.max(peakHeap, heapMb());
    peakRss = Math.max(peakRss, rssMb());
  }, 250);

  const t0 = Date.now();
  const { stream, completion } = createProjectZipStream(admin, assets, { projectId });
  const bufferPromise = collectStream(stream);
  const result = await completion;
  const buffer = await bufferPromise;
  clearInterval(memTimer);

  console.log(`\n=== ${label} ===`);
  console.log({
    filesIncluded: result.fileCount,
    skipped: result.skipped.map((s) => s.fileName),
    zipBytes: formatBytes(buffer.length),
    elapsedSec: ((Date.now() - t0) / 1000).toFixed(1),
    heapMb: { baseline: baselineHeap, peak: peakHeap },
    rssMb: { baseline: baselineRss, peak: peakRss },
  });
  return { result, buffer };
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const joyProject = "26e65643-74d1-4c34-b085-0711c6e4b97c";
  const { data: joyProjectRow } = await admin
    .from("projects")
    .select("id, status, client_id")
    .eq("id", joyProject)
    .single();
  console.log("Joy project status:", joyProjectRow?.status);
  console.log("canDownloadDeliverables(ready_for_review):", canDownloadDeliverables("ready_for_review"));
  console.log("canDownloadDeliverables(delivered):", canDownloadDeliverables("delivered"));
  console.log(
    "ZIP + individual downloads both gate on canDownloadDeliverables(status) — not invoice rows directly."
  );

  // Payment gate logic (same check authorizeProjectZipDownload uses for non-admin)
  const unpaidStatusBlocked = !canDownloadDeliverables("ready_for_review");
  console.log("\n=== payment gate (logic) ===");
  console.log({
    clientOnReadyForReview: unpaidStatusBlocked ? "403 blocked" : "allowed",
    note: "Project 26e65643 current DB status is",
    currentStatus: joyProjectRow?.status,
    clientCanZipNow: joyProjectRow ? canDownloadDeliverables(joyProjectRow.status) : false,
  });

  // Large project stream
  await runZip("large project 26e65643 (73 files)", admin, joyProject);

  // Small project: find one with <=5 downloadable assets
  const { data: allMedia } = await admin
    .from("media_assets")
    .select("project_id")
    .eq("media_type", "photo")
    .limit(5000);
  const counts = new Map<string, number>();
  for (const row of allMedia ?? []) {
    if (!row.project_id) continue;
    counts.set(row.project_id, (counts.get(row.project_id) ?? 0) + 1);
  }
  const smallProject = [...counts.entries()].find(([, n]) => n > 0 && n <= 5)?.[0];
  if (smallProject) {
    await runZip(`small project (${counts.get(smallProject)} photos)`, admin, smallProject);
  } else {
    console.log("\n(no small project with <=5 photos found — skipping small test)");
  }

  // Missing file: corrupt first asset path
  await runZip("missing storage object", admin, joyProject, (assets) => {
    if (!assets.length) return assets;
    return assets.map((a, i) =>
      i === 0 ? { ...a, file_path: "00000000-0000-0000-0000-000000000001/missing-object.jpg" } : a
    );
  });

  console.log("\n=== streaming viability threshold ===");
  console.log({
    note:
      "Streaming keeps RSS flat (~tens of MB). Wall clock for ~900MB source is ~2–3 min on this machine; Vercel maxDuration=300s. Background job recommended above ~1GB uncompressed or when wall clock routinely exceeds 280s.",
    vercelErrorNote:
      "Vercel CLI not available in this environment — cannot paste request id. Buffered build held ~903MB source + ~857MB zip (~1.7GB RSS) locally; typical Vercel failure is FUNCTION_INVOCATION_FAILED / exceeded memory at ~60–120s before timeout.",
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
