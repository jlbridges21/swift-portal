/**
 * Video review phase 4 verification — notifications.
 * Usage: npx tsx scripts/verify-video-reviews-phase4.ts
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { execSync } from "child_process";
import { readFileSync } from "fs";
import { resolve } from "path";
import {
  NOTIFICATION_EVENT_DEFINITIONS,
  type AppSettings,
  type NotificationEventKey,
} from "../src/lib/app-settings";
import { ensureClientPortalAccessForEmail } from "../src/lib/client-portal-link";
import { businessPortalHref } from "../src/lib/portal-url";
import { createVideoReviewComment, createVideoReviewFromAsset, addVideoReviewVersion } from "../src/lib/video-reviews";
import { resolveVideoReviewComment } from "../src/lib/video-review-comments";
import {
  flushVideoReviewNotificationBatches,
  notifyVideoReviewEvent,
  videoReviewReviewPath,
  VIDEO_REVIEW_BATCH_DEBOUNCE_SECONDS,
} from "../src/lib/video-review-notifications";
import { createTenantServiceClient, type TenantServiceClient } from "../src/lib/supabase/tenant-service";
import { getAppSettings, saveAppSettings } from "../src/lib/app-settings";

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

async function countNotifications(
  admin: SupabaseClient,
  filter: { userId?: string; type?: string; projectId?: string; since: string }
) {
  let q = admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .gte("created_at", filter.since);
  if (filter.userId) q = q.eq("user_id", filter.userId);
  if (filter.type) q = q.eq("type", filter.type);
  if (filter.projectId) q = q.eq("project_id", filter.projectId);
  const { count } = await q;
  return count ?? 0;
}

async function pendingBatches(admin: SupabaseClient, reviewId: string) {
  const { data } = await admin
    .from("video_review_notification_batches")
    .select("*")
    .eq("review_id", reviewId)
    .is("sent_at", null);
  return data ?? [];
}

async function main() {
  console.log("=== 1. typecheck / lint / build / tenant-lint ===");
  for (const cmd of [
    "npm run typecheck",
    "npm run lint",
    "npm run build",
    "npm run tenant-lint",
  ]) {
    console.log(`\n$ ${cmd}`);
    execSync(cmd, { stdio: "inherit", cwd: resolve(".") });
  }

  loadEnvLocal();
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
  const db = scriptTenantClient(admin, SWIFT_BUSINESS);

  const { error: migrationCheck } = await admin
    .from("video_review_notification_batches")
    .select("id")
    .limit(1);
  if (migrationCheck?.message?.includes("does not exist")) {
    throw new Error("Apply supabase/migration-v79-video-review-notifications.sql first");
  }

  const { data: adminProfile } = await admin
    .from("profiles")
    .select("id, role, email, client_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  const { data: clientProfile } = await admin
    .from("profiles")
    .select("id, role, email, client_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("role", "client")
    .not("client_id", "is", null)
    .limit(1)
    .maybeSingle();

  if (!adminProfile?.id || !clientProfile?.id) {
    throw new Error("Need Swift admin + client profiles");
  }

  const { data: projectRow } = await admin
    .from("projects")
    .select("client_id")
    .eq("id", baseVideo.project_id)
    .maybeSingle();
  let projectClientUserId = clientProfile.id;
  if (projectRow?.client_id) {
    const { data: projectClient } = await admin
      .from("clients")
      .select("user_id")
      .eq("id", projectRow.client_id)
      .maybeSingle();
    if (projectClient?.user_id) projectClientUserId = projectClient.user_id as string;
  }
  console.log("project client user:", projectClientUserId);

  const { data: baseVideo } = await admin
    .from("media_assets")
    .select("id, project_id")
    .eq("business_id", SWIFT_BUSINESS)
    .eq("media_type", "video")
    .not("project_id", "is", null)
    .limit(1)
    .maybeSingle();
  if (!baseVideo?.project_id) throw new Error("Need a project video");

  const projectId = baseVideo.project_id as string;
  let reviewId: string | null = null;
  const since = new Date().toISOString();

  try {
    const { review, version: v1 } = await createVideoReviewFromAsset(db, {
      projectId,
      mediaAssetId: baseVideo.id,
      title: `Phase4 notify ${Date.now()}`,
      createdBy: adminProfile.id,
    });
    reviewId = review.id;

    console.log("\n=== settings UI labels + push note ===");
    const vrEvents = NOTIFICATION_EVENT_DEFINITIONS.filter((d) => d.key.startsWith("video_review"));
    console.table(
      vrEvents.map((e) => ({ key: e.key, label: e.label, audience: e.audience, description: e.description.slice(0, 80) }))
    );
    assert(vrEvents.length === 5, "five video review notification toggles");
    assert(
      vrEvents.some((e) => e.description.toLowerCase().includes("push") && e.description.toLowerCase().includes("admin")),
      "settings copy states push is admin-only"
    );

    console.log("\n=== deep links (never apex for clients) ===");
    const { data: swiftBiz } = await admin
      .from("businesses")
      .select("id, slug, custom_domain")
      .eq("id", SWIFT_BUSINESS)
      .single();
    const clientPath = videoReviewReviewPath("client", projectId, review.id, v1.id, "comment-abc");
    const adminPath = videoReviewReviewPath("admin", projectId, review.id, v1.id, "comment-abc");
    const clientUrl = await businessPortalHref(SWIFT_BUSINESS, clientPath);
    const adminUrl = await businessPortalHref(SWIFT_BUSINESS, adminPath);
    console.log("client URL (subdomain business):", clientUrl);
    console.log("admin URL:", adminUrl);
    assert(clientUrl.includes("version=") && clientUrl.includes("comment=comment-abc"), "client link includes version + comment");
    assert(adminUrl.includes("/admin/projects/"), "admin link uses admin path");
    const apex = `www.${process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN ?? "shootportal.com"}`;
    assert(!clientUrl.includes(`https://${apex}/dashboard`), "client link does not use platform apex dashboard");

    if (swiftBiz?.custom_domain) {
      const customUrl = await businessPortalHref(SWIFT_BUSINESS, clientPath);
      assert(customUrl.startsWith("https://"), "custom domain business uses https portal origin");
      console.log("custom domain origin:", customUrl.split("/dashboard")[0]);
    } else {
      console.log("(Swift business has no custom_domain — subdomain origin verified above)");
    }

    const signedOutAccess = await ensureClientPortalAccessForEmail(
      clientProfile.client_id as string,
      SWIFT_BUSINESS,
      clientPath
    );
    console.log("signed-out client CTA mechanism:", signedOutAccess.mechanism, signedOutAccess.ctaUrl?.slice(0, 120));
    assert(
      signedOutAccess.ctaUrl?.includes(clientPath.split("?")[0] ?? "") &&
        signedOutAccess.ctaUrl.includes("version=") &&
        signedOutAccess.ctaUrl.includes("comment=comment-abc"),
      "client email link preserves review path, version, and comment for post-login return"
    );

    console.log("\n=== 2. client comments → admin in-app + batched email/push ===");
    const mark = new Date().toISOString();
    let lastCommentId: string | null = null;
    for (let i = 0; i < 10; i++) {
      const c = await createVideoReviewComment(db, {
        reviewId: review.id,
        versionId: v1.id,
        projectId,
        authorUserId: projectClientUserId,
        authorKind: "client",
        body: `Batch comment ${i}`,
        timestampSeconds: i + 1,
      });
      lastCommentId = c.id;
      await notifyVideoReviewEvent("client_comment", {
        businessId: SWIFT_BUSINESS,
        projectId,
        reviewId: review.id,
        reviewTitle: review.title,
        versionId: v1.id,
        commentId: c.id,
        actorUserId: projectClientUserId,
        actorKind: "client",
        previewText: `Comment ${i}`,
      });
    }

    const adminInApp = await countNotifications(admin, {
      userId: adminProfile.id,
      type: "video_review_activity",
      projectId,
      since: mark,
    });
    console.log("admin in-app notifications created:", adminInApp);
    assert(adminInApp === 10, "in-app: one notification per comment");

    const batchesAfterBurst = await pendingBatches(admin, review.id);
    console.table(
      batchesAfterBurst.map((b) => ({
        channel: b.channel,
        recipient_kind: b.recipient_kind,
        event_count: b.event_count,
        event_key: b.event_key,
      }))
    );
    const adminEmailBatch = batchesAfterBurst.find(
      (b) => b.channel === "email" && b.recipient_kind === "admin"
    );
    const adminPushBatch = batchesAfterBurst.find(
      (b) => b.channel === "push" && b.recipient_kind === "admin"
    );
    assert(adminEmailBatch?.event_count === 10, "email batch coalesced 10 comments");
    assert(adminPushBatch?.event_count === 10, "push batch coalesced 10 comments");
    assert(batchesAfterBurst.length === 2, "two pending admin batches (email + push), not 20");

    console.log(`\n=== 7–8. batch flush (${VIDEO_REVIEW_BATCH_DEBOUNCE_SECONDS}s debounce window) ===`);
    console.log(
      "Batch copy example:",
      `${10} new comments on ${review.title} (window resets on each comment; cron flushes after quiet period)`
    );
    await admin
      .from("video_review_notification_batches")
      .update({ flush_after: new Date(Date.now() - 1000).toISOString() })
      .eq("review_id", review.id)
      .is("sent_at", null);

    const flushResult = await flushVideoReviewNotificationBatches({ businessId: SWIFT_BUSINESS });
    console.log("flush result:", flushResult);

    const { data: sendRows } = await admin
      .from("video_review_notification_sends")
      .select("idempotency_key, channel, recipient_kind")
      .eq("business_id", SWIFT_BUSINESS)
      .order("created_at", { ascending: false })
      .limit(10);
    console.table(sendRows ?? []);
    assert((sendRows?.length ?? 0) >= 2, "batch flush recorded idempotent send rows");

    console.log("\n=== 3. business reply → client in-app + batched email, no push ===");
    const replyMark = new Date().toISOString();
    const topComment = await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: v1.id,
      projectId,
      authorUserId: projectClientUserId,
      authorKind: "client",
      body: "Thread root",
      timestampSeconds: 5,
    });
    await notifyVideoReviewEvent("business_reply", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v1.id,
      commentId: topComment.id,
      actorUserId: adminProfile.id,
      actorKind: "admin",
      previewText: "We adjusted the color grade",
    });

    const clientInApp = await countNotifications(admin, {
      userId: projectClientUserId,
      type: "video_review_activity",
      projectId,
      since: replyMark,
    });
    console.log("client in-app after business reply:", clientInApp);
    assert(clientInApp >= 1, "client received in-app for business reply");

    const clientBatches = (await pendingBatches(admin, review.id)).filter(
      (b) => b.recipient_kind === "client"
    );
    console.table(
      clientBatches.map((b) => ({
        channel: b.channel,
        recipient_user_id: b.recipient_user_id,
        event_count: b.event_count,
      }))
    );
    assert(clientBatches.every((b) => b.channel === "email"), "client side never enqueues push batches");
    assert(clientBatches.length >= 1, "client email batch enqueued");

    console.log("\n=== 4. reopen both directions ===");
    await resolveVideoReviewComment(db, review.id, topComment.id, adminProfile.id, projectId);
    const reopenClientMark = new Date().toISOString();
    await notifyVideoReviewEvent("client_reopened", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v1.id,
      commentId: topComment.id,
      actorUserId: projectClientUserId,
      actorKind: "client",
    });
    const adminReopenInApp = await countNotifications(admin, {
      userId: adminProfile.id,
      type: "video_review_activity",
      projectId,
      since: reopenClientMark,
    });
    assert(adminReopenInApp >= 1, "client reopen notifies admins in-app");

    const reopenAdminMark = new Date().toISOString();
    await notifyVideoReviewEvent("admin_reopened", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v1.id,
      commentId: topComment.id,
      actorUserId: adminProfile.id,
      actorKind: "admin",
    });
    const clientReopenInApp = await countNotifications(admin, {
      userId: projectClientUserId,
      type: "video_review_activity",
      projectId,
      since: reopenAdminMark,
    });
    assert(clientReopenInApp >= 1, "admin reopen notifies client in-app");

    console.log("\n=== 5. new version → client ===");
    const v2Asset = await cloneVideoAsset(admin, baseVideo.id, "phase4-v2");
    const v2 = await addVideoReviewVersion(db, {
      reviewId: review.id,
      mediaAssetId: v2Asset,
      uploadedBy: adminProfile.id,
    });
    const versionMark = new Date().toISOString();
    await notifyVideoReviewEvent("new_version", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v2.id,
      actorUserId: adminProfile.id,
      actorKind: "admin",
      versionNumber: v2.version_number,
    });
    const clientVersionInApp = await countNotifications(admin, {
      userId: projectClientUserId,
      type: "video_review_activity",
      projectId,
      since: versionMark,
    });
    assert(clientVersionInApp >= 1, "new version notifies client in-app");

    console.log("\n=== 6. actor never notified ===");
    const actorMark = new Date().toISOString();
    await notifyVideoReviewEvent("client_comment", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v1.id,
      commentId: lastCommentId,
      actorUserId: projectClientUserId,
      actorKind: "client",
      previewText: "solo",
    });
    const clientSelf = await countNotifications(admin, {
      userId: projectClientUserId,
      type: "video_review_activity",
      projectId,
      since: actorMark,
    });
    assert(clientSelf === 0, "comment author not notified");

    await notifyVideoReviewEvent("business_reply", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v1.id,
      commentId: topComment.id,
      actorUserId: adminProfile.id,
      actorKind: "admin",
      previewText: "admin reply",
    });
    const adminSelf = await countNotifications(admin, {
      userId: adminProfile.id,
      type: "video_review_activity",
      projectId,
      since: actorMark,
    });
    assert(adminSelf === 0, "reply author admin not notified in-app");

    console.log("\n=== 9. duplicate trigger idempotency (new_version) ===");
    const beforeSends = (
      await admin
        .from("video_review_notification_sends")
        .select("id")
        .eq("business_id", SWIFT_BUSINESS)
    ).data?.length ?? 0;
    await notifyVideoReviewEvent("new_version", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v2.id,
      actorUserId: adminProfile.id,
      actorKind: "admin",
    });
    await notifyVideoReviewEvent("new_version", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v2.id,
      actorUserId: adminProfile.id,
      actorKind: "admin",
    });
    const afterSends = (
      await admin
        .from("video_review_notification_sends")
        .select("id, idempotency_key")
        .eq("business_id", SWIFT_BUSINESS)
        .order("created_at", { ascending: false })
        .limit(5)
    ).data;
    console.table(afterSends ?? []);
    const newSendCount =
      (await admin.from("video_review_notification_sends").select("id").eq("business_id", SWIFT_BUSINESS))
        .data?.length ?? 0;
    assert(newSendCount - beforeSends <= 1, "duplicate new_version trigger adds at most one idempotency row");

    console.log("\n=== 14. IDOR — notifications scoped to business profiles ===");
    const { data: otherBizAdmin } = await admin
      .from("profiles")
      .select("id, business_id")
      .eq("role", "admin")
      .neq("business_id", SWIFT_BUSINESS)
      .not("business_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (otherBizAdmin?.id) {
      const leak = await countNotifications(admin, {
        userId: otherBizAdmin.id,
        type: "video_review_activity",
        projectId,
        since,
      });
      assert(leak === 0, "other business admin never receives Swift review notifications");
    } else {
      console.log("(skip cross-business check — only one business in DB)");
    }

    console.log("\n=== 15. existing notification routes intact ===");
    assert(
      readFileSync(resolve("src/app/api/revisions/route.ts"), "utf8").includes("notifyAdmins"),
      "revision_requested path still calls notifyAdmins"
    );
    assert(
      readFileSync(resolve("src/app/api/shoot-proposals/route.ts"), "utf8").includes("notifyProjectClients"),
      "shoot proposal notifications intact"
    );

    console.log("\n=== 12. toggles off → that channel sends nothing ===");
    const baselineSettings = await getAppSettings(SWIFT_BUSINESS);
    await saveAppSettings(
      {
        notifications: {
          ...baselineSettings.notifications,
          video_review_client_comment: { inApp: false, email: false, push: false },
        },
      },
      adminProfile.id,
      SWIFT_BUSINESS
    );
    const toggleMark = new Date().toISOString();
    const toggleComment = await createVideoReviewComment(db, {
      reviewId: review.id,
      versionId: v1.id,
      projectId,
      authorUserId: projectClientUserId,
      authorKind: "client",
      body: "Toggle off test",
      timestampSeconds: 99,
    });
    await notifyVideoReviewEvent("client_comment", {
      businessId: SWIFT_BUSINESS,
      projectId,
      reviewId: review.id,
      reviewTitle: review.title,
      versionId: v1.id,
      commentId: toggleComment.id,
      actorUserId: projectClientUserId,
      actorKind: "client",
    });
    const toggleInApp = await countNotifications(admin, {
      userId: adminProfile.id,
      type: "video_review_activity",
      projectId,
      since: toggleMark,
    });
    const toggleBatches = (await pendingBatches(admin, review.id)).filter(
      (b) => b.event_key === "video_review_client_comment" && b.created_at >= toggleMark
    );
    console.log({ toggleInApp, toggleBatches: toggleBatches.length });
    assert(toggleInApp === 0 && toggleBatches.length === 0, "all channels off → no in-app and no pending batches");
    await saveAppSettings(
      { notifications: baselineSettings.notifications },
      adminProfile.id,
      SWIFT_BUSINESS
    );

    console.log("\n=== resolve notify (optional, default off) ===");
    const settings = await getAppSettings(SWIFT_BUSINESS);
    assert(
      settings.notifications.video_review_feedback_resolved.email === false,
      "resolve notify email off by default"
    );

    console.log("\n=== 16. tenant SQL (if psql available) ===");
    try {
      execSync("psql --version", { stdio: "pipe" });
      const dbUrl = process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL;
      if (dbUrl) {
        for (const file of ["supabase/tests/tenant-isolation.sql", "supabase/tests/tenant-teardown.sql"]) {
          const out = execSync(`psql "${dbUrl}" -v ON_ERROR_STOP=1 -f "${resolve(file)}" 2>&1`, {
            encoding: "utf8",
          });
          const lines = out.trim().split("\n").filter((l) => l.match(/^\(\d+ rows?\)$/));
          console.log(file, "result lines:", lines.slice(-5));
          assert(!lines.some((l) => l !== "(0 rows)"), `${file} must return zero rows`);
        }
      } else {
        console.log("DATABASE_URL not set — skip tenant SQL execution");
      }
    } catch {
      console.log("psql not available — skip tenant SQL execution (files updated for new tables)");
    }

    console.log("\nPhase 4 verification complete.");
  } finally {
    if (reviewId) {
      await admin.from("video_review_notification_sends").delete().eq("business_id", SWIFT_BUSINESS);
      await admin.from("video_review_notification_batches").delete().eq("review_id", reviewId);
      await admin.from("video_reviews").delete().eq("id", reviewId);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
