/**
 * Partner program lifecycle emails — DB templates from platform_email_templates,
 * sent on approval/decline events (not cron). Idempotent via partner_email_sends.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import { sendPlatformEmail } from "@/lib/platform-email";
import {
  partnerLandingPublicUrl,
  partnerReferralLink,
} from "@/lib/partner-urls";
import { getPartnerLandingByPartnerId } from "@/lib/partner-landing";

export type PartnerLifecycleTemplateKey =
  | "partner_approved_existing"
  | "partner_approved_invite"
  | "partner_application_declined";

export type PartnerLifecycleVariables = {
  partnerName: string;
  commissionRatePct: string;
  referralLink: string;
  landingPageUrl: string;
  partnerDashboardUrl: string;
  inviteUrl: string;
};

export const PARTNER_LIFECYCLE_VARIABLE_FALLBACKS: PartnerLifecycleVariables = {
  partnerName: "there",
  commissionRatePct: "30",
  referralLink: "",
  landingPageUrl: "Not set yet — create one from your partner dashboard",
  partnerDashboardUrl: "",
  inviteUrl: "",
};

export function renderPartnerLifecycleTemplate(
  template: string,
  variables: Partial<PartnerLifecycleVariables>
): string {
  const resolved: PartnerLifecycleVariables = { ...PARTNER_LIFECYCLE_VARIABLE_FALLBACKS };
  for (const key of Object.keys(PARTNER_LIFECYCLE_VARIABLE_FALLBACKS) as (keyof PartnerLifecycleVariables)[]) {
    const raw = (variables[key] ?? "").trim();
    if (raw) resolved[key] = raw;
  }

  return template
    .replace(/\{\{(\w+)\}\}/g, (_, key: string) => {
      const k = key as keyof PartnerLifecycleVariables;
      if (k in resolved) return resolved[k];
      return "";
    })
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

type PartnerEmailTemplateRow = {
  id: string;
  key: string;
  subject: string;
  body: string;
  is_active: boolean;
};

async function loadPartnerTemplate(
  key: PartnerLifecycleTemplateKey
): Promise<PartnerEmailTemplateRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("platform_email_templates")
    .select("id, key, subject, body, is_active")
    .eq("key", key)
    .maybeSingle();
  return (data as PartnerEmailTemplateRow | null) ?? null;
}

async function alreadySent(options: {
  partnerId?: string | null;
  applicationId?: string | null;
  templateKey: PartnerLifecycleTemplateKey;
}): Promise<boolean> {
  const raw = await createServiceClient();
  if (options.partnerId) {
    const { data } = await raw
      .from("partner_email_sends")
      .select("id")
      .eq("partner_id", options.partnerId)
      .eq("template_key", options.templateKey)
      .eq("is_test", false)
      .maybeSingle();
    if (data) return true;
  }
  if (options.applicationId) {
    const { data } = await raw
      .from("partner_email_sends")
      .select("id")
      .eq("application_id", options.applicationId)
      .eq("template_key", options.templateKey)
      .eq("is_test", false)
      .maybeSingle();
    if (data) return true;
  }
  return false;
}

async function recordSend(options: {
  partnerId?: string | null;
  applicationId?: string | null;
  templateKey: PartnerLifecycleTemplateKey;
  templateId: string | null;
  recipient: string;
  subject: string;
  messageId?: string;
  isTest?: boolean;
}): Promise<void> {
  const raw = await createServiceClient();
  await raw.from("partner_email_sends").insert({
    partner_id: options.partnerId ?? null,
    application_id: options.applicationId ?? null,
    template_key: options.templateKey,
    template_id: options.templateId,
    recipient: options.recipient,
    subject: options.subject,
    resend_message_id: options.messageId ?? null,
    is_test: options.isTest ?? false,
  });
}

async function buildPartnerVariables(options: {
  partnerName: string;
  commissionRatePct: number;
  referralCode: string;
  inviteUrl?: string | null;
  landingSlug?: string | null;
}): Promise<PartnerLifecycleVariables> {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const landing =
    options.landingSlug != null
      ? partnerLandingPublicUrl(options.landingSlug)
      : null;

  return {
    partnerName: options.partnerName,
    commissionRatePct: String(options.commissionRatePct),
    referralLink: partnerReferralLink(options.referralCode),
    landingPageUrl: landing ?? "Not set yet — create one from your partner dashboard",
    partnerDashboardUrl: `${apex}/partner/dashboard`,
    inviteUrl: options.inviteUrl ?? `${apex}/partner/dashboard`,
  };
}

export type SendPartnerLifecycleResult = {
  sent: boolean;
  skipped?: boolean;
  skipReason?: string;
  error?: string | null;
};

async function sendPartnerLifecycleEmail(options: {
  templateKey: PartnerLifecycleTemplateKey;
  to: string;
  variables: Partial<PartnerLifecycleVariables>;
  ctaLabel: string;
  ctaUrl: string;
  partnerId?: string | null;
  applicationId?: string | null;
  isTest?: boolean;
}): Promise<SendPartnerLifecycleResult> {
  if (!options.isTest) {
    const dup = await alreadySent({
      partnerId: options.partnerId,
      applicationId: options.applicationId,
      templateKey: options.templateKey,
    });
    if (dup) {
      return { sent: false, skipped: true, skipReason: "already_sent" };
    }
  }

  const template = await loadPartnerTemplate(options.templateKey);
  if (!template) {
    return { sent: false, error: `Template ${options.templateKey} not found.` };
  }
  if (!template.is_active && !options.isTest) {
    return { sent: false, skipped: true, skipReason: "template_inactive" };
  }

  const subject = renderPartnerLifecycleTemplate(template.subject, options.variables);
  const body = renderPartnerLifecycleTemplate(template.body, options.variables);

  const emailResult = await sendPlatformEmail({
    to: options.to,
    subject,
    title: subject,
    body,
    ctaLabel: options.ctaLabel,
    ctaUrl: options.ctaUrl,
    isTest: options.isTest,
  });

  if (emailResult.sent && !options.isTest) {
    try {
      await recordSend({
        partnerId: options.partnerId,
        applicationId: options.applicationId,
        templateKey: options.templateKey,
        templateId: template.id,
        recipient: options.to,
        subject,
        messageId: emailResult.messageId,
      });
    } catch (err) {
      console.error("[partner-lifecycle-email] idempotency record failed", err);
    }
  }

  return {
    sent: emailResult.sent,
    error: emailResult.sent ? null : emailResult.error || emailResult.skipReason || null,
  };
}

/** Approved partner with an existing ShootPortal profile — no invite link. */
export async function sendPartnerApprovedExistingEmail(options: {
  partnerId: string;
  email: string;
  partnerName: string;
  commissionRatePct: number;
  referralCode: string;
}): Promise<SendPartnerLifecycleResult> {
  const landing = await getPartnerLandingByPartnerId(options.partnerId);
  const landingSlug =
    landing?.is_active && landing.slug ? landing.slug : null;
  const variables = await buildPartnerVariables({
    partnerName: options.partnerName,
    commissionRatePct: options.commissionRatePct,
    referralCode: options.referralCode,
    landingSlug,
  });

  return sendPartnerLifecycleEmail({
    templateKey: "partner_approved_existing",
    to: options.email,
    variables,
    ctaLabel: "Open partner dashboard",
    ctaUrl: variables.partnerDashboardUrl,
    partnerId: options.partnerId,
  });
}

/** Approved partner invite — new auth user must accept invite. */
export async function sendPartnerApprovedInviteEmail(options: {
  partnerId: string;
  email: string;
  partnerName: string;
  commissionRatePct: number;
  referralCode: string;
  inviteUrl: string;
}): Promise<SendPartnerLifecycleResult> {
  const landing = await getPartnerLandingByPartnerId(options.partnerId);
  const landingSlug =
    landing?.is_active && landing.slug ? landing.slug : null;
  const variables = await buildPartnerVariables({
    partnerName: options.partnerName,
    commissionRatePct: options.commissionRatePct,
    referralCode: options.referralCode,
    inviteUrl: options.inviteUrl,
    landingSlug,
  });

  return sendPartnerLifecycleEmail({
    templateKey: "partner_approved_invite",
    to: options.email,
    variables,
    ctaLabel: "Accept invite",
    ctaUrl: options.inviteUrl,
    partnerId: options.partnerId,
  });
}

/** Declined partner application. */
export async function sendPartnerApplicationDeclinedEmail(options: {
  applicationId: string;
  email: string;
  partnerName: string;
}): Promise<SendPartnerLifecycleResult> {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const variables: PartnerLifecycleVariables = {
    partnerName: options.partnerName,
    commissionRatePct: "",
    referralLink: "",
    landingPageUrl: "",
    partnerDashboardUrl: `${apex}/partner`,
    inviteUrl: "",
  };

  return sendPartnerLifecycleEmail({
    templateKey: "partner_application_declined",
    to: options.email,
    variables,
    ctaLabel: "Partner program",
    ctaUrl: `${apex}/partner`,
    applicationId: options.applicationId,
  });
}
