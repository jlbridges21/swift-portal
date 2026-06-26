import { NextResponse } from "next/server";
import { Resend } from "resend";
import { mapResendWebhookType, recordEmailEvent } from "@/lib/email-analytics";
import { getClientEmailPresentation } from "@/lib/client-email-notifications";
import type { NotificationType } from "@/lib/types";

interface ResendWebhookPayload {
  type: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    to?: string[];
    subject?: string;
    tags?: Record<string, string>;
    click?: { link?: string };
    bounce?: { message?: string };
  };
}

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

    let payload: ResendWebhookPayload;

    if (webhookSecret) {
      const resend = new Resend(process.env.RESEND_API_KEY);
      try {
        payload = resend.webhooks.verify({
          payload: rawBody,
          webhookSecret,
          headers: {
            id: request.headers.get("svix-id") ?? request.headers.get("webhook-id") ?? "",
            timestamp:
              request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp") ?? "",
            signature:
              request.headers.get("svix-signature") ?? request.headers.get("webhook-signature") ?? "",
          },
        }) as ResendWebhookPayload;
      } catch (verifyError) {
        console.error("[resend-webhook] signature verification failed:", verifyError);
        return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
      }
    } else {
      console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not set — accepting unsigned payload");
      payload = JSON.parse(rawBody) as ResendWebhookPayload;
    }

    const eventType = mapResendWebhookType(payload.type);
    if (!eventType) {
      return NextResponse.json({ received: true, ignored: payload.type });
    }

    const data = payload.data;
    const tags = data?.tags ?? {};
    const projectId = tags.project_id ?? null;
    const notificationId = tags.notification_id ?? null;
    const emailType = tags.email_type ?? "general";
    const recipient = data?.to?.[0] ?? "unknown";
    const occurredAt = payload.created_at ?? data?.created_at ?? new Date().toISOString();

    let ctaLabel: string | undefined;
    if (emailType && emailType !== "general") {
      try {
        const presentation = getClientEmailPresentation(
          emailType as NotificationType,
          data?.subject ?? "",
          "",
          undefined
        );
        ctaLabel = presentation.ctaLabel;
      } catch {
        ctaLabel = "portal link";
      }
    }

    if (eventType === "sent") {
      return NextResponse.json({ received: true, skipped: "sent_recorded_on_dispatch" });
    }

    await recordEmailEvent({
      resendEmailId: data?.email_id,
      projectId,
      notificationId,
      recipient,
      emailType,
      eventType,
      occurredAt,
      metadata: {
        subject: data?.subject,
        clickLink: data?.click?.link,
        bounceMessage: data?.bounce?.message,
        ctaLabel: eventType === "clicked" ? ctaLabel : undefined,
        webhookType: payload.type,
      },
      ctaLabel: eventType === "clicked" ? ctaLabel : undefined,
    });

    return NextResponse.json({ received: true, eventType });
  } catch (error) {
    console.error("[resend-webhook] handler error:", error);
    return NextResponse.json({ received: true, error: "processed_with_errors" });
  }
}
