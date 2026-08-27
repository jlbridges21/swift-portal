/**
 * Partner payout notification emails — sent after automated runs.
 * Idempotent via partner_email_sends (template_key includes payout or period).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import { sendPlatformEmail } from "@/lib/platform-email";
import {
  formatCentsForEmail,
  payoutPeriodLabel,
} from "@/lib/partner-payout-automation";
import { PARTNER_PAYOUT_MINIMUM_CENTS } from "@/lib/partner-stripe-connect";
import { renderPartnerLifecycleTemplate } from "@/lib/partner-lifecycle-email";

export type PartnerPayoutEmailTemplateKey = "partner_payout_sent" | "partner_payout_skipped";

type TemplateRow = {
  id: string;
  key: string;
  subject: string;
  body: string;
  is_active: boolean;
};

async function loadTemplate(key: PartnerPayoutEmailTemplateKey): Promise<TemplateRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("platform_email_templates")
    .select("id, key, subject, body, is_active")
    .eq("key", key)
    .maybeSingle();
  return (data as TemplateRow | null) ?? null;
}

async function alreadySent(partnerId: string, templateKey: string): Promise<boolean> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("partner_email_sends")
    .select("id")
    .eq("partner_id", partnerId)
    .eq("template_key", templateKey)
    .eq("is_test", false)
    .maybeSingle();
  return Boolean(data);
}

async function recordSend(options: {
  partnerId: string;
  templateKey: string;
  templateId: string | null;
  recipient: string;
  subject: string;
  messageId?: string;
}): Promise<void> {
  const raw = await createServiceClient();
  await raw.from("partner_email_sends").insert({
    partner_id: options.partnerId,
    template_key: options.templateKey,
    template_id: options.templateId,
    recipient: options.recipient,
    subject: options.subject,
    resend_message_id: options.messageId ?? null,
    is_test: false,
  });
}

export async function sendPartnerPayoutSentEmail(options: {
  partnerId: string;
  email: string;
  partnerName: string;
  amountCents: number;
  periodKey: string;
  payoutId: string;
  isTest?: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string | null }> {
  const templateKey = `partner_payout_sent:${options.payoutId}`;
  if (!options.isTest) {
    if (await alreadySent(options.partnerId, templateKey)) {
      return { sent: false, skipped: true };
    }
  }

  const template = await loadTemplate("partner_payout_sent");
  if (!template?.is_active && !options.isTest) {
    return { sent: false, skipped: true };
  }
  if (!template) {
    return { sent: false, error: "Template partner_payout_sent not found." };
  }

  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const variables = {
    partnerName: options.partnerName,
    payoutAmount: formatCentsForEmail(options.amountCents),
    periodLabel: payoutPeriodLabel(options.periodKey),
    partnerPayoutsUrl: `${apex}/partner/payouts`,
  };

  const subject = renderPartnerLifecycleTemplate(template.subject, variables);
  const body = renderPartnerLifecycleTemplate(template.body, variables);

  const emailResult = await sendPlatformEmail({
    to: options.email,
    subject,
    title: subject,
    body,
    ctaLabel: "View payout history",
    ctaUrl: variables.partnerPayoutsUrl,
    isTest: options.isTest,
  });

  if (emailResult.sent && !options.isTest) {
    try {
      await recordSend({
        partnerId: options.partnerId,
        templateKey,
        templateId: template.id,
        recipient: options.email,
        subject,
        messageId: emailResult.messageId,
      });
    } catch (err) {
      console.error("[partner-payout-email] sent idempotency record failed", err);
    }
  }

  return {
    sent: emailResult.sent,
    error: emailResult.sent ? null : emailResult.error || emailResult.skipReason || null,
  };
}

/** Actionable skip reasons that warrant a partner email. */
export function isActionablePayoutSkipReason(reason: string): boolean {
  return (
    reason === "connect_requirements_due" ||
    reason === "connect_not_ready" ||
    reason === "below_minimum_threshold" ||
    reason === "connect_not_linked" ||
    reason === "mode_mismatch"
  );
}

export function humanizePayoutSkipReason(reason: string, details?: Record<string, unknown>): string {
  switch (reason) {
    case "connect_requirements_due":
      return `Stripe needs more information: ${String(details?.requirementsSummary ?? "complete onboarding in Stripe.")}`;
    case "connect_not_ready":
      return "Your Stripe payout account is not ready to receive transfers yet.";
    case "below_minimum_threshold":
      return `Your payable balance is below the minimum payout threshold (${formatCentsForEmail(Number(details?.minimumCents ?? PARTNER_PAYOUT_MINIMUM_CENTS))}).`;
    case "connect_not_linked":
      return "Connect your Stripe payout account under Payout details.";
    case "mode_mismatch":
      return "Your payout account was connected in a different Stripe mode — reconnect for this environment.";
    default:
      return reason.replace(/_/g, " ");
  }
}

export async function sendPartnerPayoutSkippedEmail(options: {
  partnerId: string;
  email: string;
  partnerName: string;
  periodKey: string;
  skipReason: string;
  details?: Record<string, unknown>;
  isTest?: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string | null }> {
  if (!isActionablePayoutSkipReason(options.skipReason)) {
    return { sent: false, skipped: true };
  }

  const templateKey = `partner_payout_skipped:${options.periodKey}:${options.skipReason}`;
  if (!options.isTest) {
    if (await alreadySent(options.partnerId, templateKey)) {
      return { sent: false, skipped: true };
    }
  }

  const template = await loadTemplate("partner_payout_skipped");
  if (!template?.is_active && !options.isTest) {
    return { sent: false, skipped: true };
  }
  if (!template) {
    return { sent: false, error: "Template partner_payout_skipped not found." };
  }

  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const skipReason = humanizePayoutSkipReason(options.skipReason, options.details);
  const variables = {
    partnerName: options.partnerName,
    periodLabel: payoutPeriodLabel(options.periodKey),
    skipReason,
    partnerPayoutDetailsUrl: `${apex}/partner/payout-details`,
  };

  const subject = renderPartnerLifecycleTemplate(template.subject, variables);
  const body = renderPartnerLifecycleTemplate(template.body, variables);

  const emailResult = await sendPlatformEmail({
    to: options.email,
    subject,
    title: subject,
    body,
    ctaLabel: "Open payout details",
    ctaUrl: variables.partnerPayoutDetailsUrl,
    isTest: options.isTest,
  });

  if (emailResult.sent && !options.isTest) {
    try {
      await recordSend({
        partnerId: options.partnerId,
        templateKey,
        templateId: template.id,
        recipient: options.email,
        subject,
        messageId: emailResult.messageId,
      });
    } catch (err) {
      console.error("[partner-payout-email] skipped idempotency record failed", err);
    }
  }

  return {
    sent: emailResult.sent,
    error: emailResult.sent ? null : emailResult.error || emailResult.skipReason || null,
  };
}
