import { createServiceClient } from "@/lib/supabase/server";
import { sendBrandedEmail } from "@/lib/email";
import type { NotificationType } from "@/lib/types";

/** Payment-related emails always send even if the client opted out of marketing-style emails. */
const CRITICAL_CLIENT_EMAIL_TYPES = new Set<NotificationType>([
  "invoice_available",
  "payment_confirmed",
]);

export interface ClientEmailNotificationOptions {
  userId: string;
  clientId?: string | null;
  email: string;
  title: string;
  message: string;
  url?: string;
  eventType: NotificationType;
}

export interface ClientEmailPresentation {
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
  ctaUrl?: string;
}

function resolvePortalUrl(path?: string): string | undefined {
  if (!path) return undefined;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(
    /\/$/,
    ""
  );
  return path.startsWith("http") ? path : `${appUrl}${path}`;
}

export function getClientEmailPresentation(
  eventType: NotificationType,
  title: string,
  message: string,
  url?: string
): ClientEmailPresentation {
  const ctaUrl = resolvePortalUrl(url);
  const defaults: Partial<
    Record<NotificationType, { subject: string; title: string; body: string; ctaLabel: string }>
  > = {
    quote_sent: {
      subject: "Your proposal is ready to review",
      title: "Your proposal is ready to review",
      body:
        message ||
        "Swift Aerial Media prepared a proposal for your project. Review the details and approve it inside Swift Portal.",
      ctaLabel: "Review in Swift Portal",
    },
    shoot_proposed: {
      subject: "Your shoot time is ready to review",
      title: "Your shoot time is ready to review",
      body:
        message ||
        "Swift Aerial Media proposed a shoot time for your project. Review the proposed date and confirm or request another time inside Swift Portal.",
      ctaLabel: "Review in Swift Portal",
    },
    schedule_change_requested: {
      subject: "Update on your shoot schedule",
      title: "Update on your shoot schedule",
      body: message,
      ctaLabel: "Review in Swift Portal",
    },
    status_changed: {
      subject: title,
      title,
      body: message,
      ctaLabel: "Open Swift Portal",
    },
    deliverables_uploaded: {
      subject: "Your deliverables are ready to review",
      title: "Your deliverables are ready to review",
      body:
        message ||
        "New media has been added to your project. Review your deliverables inside Swift Portal.",
      ctaLabel: "Review in Swift Portal",
    },
    revision_requested: {
      subject: title,
      title,
      body: message,
      ctaLabel: "Open Swift Portal",
    },
    invoice_available: {
      subject: "Your payment link is ready",
      title: "Complete your payment",
      body: message,
      ctaLabel: "Pay in Swift Portal",
    },
    payment_confirmed: {
      subject: "Payment received — your downloads are ready",
      title: "Project complete",
      body:
        message ||
        "Payment confirmed. Your final deliverables are now available to download in Swift Portal.",
      ctaLabel: "Open Swift Portal",
    },
  };

  const preset = defaults[eventType];
  if (preset) {
    return { ...preset, ctaUrl };
  }

  return {
    subject: title,
    title,
    body: message,
    ctaLabel: ctaUrl ? "Open Swift Portal" : "Review in Swift Portal",
    ctaUrl,
  };
}

export async function getClientNotificationPreferences(userId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("email_notifications_enabled, in_app_notifications_enabled, role")
    .eq("id", userId)
    .single();

  if (error || !data || data.role !== "client") {
    return {
      email_notifications_enabled: true,
      in_app_notifications_enabled: true,
    };
  }

  return {
    email_notifications_enabled: data.email_notifications_enabled ?? true,
    in_app_notifications_enabled: data.in_app_notifications_enabled ?? true,
  };
}

/**
 * Send a branded client email via Resend. Never throws.
 */
export async function sendClientEmailNotification(
  options: ClientEmailNotificationOptions
): Promise<{ sent: boolean; reason?: string }> {
  if (!options.email) {
    return { sent: false, reason: "no_email" };
  }

  const isCritical = CRITICAL_CLIENT_EMAIL_TYPES.has(options.eventType);

  if (!isCritical) {
    const prefs = await getClientNotificationPreferences(options.userId);
    if (!prefs.email_notifications_enabled) {
      console.info("[email] skipped — client opted out:", options.eventType, options.userId);
      return { sent: false, reason: "opted_out" };
    }
  }

  const presentation = getClientEmailPresentation(
    options.eventType,
    options.title,
    options.message,
    options.url
  );

  try {
    const sent = await sendBrandedEmail({
      to: options.email,
      subject: presentation.subject,
      title: presentation.title,
      body: presentation.body,
      ctaLabel: presentation.ctaUrl ? presentation.ctaLabel : undefined,
      ctaUrl: presentation.ctaUrl,
    });

    if (sent) {
      console.info("[email] client notification sent:", options.eventType, "→", options.email);
      return { sent: true };
    }

    return { sent: false, reason: "send_failed" };
  } catch (error) {
    console.error("[email] client notification error:", options.eventType, error);
    return { sent: false, reason: "error" };
  }
}
