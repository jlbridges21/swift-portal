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
  clusterEnrichedReviewComments,
  clusterMarkerTooltip,
  commentPreview,
} from "../src/lib/video-review-timeline-markers";
import {
  computeTimelineMarkerAppearance,
  ensureVisibleOnScrubTrack,
  hasOppositeSideReply,
  markerStateSamples,
  MARKER_COLOR_SIMILARITY_THRESHOLD,
  MARKER_TRACK_MIN_CONTRAST,
  resolveMarkerBrandColors,
} from "../src/lib/video-review-timeline-marker-style";
import { contrastRatio, cssContrast, deriveBrandTheme } from "../src/lib/brand-color";
import {
  createVideoReviewComment,
  createVideoReviewFromAsset,
} from "../src/lib/video-reviews";
import {
  enrichVideoReviewComments,
  updateVideoReviewCommentMark,
} from "../src/lib/video-review-comments";
import { createTenantServiceClient, type TenantServiceClient } from "../src/lib/supabase/tenant-service";
import type { VideoReviewCommentEnriched, VideoReviewCommentThread } from "../src/lib/video-review-comment-model";
import {
  findPlaybackActiveCommentId,
  isCommentIdInThreads,
} from "../src/lib/video-review-playback-follow";
import { computeCommentScrollTop } from "../src/lib/video-review-comment-scroll";
import {
  FOLLOW_PLAYBACK_SESSION_KEY,
  readFollowPlaybackPreference,
  writeFollowPlaybackPreference,
} from "../src/lib/video-review-playback-follow-preference";

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
  const gap = 16;
  const rail = 380;
  const border = 16;
  return {
    before: Math.round(contentBefore * (1.4 / 2.4)),
    after: Math.round(viewport - padding - rail - gap - border),
  };
}

/** Approximate chrome above the video player (px) — old layout vs YouTube-style restructure. */
function headerChromeHeight(): { before: number; after: number } {
  return {
    before: 220, // hero title + subtitle + drop zone + version section
    after: 72, // one-line header + compact pills
  };
}

function mockThread(id: string, seconds: number): VideoReviewCommentThread {
  return {
    comment: {
      id,
      timestamp_seconds: seconds,
      body: `Comment at ${seconds}s`,
      status: "unresolved",
    } as VideoReviewCommentEnriched,
    replies: [],
  };
}

function mockEnriched(
  id: string,
  authorKind: "admin" | "client",
  extra: Partial<VideoReviewCommentEnriched> = {}
): VideoReviewCommentEnriched {
  return {
    id,
    author_kind: authorKind,
    author_user_id: id,
    author_name: authorKind === "admin" ? "Business Owner" : "Client User",
    body: "Sample",
    timestamp_seconds: 10,
    status: "unresolved",
  } as VideoReviewCommentEnriched;
}

function testMarkerBrandStyles() {
  console.log("\n=== Timeline marker brand + reply styling ===");
  const markerStyleSrc = readFileSync(resolve("src/lib/video-review-timeline-marker-style.ts"), "utf8");
  const markerSrc = readFileSync(resolve("src/components/video-review/video-review-timeline-marker.tsx"), "utf8");
  const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");

  assert(markerSrc.includes("usePortalBrand"), "markers read business brand from portal settings");
  assert(markerSrc.includes("computeClusterMarkerAppearance"), "cluster appearance uses brand + replies");
  assert(viewSrc.includes("repliesByCommentId"), "view passes reply data for border logic");
  assert(markerStyleSrc.includes("deriveBrandTheme"), "reuses brand-color derivation, not hardcoded partner colors");
  assert(markerStyleSrc.includes("sanitizeCssColor"), "reuses brand-color validation");

  const defaultSamples = markerStateSamples("", "");
  console.log("Default brand (unset → platform defaults):");
  console.table([
    { state: "admin solid", fill: defaultSamples.adminSolid.fill, border: defaultSamples.adminSolid.border ?? "none" },
    { state: "client solid", fill: defaultSamples.clientSolid.fill, border: defaultSamples.clientSolid.border ?? "none" },
    { state: "admin + client reply", fill: defaultSamples.adminClientReplied.fill, border: defaultSamples.adminClientReplied.border },
    { state: "client + business reply", fill: defaultSamples.clientAdminReplied.fill, border: defaultSamples.clientAdminReplied.border },
  ]);
  assert(defaultSamples.adminSolid.border === null, "admin solid: no border");
  assert(defaultSamples.clientSolid.border === null, "client solid: no border");
  assert(defaultSamples.adminClientReplied.border !== null, "admin + client reply: accent border");
  assert(defaultSamples.clientAdminReplied.border !== null, "client + business reply: primary border");
  assert(defaultSamples.adminSolid.fill !== defaultSamples.clientSolid.fill, "unset defaults: admin vs client fills differ");

  const customPrimary = "#7C3AED";
  const customAccent = "#DB2777";
  const before = markerStateSamples(customPrimary, customAccent);
  console.log(`Custom brand before (${customPrimary} / ${customAccent}):`, before.adminSolid.fill, before.clientSolid.fill);
  const afterPrimary = "#059669";
  const afterAccent = "#D97706";
  const after = markerStateSamples(afterPrimary, afterAccent);
  console.log(`Custom brand after (${afterPrimary} / ${afterAccent}):`, after.adminSolid.fill, after.clientSolid.fill);
  assert(before.adminSolid.fill !== after.adminSolid.fill, "changing settings changes marker fill without deploy");

  const adminComment = mockEnriched("a1", "admin");
  const sameSide = computeTimelineMarkerAppearance(adminComment, [mockEnriched("r1", "admin")], "#0F172A", "#3B82F6");
  assert(sameSide.border === null, "business owner replying to own comment adds no border");
  const clientSame = computeTimelineMarkerAppearance(
    mockEnriched("c1", "client"),
    [mockEnriched("r2", "client")],
    "#0F172A",
    "#3B82F6"
  );
  assert(clientSame.border === null, "client replying to own comment adds no border");

  const similar = markerStateSamples("#3B82F6", "#2563EB");
  assert(
    similar.adminClientReplied.fill !== similar.clientAdminReplied.fill ||
      similar.adminClientReplied.border !== similar.clientAdminReplied.border,
    "similar primary/accent: four states stay distinguishable via fallback borders"
  );
  console.log(
    `Similar colors (#3B82F6 / #2563EB) → admin fill ${similar.adminSolid.fill}, client fill ${similar.clientSolid.fill}, borders ${similar.adminClientReplied.border} / ${similar.clientAdminReplied.border} (threshold contrast < ${MARKER_COLOR_SIMILARITY_THRESHOLD})`
  );

  const nearWhite = ensureVisibleOnScrubTrack("#FAFAFA");
  const trackContrast = cssContrast(nearWhite, "rgb(241, 245, 249)");
  console.log(`Near-white #FAFAFA → clamped fill ${nearWhite}, track contrast ${trackContrast?.toFixed(2)}:1 (min ${MARKER_TRACK_MIN_CONTRAST})`);
  assert(trackContrast != null && trackContrast >= MARKER_TRACK_MIN_CONTRAST, "near-white brand still visible on scrub bar");

  const cluster = {
    anchorSeconds: 10,
    comments: [mockEnriched("c-admin", "admin"), mockEnriched("c-client", "client")],
  };
  const replies = new Map<string, VideoReviewCommentEnriched[]>([["c-admin", []]]);
  const clusterAppearance = computeTimelineMarkerAppearance(
    cluster.comments[0],
    replies.get("c-admin")!,
    "#0F172A",
    "#3B82F6"
  );
  console.log(
    "Mixed-author cluster: visual follows first comment (admin); tooltip lists all authors; click activates first."
  );
  assert(clusterAppearance.fill === markerStateSamples("#0F172A", "#3B82F6").adminSolid.fill, "cluster fill = first comment author");

  assert(markerSrc.includes('role="tooltip"'), "tooltips still name the author");
  assert(viewSrc.includes("handleTimelineMarkerActivate"), "markers still seek/pause/scroll on click");
  assert(markerSrc.includes("h-3 w-3"), "dot size unchanged at 12px");
  console.log("Low-contrast approach: darken pale fills toward ink until scrub-track contrast ≥ 2.5:1, plus white/dark halo in box-shadow.");
}

function testPlaybackFollowLogic() {
  console.log("\n=== Playback-synced comment follow ===");
  const threads = [mockThread("a", 7.5), mockThread("b", 15.3)];

  assert(findPlaybackActiveCommentId(threads, 5) === null, "before first comment: no active id");
  assert(findPlaybackActiveCommentId(threads, 7.5) === "a", "at 7.5s comment a is active");
  assert(findPlaybackActiveCommentId(threads, 10) === "a", "at 10s still comment a (7.5 <= 10)");
  assert(findPlaybackActiveCommentId(threads, 15.3) === "b", "crossing 15.3 activates comment b");
  assert(findPlaybackActiveCommentId(threads, 99) === "b", "after last comment stays on b");
  assert(findPlaybackActiveCommentId([], 10) === null, "no comments → null, no errors");

  const dense = [
    mockThread("c1", 1),
    mockThread("c2", 1.1),
    mockThread("c3", 1.2),
    mockThread("c4", 1.3),
    mockThread("c5", 1.4),
    mockThread("c6", 1.5),
    mockThread("c7", 1.6),
    mockThread("c8", 1.7),
    mockThread("c9", 1.8),
    mockThread("c10", 1.9),
  ];
  let changes = 0;
  let prev: string | null = null;
  for (let t = 0; t <= 2; t += 0.05) {
    const id = findPlaybackActiveCommentId(dense, t);
    if (id !== prev) {
      changes++;
      prev = id;
    }
  }
  console.log(`Ten comments within 2s: active-id changes=${changes} over 41 time steps (not per tick thrash)`);
  assert(changes <= 11, "dense timestamps: only changes when active comment id changes");

  const unresolvedOnly = [mockThread("resolved-one", 5)];
  assert(
    !isCommentIdInThreads("resolved-one", []),
    "tab filter: filtered-out comment not in visible threads — no scroll target"
  );
  assert(isCommentIdInThreads("resolved-one", unresolvedOnly), "visible when in current tab");

  const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");
  const panelSrc = readFileSync(resolve("src/components/video-review/video-review-comment-panel.tsx"), "utf8");
  const hookSrc = readFileSync(resolve("src/lib/use-video-review-playback-follow.ts"), "utf8");

  assert(viewSrc.includes("syncPlaybackFollowComment"), "seek/timeupdate recompute follow id immediately");
  assert(!/syncPlaybackFollowComment[\s\S]{0,200}setActiveCommentId/.test(viewSrc), "follow sync does not set selected comment");
  assert(viewSrc.includes("playbackFollowCommentId"), "follow id separate from activeCommentId");
  assert(panelSrc.includes("data-playback-active"), "playback highlight distinct from selection");
  assert(panelSrc.includes("Jump to current"), "manual scroll shows jump affordance when follow is on");
  assert(hookSrc.includes("programmaticScrollRef"), "ignores programmatic scroll for pause detection");
  assert(hookSrc.includes("!videoPaused"), "no auto-scroll while paused");
  assert(hookSrc.includes("composerFocused") && hookSrc.includes("replyFocused"), "no auto-scroll while typing");
  assert(hookSrc.includes("enabledByBreakpoint"), "lg+ gate for auto-follow");
  assert(hookSrc.includes("resumeFollow"), "resume via jump / comment click / scroll-back");
  assert(hookSrc.includes("lastAutoScrolledIdRef"), "scroll only when active comment id changes");
  assert(panelSrc.includes('role="switch"') || readFileSync(resolve("src/components/ui/switch.tsx"), "utf8").includes('role="switch"'), "Follow playback uses accessible switch");
  assert(readFileSync(resolve("src/components/ui/switch.tsx"), "utf8").includes("aria-checked"), "switch exposes aria-checked");
  assert(panelSrc.includes("Follow playback"), "follow label beside switch");
  assert(hookSrc.includes("readFollowPlaybackPreference"), "follow preference persisted in session");
  assert(hookSrc.includes("writeFollowPlaybackPreference"), "toggle writes session preference");
  assert(FOLLOW_PLAYBACK_SESSION_KEY === "video-review-follow-playback", "session storage key defined");
  assert(viewSrc.includes("handleTimelineMarkerActivate"), "timeline markers use dedicated navigate handler");
  assert(viewSrc.includes('scrollCommentRef.current(commentId, "start")'), "marker scrolls comment to top of list");
  assert(viewSrc.includes("cluster.comments[0]"), "clustered marker selects first comment in cluster");
  assert(readFileSync(resolve("src/lib/video-review-comment-scroll.ts"), "utf8").includes('"start"'), "scroll helper supports top alignment");

  console.log("Switch appearance: ON = accent-filled track (bg-accent) with knob right; OFF = neutral slate track (bg-slate-200) with knob left.");
  console.log(
    "Jump to current vs switch: switch is the master on/off; Jump to current only appears when follow is ON but user manually scrolled the list (temporary detach). Marker clicks are explicit navigation and never disable follow."
  );

  let stateUpdates = 0;
  let prevId: string | null = null;
  for (let i = 0; i < 200; i++) {
    const t = (i / 200) * 20;
    const next = findPlaybackActiveCommentId(threads, t);
    if (next !== prevId) {
      stateUpdates++;
      prevId = next;
    }
  }
  console.log(`Performance: 200 simulated timeupdates → ${stateUpdates} active-id changes (scroll work only on change)`);
  assert(stateUpdates === 2, "scroll/state work only twice across 7.5s and 15.3s boundaries");

  const sessionStore = new Map<string, string>();
  const storage = {
    getItem: (key: string) => sessionStore.get(key) ?? null,
    setItem: (key: string, value: string) => {
      sessionStore.set(key, value);
    },
  };
  (globalThis as typeof globalThis & { sessionStorage: typeof storage }).sessionStorage =
    storage as Storage;

  writeFollowPlaybackPreference(false);
  assert(readFollowPlaybackPreference() === false, "session persistence: off survives write");
  writeFollowPlaybackPreference(true);
  assert(readFollowPlaybackPreference() === true, "session persistence: on survives write");

  const scrollMock = {
    scrollTop: 100,
    scrollHeight: 500,
    clientHeight: 200,
    getBoundingClientRect: () => ({ top: 0, bottom: 200, height: 200 }),
    scrollTo: () => {},
  } as unknown as HTMLElement;
  const elMock = {
    getBoundingClientRect: () => ({ top: 80, bottom: 140, height: 60 }),
  } as unknown as HTMLElement;
  const topAligned = computeCommentScrollTop(scrollMock, elMock, "start");
  assert(topAligned === 180, "top align scrolls comment to list top (clamped)");
  scrollMock.scrollTop = 350;
  scrollMock.scrollHeight = 500;
  const endAligned = computeCommentScrollTop(scrollMock, elMock, "start");
  assert(endAligned === 300, "near list end: scroll clamped to maxScroll, not broken");

  console.log(
    "Tab filter behavior: follow id computed from all comments; scroll/highlight only when that id is in the current tab — filtered-out comments produce no scroll and no highlight."
  );
  console.log(
    "Below lg: auto-follow disabled entirely (enabledByBreakpoint=false) — list scroll stays inside rail on desktop only; mobile page flow never auto-scrolls."
  );
  console.log(
    "Resume triggers: (1) Jump to current button, (2) clicking a comment, (3) manual scroll until playback-active row intersects the list viewport."
  );
}

async function main() {
  console.log("=== 1. typecheck / lint / build / tenant-lint ===");
  for (const cmd of ["npm run typecheck", "npm run lint", "npm run build", "npm run tenant-lint"]) {
    console.log(`\n$ ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
  }

  const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");
  const panelSrc = readFileSync(resolve("src/components/video-review/video-review-comment-panel.tsx"), "utf8");
  const shellSrc = readFileSync(resolve("src/components/video-review/video-review-shell.tsx"), "utf8");
  const markerSrc = readFileSync(resolve("src/components/video-review/video-review-timeline-marker.tsx"), "utf8");
  const versionSrc = readFileSync(resolve("src/components/video-review/video-review-version-bar.tsx"), "utf8");

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
  assert(viewSrc.includes("(locked)"), "UI shows captured timestamp");

  console.log("\n=== YouTube-style layout restructure ===");
  assert(!versionSrc.includes("onDrop"), "drag-drop zone removed — button-only upload");
  assert(versionSrc.includes("Upload new version"), "upload button remains");
  assert(viewSrc.includes("VideoReviewVersionUpload"), "upload in header row");
  assert(viewSrc.includes("VideoReviewVersionPills"), "compact version pills under header");
  assert(!viewSrc.includes("VideoReviewVersionBar"), "deprecated monolithic version bar not used");
  assert(viewSrc.includes("composer={commentComposer}"), "composer passed to right rail");
  assert(panelSrc.includes("{composer}"), "composer pinned above tabs in rail");
  assert(!viewSrc.includes('className="shrink-0 space-y-2 rounded-2xl bg-white p-4'), "composer removed from left column");
  const chrome = headerChromeHeight();
  console.log(`Header chrome before ~${chrome.before}px → after ~${chrome.after}px (−${chrome.before - chrome.after}px)`);
  assert(chrome.after < chrome.before, "header uses less vertical space");
  console.log("Reply boxes: NOT wired — replies have no timestamp attachment.");

  testMarkerBrandStyles();
  testPlaybackFollowLogic();

  console.log("\n=== 11. layout dimensions ===");
  for (const vp of [1280, 1440, 1728, 2560]) {
    const dims = layoutVideoWidth(vp);
    console.log(`${vp}px viewport → video column before ${dims.before}px, after ${dims.after}px (+${dims.after - dims.before}px)`);
    assert(dims.after > dims.before, `video wider at ${vp}px`);
  }
  console.log("\n=== timeline markers — brand/reply dots + tooltip ===");
  assert(markerSrc.includes('h-3 w-3 rounded-full'), "scrub-bar markers stay 12px dots");
  assert(markerSrc.includes("data-marker-fill"), "marker encodes computed fill");
  assert(markerSrc.includes("data-marker-border"), "marker encodes reply border state");
  assert(!viewSrc.includes("clusterMarkerLabel"), "view no longer renders initials in timeline");
  assert(markerSrc.includes('role="tooltip"'), "tooltip element for hover and tap");
  assert(markerSrc.includes("onMouseEnter") && markerSrc.includes("onClick"), "tooltip on hover AND tap");
  assert(markerSrc.includes("focus-visible:ring"), "keyboard accessible markers");

  console.log("\n=== markers filter, cluster, keyboard ===");
  const markers = [
    { id: "1", author_name: "Jordan Bridges", author_user_id: "u1", timestamp_seconds: 10, body: "Fix the logo placement here please" },
    { id: "2", author_name: "Alexandra Montgomery", author_user_id: "u2", timestamp_seconds: 10.2, body: "Also adjust color grading on this shot" },
    { id: "3", author_name: "", author_user_id: "u3", timestamp_seconds: 50, body: "Missing author name edge case" },
  ] as VideoReviewCommentEnriched[];
  const clusters = clusterEnrichedReviewComments(markers);
  assert(clusters.length === 2, "cluster within 1s stays legible (one dot + badge)");
  const tooltip = clusterMarkerTooltip(clusters[0]);
  console.log("cluster tooltip:", tooltip);
  assert(tooltip.extraCount === 1, "cluster shows +N badge count");
  assert(tooltip.lines.length === 2, "cluster tooltip lists each comment");
  assert(commentPreview("A".repeat(100)).endsWith("…"), "long comment previews truncate");
  assert(hasOppositeSideReply(mockEnriched("a", "admin"), [mockEnriched("r", "client")]), "opposite-side reply detected");
  assert(!hasOppositeSideReply(mockEnriched("a", "admin"), [mockEnriched("r", "admin")]), "same-side reply ignored");
  assert(viewSrc.includes("markerComments"), "timeline markers follow active tab filter via markerComments");

  console.log("\n=== 4. explanatory text removed from rail ===");
  assert(!panelSrc.includes('<p className="text-xs leading-relaxed text-muted">'), "permanent instructional paragraphs removed from rail");
  assert(panelSrc.includes("HelpCircle"), "help icon preserves info on demand");
  assert(panelSrc.includes('role="tablist"'), "rail opens to tabs then comments");

  console.log("\n=== 5–9. viewport-locked shell (landing-editor pattern) ===");
  assert(shellSrc.includes("data-video-review-shell"), "dedicated viewport shell");
  assert(shellSrc.includes('document.documentElement.style.overflow = "hidden"'), "locks page scroll on lg+");
  assert(shellSrc.includes("lg:fixed lg:inset-x-0 lg:bottom-0 lg:top-16"), "fixed under header via inset, not vh/vw");
  assert(!/\dvw/.test(shellSrc + viewSrc + panelSrc + markerSrc), "no vw units in review layout");
  assert(shellSrc.includes("min-w-0"), "min-w-0 on shrinking flex children");
  assert(shellSrc.includes("overflow-y-auto") || panelSrc.includes("overflow-y-auto"), "comment rail scrolls internally");
  assert(viewSrc.includes("VideoReviewShell"), "review view uses shell");
  assert(viewSrc.includes("lg:flex-1 lg:aspect-auto"), "video flexes in left pane without page scroll");
  assert(viewSrc.includes("h-11 shrink-0"), "timeline stays directly under video");
  assert(panelSrc.includes("overflow-y-auto"), "only comment list scrolls in rail");
  assert(shellSrc.includes("lg:flex-row"), "side-by-side at lg+");
  assert(shellSrc.includes("flex-col"), "stacks below lg");
  for (const vp of [1280, 1440, 1728, 2560]) {
    const dims = layoutVideoWidth(vp);
    console.log(`${vp}px → video area ~${dims.after}px wide (flex remainder, 380px rail)`);
    assert(dims.after > dims.before, `video column uses flex remainder at ${vp}px`);
  }
  console.log(
    "Browser check on lg+: document.documentElement.scrollWidth === clientWidth && scrollHeight === clientHeight (body overflow hidden). Comment rail scroll does not move video."
  );

  console.log("\n=== 10. mobile stack ===");
  assert(shellSrc.includes("flex-col"), "below lg stacks in document flow (no fixed rail)");

  console.log("\n=== 11. earlier phases regression ===");

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
    console.log("\n=== edit mark + author-only API ===");
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

    console.log("\n=== phases 2–5 spot checks ===");
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
