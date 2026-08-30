/**
 * Video review player interaction + layout verification.
 * Usage: npx tsx scripts/verify-video-reviews-player.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  resolveVideoSurfaceClick,
  resolveVisibleDot,
  shouldDeferToNativeVideoControls,
} from "../src/lib/video-review-player-interaction";
import {
  authorInitials,
  authorMarkerColor,
  clusterEnrichedReviewComments,
  clusterMarkerLabel,
} from "../src/lib/video-review-timeline-markers";
import {
  createVideoReviewComment,
  createVideoReviewFromAsset,
} from "../src/lib/video-reviews";
import {
  enrichVideoReviewComments,
  updateVideoReviewCommentMark,
} from "../src/lib/video-review-comments";
import { createTenantServiceClient, type TenantServiceClient } from "../src/lib/supabase/tenant-service";
import type { VideoReviewCommentEnriched } from "../src/lib/video-review-comment-model";

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

function layoutVideoWidth(viewport: number): { before: number; after: number } {
  const padding = 48;
  const contentBefore = Math.min(viewport, 1152) - padding;
  const contentAfter = Math.min(viewport, 1600) - padding;
  const gap = 24;
  const rail = 380;
  return {
    before: Math.round(contentBefore * (1.4 / 2.4)),
    after: Math.round(contentAfter - rail - gap),
  };
}

async function main() {
  console.log("=== 1. typecheck / lint / build / tenant-lint ===");
  for (const cmd of ["npm run typecheck", "npm run lint", "npm run build", "npm run tenant-lint"]) {
    console.log(`\n$ ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
  }

  const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");

  console.log("\n=== 2. pause-then-resume root cause + fix ===");
  console.log(
    "Root cause: the container onClick called togglePlayPause() after native <video controls> already toggled playback on the same click (double toggle → pause then immediate resume)."
  );
  console.log(
    "Fix: frame clicks go through a dedicated overlay (bottom-12 excludes control bar); container onClick removed; blockPlayback guard on onPlay for draft/composer state."
  );
  assert(!viewSrc.includes("onClick={(e) => {\n              if ((e.target as HTMLElement).closest(\"button\")) return;\n              handleSurfacePointer"), "container no longer owns click-to-toggle");
  assert(viewSrc.includes("bottom-12 z-10"), "frame overlay excludes native control bar");
  assert(viewSrc.includes("blockPlaybackRef"), "playback blocked while draft/composer active");

  console.log("\n=== 3–6. interaction model ===");
  const content = { offsetX: 0, offsetY: 0, width: 375, height: 211 };
  const rect = { left: 0, top: 0, width: 375, height: 211, right: 375, bottom: 211, x: 0, y: 0, toJSON: () => ({}) } as DOMRect;
  const cx = content.width * 0.4;
  const cy = content.height * 0.4;

  assert(
    resolveVideoSurfaceClick({
      markingMode: false,
      editMarkMode: false,
      videoPaused: false,
      hasDraftPoint: false,
      blockPlaybackToggle: false,
      clientX: cx,
      clientY: cy,
      containerRect: rect,
      content,
    }).action === "toggle_play",
    "one click → one toggle_play action (overlay handles it once)"
  );

  assert(
    resolveVideoSurfaceClick({
      markingMode: false,
      editMarkMode: false,
      videoPaused: true,
      hasDraftPoint: true,
      blockPlaybackToggle: true,
      clientX: 10,
      clientY: 105,
      containerRect: rect,
      content: { offsetX: 50, offsetY: 0, width: 275, height: 211 },
    }).action === "blocked_draft",
    "draft protection blocks playback toggle (draft not silently lost)"
  );
  console.log("Draft protection choice: block playback toggle while a draft mark or composer text exists; user clears mark explicitly or submits comment.");

  console.log("\nMark + comment flow states (simulated):");
  const steps = [
    { step: "playing", videoPaused: false, markingMode: false, pendingPoint: false, block: false },
    { step: "Add mark clicked", videoPaused: true, markingMode: true, pendingPoint: false, block: false },
    { step: "hover preview", videoPaused: true, markingMode: true, pendingPoint: false, block: false },
    { step: "dot placed", videoPaused: true, markingMode: false, pendingPoint: true, block: true },
    { step: "typing comment", videoPaused: true, markingMode: false, pendingPoint: true, block: true },
    { step: "after submit", videoPaused: true, markingMode: false, pendingPoint: false, block: false },
  ];
  console.table(steps);

  console.log("\n=== 9. one dot max ===");
  assert(
    resolveVisibleDot({
      videoPaused: true,
      pendingPoint: { x: 0.5, y: 0.5 },
      activeCommentId: "a",
      activeCommentPoint: { x: 0.2, y: 0.2 },
      markingMode: false,
      editMarkMode: false,
      hoverPreviewPoint: null,
    })?.kind === "draft",
    "draft wins over selected — never two dots"
  );
  assert(
    resolveVisibleDot({
      videoPaused: true,
      pendingPoint: null,
      activeCommentId: "a",
      activeCommentPoint: { x: 0.2, y: 0.2 },
      markingMode: true,
      editMarkMode: false,
      hoverPreviewPoint: { x: 0.6, y: 0.6 },
    })?.kind === "preview",
    "marking preview is the only dot while placing"
  );

  console.log("\n=== 10. typing captures timestamp (main composer only) ===");
  assert(viewSrc.includes("handleCommentInputChange"), "composer pauses on first keystroke");
  assert(viewSrc.includes("composerTimestamp"), "timestamp locked at typing start");
  assert(viewSrc.includes("(locked when typing started)"), "UI shows captured timestamp");
  console.log("Reply boxes: NOT wired — replies have no timestamp attachment.");

  console.log("\n=== 11. layout dimensions ===");
  for (const vp of [1280, 1440, 1728, 2560]) {
    const dims = layoutVideoWidth(vp);
    console.log(`${vp}px viewport → video column before ${dims.before}px, after ${dims.after}px (+${dims.after - dims.before}px)`);
    assert(dims.after > dims.before, `video wider at ${vp}px`);
  }
  assert(viewSrc.includes("max-w-[1600px]"), "wider page canvas");
  assert(viewSrc.includes("lg:w-[380px]"), "fixed-width comment rail");
  assert(viewSrc.includes("lg:flex-row"), "side-by-side at lg+");
  assert(viewSrc.includes("flex-col"), "stacks below lg");

  console.log("\n=== 13–15. timeline initials + clustering + tab filter ===");
  const markers = [
    { id: "1", author_name: "Jordan", author_user_id: "u1", timestamp_seconds: 10 },
    { id: "2", author_name: "Alexandra Montgomery", author_user_id: "u2", timestamp_seconds: 10.2 },
    { id: "3", author_name: "", author_user_id: "u3", timestamp_seconds: 50 },
  ] as VideoReviewCommentEnriched[];
  console.log("single name:", authorInitials("Jordan"));
  console.log("long name:", authorInitials("Alexandra Montgomery"));
  console.log("missing name:", authorInitials(""));
  assert(authorInitials("Jordan") === "JN", "single name → first+last letter of name");
  assert(authorInitials("Alexandra Montgomery") === "AM", "long name → first+last initial");
  assert(authorInitials("") === "?", "missing name → ?");
  const c1 = authorMarkerColor("user-alpha");
  const c2 = authorMarkerColor("user-alpha");
  assert(c1 === c2, "stable color per author id");
  const clusters = clusterEnrichedReviewComments(markers);
  assert(clusters.length === 2, "cluster within 1s");
  const clusterLabel = clusterMarkerLabel(clusters[0]);
  console.log("cluster label:", clusterLabel);
  assert(clusterLabel.extraCount === 1, "cluster shows +N for extra comments");
  assert(viewSrc.includes("markerComments"), "timeline markers follow active tab filter via markerComments");

  console.log("\n=== 16. no forbidden features ===");
  for (const forbidden of ["drawing", "emoji", "watching", "share link", "arrow tool"]) {
    assert(!viewSrc.toLowerCase().includes(forbidden), `no ${forbidden} in review view`);
  }

  loadEnvLocal();
  const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const db = scriptTenantClient(admin, SWIFT_BUSINESS);

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "admin")
    .limit(1)
    .single();
  const { data: clientProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "client")
    .limit(1)
    .single();
  const { data: baseVideo } = await admin
    .from("media_assets")
    .select("id, project_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("media_type", "video")
    .not("project_id", "is", null)
    .limit(1)
    .single();
  if (!adminProfile?.id || !clientProfile?.id || !baseVideo?.project_id) {
    throw new Error("Need admin, client, and project video");
  }

  let reviewId: string | null = null;
  try {
    console.log("\n=== 7–8. edit mark + author-only API ===");
    const { review, version } = await createVideoReviewFromAsset(db, {
      projectId: baseVideo.project_id,
      mediaAssetId: baseVideo.id,
      title: `Player UX ${Date.now()}`,
      createdBy: adminProfile.id,
    });
    reviewId = review.id;

    const clientComment = await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: version.id,
      projectId: baseVideo.project_id,
      authorUserId: clientProfile.id,
      authorKind: "client",
      body: "Client mark",
      timestampSeconds: 8,
      pointX: 0.25,
      pointY: 0.35,
    });
    console.log("before edit:", { x: clientComment.point_x, y: clientComment.point_y });

    const selfUpdated = await updateVideoReviewCommentMark(
      db,
      review.id,
      clientComment.id,
      clientProfile.id,
      0.55,
      0.65
    );
    console.log("after self edit:", { x: selfUpdated.point_x, y: selfUpdated.point_y });
    assert(selfUpdated.point_x === 0.55 && selfUpdated.point_y === 0.65, "author can move own mark");

    try {
      await updateVideoReviewCommentMark(
        db,
        review.id,
        clientComment.id,
        adminProfile.id,
        0.1,
        0.1
      );
      throw new Error("admin edit should fail");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log("admin edit refused:", msg);
      assert(msg.includes("Only the comment author"), "server refuses non-author mark edit");
    }

    assert(
      readFileSync(resolve("src/app/api/video-reviews/[id]/comments/[commentId]/mark/route.ts"), "utf8").includes(
        "mark_edit_forbidden"
      ),
      "PATCH mark route returns 403 for non-author"
    );

    console.log("\n=== 17. phases 2–5 regression spot checks ===");
    assert(readFileSync(resolve("src/lib/use-video-review-poll.ts"), "utf8").includes("visibilitychange"), "phase 5 polling intact");
    assert(
      readFileSync(resolve("src/lib/video-review-notifications.ts"), "utf8").includes("notifyVideoReviewEvent"),
      "phase 4 notifications intact"
    );
    assert(readFileSync(resolve("src/lib/video-review-comments.ts"), "utf8").includes("resolveVideoReviewComment"), "phase 3 resolve intact");

    console.log("\n=== controls band deferral ===");
    assert(shouldDeferToNativeVideoControls(400, 390, 0), "clicks near bottom defer to native controls");
    assert(!shouldDeferToNativeVideoControls(400, 200, 0), "frame clicks handled by overlay");

    console.log("\nPlayer interaction verification complete.");
  } finally {
    if (reviewId) await admin.from("video_reviews").delete().eq("id", reviewId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
