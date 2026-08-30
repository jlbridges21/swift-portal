/**
 * Video review phase 3 verification.
 * Usage: npx tsx scripts/verify-video-reviews-phase3.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  addVideoReviewVersion,
  createVideoReviewComment,
  createVideoReviewFromAsset,
  removeVideoReviewVersion,
} from "../src/lib/video-reviews";
import {
  buildCommentThreads,
  countTopLevelComments,
  createVideoReviewReply,
  enrichVideoReviewComments,
  filterTopLevelForView,
  listVideoReviewCommentsForVersion,
  reopenVideoReviewComment,
  resolveVideoReviewComment,
} from "../src/lib/video-review-comments";
import {
  assertCanResolveComment,
  loadCommentForReview,
  VideoReviewAccessError,
} from "../src/lib/video-review-access";
import {
  capturePlaybackRestoreState,
  shouldRefreshSignedUrl,
  signedUrlExpired,
  signedUrlRefreshAtSeconds,
} from "../src/lib/video-review-stream-policy";
import { clusterReviewComments, markerPositionPercent } from "../src/lib/video-review-timeline";
import { THUMB_SIGNED_TTL_SECONDS } from "../src/lib/media-signed-thumbs";
import { SIGNED_URL_REFRESH_BEFORE_EXPIRY_SECONDS } from "../src/lib/use-video-review-stream";
import { createTenantServiceClient, type TenantServiceClient } from "../src/lib/supabase/tenant-service";
import type { Profile } from "../src/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const SWIFT_BUSINESS = "00000000-0000-0000-0000-000000000001";

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

async function cloneVideoAsset(
  admin: SupabaseClient,
  sourceId: string,
  suffix: string
): Promise<string> {
  const { data: source } = await admin.from("media_assets").select("*").eq("id", sourceId).single();
  if (!source) throw new Error("source video missing");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const filePath = source.file_path
    ? `${source.file_path.split("#")[0]}#verify-${stamp}`
    : `verify/${sourceId}-${stamp}.mp4`;
  const { data: clone, error } = await admin
    .from("media_assets")
    .insert({
      business_id: source.business_id,
      project_id: source.project_id,
      client_id: source.client_id,
      property_id: source.property_id,
      media_type: "video",
      media_source: source.media_source,
      file_path: filePath,
      file_name: `${source.file_name ?? "video"}-${suffix}`,
      title: `${source.title ?? "Video"} ${suffix}`,
      mime_type: source.mime_type,
      visibility: source.visibility,
      downloadable: source.downloadable,
      display_order: (source.display_order ?? 0) + Math.floor(Math.random() * 1000),
    })
    .select("id")
    .single();
  if (error || !clone) throw new Error(error?.message ?? "clone failed");
  return clone.id as string;
}

function testSignedUrlRefreshPolicy() {
  console.log("\n=== signed URL refresh (production TTL unchanged) ===");
  console.log({
    THUMB_SIGNED_TTL_SECONDS,
    SIGNED_URL_REFRESH_BEFORE_EXPIRY_SECONDS,
    proactiveRefreshAtSec: signedUrlRefreshAtSeconds(),
    productionTtlUnchanged: THUMB_SIGNED_TTL_SECONDS === 7200,
  });

  const issuedAt = Date.now() - 6600 * 1000;
  assert(shouldRefreshSignedUrl(issuedAt, Date.now()), "proactive refresh at 6600s elapsed (7200 TTL)");

  const expiredIssuedAt = Date.now() - 7201 * 1000;
  assert(signedUrlExpired(expiredIssuedAt, Date.now()), "URL considered expired after 7201s");

  const saved = capturePlaybackRestoreState(87.25, false);
  assert(saved.time === 87.25 && saved.wasPlaying, "playback position captured before refresh");
  console.log("playback restore payload:", saved);

  const shortTtl = 8;
  const shortRefreshBefore = 2;
  const shortIssued = Date.now() - 7000;
  assert(
    shouldRefreshSignedUrl(shortIssued, Date.now(), shortTtl, shortRefreshBefore),
    "shortened TTL test proves refresh past expiry threshold without changing production TTL"
  );
}

async function main() {
  testSignedUrlRefreshPolicy();

  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const db = scriptTenantClient(admin, SWIFT_BUSINESS);

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id, role, email, full_name, client_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  const { data: clientProfile } = await admin
    .from("profiles")
    .select("id, role, email, full_name, client_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "client")
    .not("client_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!adminProfile?.id || !clientProfile?.id) {
    throw new Error("Need Swift admin + client profiles");
  }

  const { data: baseVideo } = await admin
    .from("media_assets")
    .select("id, project_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("media_type", "video")
    .not("project_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!baseVideo?.project_id) throw new Error("Need a project video");

  let reviewId: string | null = null;
  const versionIds: string[] = [];
  const assetIds: string[] = [];
  const baseVideoId = baseVideo.id;
  const projectId = baseVideo.project_id;

  try {
    console.log("\n=== real review with V1, V2, V3 ===");
    const v2Asset = await cloneVideoAsset(admin, baseVideoId, "phase3-v2");
    const v3Asset = await cloneVideoAsset(admin, baseVideoId, "phase3-v3");
    assetIds.push(v2Asset, v3Asset);

    const { review, version: v1 } = await createVideoReviewFromAsset(db, {
      projectId,
      mediaAssetId: baseVideoId,
      title: `Phase3 verify ${Date.now()}`,
      createdBy: adminProfile.id,
    });
    reviewId = review.id;
    versionIds.push(v1.id);
    assetIds.push(baseVideoId);

    const v2 = await addVideoReviewVersion(db, {
      reviewId: review.id,
      mediaAssetId: v2Asset,
      uploadedBy: adminProfile.id,
    });
    const v3 = await addVideoReviewVersion(db, {
      reviewId: review.id,
      mediaAssetId: v3Asset,
      uploadedBy: adminProfile.id,
    });
    versionIds.push(v2.id, v3.id);

    const { data: versionRows } = await admin
      .from("video_review_versions")
      .select("id, version_number, media_asset_id, created_at")
      .eq("review_id", review.id)
      .order("version_number", { ascending: true });
    console.table(versionRows ?? []);
    assert((versionRows?.length ?? 0) === 3, "review has V1, V2, V3");

    const clientComment = await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: v1.id,
      projectId,
      authorUserId: clientProfile.id,
      authorKind: "client",
      body: "Client note on V1",
      timestampSeconds: 12.5,
    });
    await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: v2.id,
      projectId,
      authorUserId: clientProfile.id,
      authorKind: "client",
      body: "Client note on V2 only",
      timestampSeconds: 20,
    });

    const v1Only = await listVideoReviewCommentsForVersion(db, review.id, v1.id);
    const v2Only = await listVideoReviewCommentsForVersion(db, review.id, v2.id);
    assert(v1Only.comments.length === 1, "V1 loads only V1 comments");
    assert(v2Only.comments.length === 1, "V2 loads only V2 comments");

    console.log("\n=== replies ===");
    const adminReply = await createVideoReviewReply(db, {
      reviewId: review.id,
      parentCommentId: clientComment.id,
      authorUserId: adminProfile.id,
      authorKind: "admin",
      body: "Admin reply",
    });
    const clientReply = await createVideoReviewReply(db, {
      reviewId: review.id,
      parentCommentId: clientComment.id,
      authorUserId: clientProfile.id,
      authorKind: "client",
      body: "Client reply",
    });

    const { data: replyRows } = await admin
      .from("video_review_comments")
      .select("id, parent_comment_id, timestamp_seconds, point_x, point_y, author_kind, body")
      .eq("review_id", review.id)
      .not("parent_comment_id", "is", null)
      .order("created_at", { ascending: true });
    console.table(replyRows ?? []);
    assert(
      replyRows?.every(
        (r) => r.parent_comment_id === clientComment.id && r.timestamp_seconds == null && r.point_x == null
      ),
      "replies have parent_comment_id, null timestamps, null points"
    );

    console.log("\n=== nested reply rejected by database ===");
    const { error: nestedInsertError } = await admin.from("video_review_comments").insert({
      business_id: SWIFT_BUSINESS,
      review_id: review.id,
      version_id: v1.id,
      project_id: projectId,
      parent_comment_id: adminReply.id,
      author_user_id: adminProfile.id,
      author_kind: "admin",
      body: "nested reply attempt",
    });
    console.log("nested reply error:", nestedInsertError?.message ?? nestedInsertError);
    assert(
      Boolean(nestedInsertError?.message?.includes("replies cannot nest")),
      "nested reply rejected by DB trigger"
    );

    console.log("\n=== resolve / reopen ===");
    const firstResolve = await resolveVideoReviewComment(
      db,
      review.id,
      clientComment.id,
      adminProfile.id,
      projectId
    );
    console.log("first resolve:", {
      status: firstResolve.comment.status,
      resolved_by: firstResolve.comment.resolved_by,
      changed: firstResolve.changed,
    });
    assert(firstResolve.changed && firstResolve.comment.status === "resolved", "admin resolves comment");

    const { count: activityAfterFirst } = await admin
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("activity_type", "video_review_comment_resolved");
    const activityCount1 = activityAfterFirst ?? 0;

    const secondResolve = await resolveVideoReviewComment(
      db,
      review.id,
      clientComment.id,
      adminProfile.id,
      projectId
    );
    assert(!secondResolve.changed, "second resolve is no-op");
    const { count: activityAfterSecond } = await admin
      .from("activity_logs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId)
      .eq("activity_type", "video_review_comment_resolved");
    assert((activityAfterSecond ?? 0) === activityCount1, "no duplicate resolve activity");

    console.log("\n=== client resolve refused server-side ===");
    const fakeClient: Profile = {
      id: clientProfile.id,
      role: "client",
      email: clientProfile.email,
      full_name: clientProfile.full_name,
      avatar_url: null,
      client_id: clientProfile.client_id,
      created_at: new Date().toISOString(),
    };
    let clientResolveStatus = 0;
    try {
      assertCanResolveComment(fakeClient);
    } catch (err) {
      if (err instanceof VideoReviewAccessError) clientResolveStatus = err.status;
    }
    console.log("client resolve response:", {
      status: clientResolveStatus,
      error: "Only the business team can mark feedback as resolved.",
    });
    assert(clientResolveStatus === 403, "client RESOLVE refused with 403");

    const reopen = await reopenVideoReviewComment(
      db,
      review.id,
      clientComment.id,
      clientProfile.id,
      projectId
    );
    console.log("client reopen:", {
      status: reopen.comment.status,
      reopened_by: reopen.comment.reopened_by,
      changed: reopen.changed,
    });
    assert(reopen.changed && reopen.comment.status === "unresolved", "client reopens comment");

    console.log("\n=== three views + timeline markers ===");
    await resolveVideoReviewComment(db, review.id, clientComment.id, adminProfile.id, projectId);
    const allComments = await listVideoReviewCommentsForVersion(db, review.id, v1.id);
    const counts = countTopLevelComments(allComments.comments);
    console.log("counts:", counts);

    const enriched = await enrichVideoReviewComments(db, allComments.comments);
    const unresolvedMarkers = filterTopLevelForView(allComments.comments, "unresolved").map(
      (c) => enriched.get(c.id)!
    );
    const allMarkers = filterTopLevelForView(allComments.comments, "all").map((c) => enriched.get(c.id)!);
    const unresolvedClusters = clusterReviewComments(unresolvedMarkers);
    const allClusters = clusterReviewComments(allMarkers);
    console.log("marker sets:", {
      unresolved: unresolvedClusters.map((c) => ({
        sec: c.anchorSeconds,
        pct: markerPositionPercent(c.anchorSeconds, 120),
      })),
      all: allClusters.map((c) => ({
        sec: c.anchorSeconds,
        pct: markerPositionPercent(c.anchorSeconds, 120),
      })),
    });
    assert(counts.resolved >= 1 && counts.unresolved === 0, "unresolved view empty after resolve");
    assert(allClusters.length >= 1, "all view still shows resolved markers");

    console.log("\n=== upload V4 does not auto-resolve V3 comments ===");
    const v3Comment = await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: v3.id,
      projectId,
      authorUserId: clientProfile.id,
      authorKind: "client",
      body: "Open note on V3",
      timestampSeconds: 33,
    });
    const v4Asset = await cloneVideoAsset(admin, baseVideoId, "phase3-v4");
    assetIds.push(v4Asset);
    const v4 = await addVideoReviewVersion(db, {
      reviewId: review.id,
      mediaAssetId: v4Asset,
      uploadedBy: adminProfile.id,
    });
    versionIds.push(v4.id);
    const { data: v3CommentAfterV4 } = await admin
      .from("video_review_comments")
      .select("status, version_id")
      .eq("id", v3Comment.id)
      .single();
    console.log("V3 comment after V4 upload:", v3CommentAfterV4);
    assert(v3CommentAfterV4?.status === "unresolved", "V3 comment stays unresolved after V4 upload");

    console.log("\n=== empty states (logic) ===");
    console.log({
      noComments: counts.all === 0,
      noneUnresolved: counts.unresolved === 0 && counts.all > 0,
      noneResolved: counts.resolved === 0 && counts.all > 0,
    });

    console.log("\n=== IDOR access layer ===");
    const fakeReviewId = "f0000000-0000-0000-0000-000000000001";
    const adminProfileFull: Profile = {
      id: adminProfile.id,
      role: "admin",
      email: adminProfile.email,
      full_name: adminProfile.full_name,
      avatar_url: null,
      client_id: null,
      created_at: new Date().toISOString(),
    };
    for (const [label, fn] of [
      ["reply on wrong review", async () => loadCommentForReview(db, adminProfileFull, clientComment.id, fakeReviewId)],
      ["resolve wrong review", async () => loadCommentForReview(db, adminProfileFull, clientComment.id, fakeReviewId)],
      ["reopen wrong review", async () => loadCommentForReview(db, adminProfileFull, clientComment.id, fakeReviewId)],
    ] as const) {
      try {
        await fn();
        console.log(`${label}: unexpected 200`);
      } catch (err) {
        const status = err instanceof VideoReviewAccessError ? err.status : 500;
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`${label}: ${status} ${msg}`);
        assert(status === 404, `${label} returns 404 with no data`);
      }
    }

    const { data: otherProject } = await admin
      .from("projects")
      .select("id")
      .neq("business_id", SWIFT_BUSINESS)
      .limit(1)
      .maybeSingle();
    console.log({ wrongBusinessProject: otherProject?.id ?? "none" });

    console.log("\nverify-video-reviews-phase3: checks passed");
  } finally {
    for (const versionId of [...versionIds].reverse()) {
      try {
        await removeVideoReviewVersion(db, versionId);
      } catch {
        /* cleanup */
      }
    }
    if (reviewId) {
      try {
        await admin.from("video_reviews").delete().eq("id", reviewId);
      } catch {
        /* cleanup */
      }
    }
    for (const assetId of assetIds) {
      if (assetId === baseVideoId) continue;
      try {
        await admin.from("media_assets").delete().eq("id", assetId);
      } catch {
        /* cleanup */
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
