import { createServiceClient } from "@/lib/supabase/server";
import { sendBrandedEmail } from "@/lib/email";
import { getAppSettings } from "@/lib/app-settings";
import type { PremiumEmailContent } from "@/lib/email-templates";
import { getStatusOrder } from "@/lib/constants";
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
  projectId?: string | null;
  projectName?: string;
  projectStatus?: string;
  notificationId?: string | null;
}

export interface ClientEmailNotificationResult {
  sent: boolean;
  reason?: string;
  error?: string;
  messageId?: string;
}

function resolvePortalUrl(path?: string): string | undefined {
  if (!path) return undefined;
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com").replace(
    /\/$/,
    ""
  );
  return path.startsWith("http") ? path : `${appUrl}${path}`;
}

function resolveTemplate(
  eventType: NotificationType,
  title: string,
  message: string
): PremiumEmailContent["template"] {
  if (eventType === "quote_sent") return "proposal_ready";
  if (eventType === "proposal_changes") return "proposal_updated";
  if (eventType === "shoot_proposed" || eventType === "schedule_change_requested") return "shoot_proposed";
  if (eventType === "deliverables_uploaded") return "deliverables_ready";
  if (eventType === "revision_requested") return "revision_response";
  if (eventType === "invoice_available") return "payment_requested";
  if (eventType === "payment_confirmed") return "payment_received";

  if (eventType === "status_changed") {
    const lower = `${title} ${message}`.toLowerCase();
    if (lower.includes("shoot scheduled") || lower.includes("shoot confirmed")) return "shoot_confirmed";
    if (lower.includes("complete") || lower.includes("delivered")) return "project_complete";
    if (lower.includes("deliverable") || lower.includes("review")) return "deliverables_ready";
    if (lower.includes("payment")) return "payment_requested";
  }

  return "general";
}

export function getClientEmailPresentation(
  eventType: NotificationType,
  title: string,
  message: string,
  url?: string,
  projectStatus?: string,
  brand?: { businessName: string; portalName: string }
): PremiumEmailContent {
  const businessName = brand?.businessName ?? "Swift Aerial Media";
  const portalName = brand?.portalName ?? "Swift Portal";
  const ctaUrl = resolvePortalUrl(url);
  const progressStep =
    projectStatus !== undefined ? getStatusOrder(projectStatus) : undefined;
  const template = resolveTemplate(eventType, title, message);

  const presets: Record<PremiumEmailContent["template"], Omit<PremiumEmailContent, "template" | "ctaUrl">> = {
    proposal_ready: {
      subject: `Your ${businessName} proposal is ready`,
      title: title || "Your proposal is ready",
      body:
        message ||
        `Your proposal is ready to review inside ${portalName}. You can review the details, approve the proposal, or request changes.`,
      ctaLabel: "Review Proposal",
      secondaryInfo: "Most clients review and approve within a few minutes.",
      progressStep: progressStep ?? 1,
    },
    proposal_updated: {
      subject: "Your proposal has been updated",
      title: title || "Proposal updated",
      body:
        message ||
        `${businessName} updated your proposal. Review the latest details and let us know if you have any questions.`,
      ctaLabel: "Review Proposal",
      secondaryInfo: "Changes are highlighted in your portal.",
      progressStep: progressStep ?? 1,
    },
    shoot_proposed: {
      subject: "Your shoot time is ready to review",
      title: title || "Review your shoot time",
      body:
        message ||
        `${businessName} proposed a shoot time for your project. Review the date and confirm or suggest another time inside ${portalName}.`,
      ctaLabel: "Review Schedule",
      secondaryInfo: "Confirming your shoot time helps us plan your production day.",
      progressStep: progressStep ?? 2,
    },
    shoot_confirmed: {
      subject: "Your shoot is confirmed",
      title: "Shoot confirmed",
      body:
        message ||
        "Your shoot is confirmed. We'll see you on site — check Swift Portal for the latest schedule details.",
      ctaLabel: "View Schedule",
      secondaryInfo: "We'll notify you when your media is in production.",
      progressStep: progressStep ?? 3,
    },
    deliverables_ready: {
      subject: "Your deliverables are ready to review",
      title: "Deliverables ready for review",
      body:
        message ||
        "New media has been added to your project. Review your deliverables and share feedback inside Swift Portal.",
      ctaLabel: "Review Deliverables",
      secondaryInfo: "You can approve assets or request revisions directly in your portal.",
      progressStep: progressStep ?? 5,
    },
    revision_response: {
      subject: title,
      title,
      body: message,
      ctaLabel: "Open Swift Portal",
      progressStep: progressStep ?? 5,
    },
    payment_requested: {
      subject: "Your payment link is ready",
      title: "Complete your payment",
      body:
        message ||
        "Your final payment is ready inside Swift Portal. Complete payment to unlock your final downloads.",
      ctaLabel: "Pay in Swift Portal",
      secondaryInfo: "Secure payment powered by Stripe.",
      progressStep: progressStep ?? 6,
    },
    payment_received: {
      subject: "Payment received — thank you",
      title: "Payment received",
      body:
        message ||
        "Payment confirmed. Your final deliverables are now available to download in Swift Portal.",
      ctaLabel: "Download Deliverables",
      secondaryInfo: `Thank you for choosing ${businessName}.`,
      progressStep: progressStep ?? 7,
    },
    project_complete: {
      subject: "Your project is complete",
      title: title || "Project complete",
      body:
        message ||
        `Your project is complete. All deliverables are available in ${portalName} whenever you need them.`,
      ctaLabel: "Open Portal",
      secondaryInfo: `Thank you for trusting ${businessName} with your project.`,
      progressStep: progressStep ?? 7,
    },
    general: {
      subject: title,
      title,
      body: message,
      ctaLabel: ctaUrl ? "Open Portal" : "Review in Portal",
      progressStep,
    },
  };

  const preset = presets[template];
  return { template, ...preset, ctaUrl };
}

export async function getClientNotificationPreferences(userId: string) {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("email_notifications_enabled, in_app_notifications_enabled, role, email")
    .eq("id", userId)
    .single();

  if (error) {
    console.warn("[email] preference lookup failed, defaulting to enabled:", userId, error.message);
    return {
      email_notifications_enabled: true,
      in_app_notifications_enabled: true,
      email: null as string | null,
    };
  }

  if (!data || data.role !== "client") {
    return {
      email_notifications_enabled: true,
      in_app_notifications_enabled: true,
      email: data?.email ?? null,
    };
  }

  return {
    email_notifications_enabled: data.email_notifications_enabled !== false,
    in_app_notifications_enabled: data.in_app_notifications_enabled !== false,
    email: data.email ?? null,
  };
}

/**
 * Send a branded client email via Resend. Never throws.
 */
export async function sendClientEmailNotification(
  options: ClientEmailNotificationOptions
): Promise<ClientEmailNotificationResult> {
  const recipientEmail = options.email?.trim();
  if (!recipientEmail) {
    console.warn("[email] skipped — no recipient email:", options.eventType, options.userId);
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

  const appSettings = await getAppSettings();
  const brandNames = {
    businessName: appSettings.business.businessName,
    portalName: appSettings.business.portalName,
  };

  const presentation = getClientEmailPresentation(
    options.eventType,
    options.title,
    options.message,
    options.url,
    options.projectStatus,
    brandNames
  );

  try {
    const result = await sendBrandedEmail({
      to: recipientEmail,
      subject: presentation.subject,
      title: presentation.title,
      body: presentation.body,
      projectName: options.projectName,
      secondaryInfo: presentation.secondaryInfo,
      ctaLabel: presentation.ctaUrl ? presentation.ctaLabel : undefined,
      ctaUrl: presentation.ctaUrl,
      progressStep: presentation.progressStep,
      emailType: options.eventType,
      analytics: {
        projectId: options.projectId,
        notificationId: options.notificationId,
        emailType: options.eventType,
      },
    });

    if (result.sent) {
      console.info("[email] client notification sent:", options.eventType, "→", recipientEmail);
      return { sent: true, messageId: result.messageId };
    }

    if (result.skipped) {
      return { sent: false, reason: result.skipReason ?? "skipped", error: result.error };
    }

    return { sent: false, reason: "send_failed", error: result.error };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] client notification error:", options.eventType, message);
    return { sent: false, reason: "error", error: message };
  }
}
