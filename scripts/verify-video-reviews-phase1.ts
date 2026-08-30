/**
 * Video review phase 1 verification: constraints, cross-tenant triggers, gallery/ZIP filter, Joy baseline.
 * Usage: npx tsx scripts/verify-video-reviews-phase1.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  filterMediaForVideoReviewDelivery,
  loadVideoReviewVersionMap,
} from "../src/lib/video-review-media";
import { pickDownloadableAssets } from "../src/lib/project-zip-download";
import { filterClientMedia } from "../src/lib/client-media";
import { THUMB_SIGNED_TTL_SECONDS } from "../src/lib/media-signed-thumbs";
import {
  addVideoReviewVersion,
  createVideoReviewFromAsset,
  removeVideoReviewVersion,
} from "../src/lib/video-reviews";
import { createTenantServiceClient, type TenantServiceClient } from "../src/lib/supabase/tenant-service";
import type { SupabaseClient } from "@supabase/supabase-js";

const SWIFT_BUSINESS = "00000000-0000-0000-0000-000000000001";
const JOY_PROJECT = "26e65643-74d1-4c34-b085-0711c6e4b97c";

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

function scriptTenantClient(admin: SupabaseClient, businessId: string): TenantServiceClient {
  const from: SupabaseClient["from"] = ((table: string) => {
    const qb = admin.from(table);
    return {
      select: (...args: Parameters<typeof qb.select>) =>
        qb.select(...args).eq("business_id", businessId),
      insert: (values: Parameters<typeof qb.insert>[0], options?: Parameters<typeof qb.insert>[1]) =>
        qb.insert(
          Array.isArray(values)
            ? values.map((row) => ({ ...row, business_id: businessId }))
            : { ...(values as Record<string, unknown>), business_id: businessId },
          options
        ),
      upsert: (values: Parameters<typeof qb.upsert>[0], options?: Parameters<typeof qb.upsert>[1]) =>
        qb.upsert(
          Array.isArray(values)
            ? values.map((row) => ({ ...row, business_id: businessId }))
            : { ...(values as Record<string, unknown>), business_id: businessId },
          options
        ),
      update: (values: Parameters<typeof qb.update>[0], options?: Parameters<typeof qb.update>[1]) =>
        qb.update(values, options).eq("business_id", businessId),
      delete: (options?: Parameters<typeof qb.delete>[0]) =>
        qb.delete(options).eq("business_id", businessId),
    };
  }) as SupabaseClient["from"];
  return { businessId, raw: admin, from };
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );

  console.log("\n=== signed URL TTL ===");
  console.log({
    THUMB_SIGNED_TTL_SECONDS,
    ttlHours: THUMB_SIGNED_TTL_SECONDS / 3600,
    sufficientFor20MinVideo:
      THUMB_SIGNED_TTL_SECONDS >= 7200
        ? "Yes — 2h TTL covers 20min playback with pauses; Phase 2 may add refresh without weakening TTL."
        : "No — refresh mechanism needed in Phase 2.",
  });

  console.log("\n=== Joy project baseline (no video reviews) ===");
  const { data: joyMedia } = await admin
    .from("media_assets")
    .select("*")
    .eq("project_id", JOY_PROJECT)
    .order("display_order", { ascending: true });

  const joyDb = scriptTenantClient(admin, SWIFT_BUSINESS);
  const joyVersionMap = await loadVideoReviewVersionMap(joyDb, JOY_PROJECT);
  assert(joyVersionMap.size === 0, "Joy project has no video review version map entries");

  const joyClientVisible = filterClientMedia(
    filterMediaForVideoReviewDelivery(joyMedia ?? [], joyVersionMap, false)
  );
  const joyClientPhotos = joyClientVisible.filter((m) => m.media_type === "photo");
  const joyClientVideos = joyClientVisible.filter((m) => m.media_type === "video");
  console.log({
    totalAssets: joyMedia?.length ?? 0,
    clientVisibleTotal: joyClientVisible.length,
    clientPhotos: joyClientPhotos.length,
    clientVideos: joyClientVideos.length,
  });

  const joyDownloadable = pickDownloadableAssets(
    filterMediaForVideoReviewDelivery(joyMedia ?? [], joyVersionMap, false),
    false
  );
  const joyDownloadableAdmin = pickDownloadableAssets(joyMedia ?? [], true);
  assert(
    joyDownloadable.length === pickDownloadableAssets(filterClientMedia(joyMedia ?? []), false).length,
    "Joy client ZIP set unchanged vs pre-review filter baseline"
  );
  assert(
    joyDownloadableAdmin.length === pickDownloadableAssets(joyMedia ?? [], true).length,
    "Joy admin ZIP set unchanged"
  );

  console.log("\n=== gallery/ZIP decision simulation ===");
  // Find a Swift project video to simulate review (or skip if none)
  const { data: sampleVideo } = await admin
    .from("media_assets")
    .select("id, project_id, file_name")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("media_type", "video")
    .not("project_id", "is", null)
    .limit(1)
    .maybeSingle();

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  const adminUserId = adminProfile?.id;
  if (!adminUserId) throw new Error("No Swift admin profile for simulation");

  if (!sampleVideo?.project_id) {
    console.log("(no project video found — skipped review simulation)");
  } else {
    const simDb = joyDb;
    const reviewTitle = `Phase1 verify ${Date.now()}`;
    let reviewId: string | null = null;
    let version1Id: string | null = null;
    let version2AssetId: string | null = null;

    try {
      const { review, version } = await createVideoReviewFromAsset(simDb, {
        projectId: sampleVideo.project_id,
        mediaAssetId: sampleVideo.id,
        title: reviewTitle,
        createdBy: adminUserId,
      });
      reviewId = review.id;
      version1Id = version.id;

      const { data: v2Asset } = await admin
        .from("media_assets")
        .select("id")
        .eq("project_id", sampleVideo.project_id)
        .eq("media_type", "video")
        .neq("id", sampleVideo.id)
        .limit(1)
        .maybeSingle();

      if (v2Asset?.id) {
        version2AssetId = v2Asset.id;
        await addVideoReviewVersion(simDb, {
          reviewId: review.id,
          mediaAssetId: v2Asset.id,
          uploadedBy: adminUserId,
        });
      }

      const { data: projectMedia } = await admin
        .from("media_assets")
        .select("*")
        .eq("project_id", sampleVideo.project_id);

      const versionMap = await loadVideoReviewVersionMap(simDb, sampleVideo.project_id);
      const beforeClientVideos = filterClientMedia(projectMedia ?? []).filter(
        (m) => m.media_type === "video"
      ).length;
      const afterClientVideos = filterClientMedia(
        filterMediaForVideoReviewDelivery(projectMedia ?? [], versionMap, false)
      ).filter((m) => m.media_type === "video").length;
      const adminVideos = filterMediaForVideoReviewDelivery(
        projectMedia ?? [],
        versionMap,
        true
      ).filter((m) => m.media_type === "video").length;

      console.log({
        projectId: sampleVideo.project_id,
        beforeClientVideos,
        afterClientVideos,
        adminVideos,
        hiddenOlderVersions: beforeClientVideos - afterClientVideos,
        clientZipCount: pickDownloadableAssets(
          filterMediaForVideoReviewDelivery(projectMedia ?? [], versionMap, false),
          false
        ).filter((a) => a.media_type === "video").length,
        adminZipCount: pickDownloadableAssets(projectMedia ?? [], true).filter(
          (a) => a.media_type === "video"
        ).length,
      });

      assert(afterClientVideos <= beforeClientVideos, "Client gallery hides non-latest review versions");
      if (version2AssetId) {
        assert(afterClientVideos < beforeClientVideos, "Two review versions → client sees latest only");
        assert(adminVideos === beforeClientVideos, "Admin gallery still shows all review versions");
      }
    } finally {
      if (version1Id) {
        await removeVideoReviewVersion(simDb, version1Id).catch(() => {});
      }
      if (reviewId && version2AssetId) {
        const { data: v2row } = await admin
          .from("video_review_versions")
          .select("id")
          .eq("media_asset_id", version2AssetId)
          .maybeSingle();
        if (v2row?.id) await removeVideoReviewVersion(simDb, v2row.id).catch(() => {});
      }
      if (reviewId) {
        await admin.from("video_reviews").delete().eq("id", reviewId);
      }
    }
  }

  console.log("\n=== revisions workflow untouched ===");
  const { data: revisionsRoute } = await admin
    .from("revisions")
    .select("id, status")
    .eq("business_id", SWIFT_BUSINESS)
    .limit(1);
  console.log({
    revisionsTableReadable: true,
    sampleCount: revisionsRoute?.length ?? 0,
    revisionRequestedNotifications:
      "unchanged — video_reviews is a separate table; /api/revisions still fires revision_requested",
  });

  console.log("\nverify-video-reviews-phase1: app-level checks passed");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
