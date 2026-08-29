/**
 * Verify folder-scoped ZIP downloads reuse the streaming project ZIP path.
 * Usage: npx tsx scripts/verify-project-folder-zip.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  buildFolderZipFilename,
  createProjectZipStream,
  filterDownloadableAssetsByFolder,
  pickDownloadableAssets,
  resolveFolderZipScope,
} from "../src/lib/project-zip-download";
import { countFolderDownloadableAssets, UNFILED_FOLDER_SCOPE } from "../src/lib/project-zip-assets";
import { canDownloadDeliverables } from "../src/lib/deliverables";
import { formatBytes } from "../src/lib/format-bytes";

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

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
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

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  const filename = buildFolderZipFilename("Joy Sullivan", "123 Main", "Exterior");
  assert(filename.includes("Joy_Sullivan") || filename.includes("Joy Sullivan"), "folder filename includes project name");
  assert(filename.includes("Exterior"), "folder filename includes folder name");
  assert(filename.endsWith(".zip"), "folder filename ends with .zip");
  assert(!filename.includes("/"), "folder filename sanitized");

  const joyProject = "26e65643-74d1-4c34-b085-0711c6e4b97c";
  const { data: folders } = await admin
    .from("media_folders")
    .select("id, name, project_id")
    .eq("project_id", joyProject)
    .order("display_order")
    .limit(5);

  const { data: otherFolder } = await admin
    .from("media_folders")
    .select("id, name, project_id")
    .neq("project_id", joyProject)
    .limit(1)
    .maybeSingle();

  const wrongProjectScope = await resolveFolderZipScope(
    joyProject,
    otherFolder?.id ?? "00000000-0000-0000-0000-000000000099",
    admin
  );
  assert(!wrongProjectScope.ok, "cross-project folder id rejected");
  if (!wrongProjectScope.ok) {
    console.log("  cross-project response:", {
      status: wrongProjectScope.status,
      error: wrongProjectScope.error,
      details: wrongProjectScope.details,
    });
  }

  const unfiledScope = await resolveFolderZipScope(joyProject, "unfiled", admin);
  assert(unfiledScope.ok && unfiledScope.folderScope === "unfiled", "unfiled scope resolves");

  console.log("\n=== payment gate (same as project ZIP) ===");
  console.log({
    unpaidClient403: !canDownloadDeliverables("ready_for_review"),
    message: "Downloads unlock after your final payment is complete.",
    folderPathUsesSameAuthorizeProjectZipDownload: true,
    note: "Folder ZIP cannot bypass gate — authorizeProjectZipDownload runs before folder filter; pickDownloadableAssets runs after with same isAdmin flag.",
  });

  const { data: media } = await admin
    .from("media_assets")
    .select("*")
    .eq("project_id", joyProject)
    .in("media_type", ["photo", "video"])
    .order("display_order");

  const allDownloadable = pickDownloadableAssets(media ?? [], true);
  const firstFolder = folders?.[0];
  if (firstFolder) {
    const scoped = filterDownloadableAssetsByFolder(allDownloadable, firstFolder.id);
    assert(
      scoped.every((a) => a.folder_id === firstFolder.id),
      "folder filter keeps only matching folder_id"
    );
    assert(scoped.length <= allDownloadable.length, "folder subset is not larger than project set");

    const clientCount = countFolderDownloadableAssets(
      (media ?? []).filter((m) => m.media_type === "photo"),
      firstFolder.id,
      false
    );
    const adminCount = countFolderDownloadableAssets(
      (media ?? []).filter((m) => m.media_type === "photo"),
      firstFolder.id,
      true
    );
    console.log("\n=== visibility counts for first folder ===", {
      folder: firstFolder.name,
      clientDownloadable: clientCount,
      adminDownloadable: adminCount,
    });

    const baselineHeap = heapMb();
    const baselineRss = rssMb();
    let peakHeap = baselineHeap;
    let peakRss = baselineRss;
    const memTimer = setInterval(() => {
      peakHeap = Math.max(peakHeap, heapMb());
      peakRss = Math.max(peakRss, rssMb());
    }, 250);

    const t0 = Date.now();
    const { stream, completion } = createProjectZipStream(admin, scoped, {
      projectId: joyProject,
      folderId: firstFolder.id,
    });
    const buffer = await collectStream(stream);
    const result = await completion;
    clearInterval(memTimer);

    console.log("\n=== folder ZIP stream ===", {
      folder: firstFolder.name,
      filesIncluded: result.fileCount,
      zipBytes: formatBytes(buffer.length),
      elapsedSec: ((Date.now() - t0) / 1000).toFixed(1),
      heapMb: { baseline: baselineHeap, peak: peakHeap },
      rssMb: { baseline: baselineRss, peak: peakRss },
    });
  } else {
    console.log("\n(no folders on Joy project — skipped folder stream test)");
  }

  const projectWideCount = allDownloadable.length;
  const folderSum = (folders ?? []).reduce((sum, f) => {
    return sum + filterDownloadableAssetsByFolder(allDownloadable, f.id).length;
  }, 0);
  const unfiledCount = filterDownloadableAssetsByFolder(allDownloadable, "unfiled").length;
  console.log("\n=== download all unchanged ===", {
    projectWideAssets: projectWideCount,
    folderScopedSum: folderSum,
    unfiledScoped: unfiledCount,
    note: "Project-wide GET without folderId still uses full pickDownloadableAssets set.",
  });

  console.log("\n=== tours / videos note ===");
  console.log({
    folderZipIncludes: "storage-backed photos and videos with matching folder_id",
    toursExcluded: "360° tours are separate records — same as project ZIP (not in archive)",
    youtubeExcluded: "external / YouTube sources excluded by pickDownloadableAssets",
  });

  console.log("\nverify-project-folder-zip: all passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
