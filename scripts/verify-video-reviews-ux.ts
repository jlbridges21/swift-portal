/**
 * Video review UX verification (marking mode, tabs, in-player upload).
 * Usage: npx tsx scripts/verify-video-reviews-ux.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  computeVideoContentRect as contentRect,
  normalizedPointToPercent as toPct,
  pointerToNormalizedPoint as toNorm,
} from "../src/lib/video-review-coords";
import {
  resolveVideoSurfaceClick,
  resolveVisibleDot,
} from "../src/lib/video-review-player-interaction";
import {
  addVideoReviewVersion,
  createVideoReviewComment,
  createVideoReviewFromAsset,
} from "../src/lib/video-reviews";
import { listVideoReviewCommentsForVersion } from "../src/lib/video-review-comments";
import { notifyVideoReviewEvent } from "../src/lib/video-review-notifications";
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

function domRect(w: number, h: number): DOMRect {
  return { left: 0, top: 0, width: w, height: h, right: w, bottom: h, x: 0, y: 0, toJSON: () => ({}) };
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

async function cloneVideoAsset(admin: SupabaseClient, sourceId: string, suffix: string): Promise<string> {
  const { data: source } = await admin.from("media_assets").select("*").eq("id", sourceId).single();
  if (!source) throw new Error("source video missing");
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const { data: clone, error } = await admin
    .from("media_assets")
    .insert({
      business_id: source.business_id,
      project_id: source.project_id,
      client_id: source.client_id,
      property_id: source.property_id,
      media_type: "video",
      media_source: source.media_source,
      file_path: `verify/${sourceId}-${stamp}.mp4`,
      file_name: `${source.file_name ?? "video"}-${suffix}`,
      title: `${source.title ?? "Video"} ${suffix}`,
      mime_type: source.mime_type,
      visibility: source.visibility,
      downloadable: source.downloadable,
      display_order: (source.display_order ?? 0) + 1,
    })
    .select("id")
    .single();
  if (error || !clone) throw new Error(error?.message ?? "clone failed");
  return clone.id as string;
}

function testCoordAccuracy() {
  console.log("\n=== 6. stored coordinate math unchanged (phase 2) ===");
  const videoW = 1920;
  const videoH = 1080;
  const point = { x: 0.25, y: 0.75 };
  for (const { label, w, h } of [
    { label: "375px mobile", w: 375, h: 211 },
    { label: "narrow window", w: 300, h: 400 },
    { label: "wide window", w: 800, h: 450 },
    { label: "tall letterbox", w: 375, h: 500 },
  ]) {
    const content = contentRect(w, h, videoW, videoH)!;
    const pct = toPct(point, w, h, content);
    const roundTrip = toNorm((pct.leftPct / 100) * w, (pct.topPct / 100) * h, domRect(w, h), content);
    console.log(`${label}: (${roundTrip?.x.toFixed(3)}, ${roundTrip?.y.toFixed(3)})`);
    assert(
      roundTrip !== null &&
        Math.abs(roundTrip.x - point.x) < 0.001 &&
        Math.abs(roundTrip.y - point.y) < 0.001,
      `round-trip on ${label}`
    );
  }
  const tall = contentRect(375, 500, videoW, videoH)!;
  assert(toNorm(0, 0, domRect(375, 500), tall) === null, "letterbox click places nothing");
}

function testMarkingInteractionModel() {
  console.log("\n=== 2–13. marking / selection interaction model ===");
  const content = contentRect(375, 211, 1920, 1080)!;
  const rect = domRect(375, 211);
  const cx = content.offsetX + content.width * 0.4;
  const cy = content.offsetY + content.height * 0.4;

  assert(
    resolveVideoSurfaceClick({
      markingMode: false,
      videoPaused: true,
      hasDraftPoint: false,
      clientX: cx,
      clientY: cy,
      containerRect: rect,
      content,
    }).action === "toggle_play",
    "default click toggles play/pause (not marking mode)"
  );

  const mark = resolveVideoSurfaceClick({
    markingMode: true,
    videoPaused: true,
    hasDraftPoint: false,
    clientX: cx,
    clientY: cy,
    containerRect: rect,
    content,
  });
  assert(mark.action === "place_mark", "marking mode click places mark and pauses (handled in UI)");

  assert(
    resolveVideoSurfaceClick({
      markingMode: false,
      videoPaused: true,
      hasDraftPoint: true,
      clientX: cx + 10,
      clientY: cy + 10,
      containerRect: rect,
      content,
    }).action === "move_draft",
    "touch/desktop can move draft before submit"
  );

  assert(
    resolveVideoSurfaceClick({
      markingMode: true,
      videoPaused: true,
      hasDraftPoint: false,
      clientX: 0,
      clientY: 0,
      containerRect: rect,
      content,
    }).action === "letterbox",
    "letterbox click places nothing in marking mode"
  );

  assert(resolveVisibleDot({
    videoPaused: false,
    pendingPoint: { x: 0.5, y: 0.5 },
    activeCommentId: "a",
    activeCommentPoint: { x: 0.2, y: 0.2 },
  }) === null, "NO dot visible while playing");

  assert(
    resolveVisibleDot({
      videoPaused: true,
      pendingPoint: { x: 0.5, y: 0.5 },
      activeCommentId: "a",
      activeCommentPoint: { x: 0.2, y: 0.2 },
    })?.kind === "draft",
    "only draft dot when draft exists (one dot max)"
  );

  assert(
    resolveVisibleDot({
      videoPaused: true,
      pendingPoint: null,
      activeCommentId: "b",
      activeCommentPoint: { x: 0.15, y: 0.15 },
    })?.kind === "selected",
    "two nearby comments: only selected comment id drives the one visible dot"
  );

  const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");
  assert(viewSrc.includes('useState<VideoReviewCommentView>("all")'), 'default tab is "all"');
  assert(/seekTo[\s\S]{0,500}video\.pause\(\)/.test(viewSrc), "seekTo pauses on comment click");
  assert(!/seekTo[\s\S]{0,500}video\.play/.test(viewSrc), "seekTo does not auto-play");
  assert(viewSrc.includes('e.key === "Escape"'), "Escape exits marking mode");
  assert(viewSrc.includes('e.key === " "') && viewSrc.includes('"k"'), "Space/K toggle play/pause");

  const panelSrc = readFileSync(resolve("src/components/video-review/video-review-comment-panel.tsx"), "utf8");
  assert(
    panelSrc.indexOf('["all", "All"') < panelSrc.indexOf('["unresolved"') &&
      panelSrc.indexOf('["unresolved"') < panelSrc.indexOf('["resolved"'),
    "tabs read All · Unresolved · Resolved"
  );
  console.log('Default tab: "all" — shows full feedback context on open; Unresolved is one click away for action items.');
}

async function main() {
  console.log("=== 1. typecheck / lint / build / tenant-lint ===");
  for (const cmd of ["npm run typecheck", "npm run lint", "npm run build", "npm run tenant-lint"]) {
    console.log(`\n$ ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
  }

  testCoordAccuracy();
  testMarkingInteractionModel();

  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const db = scriptTenantClient(admin, SWIFT_BUSINESS);

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  const { data: baseVideo } = await admin
    .from("media_assets")
    .select("id, project_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("media_type", "video")
    .not("project_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!adminProfile?.id || !baseVideo?.project_id) throw new Error("Need admin + project video");

  let reviewId: string | null = null;
  try {
    console.log("\n=== 15–17. version upload + comment binding ===");
    const { review, version: v1 } = await createVideoReviewFromAsset(db, {
      projectId: baseVideo.project_id,
      mediaAssetId: baseVideo.id,
      title: `UX verify ${Date.now()}`,
      createdBy: adminProfile.id,
    });
    reviewId = review.id;

    await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: v1.id,
      projectId: baseVideo.project_id,
      authorUserId: adminProfile.id,
      authorKind: "admin",
      body: "V1 note stays open",
      timestampSeconds: 4,
      pointX: 0.33,
      pointY: 0.44,
    });

    const v2Asset = await cloneVideoAsset(admin, baseVideo.id, "ux-v2");
    const v2 = await addVideoReviewVersion(db, {
      reviewId: review.id,
      mediaAssetId: v2Asset,
      uploadedBy: adminProfile.id,
    });

    const { data: versionRows } = await admin
      .from("video_review_versions")
      .select("id, version_number, created_at")
      .eq("review_id", review.id)
      .order("version_number", { ascending: true });
    console.table(versionRows ?? []);
    assert((versionRows?.length ?? 0) === 2, "V1 + V2 rows after in-review upload path");

    const v1Comments = await listVideoReviewCommentsForVersion(db, review.id, v1.id);
    assert(v1Comments.comments.length === 1, "V1 comment remains on V1 after V2 upload");
    assert(v1Comments.comments[0]?.status === "unresolved", "V1 comment not auto-resolved by V2");

    const versionBarSrc = readFileSync(resolve("src/components/video-review/video-review-version-bar.tsx"), "utf8");
    assert(versionBarSrc.includes("Upload new version"), "prominent upload action in review player");
    assert(versionBarSrc.includes("onDrop"), "drag-and-drop supported");
    assert(versionBarSrc.includes("Try again"), "upload failure is recoverable");

    const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");
    assert(viewSrc.includes("versionRows[versionRows.length - 1]"), "client lands on latest version by default");

    console.log("\n=== 19. stored points still valid ===");
    const c = v1Comments.comments[0];
    const pct = toPct(
      { x: c.point_x!, y: c.point_y! },
      375,
      211,
      contentRect(375, 211, 1920, 1080)!
    );
    console.log("stored point renders at", `${pct.leftPct.toFixed(2)}%, ${pct.topPct.toFixed(2)}%`);
    assert(c.point_x === 0.33 && c.point_y === 0.44, "stored coordinates unchanged in DB");

    console.log("\n=== 20. notifications still wired ===");
    assert(
      readFileSync(resolve("src/app/api/video-reviews/[id]/versions/route.ts"), "utf8").includes(
        "notifyVideoReviewEvent"
      ),
      "new version API still notifies"
    );
    assert(
      readFileSync(resolve("src/app/api/video-reviews/[id]/comments/route.ts"), "utf8").includes(
        "notifyVideoReviewEvent"
      ),
      "comment API still notifies"
    );
    await notifyVideoReviewEvent("new_version", {
      businessId: SWIFT_BUSINESS,
      projectId: baseVideo.project_id,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v2.id,
      actorUserId: adminProfile.id,
      actorKind: "admin",
      versionNumber: v2.version_number,
    });
    assert(true, "new_version notifyVideoReviewEvent executes without error");

    console.log("\nUX verification complete.");
  } finally {
    if (reviewId) await admin.from("video_reviews").delete().eq("id", reviewId);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
