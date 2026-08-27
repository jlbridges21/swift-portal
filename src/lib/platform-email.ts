/**
 * ShootPortal → photography-business email (identity B).
 *
 * Do NOT route these through sendBrandedEmail. That path brands as the tenant
 * studio (name, logo, colors, reply-to) for business→client mail. Lifecycle
 * notices must arrive as ShootPortal / noreply@shootportal.app.
 */

import { Resend } from "resend";
import { buildPremiumEmailHtml } from "@/lib/email-templates";
import { BRAND, LOGO_URL } from "@/lib/brand";
import { SITE, getSiteUrl } from "@/lib/site-metadata";
import {
  formatFromHeader,
  getPlatformFromAddress,
} from "@/lib/email-sender-policy";
import { renderEmailTemplate } from "@/lib/email-template-render";

export type PlatformEmailSendResult = {
  sent: boolean;
  skipped?: boolean;
  skipReason?: string;
  error?: string;
  messageId?: string;
  to: string;
  subject: string;
  from: string;
  at: string;
};

export type PlatformLifecycleVariables = {
  businessName: string;
  daysRemaining: string;
  trialEndDate: string;
  planName: string;
  planPrice: string;
  billingUrl: string;
  ownerName: string;
};

export const PLATFORM_LIFECYCLE_VARIABLE_FALLBACKS: PlatformLifecycleVariables = {
  businessName: "your studio",
  daysRemaining: "a few",
  trialEndDate: "your trial end date",
  planName: "your plan",
  planPrice: "the price on Billing",
  billingUrl: "https://shootportal.app/billing",
  ownerName: "there",
};

const resendClients = new Map<string, Resend>();

function getResend() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return null;
  const existing = resendClients.get(apiKey);
  if (existing) return existing;
  const client = new Resend(apiKey);
  resendClients.set(apiKey, client);
  return client;
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

/** Absolute URL for ShootPortal logo in HTML email. */
export function platformEmailLogoUrl(): string {
  const path = LOGO_URL.startsWith("/") ? LOGO_URL : `/${LOGO_URL}`;
  return `${getSiteUrl()}${path}`;
}

export function getPlatformLifecycleFromHeader(): string {
  const address = getPlatformFromAddress() || "noreply@shootportal.app";
  return formatFromHeader(SITE.name || "ShootPortal", address);
}

export function getPlatformLifecycleReplyTo(): string | undefined {
  const reply = process.env.PLATFORM_REPLY_TO?.trim() || process.env.PLATFORM_SUPPORT_EMAIL?.trim();
  return reply || undefined;
}

/**
 * Same {{variable}} interpolation as other platform mail — unknown keys fail closed
 * via renderEmailTemplate (no silent empty holes).
 */
export function renderPlatformLifecycleTemplate(
  template: string,
  variables: Partial<PlatformLifecycleVariables>
): string {
  const resolved: Record<string, string> = { ...PLATFORM_LIFECYCLE_VARIABLE_FALLBACKS };
  for (const key of Object.keys(PLATFORM_LIFECYCLE_VARIABLE_FALLBACKS) as (keyof PlatformLifecycleVariables)[]) {
    const raw = (variables[key] ?? "").trim();
    if (raw) resolved[key] = raw;
  }

  return renderEmailTemplate(template, resolved, {
    // Some templates omit these; others require them — allow empty only when unused.
    // If a template references an empty one, renderEmailTemplate still throws.
    allowEmpty: [],
  });
}

export type SendPlatformEmailOptions = {
  to: string;
  subject: string;
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryInfo?: string;
  /** Prefixed in subject when true (test-send from /platform). */
  isTest?: boolean;
};

/**
 * Platform-identity send only. Never loads tenant app_settings branding.
 */
export async function sendPlatformEmail(
  options: SendPlatformEmailOptions
): Promise<PlatformEmailSendResult> {
  const from = getPlatformLifecycleFromHeader();
  const subject = options.isTest ? `[TEST] ${options.subject}` : options.subject;
  const base = {
    to: options.to,
    subject,
    from,
    sent: false,
  };

  const client = getResend();
  if (!client) {
    const msg = "RESEND_API_KEY is not set — platform email skipped";
    console.warn("[platform-email]", msg, subject, "→", options.to);
    return {
      ...base,
      skipped: true,
      skipReason: "missing_api_key",
      error: msg,
      at: new Date().toISOString(),
    };
  }

  const body = options.isTest
    ? `[TEST MESSAGE — not a real lifecycle send]\n\n${options.body}`
    : options.body;

  const html = buildPremiumEmailHtml({
    title: options.isTest ? `[TEST] ${options.title}` : options.title,
    body,
    secondaryInfo: options.secondaryInfo,
    ctaLabel: options.ctaLabel,
    ctaUrl: options.ctaUrl,
    branding: {
      portalName: BRAND.portalName,
      businessName: BRAND.name,
      logoUrl: platformEmailLogoUrl(),
      footerText: "You received this email because you have a ShootPortal account.",
      accentColor: SITE_THEME_ACCENT,
      primaryColor: "#0F172A",
      portalUrl: getSiteUrl(),
    },
  });

  const replyTo = getPlatformLifecycleReplyTo();

  try {
    const { data, error } = await client.emails.send({
      from,
      to: options.to,
      subject,
      html,
      replyTo,
      tags: [
        { name: "email_identity", value: "platform" },
        { name: "email_type", value: options.isTest ? "platform_lifecycle_test" : "platform_lifecycle" },
      ],
    });

    if (error) {
      const errorMessage = formatResendError(error);
      console.error("[platform-email] Resend API error:", subject, "→", options.to, errorMessage);
      return { ...base, error: errorMessage, at: new Date().toISOString() };
    }

    console.info("[platform-email] sent:", subject, "→", options.to, "from:", from, data?.id ?? "");
    return {
      ...base,
      sent: true,
      messageId: data?.id,
      at: new Date().toISOString(),
    };
  } catch (err) {
    const errorMessage = formatResendError(err);
    console.error("[platform-email] send failed:", subject, "→", options.to, errorMessage);
    return { ...base, error: errorMessage, at: new Date().toISOString() };
  }
}

/** Brand guide Portal Indigo — platform email accent (not tenant brand). */
const SITE_THEME_ACCENT = "#4F46E5";
