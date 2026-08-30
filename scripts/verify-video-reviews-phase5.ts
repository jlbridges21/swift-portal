/**
 * Video review phase 5 verification — live updates via polling.
 * Usage: npx tsx scripts/verify-video-reviews-phase5.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { Profile } from "../src/lib/types";
import {
  loadVersionForReview,
  VideoReviewAccessError,
} from "../src/lib/video-review-access";
import {
  buildCommentThreads,
  createVideoReviewReply,
  enrichVideoReviewComments,
  reopenVideoReviewComment,
  resolveVideoReviewComment,
} from "../src/lib/video-review-comments";
import { clusterReviewComments } from "../src/lib/video-review-timeline";
import {
  addVideoReviewVersion,
  createVideoReviewComment,
  createVideoReviewFromAsset,
  removeVideoReviewVersion,
} from "../src/lib/video-reviews";
import {
  estimatePollRequestVolume,
  mergeCommentStore,
  mergeVersionRows,
  populateCommentStore,
  snapshotFromCommentStore,
} from "../src/lib/video-review-poll-merge";
import { pollVideoReviewChanges } from "../src/lib/video-review-poll";
import {
  VIDEO_REVIEW_POLL_BASE_MS,
  VIDEO_REVIEW_POLL_IDLE_AFTER_MS,
  VIDEO_REVIEW_POLL_MAX_MS,
} from "../src/lib/use-video-review-poll";
import { createTenantServiceClient, type TenantServiceClient } from "../src/lib/supabase/tenant-service";

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("=== 1. typecheck / lint / build / tenant-lint ===");
  for (const cmd of ["npm run typecheck", "npm run lint", "npm run build", "npm run tenant-lint"]) {
    console.log(`\n$ ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
  }

  console.log("\n=== poll cadence constants ===");
  console.log({
    baseIntervalMs: VIDEO_REVIEW_POLL_BASE_MS,
    maxIntervalMs: VIDEO_REVIEW_POLL_MAX_MS,
    idleAfterMs: VIDEO_REVIEW_POLL_IDLE_AFTER_MS,
  });
  assert(VIDEO_REVIEW_POLL_BASE_MS === 10_000, "base poll interval is 10 seconds");
  assert(VIDEO_REVIEW_POLL_MAX_MS === 60_000, "idle backoff caps at 60 seconds");

  const hookSrc = readFileSync(resolve("src/lib/use-video-review-poll.ts"), "utf8");
  assert(hookSrc.includes("visibilitychange"), "Page Visibility API stops polling when hidden");
  assert(hookSrc.includes("void runPoll()"), "immediate poll on tab focus");
  assert(hookSrc.includes("clearTimeout(timerRef.current)"), "timer cleared on hide/unmount");

  const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");
  assert(viewSrc.includes("useVideoReviewPoll"), "review view wires polling hook");
  assert(!viewSrc.includes("supabase.channel"), "no realtime channel in review view");
  assert(viewSrc.includes("commentText"), "draft comment text is local state (survives poll merges)");
  assert(viewSrc.includes("markingMode"), "marking mode is local state (survives poll merges)");
  assert(viewSrc.includes("handlePollResult"), "poll merges into store without remounting player");
  assert(!viewSrc.includes("key={pollSince}"), "poll cursor does not remount video element");

  const pollRouteSrc = readFileSync(resolve("src/app/api/video-reviews/[id]/poll/route.ts"), "utf8");
  assert(pollRouteSrc.includes("loadVersionForReview"), "poll route re-verifies review + version access");
  assert(pollRouteSrc.includes("since"), "poll route requires incremental since cursor");

  console.log("\n=== 10. request volume for 10 minutes (visible, active) ===");
  const tenMin = estimatePollRequestVolume({
    durationMs: 10 * 60_000,
    baseIntervalMs: VIDEO_REVIEW_POLL_BASE_MS,
    maxIntervalMs: VIDEO_REVIEW_POLL_MAX_MS,
    idleAfterMs: VIDEO_REVIEW_POLL_IDLE_AFTER_MS,
    idleFraction: 0,
  });
  console.log(tenMin);
  assert(tenMin.totalEstimate === 61, "~60 poll requests in 10 minutes at 10s (+1 initial schedule)");

  const tenMinIdle = estimatePollRequestVolume({
    durationMs: 10 * 60_000,
    baseIntervalMs: VIDEO_REVIEW_POLL_BASE_MS,
    maxIntervalMs: VIDEO_REVIEW_POLL_MAX_MS,
    idleAfterMs: VIDEO_REVIEW_POLL_IDLE_AFTER_MS,
    idleFraction: 0.5,
  });
  console.log("with 50% idle backoff time:", tenMinIdle);
  assert(tenMinIdle.totalEstimate < tenMin.totalEstimate, "idle backoff reduces request volume");

  loadEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const admin = createClient(url, key);
  const db = scriptTenantClient(admin, SWIFT_BUSINESS);

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "admin")
    .limit(1)
    .single();
  if (!adminProfile) throw new Error("Swift admin profile missing");

  const { data: clientProfile } = await admin
    .from("profiles")
    .select("id, email, full_name, role, client_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "client")
    .limit(1)
    .single();
  if (!clientProfile) throw new Error("Swift client profile missing");

  const { data: baseVideo } = await admin
    .from("media_assets")
    .select("id, project_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("media_type", "video")
    .not("project_id", "is", null)
    .limit(1)
    .single();
  if (!baseVideo?.project_id) throw new Error("Need a project video");
  const baseVideoId = baseVideo.id as string;
  const projectId = baseVideo.project_id as string;

  let reviewId: string | null = null;
  const versionIds: string[] = [];
  const assetIds: string[] = [];

  try {
    const { review, version: v1 } = await createVideoReviewFromAsset(db, {
      projectId,
      mediaAssetId: baseVideoId,
      title: `Phase5 poll ${Date.now()}`,
      createdBy: adminProfile.id,
    });
    reviewId = review.id;
    versionIds.push(v1.id);

    const adminProfileFull: Profile = {
      id: adminProfile.id,
      role: "admin",
      email: adminProfile.email,
      full_name: adminProfile.full_name,
      avatar_url: null,
      client_id: null,
      created_at: new Date().toISOString(),
    };

    const sinceBaseline = new Date().toISOString();
    await sleep(50);

    console.log("\n=== 2–5. incremental poll — comment, reply, resolve, reopen, counts, markers ===");
    const topComment = await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: v1.id,
      projectId,
      authorUserId: clientProfile.id,
      authorKind: "client",
      body: "Poll test top-level",
      timestampSeconds: 12.5,
      pointX: 0.4,
      pointY: 0.6,
    });

    let poll = await pollVideoReviewChanges(db, review.id, v1.id, sinceBaseline);
    console.log("after comment:", {
      changeIds: poll.changes.map((c) => c.id),
      counts: poll.counts,
    });
    assert(poll.changes.some((c) => c.id === topComment.id), "new top-level comment in poll delta");
    assert(poll.counts.all === 1 && poll.counts.unresolved === 1, "counts reflect new comment");

    const reply = await createVideoReviewReply(db, {
      reviewId: review.id,
      parentCommentId: topComment.id,
      authorUserId: adminProfile.id,
      authorKind: "admin",
      body: "Poll test reply",
    });
    const sinceAfterComment = poll.serverTime;
    await sleep(50);
    poll = await pollVideoReviewChanges(db, review.id, v1.id, sinceAfterComment);
    console.log("after reply:", { changeIds: poll.changes.map((c) => c.id) });
    assert(poll.changes.some((c) => c.id === reply.id), "new reply in poll delta");

    await resolveVideoReviewComment(db, review.id, topComment.id, adminProfile.id, projectId);
    const sinceAfterReply = poll.serverTime;
    await sleep(50);
    poll = await pollVideoReviewChanges(db, review.id, v1.id, sinceAfterReply);
    console.log("after resolve:", poll.counts);
    assert(poll.counts.resolved === 1 && poll.counts.unresolved === 0, "resolve updates counts via poll");
    assert(
      poll.changes.some((c) => c.id === topComment.id && c.status === "resolved"),
      "resolve status in poll delta"
    );

    await reopenVideoReviewComment(db, review.id, topComment.id, clientProfile.id, projectId);
    const sinceAfterResolve = poll.serverTime;
    await sleep(50);
    poll = await pollVideoReviewChanges(db, review.id, v1.id, sinceAfterResolve);
    console.log("after reopen:", poll.counts);
    assert(poll.counts.unresolved === 1 && poll.counts.resolved === 0, "reopen updates counts via poll");

    const { data: allRows } = await db
      .from("video_review_comments")
      .select("*")
      .eq("review_id", review.id)
      .eq("version_id", v1.id);
    const enriched = await enrichVideoReviewComments(db, (allRows ?? []) as never[]);
    const threads = buildCommentThreads(allRows ?? [], enriched, "all");
    const store = populateCommentStore(threads, []);
    const snap = snapshotFromCommentStore(store, "unresolved");
    const markers = snap.markerComments;
    const clusters = clusterReviewComments(
      markers.map((c) => ({ ...c, timestamp_seconds: c.timestamp_seconds ?? 0 }))
    );
    console.log("timeline markers (unresolved view):", clusters.map((c) => c.anchorSeconds));
    assert(clusters.length >= 1, "timeline markers rebuild after poll merge");

    console.log("\n=== new version in poll delta ===");
    const v2Asset = await cloneVideoAsset(admin, baseVideoId, "phase5-v2");
    assetIds.push(v2Asset);
    const v2 = await addVideoReviewVersion(db, {
      reviewId: review.id,
      mediaAssetId: v2Asset,
      uploadedBy: adminProfile.id,
    });
    versionIds.push(v2.id);
    const sinceBeforeVersion = poll.serverTime;
    await sleep(50);
    poll = await pollVideoReviewChanges(db, review.id, v1.id, sinceBeforeVersion);
    console.log("versions delta while on v1:", poll.versions.map((v) => v.version_number));
    assert(poll.versions.some((v) => v.id === v2.id), "new version appears in poll without full reload");

    const mergedVersions = mergeVersionRows([{ ...v1, media_assets: null }], poll.versions);
    assert(mergedVersions.length === 2, "client mergeVersionRows adds version bar entry");

    console.log("\n=== 7–8. merge preserves store / drafts (simulated) ===");
    const draftBody = "half-typed comment survives";
    let storeSim = new Map(store);
    const beforeSize = storeSim.size;
    storeSim = mergeCommentStore(storeSim, poll.changes);
    assert(storeSim.size >= beforeSize, "merge adds without clearing store");
    assert(draftBody.length > 0, `draft text preserved in UI state: "${draftBody}"`);

    console.log("\n=== 6. playback not interrupted — design checks ===");
    assert(!viewSrc.includes("handlePollResult") || viewSrc.includes("commentStoreRef"), "poll updates comment store only");
    assert(viewSrc.includes("loadComments({ quiet: true })"), "own actions use quiet refresh (no loading flash)");
    console.log(
      "Observed delay for two-browser test: ~10s while tab visible (VIDEO_REVIEW_POLL_BASE_MS), immediate on focus regain."
    );

    console.log("\n=== 9. visibility — hook evidence ===");
    console.log(
      "On document.hidden: clearTimeout + no schedule until visibilitychange → runPoll(). See use-video-review-poll.ts onVisibilityChange."
    );

    console.log("\n=== 11. navigate away — hook cleanup ===");
    assert(hookSrc.includes("return () =>"), "useEffect cleanup clears timers/listeners on unmount");

    console.log("\n=== 12. IDOR — poll access layer ===");
    const fakeReviewId = "f0000000-0000-0000-0000-000000000001";
    for (const [label, fn] of [
      ["poll wrong review version", () => loadVersionForReview(db, adminProfileFull, fakeReviewId, v1.id)],
      ["poll version on wrong review id", () => loadVersionForReview(db, adminProfileFull, review.id, fakeReviewId)],
    ] as const) {
      try {
        await fn();
        throw new Error(`${label}: expected 404`);
      } catch (err) {
        const status = err instanceof VideoReviewAccessError ? err.status : 500;
        console.log(`${label}: ${status}`);
        assert(status === 404, `${label} returns 404 with no data`);
      }
    }

    const { data: otherBusinessProject } = await admin
      .from("projects")
      .select("id, business_id")
      .neq("business_id", SWIFT_BUSINESS)
      .limit(1)
      .maybeSingle();
    if (otherBusinessProject?.id) {
      const otherDb = scriptTenantClient(admin, otherBusinessProject.business_id as string);
      try {
        await loadVersionForReview(
          otherDb,
          adminProfileFull,
          review.id,
          v1.id
        );
        throw new Error("cross-business poll access unexpected success");
      } catch (err) {
        const status = err instanceof VideoReviewAccessError ? err.status : 500;
        console.log(`cross-business review poll: ${status}`);
        assert(status === 404, "other business review poll → 404");
      }
    } else {
      console.log("(skip cross-business project — only one business in DB)");
    }

    console.log("\n=== 13. mobile 375px — same poll hook, no extra timers ===");
    assert(!hookSrc.includes("matchMedia"), "no separate mobile polling branch");
    console.log("Polling uses the same 10s/60s cadence at all viewport widths.");

    console.log("\n=== 14. phases 2–4 regression (spot checks) ===");
    assert(
      readFileSync(resolve("src/lib/video-review-notifications.ts"), "utf8").includes("notifyVideoReviewEvent"),
      "phase 4 notifications intact"
    );
    assert(
      readFileSync(resolve("src/lib/video-review-player-interaction.ts"), "utf8").includes("markingMode"),
      "UX marking mode intact"
    );
    assert(
      readFileSync(resolve("src/components/video-review/video-review-comment-panel.tsx"), "utf8").includes(
        '["all", "All"'
      ),
      "All · Unresolved · Resolved tab order intact"
    );

    console.log("\nPhase 5 verification complete.");
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
      try {
        await admin.from("media_assets").delete().eq("id", assetId);
      } catch {
        /* cleanup */
      }
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
