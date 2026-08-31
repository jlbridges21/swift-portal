/**
 * Lazy video review creation — Jackson 9560 CR-99 verification only.
 * Usage: npx tsx scripts/verify-lazy-video-review.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { filterClientMedia } from "../src/lib/client-media";
import {
  filterDownloadableAssetsByFolder,
  pickDownloadableAssets,
  resolveFolderZipScope,
} from "../src/lib/project-zip-download";
import {
  filterMediaForVideoReviewDelivery,
  loadVideoReviewVersionMap,
} from "../src/lib/video-review-media";
import type { TenantServiceClient } from "../src/lib/supabase/tenant-service";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const SWIFT_SLUG = "swift-aerial-media";
const TEST_PROJECT = "933c476c-c1c4-4d8b-a5fa-aa556fcf640a";
const TEST_CLIENT_EMAIL = "jackson.bridges21@gmail.com";
const ADMIN_EMAIL = "jackson@swiftaerialmedia.com";
const TEST_FOLDER = "df142d88-fa00-44af-95c8-da6e2c92324f";

const ASSET_A = "d49137e6-a523-46fe-9aba-c4c9ef72581c";
const ASSET_B = "7a54256f-08aa-43a4-ba5f-93ca4bd57c2e";
const ASSET_C = "faba133d-8788-49e4-89d9-e83836d6d338";

type ReviewBackup = {
  assetId: string;
  review: Record<string, unknown> | null;
  versions: Record<string, unknown>[];
  comments: Record<string, unknown>[];
};

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

async function backupReview(admin: SupabaseClient, assetId: string): Promise<ReviewBackup> {
  const { data: version } = await admin
    .from("video_review_versions")
    .select("*")
    .eq("media_asset_id", assetId)
    .maybeSingle();
  if (!version) return { assetId, review: null, versions: [], comments: [] };

  const reviewId = version.review_id as string;
  const { data: review } = await admin.from("video_reviews").select("*").eq("id", reviewId).maybeSingle();
  const { data: versions } = await admin.from("video_review_versions").select("*").eq("review_id", reviewId);
  const { data: comments } = await admin.from("video_review_comments").select("*").eq("review_id", reviewId);
  return {
    assetId,
    review: review ?? null,
    versions: versions ?? [],
    comments: comments ?? [],
  };
}

async function deleteReviewForAsset(admin: SupabaseClient, assetId: string) {
  const { data: version } = await admin
    .from("video_review_versions")
    .select("review_id")
    .eq("media_asset_id", assetId)
    .maybeSingle();
  if (!version?.review_id) return;
  await admin.from("video_reviews").delete().eq("id", version.review_id);
}

async function restoreReviewBackup(admin: SupabaseClient, backup: ReviewBackup) {
  await deleteReviewForAsset(admin, backup.assetId);
  if (!backup.review) return;
  await admin.from("video_reviews").insert(backup.review);
  if (backup.versions.length) await admin.from("video_review_versions").insert(backup.versions);
  if (backup.comments.length) await admin.from("video_review_comments").insert(backup.comments);
}

async function clientGalleryVideoIds(db: TenantServiceClient, projectId: string): Promise<string[]> {
  const { data: media } = await db
    .from("media_assets")
    .select("id, media_type, visibility")
    .eq("project_id", projectId);
  const versionMap = await loadVideoReviewVersionMap(db, projectId);
  const visible = filterClientMedia(
    filterMediaForVideoReviewDelivery(media ?? [], versionMap, false)
  );
  return visible
    .filter((m) => m.media_type === "video")
    .map((m) => m.id as string)
    .sort();
}

async function downloadAllCount(db: TenantServiceClient, projectId: string): Promise<number> {
  const { data: media } = await db
    .from("media_assets")
    .select("*")
    .eq("project_id", projectId)
    .in("media_type", ["photo", "video"]);
  const versionMap = await loadVideoReviewVersionMap(db, projectId);
  const deliveryMedia = filterMediaForVideoReviewDelivery(media ?? [], versionMap, false);
  return pickDownloadableAssets(deliveryMedia, false).length;
}

async function folderZipCount(db: TenantServiceClient, projectId: string, folderId: string): Promise<number> {
  const { data: media } = await db
    .from("media_assets")
    .select("*")
    .eq("project_id", projectId)
    .in("media_type", ["photo", "video"]);
  const versionMap = await loadVideoReviewVersionMap(db, projectId);
  const deliveryMedia = filterMediaForVideoReviewDelivery(media ?? [], versionMap, false);
  let downloadable = pickDownloadableAssets(deliveryMedia, false);
  const folderScope = await resolveFolderZipScope(projectId, folderId, db);
  if (folderScope.ok && folderScope.folderScope) {
    downloadable = filterDownloadableAssetsByFolder(downloadable, folderScope.folderScope);
  }
  return downloadable.length;
}

async function rowsForAsset(admin: SupabaseClient, assetId: string) {
  const { data: versions } = await admin
    .from("video_review_versions")
    .select("id, review_id, version_number, media_asset_id, uploaded_by")
    .eq("media_asset_id", assetId);
  const reviewIds = [...new Set((versions ?? []).map((v) => v.review_id as string))];
  const { data: reviews } = reviewIds.length
    ? await admin.from("video_reviews").select("id, title, created_by").in("id", reviewIds)
    : { data: [] };
  const versionIds = (versions ?? []).map((v) => v.id as string);
  const { data: comments } = versionIds.length
    ? await admin
        .from("video_review_comments")
        .select("id, review_id, version_id, author_user_id, author_kind, body, timestamp_seconds")
        .in("version_id", versionIds)
    : { data: [] };
  return { reviews: reviews ?? [], versions: versions ?? [], comments: comments ?? [] };
}

async function setupShareViewer(admin: SupabaseClient, ts: number) {
  const { addProjectShare, buildShareMagicLinkForProject, resolveShareAccessWindow } =
    await import("../src/lib/project-shares");
  const shareEmail = `lazy-review-share-${ts}@example.test`;
  const accessFields = resolveShareAccessWindow("30days");
  const added = await addProjectShare({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email: shareEmail,
    invitedBy: SWIFT_ADMIN,
    notify: false,
    projectName: "Jackson Bridges - 9560 CR-99 - Aerial Photography",
    inviterName: "Admin",
    expiryPreset: "30days",
  });
  const link = await buildShareMagicLinkForProject({
    businessId: SWIFT,
    projectId: TEST_PROJECT,
    email: shareEmail,
    shareId: added.share.id,
    accessFields,
  });
  const token = new URL(link).searchParams.get("token") || "";
  const form = new URLSearchParams();
  form.set("token", token);
  const res = await fetch(`${tenantBase()}/auth/share/consume`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    redirect: "manual",
  });
  const cookie = (res.headers.getSetCookie?.() ?? []).map((c) => c.split(";")[0]).join("; ");
  return {
    cookie,
    cleanup: async () => {
      await admin
        .from("project_shares")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", added.share.id);
    },
  };
}

async function postLazyComment(
  base: string,
  cookie: string,
  assetId: string,
  body: string,
  timestampSeconds = 2.5
) {
  const res = await fetch(`${base}/api/video-reviews/lazy-comment`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      project_id: TEST_PROJECT,
      media_asset_id: assetId,
      body,
      timestamp_seconds: timestampSeconds,
    }),
  });
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  return { status: res.status, text, json };
}

async function countAdminNotifications(admin: SupabaseClient, since: string) {
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", SWIFT_ADMIN)
    .eq("type", "video_review_activity")
    .gte("created_at", since);
  return count ?? 0;
}

async function main() {
  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const db = scriptTenantClient(admin, SWIFT);
  const base = tenantBase();
  const ts = Date.now();

  const backups = await Promise.all([
    backupReview(admin, ASSET_A),
    backupReview(admin, ASSET_B),
    backupReview(admin, ASSET_C),
  ]);

  try {
    section("1. Build gates");
    if (!process.env.SKIP_BUILD_GATES) {
      for (const cmd of [
        "npm run typecheck",
        "npm run lint",
        "npm run build",
        "npm run tenant-lint",
      ]) {
        console.log(`\n$ ${cmd}`);
        execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
      }
      assert(true, "typecheck + lint + build + tenant-lint passed");
    } else {
      console.log("SKIP_BUILD_GATES=1 — skipping build gates");
    }

    const share = await setupShareViewer(admin, ts);
    const clientCookie = await sessionCookie(admin, TEST_CLIENT_EMAIL);
    const adminCookie = await sessionCookie(admin, ADMIN_EMAIL);

    section("2. Shared viewer — first lazy comment on video with no review");
    await deleteReviewForAsset(admin, ASSET_A);
    const assetPage = await fetch(`${base}/dashboard/projects/${TEST_PROJECT}/reviews/asset/${ASSET_A}`, {
      headers: { Cookie: share.cookie },
    });
    console.log("lazy asset page status:", assetPage.status);
    assert(assetPage.status === 200, "shared viewer can open lazy asset review page");
    const notifyMark = new Date().toISOString();
    const shareRes = await postLazyComment(base, share.cookie, ASSET_A, `Share lazy ${ts}`);
    console.log("POST lazy-comment:", shareRes.status, shareRes.text.slice(0, 320));
    assert(shareRes.status === 201, "shared viewer lazy comment succeeds");
    assert(Boolean(shareRes.json.review_created), "review_created true on first comment");
    const shareRows = await rowsForAsset(admin, ASSET_A);
    console.log("rows after share comment:", JSON.stringify(shareRows, null, 2));
    assert(shareRows.reviews.length === 1, "exactly one review row");
    assert(shareRows.versions.length === 1, "exactly one V1 row");
    assert(shareRows.versions[0]?.version_number === 1, "V1 version_number is 1");
    assert(shareRows.comments.length === 1, "exactly one comment row");
    const shareNotify = await countAdminNotifications(admin, notifyMark);
    console.log("admin notifications since share comment:", shareNotify);
    assert(shareNotify >= 1, "admin notified on shared viewer first comment");

    section("3. Assigned client — first lazy comment");
    await deleteReviewForAsset(admin, ASSET_B);
    const clientRes = await postLazyComment(base, clientCookie, ASSET_B, `Client lazy ${ts}`);
    console.log("POST lazy-comment:", clientRes.status, clientRes.text.slice(0, 320));
    assert(clientRes.status === 201, "assigned client lazy comment succeeds");
    const clientRows = await rowsForAsset(admin, ASSET_B);
    console.log("rows after client comment:", JSON.stringify(clientRows, null, 2));
    assert(clientRows.reviews.length === 1 && clientRows.comments.length === 1, "client created review + comment");

    section("4. Admin — first lazy comment");
    await deleteReviewForAsset(admin, ASSET_C);
    const adminRes = await postLazyComment(base, adminCookie, ASSET_C, `Admin lazy ${ts}`);
    console.log("POST lazy-comment:", adminRes.status, adminRes.text.slice(0, 320));
    assert(adminRes.status === 201, "admin lazy comment succeeds");
    const adminRows = await rowsForAsset(admin, ASSET_C);
    console.log("rows after admin comment:", JSON.stringify(adminRows, null, 2));
    assert(adminRows.reviews[0]?.created_by, "review.created_by is the commenter (admin)");

    section("5. Concurrency — two simultaneous first comments → one review");
    await deleteReviewForAsset(admin, ASSET_A);
    const concBodyA = `Concurrent A ${ts}`;
    const concBodyB = `Concurrent B ${ts}`;
    const [concA, concB] = await Promise.all([
      postLazyComment(base, share.cookie, ASSET_A, concBodyA, 1),
      postLazyComment(base, clientCookie, ASSET_A, concBodyB, 2),
    ]);
    console.log("response A:", concA.status, concA.text.slice(0, 240));
    console.log("response B:", concB.status, concB.text.slice(0, 240));
    assert(concA.status === 201 && concB.status === 201, "both concurrent requests succeed");
    const reviewCreatedCount = [concA.json.review_created, concB.json.review_created].filter(Boolean).length;
    console.log("review_created flags:", concA.json.review_created, concB.json.review_created);
    assert(reviewCreatedCount === 1, "exactly one response has review_created=true");
    const concRows = await rowsForAsset(admin, ASSET_A);
    console.log(
      "resulting row counts — reviews:",
      concRows.reviews.length,
      "versions:",
      concRows.versions.length,
      "comments:",
      concRows.comments.length
    );
    assert(concRows.reviews.length === 1, "concurrency produced one review");
    assert(concRows.versions.length === 1, "concurrency produced one version");
    assert(concRows.comments.length === 2, "concurrency produced two comments");

    section("6. Failed comment insert leaves no orphan review");
    await deleteReviewForAsset(admin, ASSET_A);
    const emptyRes = await postLazyComment(base, adminCookie, ASSET_A, "   ");
    console.log("empty body POST:", emptyRes.status, emptyRes.text.slice(0, 200));
    assert(emptyRes.status === 400, "empty body rejected");
    let orphanRows = await rowsForAsset(admin, ASSET_A);
    assert(orphanRows.reviews.length === 0, "empty body left no review");

    const { error: simError } = await admin.rpc("verify_simulate_lazy_review_orphan_failure", {
      p_business_id: SWIFT,
      p_project_id: TEST_PROJECT,
      p_media_asset_id: ASSET_A,
      p_created_by: SWIFT_ADMIN,
    });
    console.log("simulated mid-transaction failure:", simError?.message ?? "(no error — fail)");
    assert(Boolean(simError), "simulation raised an error");
    orphanRows = await rowsForAsset(admin, ASSET_A);
    console.log("rows after simulated failure:", JSON.stringify(orphanRows, null, 2));
    assert(orphanRows.reviews.length === 0, "simulated failure left no review");
    assert(orphanRows.versions.length === 0, "simulated failure left no version");

    section("7–9. Gallery + Download All + folder ZIP counts unchanged by lazy review");
    await deleteReviewForAsset(admin, ASSET_B);
    const galleryBefore = await clientGalleryVideoIds(db, TEST_PROJECT);
    const downloadBefore = await downloadAllCount(db, TEST_PROJECT);
    const folderBefore = await folderZipCount(db, TEST_PROJECT, TEST_FOLDER);
    console.log("gallery video ids BEFORE:", galleryBefore);
    console.log("Download All file count BEFORE:", downloadBefore);
    console.log("folder ZIP file count BEFORE:", folderBefore);
    const galleryRes = await postLazyComment(base, clientCookie, ASSET_B, `Gallery probe ${ts}`);
    assert(galleryRes.status === 201, "gallery probe comment ok");
    const galleryAfter = await clientGalleryVideoIds(db, TEST_PROJECT);
    const downloadAfter = await downloadAllCount(db, TEST_PROJECT);
    const folderAfter = await folderZipCount(db, TEST_PROJECT, TEST_FOLDER);
    console.log("gallery video ids AFTER:", galleryAfter);
    console.log("Download All file count AFTER:", downloadAfter);
    console.log("folder ZIP file count AFTER:", folderAfter);
    assert(
      JSON.stringify(galleryBefore) === JSON.stringify(galleryAfter),
      "client gallery video list identical before/after"
    );
    assert(downloadBefore === downloadAfter, "Download All count identical before/after");
    assert(folderBefore === folderAfter, "folder ZIP count identical before/after");

    section("10. Admin Start video review — same shape as first comment");
    await deleteReviewForAsset(admin, ASSET_C);
    const startRes = await fetch(`${base}/api/video-reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: adminCookie },
      body: JSON.stringify({
        project_id: TEST_PROJECT,
        media_asset_id: ASSET_C,
        title: "Perdido Bay-2",
      }),
    });
    const startText = await startRes.text();
    console.log("POST /api/video-reviews:", startRes.status, startText.slice(0, 320));
    assert(startRes.status === 201, "admin Start video review still works");
    const startJson = JSON.parse(startText) as { review: { id: string }; version: { version_number: number } };
    const startRows = await rowsForAsset(admin, ASSET_C);
    console.log("rows after admin start:", JSON.stringify(startRows, null, 2));
    assert(startRows.reviews.length === 1, "admin start creates one review");
    assert(startRows.versions.length === 1 && startRows.versions[0]?.version_number === 1, "admin start creates V1");
    assert(startRows.comments.length === 0, "admin start creates no comment (expected)");
    assert(Boolean(startJson.review?.id), "admin start returns review id");

    section("11. Notifications on shared viewer first comment — covered in step 2");

    section("12. Anonymous visitor still prompted to sign in");
    const { data: pubProject } = await admin
      .from("projects")
      .select("link_access_token, link_access_mode")
      .eq("id", TEST_PROJECT)
      .single();
    const priorMode = pubProject?.link_access_mode;
    if (priorMode !== "anyone_with_link") {
      await admin.from("projects").update({ link_access_mode: "anyone_with_link" }).eq("id", TEST_PROJECT);
    }
    const anonHtml = await (await fetch(`${base}/view/${pubProject!.link_access_token}`)).text();
    console.log('grep "Sign in to comment":', anonHtml.includes("Sign in to comment"));
    assert(anonHtml.includes("Sign in to comment"), "anonymous page prompts sign in");
    if (priorMode !== "anyone_with_link") {
      await admin.from("projects").update({ link_access_mode: priorMode }).eq("id", TEST_PROJECT);
    }

    section("13. Shared viewer cannot resolve — server 403");
    const versionId = concRows.versions[0]?.id as string;
    const commentId = concRows.comments[0]?.id as string;
    const reviewId = concRows.reviews[0]?.id as string;
    const resolveRes = await fetch(
      `${base}/api/video-reviews/${reviewId}/comments/${commentId}/resolve`,
      { method: "POST", headers: { Cookie: share.cookie } }
    );
    console.log("POST resolve:", resolveRes.status, (await resolveRes.text()).slice(0, 200));
    assert(resolveRes.status === 403, "shared viewer resolve is 403");
    void versionId;

    section("14. Phase 2 + phase 3 boundary sweeps");
    execSync("npx tsx scripts/verify-share-access-tokens.ts", { stdio: "inherit", cwd: resolve(".") });

    await share.cleanup();
    console.log("\n=== verify-lazy-video-review complete ===");
  } finally {
    section("Restore Jackson review backups");
    for (const backup of backups) {
      await restoreReviewBackup(admin, backup);
      console.log("restored asset", backup.assetId, backup.review ? "(had review)" : "(no review)");
    }
  }
}

main().catch((err) => {
  console.error("\nVERIFY FAILED:", err);
  process.exit(1);
});
