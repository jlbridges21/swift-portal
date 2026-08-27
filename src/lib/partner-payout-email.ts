/**
 * Partner payout notification emails — sent after automated / executed transfer runs.
 * Idempotent via partner_email_sends (template_key includes payout or period).
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import { sendPlatformEmail } from "@/lib/platform-email";
import {
  formatCentsForEmail,
  payoutPeriodLabel,
} from "@/lib/partner-payout-automation";
import {
  PARTNER_PAYOUT_MINIMUM_CENTS,
  formatPartnerPayoutSkipReason,
} from "@/lib/partner-payout-constants";
import { renderEmailTemplatePair } from "@/lib/email-template-render";

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

  const rendered = renderEmailTemplatePair(template.subject, template.body, variables, {
    context: "partner_payout_sent",
  });
  if (!rendered.ok) {
    return { sent: false, skipped: true, error: rendered.error };
  }

  const emailResult = await sendPlatformEmail({
    to: options.email,
    subject: rendered.subject,
    title: rendered.subject,
    body: rendered.body,
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
        subject: rendered.subject,
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

/**
 * Skip reasons that *can* warrant email — only when payable balance is positive.
 * below_minimum is not emailed: the partner cannot act except by earning more.
 * zero_payable / negative / inactive / already_paid never email.
 */
export function isConnectBlockingSkipReason(reason: string): boolean {
  return (
    reason === "connect_requirements_due" ||
    reason === "connect_not_ready" ||
    reason === "connect_not_linked" ||
    reason === "mode_mismatch"
  );
}

/**
 * Gate: email only when there is a positive payable balance that could not be paid
 * because of a Connect/setup blocker the partner can fix.
 */
export function shouldSendPayoutSkipEmail(args: {
  skipReason: string;
  openNetCents: number;
}): boolean {
  if (!(args.openNetCents > 0)) return false;
  return isConnectBlockingSkipReason(args.skipReason);
}

/** @deprecated Prefer shouldSendPayoutSkipEmail — kept for call-site clarity in tests. */
export function isActionablePayoutSkipReason(reason: string): boolean {
  return isConnectBlockingSkipReason(reason);
}

export function humanizePayoutSkipReason(reason: string, details?: Record<string, unknown>): string {
  return formatPartnerPayoutSkipReason(reason, {
    minimumCents:
      typeof details?.minimumCents === "number"
        ? details.minimumCents
        : PARTNER_PAYOUT_MINIMUM_CENTS,
    requirementsSummary:
      details?.requirementsSummary != null ? String(details.requirementsSummary) : null,
  });
}

export function resolveOpenNetCentsFromSkipDetails(
  details?: Record<string, unknown>
): number {
  if (typeof details?.openNetCents === "number" && Number.isFinite(details.openNetCents)) {
    return details.openNetCents;
  }
  if (typeof details?.payableCents === "number" && Number.isFinite(details.payableCents)) {
    return details.payableCents;
  }
  return 0;
}

export async function sendPartnerPayoutSkippedEmail(options: {
  partnerId: string;
  email: string;
  partnerName: string;
  periodKey: string;
  skipReason: string;
  details?: Record<string, unknown>;
  /** When known, preferred over details.openNetCents. */
  openNetCents?: number;
  isTest?: boolean;
}): Promise<{ sent: boolean; skipped?: boolean; error?: string | null; skipReason?: string }> {
  const openNetCents =
    typeof options.openNetCents === "number"
      ? options.openNetCents
      : resolveOpenNetCentsFromSkipDetails(options.details);

  if (!shouldSendPayoutSkipEmail({ skipReason: options.skipReason, openNetCents })) {
    return { sent: false, skipped: true, skipReason: "not_actionable_or_zero_balance" };
  }

  const templateKey = `partner_payout_skipped:${options.periodKey}:${options.skipReason}`;
  if (!options.isTest) {
    if (await alreadySent(options.partnerId, templateKey)) {
      return { sent: false, skipped: true, skipReason: "already_sent" };
    }
  }

  const template = await loadTemplate("partner_payout_skipped");
  if (!template?.is_active && !options.isTest) {
    return { sent: false, skipped: true, skipReason: "template_inactive" };
  }
  if (!template) {
    return { sent: false, error: "Template partner_payout_skipped not found." };
  }

  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const skipReasonText = humanizePayoutSkipReason(options.skipReason, options.details);
  const variables = {
    partnerName: options.partnerName,
    periodLabel: payoutPeriodLabel(options.periodKey),
    skipReason: skipReasonText,
    payableAmount: formatCentsForEmail(openNetCents),
    partnerPayoutDetailsUrl: `${apex}/partner/payout-details`,
  };

  const rendered = renderEmailTemplatePair(template.subject, template.body, variables, {
    context: "partner_payout_skipped",
  });
  if (!rendered.ok) {
    return { sent: false, skipped: true, error: rendered.error, skipReason: "unresolved_template_variables" };
  }

  const emailResult = await sendPlatformEmail({
    to: options.email,
    subject: rendered.subject,
    title: rendered.subject,
    body: rendered.body,
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
        subject: rendered.subject,
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
