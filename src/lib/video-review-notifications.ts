import { createTenantServiceClient, type TenantServiceClient } from "@/lib/supabase/tenant-service";
import type { NotificationEventKey } from "@/lib/app-settings";
import { getAppSettings } from "@/lib/app-settings";
import { ensureClientPortalAccessForEmail } from "@/lib/client-portal-link";
import { logCommunication } from "@/lib/communication-records";
import { sendBrandedEmail } from "@/lib/email";
import { idempotencyKey } from "@/lib/idempotency";
import { notifyAdmins, notifyProjectClients } from "@/lib/notifications";
import { sendAdminPushNotification } from "@/lib/onesignal-push";
import { businessPortalHref, joinPortalPath } from "@/lib/portal-url";
import { sendClientEmailNotification } from "@/lib/client-email-notifications";
import { isLiveBusiness } from "@/lib/business-live";
import type { NotificationType } from "@/lib/types";

/** Debounce window for batched email/push (seconds). Resets on each new comment in the batch. */
export const VIDEO_REVIEW_BATCH_DEBOUNCE_SECONDS = 30;

export type VideoReviewNotifyTrigger =
  | "client_comment"
  | "business_reply"
  | "client_reopened"
  | "admin_reopened"
  | "new_version"
  | "admin_resolved";

const TRIGGER_EVENT: Record<
  VideoReviewNotifyTrigger,
  { eventKey: NotificationEventKey; type: NotificationType }
> = {
  client_comment: { eventKey: "video_review_client_comment", type: "video_review_activity" },
  business_reply: { eventKey: "video_review_business_reply", type: "video_review_activity" },
  client_reopened: { eventKey: "video_review_reopened", type: "video_review_activity" },
  admin_reopened: { eventKey: "video_review_reopened", type: "video_review_activity" },
  new_version: { eventKey: "video_review_new_version", type: "video_review_activity" },
  admin_resolved: { eventKey: "video_review_feedback_resolved", type: "video_review_activity" },
};

export interface VideoReviewNotifyContext {
  businessId: string;
  projectId: string;
  reviewId: string;
  reviewTitle: string;
  versionId: string;
  commentId?: string | null;
  actorUserId: string;
  actorKind: "client" | "admin";
  previewText?: string;
  versionNumber?: number;
}

export function videoReviewReviewPath(
  role: "admin" | "client",
  projectId: string,
  reviewId: string,
  versionId: string,
  commentId?: string | null
): string {
  const base =
    role === "admin"
      ? `/admin/projects/${projectId}/reviews/${reviewId}`
      : `/dashboard/projects/${projectId}/reviews/${reviewId}`;
  const params = new URLSearchParams();
  params.set("version", versionId);
  if (commentId) params.set("comment", commentId);
  return `${base}?${params.toString()}`;
}

export async function videoReviewAbsoluteLink(
  businessId: string,
  relativePath: string
): Promise<string> {
  return businessPortalHref(businessId, relativePath);
}

function batchCopy(eventCount: number, reviewTitle: string, kind: "comment" | "reply" | "reopened" | "version") {
  if (kind === "version") {
    return {
      title: `New video version ready — ${reviewTitle}`,
      body: "A new version of your video review is ready to watch.",
    };
  }
  if (kind === "reopened") {
    return {
      title: eventCount > 1 ? `${eventCount} notes reopened — ${reviewTitle}` : `Feedback reopened — ${reviewTitle}`,
      body:
        eventCount > 1
          ? `${eventCount} video review notes were reopened and need your attention.`
          : "A video review note was reopened and needs your attention.",
    };
  }
  const noun = kind === "reply" ? "reply" : "comment";
  const plural = eventCount > 1 ? `${eventCount} new ${noun}s` : `New ${noun}`;
  return {
    title: `${plural} on ${reviewTitle}`,
    body:
      eventCount > 1
        ? `${eventCount} new items were added to the video review.`
        : kind === "reply"
          ? "The business replied on your video review."
          : "New feedback was added to the video review.",
  };
}

async function claimImmediateSend(
  db: TenantServiceClient,
  key: string,
  channel: string,
  recipientKind: string
): Promise<boolean> {
  const { error } = await db.from("video_review_notification_sends").insert({
    idempotency_key: key,
    channel,
    recipient_kind: recipientKind,
  });
  if (error?.code === "23505") return false;
  if (error) {
    console.warn("[video-review-notify] idempotency insert failed:", error.message);
    return true;
  }
  return true;
}

async function listProjectClientUserIds(
  db: TenantServiceClient,
  projectId: string
): Promise<string[]> {
  const { data: project } = await db.from("projects").select("client_id").eq("id", projectId).maybeSingle();
  const clientIds = new Set<string>();
  if (project?.client_id) clientIds.add(project.client_id as string);
  const { data: junction } = await db.from("project_clients").select("client_id").eq("project_id", projectId);
  for (const row of junction ?? []) clientIds.add(row.client_id as string);
  if (!clientIds.size) return [];
  const { data: clients } = await db
    .from("clients")
    .select("user_id")
    .in("id", Array.from(clientIds));
  return (clients ?? []).map((c) => c.user_id).filter(Boolean) as string[];
}

async function enqueueBatch(
  db: TenantServiceClient,
  params: {
    businessId: string;
    reviewId: string;
    projectId: string;
    versionId: string;
    commentId?: string | null;
    eventKey: NotificationEventKey;
    recipientKind: "admin" | "client";
    recipientUserId: string | null;
    channel: "email" | "push";
    actorUserId: string;
    reviewTitle: string;
    projectName: string | null;
  }
): Promise<void> {
  const flushAfter = new Date(Date.now() + VIDEO_REVIEW_BATCH_DEBOUNCE_SECONDS * 1000).toISOString();

  let pendingQuery = db
    .from("video_review_notification_batches")
    .select("id, event_count")
    .eq("review_id", params.reviewId)
    .eq("event_key", params.eventKey)
    .eq("recipient_kind", params.recipientKind)
    .eq("channel", params.channel)
    .is("sent_at", null);

  pendingQuery = params.recipientUserId
    ? pendingQuery.eq("recipient_user_id", params.recipientUserId)
    : pendingQuery.is("recipient_user_id", null);

  const { data: existing } = await pendingQuery.maybeSingle();

  if (existing?.id) {
    await db
      .from("video_review_notification_batches")
      .update({
        event_count: (existing.event_count as number) + 1,
        flush_after: flushAfter,
        version_id: params.versionId,
        comment_id: params.commentId ?? null,
        actor_user_id: params.actorUserId,
      })
      .eq("id", existing.id);
    return;
  }

  const { error } = await db.from("video_review_notification_batches").insert({
    review_id: params.reviewId,
    project_id: params.projectId,
    version_id: params.versionId,
    comment_id: params.commentId ?? null,
    event_key: params.eventKey,
    recipient_kind: params.recipientKind,
    recipient_user_id: params.recipientUserId,
    channel: params.channel,
    event_count: 1,
    review_title: params.reviewTitle,
    project_name: params.projectName,
    actor_user_id: params.actorUserId,
    flush_after: flushAfter,
  });

  if (error?.code === "23505") {
    let retryQuery = db
      .from("video_review_notification_batches")
      .select("id, event_count")
      .eq("review_id", params.reviewId)
      .eq("event_key", params.eventKey)
      .eq("recipient_kind", params.recipientKind)
      .eq("channel", params.channel)
      .is("sent_at", null);
    retryQuery = params.recipientUserId
      ? retryQuery.eq("recipient_user_id", params.recipientUserId)
      : retryQuery.is("recipient_user_id", null);
    const { data: row } = await retryQuery.maybeSingle();
    if (row?.id) {
      await db
        .from("video_review_notification_batches")
        .update({
          event_count: (row.event_count as number) + 1,
          flush_after: flushAfter,
          version_id: params.versionId,
          comment_id: params.commentId ?? null,
        })
        .eq("id", row.id);
    }
    return;
  }

  if (error) {
    console.error("[video-review-notify] batch enqueue failed:", error.message);
  }
}

async function loadProjectName(db: TenantServiceClient, projectId: string): Promise<string | null> {
  const { data } = await db.from("projects").select("project_name").eq("id", projectId).maybeSingle();
  return (data?.project_name as string | undefined) ?? null;
}

export async function notifyVideoReviewEvent(
  trigger: VideoReviewNotifyTrigger,
  ctx: VideoReviewNotifyContext
): Promise<void> {
  if (!(await isLiveBusiness(ctx.businessId))) return;

  const { eventKey, type } = TRIGGER_EVENT[trigger];
  const appSettings = await getAppSettings(ctx.businessId);
  const channels = appSettings.notifications[eventKey];
  if (!channels && trigger !== "admin_resolved") return;

  if (trigger === "admin_resolved") {
    const resolved = appSettings.notifications.video_review_feedback_resolved;
    if (resolved?.inApp === false && resolved?.email === false) return;
  }

  const db = await createTenantServiceClient(ctx.businessId);
  const projectName = await loadProjectName(db, ctx.projectId);

  const notifyAdminsSide =
    trigger === "client_comment" || trigger === "client_reopened";
  const notifyClientsSide =
    trigger === "business_reply" ||
    trigger === "admin_reopened" ||
    trigger === "new_version" ||
    trigger === "admin_resolved";

  const adminPath = videoReviewReviewPath(
    "admin",
    ctx.projectId,
    ctx.reviewId,
    ctx.versionId,
    ctx.commentId
  );
  const clientPath = videoReviewReviewPath(
    "client",
    ctx.projectId,
    ctx.reviewId,
    ctx.versionId,
    ctx.commentId
  );

  const copyKind =
    trigger === "new_version"
      ? "version"
      : trigger === "client_reopened" || trigger === "admin_reopened"
        ? "reopened"
        : trigger === "business_reply"
          ? "reply"
          : "comment";

  const copy = batchCopy(1, ctx.reviewTitle, copyKind);
  const inAppTitle = copy.title;
  const inAppBody = ctx.previewText?.slice(0, 280) || copy.body;

  if (notifyAdminsSide) {
    if (channels.inApp !== false) {
      await notifyAdmins({
        businessId: ctx.businessId,
        projectId: ctx.projectId,
        type,
        eventKey,
        title: inAppTitle,
        body: inAppBody,
        link: adminPath,
        sendEmail: false,
        sendPush: false,
        excludeUserIds: [ctx.actorUserId],
      });
    }

    if (trigger === "client_reopened") {
      const baseKey = idempotencyKey(
        "vr-immediate",
        trigger,
        ctx.reviewId,
        ctx.versionId,
        ctx.commentId ?? "none"
      );
      if (channels.email !== false) {
        const claimed = await claimImmediateSend(db, `${baseKey}:admin-email`, "email", "admin");
        if (claimed) {
          await notifyAdmins({
            businessId: ctx.businessId,
            projectId: ctx.projectId,
            type,
            eventKey,
            title: inAppTitle,
            body: inAppBody,
            link: adminPath,
            sendEmail: true,
            sendPush: false,
            excludeUserIds: [ctx.actorUserId],
          });
        }
      }
      if (channels.push !== false) {
        const claimed = await claimImmediateSend(db, `${baseKey}:admin-push`, "push", "admin");
        if (claimed) {
          await notifyAdmins({
            businessId: ctx.businessId,
            projectId: ctx.projectId,
            type,
            eventKey,
            title: inAppTitle,
            body: inAppBody,
            link: adminPath,
            sendEmail: false,
            sendPush: true,
            excludeUserIds: [ctx.actorUserId],
          });
        }
      }
    } else if (trigger === "client_comment") {
      if (channels.email !== false) {
        await enqueueBatch(db, {
          businessId: ctx.businessId,
          reviewId: ctx.reviewId,
          projectId: ctx.projectId,
          versionId: ctx.versionId,
          commentId: ctx.commentId,
          eventKey,
          recipientKind: "admin",
          recipientUserId: null,
          channel: "email",
          actorUserId: ctx.actorUserId,
          reviewTitle: ctx.reviewTitle,
          projectName,
        });
      }

      if (channels.push !== false) {
        await enqueueBatch(db, {
          businessId: ctx.businessId,
          reviewId: ctx.reviewId,
          projectId: ctx.projectId,
          versionId: ctx.versionId,
          commentId: ctx.commentId,
          eventKey,
          recipientKind: "admin",
          recipientUserId: null,
          channel: "push",
          actorUserId: ctx.actorUserId,
          reviewTitle: ctx.reviewTitle,
          projectName,
        });
      }
    }
  }

  if (notifyClientsSide) {
    const clientChannels =
      trigger === "admin_resolved"
        ? appSettings.notifications.video_review_feedback_resolved
        : channels;

    if (clientChannels.inApp !== false) {
      await notifyProjectClients({
        businessId: ctx.businessId,
        projectId: ctx.projectId,
        type,
        eventKey: trigger === "admin_resolved" ? "video_review_feedback_resolved" : eventKey,
        title: inAppTitle,
        body: inAppBody,
        link: clientPath,
        sendEmail: false,
        excludeUserIds: [ctx.actorUserId],
      });
    }

    if (clientChannels.email !== false) {
      if (trigger === "new_version" || trigger === "admin_reopened" || trigger === "admin_resolved") {
        const immediateKey = idempotencyKey(
          "vr-immediate",
          trigger,
          ctx.reviewId,
          ctx.versionId,
          ctx.commentId ?? "none"
        );
        const claimed = await claimImmediateSend(db, immediateKey, "email", "client");
        if (claimed) {
          await notifyProjectClients({
            businessId: ctx.businessId,
            projectId: ctx.projectId,
            type,
            eventKey: trigger === "admin_resolved" ? "video_review_feedback_resolved" : eventKey,
            title: inAppTitle,
            body: inAppBody,
            link: clientPath,
            sendEmail: true,
            excludeUserIds: [ctx.actorUserId],
          });
        }
      } else {
        const userIds = await listProjectClientUserIds(db, ctx.projectId);
        for (const userId of userIds) {
          if (userId === ctx.actorUserId) continue;
          await enqueueBatch(db, {
            businessId: ctx.businessId,
            reviewId: ctx.reviewId,
            projectId: ctx.projectId,
            versionId: ctx.versionId,
            commentId: ctx.commentId,
            eventKey,
            recipientKind: "client",
            recipientUserId: userId,
            channel: "email",
            actorUserId: ctx.actorUserId,
            reviewTitle: ctx.reviewTitle,
            projectName,
          });
        }
      }
    }
  }
}

export async function flushVideoReviewNotificationBatches(options: {
  businessId?: string;
  businessIds?: string[];
  dryRun?: boolean;
}): Promise<{ flushed: number; errors: number }> {
  let businessIds: string[] = [];
  if (options.businessId) {
    businessIds = [options.businessId];
  } else if (options.businessIds?.length) {
    businessIds = options.businessIds;
  }

  if (!businessIds.length) {
    return { flushed: 0, errors: 0 };
  }

  let flushed = 0;
  let errors = 0;
  const now = new Date().toISOString();

  for (const businessId of businessIds) {
    if (!(await isLiveBusiness(businessId))) continue;
    const db = await createTenantServiceClient(businessId);
    const appSettings = await getAppSettings(businessId);

    const { data: batches, error } = await db
      .from("video_review_notification_batches")
      .select("*")
      .is("sent_at", null)
      .lte("flush_after", now);

    if (error || !batches?.length) continue;

    for (const batch of batches) {
      const eventKey = batch.event_key as NotificationEventKey;
      const channelSettings = appSettings.notifications[eventKey];
      if (!channelSettings) continue;

      if (batch.channel === "email" && channelSettings.email === false) {
        if (!options.dryRun) {
          await db.from("video_review_notification_batches").update({ sent_at: now }).eq("id", batch.id);
        }
        flushed++;
        continue;
      }
      if (batch.channel === "push" && channelSettings.push === false) {
        if (!options.dryRun) {
          await db.from("video_review_notification_batches").update({ sent_at: now }).eq("id", batch.id);
        }
        flushed++;
        continue;
      }

      const sendKey = idempotencyKey("vr-batch-send", batch.id);
      if (!options.dryRun) {
        const claimed = await claimImmediateSend(
          db,
          sendKey,
          batch.channel as string,
          batch.recipient_kind as string
        );
        if (!claimed) {
          await db.from("video_review_notification_batches").update({ sent_at: now }).eq("id", batch.id);
          flushed++;
          continue;
        }

        const { data: locked } = await db
          .from("video_review_notification_batches")
          .update({ sent_at: now })
          .eq("id", batch.id)
          .is("sent_at", null)
          .select("*")
          .maybeSingle();

        if (!locked) continue;
      }

      const copyKind =
        batch.event_key === "video_review_business_reply"
          ? "reply"
          : batch.event_key === "video_review_reopened"
            ? "reopened"
            : "comment";
      const copy = batchCopy(batch.event_count as number, batch.review_title as string, copyKind);

      const role = batch.recipient_kind === "admin" ? "admin" : "client";
      const path = videoReviewReviewPath(
        role,
        batch.project_id as string,
        batch.review_id as string,
        batch.version_id as string,
        batch.comment_id as string | null
      );

      try {
        if (options.dryRun) {
          flushed++;
          continue;
        }

        if (batch.channel === "push") {
          const pushUrl = await videoReviewAbsoluteLink(businessId, path);
          await sendAdminPushNotification({
            businessId,
            title: copy.title,
            message: copy.body,
            url: pushUrl,
            projectId: batch.project_id as string,
            eventType: "video_review_activity",
          });
          await logCommunication({
            businessId,
            commType: "push",
            status: "sent",
            provider: "onesignal",
            title: copy.title,
            message: copy.body,
            projectId: batch.project_id as string,
            metadata: { batchId: batch.id, eventKey },
          });
        } else if (batch.recipient_kind === "admin") {
          const link = await videoReviewAbsoluteLink(businessId, path);
          const { data: admins } = await db.raw
            .from("profiles")
            .select("id, email, full_name")
            .eq("role", "admin")
            .eq("business_id", businessId);

          for (const admin of admins ?? []) {
            if (admin.id === batch.actor_user_id) continue;
            if (!admin.email) continue;
            await sendBrandedEmail({
              businessId,
              to: admin.email,
              subject: copy.title,
              title: copy.title,
              body: copy.body,
              projectName: batch.project_name as string | undefined,
              ctaLabel: "Open video review",
              ctaUrl: link,
              emailType: "video_review_activity",
              analytics: { projectId: batch.project_id as string, emailType: "video_review_activity" },
            });
          }
        } else if (batch.recipient_user_id) {
          const { data: profile } = await db.raw
            .from("profiles")
            .select("id, email, client_id")
            .eq("id", batch.recipient_user_id)
            .maybeSingle();

          if (profile?.email && profile.client_id) {
            const access = await ensureClientPortalAccessForEmail(
              profile.client_id as string,
              businessId,
              path
            );
            await sendClientEmailNotification({
              businessId,
              userId: profile.id as string,
              clientId: profile.client_id as string,
              email: profile.email as string,
              title: copy.title,
              message: copy.body,
              url: path,
              eventType: "video_review_activity",
              eventKey,
              projectId: batch.project_id as string,
              projectName: batch.project_name as string | undefined,
            });
            if (access.ctaUrl) {
              await logCommunication({
                businessId,
                commType: "email",
                status: "sent",
                provider: "resend",
                title: copy.title,
                message: copy.body,
                projectId: batch.project_id as string,
                userId: profile.id as string,
                clientId: profile.client_id as string,
                metadata: { batchId: batch.id, ctaUrl: access.ctaUrl, recipient: profile.email },
              });
            }
          }
        }

        flushed++;
      } catch (err) {
        errors++;
        console.error("[video-review-notify] flush batch failed:", batch.id, err);
      }
    }
  }

  return { flushed, errors };
}
