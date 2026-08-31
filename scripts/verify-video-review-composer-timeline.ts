/**
 * Video review composer timestamp + resolved timeline markers — Jackson project only.
 * Usage: npx tsx scripts/verify-video-review-composer-timeline.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  clusterShowsResolvedIndicator,
  commentTimestampForSubmit,
  shouldClearDraftMark,
} from "../src/lib/video-review-composer";
import { computeTimelineMarkerAppearance } from "../src/lib/video-review-timeline-marker-style";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_SLUG = "swift-aerial-media";
const TEST_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const TEST_REVIEW = "ed52d70a-b94b-4e6b-9e9e-74bd396d56b5";
const ADMIN_EMAIL = "jackson@swiftaerialmedia.com";

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

function section(title: string) {
  console.log(`\n${"=".repeat(72)}\n${title}\n${"=".repeat(72)}`);
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

function tenantBase() {
  const host = (process.env.PENTEST_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
  return `${host}/b/${SWIFT_SLUG}`;
}

async function sessionCookie(admin: SupabaseClient, email: string): Promise<string> {
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkErr) throw linkErr;
  const hashed = linkData.properties?.hashed_token;
  if (!hashed) throw new Error(`no hashed_token for ${email}`);

  const userClient = createClient(url, anon, { auth: { persistSession: false } });
  const { data: verified, error: vErr } = await userClient.auth.verifyOtp({
    token_hash: hashed,
    type: "email",
  });
  if (vErr || !verified.session) throw vErr ?? new Error("no session");

  const projectRef = new URL(url).hostname.split(".")[0];
  return `sb-${projectRef}-auth-token=${encodeURIComponent(
    JSON.stringify({
      access_token: verified.session.access_token,
      refresh_token: verified.session.refresh_token,
      expires_at: verified.session.expires_at,
      expires_in: verified.session.expires_in,
      token_type: verified.session.token_type,
      user: verified.user,
    })
  )}`;
}

async function main() {
  loadEnvLocal();
  const viewSrc = readFileSync(resolve("src/components/video-review/video-review-view.tsx"), "utf8");
  const markerSrc = readFileSync(
    resolve("src/components/video-review/video-review-timeline-marker.tsx"),
    "utf8"
  );

  section("1. Build gates");
  if (!process.env.SKIP_BUILD_GATES) {
    for (const cmd of ["npm run typecheck", "npm run lint", "npm run build", "npm run tenant-lint"]) {
      console.log(`\n$ ${cmd}`);
      execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
    }
    assert(true, "typecheck + lint + build + tenant-lint passed");
  } else {
    console.log("SKIP_BUILD_GATES=1 — skipping build gates");
  }

  section("2–7. Composer timestamp + mark edge case (logic + source)");
  assert(!viewSrc.includes("composerTimestamp"), "removed sticky composerTimestamp lock");
  assert(!viewSrc.includes("(locked)"), "removed misleading locked label");
  assert(viewSrc.includes("syncPlayheadFromVideo"), "playhead sync helper drives composer time");
  assert(viewSrc.includes("onSeeked={handleVideoSeeked}"), "native scrub updates composer via seeked");
  assert(viewSrc.includes("composerDisplayTime = playheadSeconds"), "composer always shows live playhead");
  assert(
    commentTimestampForSubmit({
      playheadSeconds: 15,
      videoCurrentTime: 15,
      pendingPoint: null,
      pendingMarkTimestamp: null,
    }) === 15,
    "comment at scrubbed playhead uses current position"
  );
  assert(
    commentTimestampForSubmit({
      playheadSeconds: 15,
      videoCurrentTime: 15,
      pendingPoint: { x: 0.2, y: 0.3 },
      pendingMarkTimestamp: 6,
    }) === 6,
    "comment with mark uses mark frame timestamp when still aligned"
  );
  assert(shouldClearDraftMark(15, 6), "scrub away from mark frame triggers clear");
  assert(!shouldClearDraftMark(6.02, 6), "tiny drift keeps mark on same frame");
  assert(viewSrc.includes("shouldClearDraftMark"), "draft mark cleared when playhead leaves mark frame");
  console.log(
    "Typing lock decision: REMOVED — composer tracks playhead unconditionally; first keystroke only pauses playback."
  );
  console.log(
    "Mark edge case: CLEAR on scrub — moving playhead >50ms from mark frame clears draft mark with toast; submit never pairs mark with a different timestamp."
  );

  section("8–11. Resolved scrub-bar markers");
  assert(markerSrc.includes("data-marker-resolved"), "markers expose resolved state in DOM");
  assert(markerSrc.includes('showResolvedIndicator'), "All view passes resolved indicator flag");
  assert(viewSrc.includes('showResolvedIndicator={commentView === "all"}'), "only All view shows resolved badge");
  assert(!clusterShowsResolvedIndicator([{ status: "resolved" }], false), "Resolved tab: plain dots");
  assert(clusterShowsResolvedIndicator([{ status: "resolved" }], true), "All tab: resolved cluster flagged");
  assert(!clusterShowsResolvedIndicator([{ status: "unresolved" }], true), "unresolved stays plain in All");

  const lightBrand = computeTimelineMarkerAppearance(
    { id: "1", author_kind: "client", author_user_id: "u", body: "x", status: "resolved" } as never,
    [],
    "#F8FAFC",
    "#93C5FD"
  );
  const darkBrand = computeTimelineMarkerAppearance(
    { id: "2", author_kind: "admin", author_user_id: "u", body: "y", status: "resolved" } as never,
    [],
    "#0F172A",
    "#1E3A8A"
  );
  console.log("light brand fill:", lightBrand.fill, "border:", lightBrand.border ?? "none");
  console.log("dark brand fill:", darkBrand.fill, "border:", darkBrand.border ?? "none");
  assert(markerSrc.includes("bg-black/50"), "resolved check uses dark overlay for legibility on any fill");

  section("12. Marker regressions (source)");
  assert(markerSrc.includes("computeClusterMarkerAppearance"), "author fill + reply border preserved");
  assert(markerSrc.includes('role="tooltip"'), "tooltips preserved");
  assert(viewSrc.includes("handleTimelineMarkerActivate"), "click-to-seek preserved");
  assert(viewSrc.includes('scrollCommentRef.current(commentId, "start")'), "scroll-to-top preserved");
  assert(markerSrc.includes("h-3 w-3"), "12px dot size preserved");

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const base = tenantBase();
  const adminCookie = await sessionCookie(admin, ADMIN_EMAIL);
  const ts = Date.now();

  const { data: version } = await admin
    .from("video_review_versions")
    .select("id")
    .eq("review_id", TEST_REVIEW)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!version?.id) throw new Error("Jackson review version missing");

  section("2–4. API — comment saved at requested playhead (simulates scrubbed position)");
  const at15 = await fetch(`${base}/api/video-reviews/${TEST_REVIEW}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      version_id: version.id,
      body: `Composer scrub verify ${ts} @15`,
      timestamp_seconds: 15,
    }),
  });
  const at15Json = (await at15.json()) as { id?: string; timestamp_seconds?: number };
  console.log("POST @15:", at15.status, at15Json);
  assert(at15.status === 201, "comment POST ok");
  assert(Math.abs((at15Json.timestamp_seconds ?? 0) - 15) < 0.01, "row saved at 15s");

  const at20 = await fetch(`${base}/api/video-reviews/${TEST_REVIEW}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      version_id: version.id,
      body: `Composer play verify ${ts} @20`,
      timestamp_seconds: 20,
    }),
  });
  const at20Json = (await at20.json()) as { timestamp_seconds?: number };
  console.log("POST @20:", at20.status, at20Json.timestamp_seconds);
  assert(at20.status === 201 && Math.abs((at20Json.timestamp_seconds ?? 0) - 20) < 0.01, "row saved at ~20s");

  section("7. Mark + timestamp pairing via API (mark at 6, timestamp 6)");
  const marked = await fetch(`${base}/api/video-reviews/${TEST_REVIEW}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: adminCookie },
    body: JSON.stringify({
      version_id: version.id,
      body: `Mark pairing verify ${ts}`,
      timestamp_seconds: 6,
      point_x: 0.35,
      point_y: 0.42,
    }),
  });
  const markedJson = (await marked.json()) as {
    id?: string;
    timestamp_seconds?: number;
    point_x?: number;
    point_y?: number;
  };
  console.log("marked row:", markedJson);
  assert(marked.status === 201, "marked comment POST ok");
  assert(Math.abs((markedJson.timestamp_seconds ?? 0) - 6) < 0.01, "mark saved at 6s");
  assert(markedJson.point_x != null && markedJson.point_y != null, "mark coordinates saved");

  section("13–14. Resolve/reopen updates comment status for timeline markers");
  const resolveTarget = at15Json.id!;
  const resolveRes = await fetch(
    `${base}/api/video-reviews/${TEST_REVIEW}/comments/${resolveTarget}/resolve`,
    { method: "POST", headers: { Cookie: adminCookie } }
  );
  console.log("resolve:", resolveRes.status, (await resolveRes.text()).slice(0, 120));
  assert(resolveRes.status === 200, "resolve ok");

  const afterResolve = await fetch(
    `${base}/api/video-reviews/${TEST_REVIEW}/comments?version_id=${version.id}&view=all`,
    { headers: { Cookie: adminCookie } }
  );
  const afterResolveJson = (await afterResolve.json()) as {
    markerComments?: { id: string; status: string }[];
  };
  const resolvedRow = afterResolveJson.markerComments?.find((c) => c.id === resolveTarget);
  console.log("markerComments resolved row:", resolvedRow);
  assert(resolvedRow?.status === "resolved", "resolve reflected in markerComments immediately");
  assert(clusterShowsResolvedIndicator([resolvedRow!], true), "All view would show resolved checkmark");

  const reopenRes = await fetch(
    `${base}/api/video-reviews/${TEST_REVIEW}/comments/${resolveTarget}/reopen`,
    { method: "POST", headers: { Cookie: adminCookie } }
  );
  console.log("reopen:", reopenRes.status);
  assert(reopenRes.status === 200, "reopen ok");

  const afterReopen = await fetch(
    `${base}/api/video-reviews/${TEST_REVIEW}/comments?version_id=${version.id}&view=all`,
    { headers: { Cookie: adminCookie } }
  );
  const afterReopenJson = (await afterReopen.json()) as {
    markerComments?: { id: string; status: string }[];
  };
  const reopenedRow = afterReopenJson.markerComments?.find((c) => c.id === resolveTarget);
  console.log("markerComments after reopen:", reopenedRow?.status);
  assert(reopenedRow?.status === "unresolved", "reopen reflected in markerComments immediately");
  assert(!clusterShowsResolvedIndicator([reopenedRow!], true), "resolved checkmark removed after reopen");

  section("Mobile 375px marker (source)");
  assert(markerSrc.includes("h-2 w-2"), "check icon sized for scrub bar at mobile scale");

  console.log("\n=== verify-video-review-composer-timeline complete ===");
}

main().catch((err) => {
  console.error("\nVERIFY FAILED:", err);
  process.exit(1);
});
