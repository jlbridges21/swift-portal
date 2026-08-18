import { Resend } from "resend";
import { buildPremiumEmailHtml } from "@/lib/email-templates";
import { recordEmailEvent } from "@/lib/email-analytics";
import { getAppSettings } from "@/lib/app-settings";
import { LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";

const resendClients = new Map<string, Resend>();

export interface EmailSendResult {
  sent: boolean;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  messageId?: string;
  to?: string;
  subject?: string;
  at: string;
}

const lastEmailSendResultByBusiness = new Map<string, EmailSendResult>();

export function getLastEmailSendResult(businessId: string): EmailSendResult | null {
  return lastEmailSendResultByBusiness.get(businessId) ?? null;
}

function recordEmailResult(businessId: string, result: Omit<EmailSendResult, "at">) {
  lastEmailSendResultByBusiness.set(businessId, { ...result, at: new Date().toISOString() });
}

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const existing = resendClients.get(apiKey);
  if (existing) return existing;
  const client = new Resend(apiKey);
  resendClients.set(apiKey, client);
  return client;
}

async function emailBusinessId(): Promise<string> {
  // Context-free: reachable from cron, webhooks, and authenticated sends that
  // do not yet thread a businessId. Unconditional so it stays greppable.
  // TODO(tenant): prompt 16 — pass businessId from the caller (project/payment/webhook row)
  return LEGACY_DEFAULT_BUSINESS_ID;
}

export function getResendFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL || "Swift Portal <portal@swiftaerialmedia.com>";
}

export async function getConfiguredFromEmail(): Promise<string> {
  const settings = await getAppSettings(await emailBusinessId());
  const { fromName, senderEmail } = settings.email;
  if (fromName && senderEmail) {
    return `${fromName} <${senderEmail}>`;
  }
  return getResendFromEmail();
}

export function getEmailConfigStatus() {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  return {
    resendApiKeyPresent: Boolean(apiKey),
    resendFromEmailPresent: Boolean(fromEmail),
    resendWebhookSecretPresent: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    fromEmail: getResendFromEmail(),
    environment: process.env.NODE_ENV || "development",
    appUrl: process.env.NEXT_PUBLIC_APP_URL || null,
  };
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  title: string;
  body: string;
  projectName?: string;
  secondaryInfo?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  progressStep?: number;
  emailType?: string;
  analytics?: {
    projectId?: string | null;
    notificationId?: string | null;
    emailType?: string;
  };
}

function formatResendError(error: unknown): string {
  if (!error) return "Unknown Resend error";
  if (typeof error === "string") return error;
  if (typeof error === "object") {
    const e = error as { message?: string; name?: string; statusCode?: number };
    const parts = [e.name, e.message, e.statusCode ? `(${e.statusCode})` : ""].filter(Boolean);
    if (parts.length) return parts.join(" ");
    return JSON.stringify(error);
  }
  return String(error);
}

function buildResendTags(analytics?: SendEmailOptions["analytics"]): { name: string; value: string }[] {
  const tags: { name: string; value: string }[] = [];
  if (analytics?.projectId) tags.push({ name: "project_id", value: analytics.projectId });
  if (analytics?.notificationId) tags.push({ name: "notification_id", value: analytics.notificationId });
  if (analytics?.emailType) tags.push({ name: "email_type", value: analytics.emailType });
  return tags;
}

export async function sendBrandedEmail(options: SendEmailOptions): Promise<EmailSendResult> {
  const base = {
    to: options.to,
    subject: options.subject,
    sent: false,
  };

  const businessId = await emailBusinessId();
  const client = getResend();
  if (!client) {
    const msg = "RESEND_API_KEY is not set — email sending skipped";
    console.warn("[email]", msg, options.subject, "→", options.to);
    const result = { ...base, skipped: true, skipReason: "missing_api_key", error: msg };
    recordEmailResult(businessId, result);
    return { ...result, at: new Date().toISOString() };
  }

  const appSettings = await getAppSettings(businessId);
  const html = buildPremiumEmailHtml({
    title: options.title,
    body: options.body,
    projectName: options.projectName,
    secondaryInfo: options.secondaryInfo,
    ctaLabel: options.ctaLabel,
    ctaUrl: options.ctaUrl,
    progressStep: options.progressStep,
    branding: {
      portalName: appSettings.business.portalName,
      businessName: appSettings.business.businessName,
      logoUrl: appSettings.business.logoUrl,
      footerText: appSettings.email.footerText,
      accentColor: appSettings.business.brandAccentColor,
      primaryColor: appSettings.business.brandPrimaryColor,
    },
  });

  const from = await getConfiguredFromEmail();
  const tags = buildResendTags(options.analytics);
  const emailType = options.analytics?.emailType ?? options.emailType ?? "general";

  try {
    const { data, error } = await client.emails.send({
      from,
      to: options.to,
      subject: options.subject,
      html,
      replyTo: appSettings.email.replyTo || undefined,
      tags: tags.length ? tags : undefined,
    });

    if (error) {
      const errorMessage = formatResendError(error);
      console.error("[email] Resend API error:", options.subject, "→", options.to, errorMessage, error);
      const result = { ...base, error: errorMessage };
      recordEmailResult(businessId, result);
      return { ...result, at: new Date().toISOString() };
    }

    console.info("[email] sent:", options.subject, "→", options.to, data?.id ?? "");

    void recordEmailEvent({
      resendEmailId: data?.id,
      projectId: options.analytics?.projectId,
      notificationId: options.analytics?.notificationId,
      recipient: options.to,
      emailType,
      eventType: "sent",
      metadata: { subject: options.subject, ctaLabel: options.ctaLabel },
      ctaLabel: options.ctaLabel,
    });

    const result = { ...base, sent: true, messageId: data?.id };
    recordEmailResult(businessId, result);
    return { ...result, at: new Date().toISOString() };
  } catch (err) {
    const errorMessage = formatResendError(err);
    console.error("[email] send failed:", options.subject, "→", options.to, errorMessage, err);
    const result = { ...base, error: errorMessage };
    recordEmailResult(businessId, result);
    return { ...result, at: new Date().toISOString() };
  }
}

export async function sendTestEmail(to: string): Promise<EmailSendResult> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://portal.swiftaerialmedia.com";
  return sendBrandedEmail({
    to,
    subject: "Swift Portal Test Email",
    title: "Email notifications are working",
    body: "Email notifications are working for Swift Portal. Your clients will receive polished, branded updates for proposals, scheduling, deliverables, and payments.",
    secondaryInfo: "This is a test message from your Swift Portal admin dashboard.",
    ctaLabel: "Open Swift Portal",
    ctaUrl: appUrl,
    progressStep: 0,
    emailType: "test",
    analytics: { emailType: "test" },
  });
}
