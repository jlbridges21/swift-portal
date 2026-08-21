/**
 * Platform lifecycle email evaluation + recipient resolution.
 *
 * Recipient rule (documented): use businesses.billing_email when set; otherwise
 * every active admin on the business. These are transactional billing notices —
 * no global unsubscribe. Super-admins suppress per-business via
 * lifecycle_emails_suppressed.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { getSubscriptionState } from "@/lib/subscription";
import { formatPlanPrice } from "@/lib/plan-catalog";
import { getSiteUrl } from "@/lib/site-metadata";
import {
  renderPlatformLifecycleTemplate,
  sendPlatformEmail,
  type PlatformLifecycleVariables,
} from "@/lib/platform-email";
import { writePlatformAudit } from "@/lib/platform-audit";

export type PlatformEmailTemplateRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  body: string;
  is_active: boolean;
  send_offset_days: number;
  created_at: string;
  updated_at: string;
};

export type LifecycleBusinessRow = {
  id: string;
  name: string;
  slug: string;
  status: string;
  deleted_at: string | null;
  plan: string | null;
  subscription_status: string | null;
  trial_ends_at: string | null;
  comped_until: string | null;
  comped_reason: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean | null;
  billing_email: string | null;
  lifecycle_emails_suppressed: boolean | null;
};

export type LifecycleAction =
  | { action: "skipped"; reason: string }
  | { action: "sent"; templateKey: string; recipient: string; messageId?: string }
  | { action: "already_sent"; templateKey: string }
  | { action: "failed"; templateKey: string; error: string }
  | { action: "status_synced"; from: string; to: string };

export type BusinessLifecycleSummary = {
  businessId: string;
  businessName: string;
  ok: boolean;
  actions: LifecycleAction[];
  error?: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Calendar days relative to event: negative before, 0 on event day, positive after. */
export function daysRelativeToEvent(eventIso: string, now: Date = new Date()): number | null {
  const event = new Date(eventIso);
  if (!Number.isFinite(event.getTime())) return null;
  const eventDay = startOfUtcDay(event).getTime();
  const today = startOfUtcDay(now).getTime();
  return Math.round((today - eventDay) / DAY_MS);
}

export function toEventDateIso(eventIso: string): string | null {
  const event = new Date(eventIso);
  if (!Number.isFinite(event.getTime())) return null;
  return startOfUtcDay(event).toISOString().slice(0, 10);
}

export type TemplateEventFamily =
  | "trial_ending"
  | "trial_ended"
  | "payment_failed"
  | "subscription_canceled"
  | "unknown";

export function templateEventFamily(key: string): TemplateEventFamily {
  if (key.startsWith("trial_ending")) return "trial_ending";
  if (key === "trial_ended" || key.startsWith("trial_ended")) return "trial_ended";
  if (key.startsWith("payment_failed")) return "payment_failed";
  if (key.startsWith("subscription_canceled")) return "subscription_canceled";
  return "unknown";
}

/**
 * Resolve the event timestamp this template keys off for a business, or null
 * when the business is not in a state that can trigger this family.
 */
export function resolveEventIso(
  family: TemplateEventFamily,
  business: LifecycleBusinessRow,
  now: Date = new Date()
): string | null {
  const sub = getSubscriptionState(business, now);

  if (family === "trial_ending") {
    if (business.subscription_status !== "trialing") return null;
    if (sub.isComped || !business.trial_ends_at) return null;
    if (sub.requiresPayment) return null; // already expired live
    return business.trial_ends_at;
  }

  if (family === "trial_ended") {
    if (sub.isComped || !business.trial_ends_at) return null;
    const status = business.subscription_status;
    if (status !== "trialing" && status !== "trial_expired") return null;
    // Only once the live trial is over (or status already trial_expired).
    if (status === "trialing" && !sub.requiresPayment) return null;
    return business.trial_ends_at;
  }

  if (family === "payment_failed") {
    if (business.subscription_status !== "past_due") return null;
    // Stable anchor: period end when known; otherwise a fixed sentinel so daily
    // cron runs do not mint a new event_date (and re-send) every day.
    return business.subscription_current_period_end || "1970-01-01T00:00:00.000Z";
  }

  if (family === "subscription_canceled") {
    if (business.subscription_status !== "canceled") return null;
    return business.subscription_current_period_end || "1970-01-01T00:00:00.000Z";
  }

  return null;
}

/**
 * Point-in-time warnings (trial_ending_*): exact calendar-day match.
 * Sticky statuses (trial ended / past_due / canceled): offset-or-later so a
 * missed cron day still sends once (idempotency blocks duplicates).
 */
export function templateMatchesOffset(
  template: Pick<PlatformEmailTemplateRow, "key" | "send_offset_days">,
  eventIso: string,
  now: Date = new Date()
): boolean {
  const relative = daysRelativeToEvent(eventIso, now);
  if (relative == null) return false;
  const family = templateEventFamily(template.key);
  if (family === "trial_ending") {
    return relative === template.send_offset_days;
  }
  return relative >= template.send_offset_days;
}

export async function loadActiveLifecycleTemplates(): Promise<PlatformEmailTemplateRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("platform_email_templates")
    .select("*")
    .eq("is_active", true)
    .order("send_offset_days", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformEmailTemplateRow[];
}

export async function loadAllLifecycleTemplates(): Promise<PlatformEmailTemplateRow[]> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("platform_email_templates")
    .select("*")
    .order("key", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as PlatformEmailTemplateRow[];
}

export async function resolveLifecycleRecipients(
  business: LifecycleBusinessRow
): Promise<{ emails: string[]; ownerName: string }> {
  const billing = business.billing_email?.trim();
  const supabase = await createServiceClient();
  const { data: admins } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("business_id", business.id)
    .eq("role", "admin")
    .order("created_at", { ascending: true });

  const ownerName =
    (admins ?? []).map((a) => a.full_name?.trim()).find(Boolean) ||
    (admins ?? [])[0]?.email?.split("@")[0] ||
    "there";

  if (billing) {
    return { emails: [billing], ownerName };
  }

  const emails = [
    ...new Set(
      (admins ?? [])
        .map((a) => a.email?.trim().toLowerCase())
        .filter((e): e is string => Boolean(e))
    ),
  ];
  return { emails, ownerName };
}

export async function buildLifecycleVariables(
  business: LifecycleBusinessRow,
  ownerName: string,
  now: Date = new Date()
): Promise<PlatformLifecycleVariables> {
  const supabase = await createServiceClient();
  let planName = business.plan || "Studio";
  let planPrice = "";
  if (business.plan) {
    const { data: plan } = await supabase
      .from("plans")
      .select("name, price_monthly_cents")
      .eq("key", business.plan)
      .maybeSingle();
    if (plan) {
      planName = plan.name || planName;
      planPrice = formatPlanPrice(plan.price_monthly_cents);
      if (planPrice !== "—") planPrice = `${planPrice}/mo`;
      else planPrice = "";
    }
  }

  const sub = getSubscriptionState(business, now);
  const daysRemaining =
    sub.daysLeftInTrial != null ? String(sub.daysLeftInTrial) : "";
  const trialEndDate = business.trial_ends_at
    ? new Date(business.trial_ends_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        timeZone: "UTC",
      })
    : "";

  return {
    businessName: business.name || "your studio",
    daysRemaining,
    trialEndDate,
    planName,
    planPrice,
    billingUrl: `${getSiteUrl()}/billing`,
    ownerName,
  };
}

export function renderLifecyclePreview(
  template: Pick<PlatformEmailTemplateRow, "subject" | "body">,
  variables: Partial<PlatformLifecycleVariables>
): { subject: string; body: string } {
  return {
    subject: renderPlatformLifecycleTemplate(template.subject, variables),
    body: renderPlatformLifecycleTemplate(template.body, variables),
  };
}

async function alreadySent(
  businessId: string,
  templateKey: string,
  eventDate: string
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("platform_email_sends")
    .select("id")
    .eq("business_id", businessId)
    .eq("template_key", templateKey)
    .eq("event_date", eventDate)
    .eq("is_test", false)
    .maybeSingle();
  return Boolean(data);
}

/** True when payment_failed was sent for this event and enough days have elapsed. */
async function paymentFollowUpReady(
  businessId: string,
  eventDate: string,
  offsetDays: number,
  now: Date
): Promise<boolean> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("platform_email_sends")
    .select("created_at")
    .eq("business_id", businessId)
    .eq("template_key", "payment_failed")
    .eq("event_date", eventDate)
    .eq("is_test", false)
    .maybeSingle();
  if (!data?.created_at) return false;
  const relative = daysRelativeToEvent(data.created_at, now);
  return relative != null && relative >= offsetDays;
}

/** @returns true when this caller claimed the send slot; false if already claimed. */
async function recordSend(entry: {
  businessId: string;
  templateKey: string;
  templateId: string;
  eventDate: string;
  isTest: boolean;
  recipient: string;
  subject: string;
  messageId?: string;
}): Promise<boolean> {
  const supabase = await createServiceClient();
  const { error } = await supabase.from("platform_email_sends").insert({
    business_id: entry.businessId,
    template_key: entry.templateKey,
    template_id: entry.templateId,
    event_date: entry.eventDate,
    is_test: entry.isTest,
    recipient: entry.recipient,
    subject: entry.subject,
    resend_message_id: entry.messageId ?? null,
  });
  if (error) {
    // Unique violation = another cron worker already recorded — treat as already sent.
    if (error.code === "23505") return false;
    throw new Error(error.message);
  }
  return true;
}

/**
 * Reporting-only: flip stored subscription_status from trialing → trial_expired
 * once past trial_ends_at. Access enforcement stays live-computed in
 * getSubscriptionState() — do not make gates depend on this write.
 */
export async function syncTrialExpiredStatus(
  business: LifecycleBusinessRow,
  now: Date = new Date()
): Promise<LifecycleAction | null> {
  if (business.subscription_status !== "trialing" || !business.trial_ends_at) return null;
  const end = new Date(business.trial_ends_at).getTime();
  if (!Number.isFinite(end) || end > now.getTime()) return null;

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("businesses")
    .update({ subscription_status: "trial_expired" })
    .eq("id", business.id)
    .eq("subscription_status", "trialing");

  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: null,
    actorEmail: "cron:platform-lifecycle",
    action: "business.subscription_change",
    targetBusinessId: business.id,
    targetType: "business",
    targetId: business.id,
    metadata: {
      reason: "trial_expired_reporting_sync",
      from: "trialing",
      to: "trial_expired",
      trial_ends_at: business.trial_ends_at,
      note: "Reporting only — access remains live-computed from trial_ends_at",
    },
  });

  return { action: "status_synced", from: "trialing", to: "trial_expired" };
}

export async function processBusinessLifecycle(options: {
  business: LifecycleBusinessRow;
  templates: PlatformEmailTemplateRow[];
  now?: Date;
  dryRun?: boolean;
}): Promise<BusinessLifecycleSummary> {
  const now = options.now ?? new Date();
  const actions: LifecycleAction[] = [];
  const business = options.business;

  try {
    if (business.status !== "active" || business.deleted_at) {
      actions.push({ action: "skipped", reason: "suspended_or_deleted" });
      return { businessId: business.id, businessName: business.name, ok: true, actions };
    }

    // COMPED PROTECTION — permanent (Swift) and time-limited comps never get lifecycle mail.
    if (getSubscriptionState(business, now).isComped) {
      actions.push({ action: "skipped", reason: "comped" });
      return { businessId: business.id, businessName: business.name, ok: true, actions };
    }

    if (business.lifecycle_emails_suppressed) {
      actions.push({ action: "skipped", reason: "suppressed" });
      // Still allow reporting status sync below.
    }

    const synced = await syncTrialExpiredStatus(business, now);
    if (synced) {
      actions.push(synced);
      business.subscription_status = "trial_expired";
    }

    if (business.lifecycle_emails_suppressed) {
      return { businessId: business.id, businessName: business.name, ok: true, actions };
    }

    const { emails, ownerName } = await resolveLifecycleRecipients(business);
    if (emails.length === 0) {
      actions.push({ action: "skipped", reason: "no_recipients" });
      return { businessId: business.id, businessName: business.name, ok: true, actions };
    }

    const variables = await buildLifecycleVariables(business, ownerName, now);

    for (const template of options.templates) {
      const family = templateEventFamily(template.key);
      const eventIso = resolveEventIso(family, business, now);
      if (!eventIso) continue;
      if (!templateMatchesOffset(template, eventIso, now)) continue;

      const eventDate = toEventDateIso(eventIso);
      if (!eventDate) continue;

      // Follow-ups (offset > 0) wait until the base notice for this event was sent
      // and enough days have passed — avoids same-day double-send when the event
      // anchor is far in the past (or the open past_due sentinel).
      if (family === "payment_failed" && template.send_offset_days > 0) {
        const ready = await paymentFollowUpReady(
          business.id,
          eventDate,
          template.send_offset_days,
          now
        );
        if (!ready) continue;
      }

      if (await alreadySent(business.id, template.key, eventDate)) {
        actions.push({ action: "already_sent", templateKey: template.key });
        continue;
      }

      const rendered = renderLifecyclePreview(template, variables);
      const title = template.name || "ShootPortal notice";

      if (options.dryRun) {
        actions.push({
          action: "sent",
          templateKey: template.key,
          recipient: emails.join(","),
        });
        continue;
      }

      // Claim idempotency row first so a double cron cannot double-send.
      const claimed = await recordSend({
        businessId: business.id,
        templateKey: template.key,
        templateId: template.id,
        eventDate,
        isTest: false,
        recipient: emails.join(", "),
        subject: rendered.subject,
      });
      if (!claimed) {
        actions.push({ action: "already_sent", templateKey: template.key });
        continue;
      }

      let anySent = false;
      let lastError: string | undefined;
      let messageId: string | undefined;

      for (const to of emails) {
        const result = await sendPlatformEmail({
          to,
          subject: rendered.subject,
          title,
          body: rendered.body,
          ctaLabel: "Open billing",
          ctaUrl: variables.billingUrl,
        });
        if (result.sent) {
          anySent = true;
          messageId = result.messageId ?? messageId;
        } else if (result.error) {
          lastError = result.error;
        }
      }

      if (messageId) {
        const supabase = await createServiceClient();
        await supabase
          .from("platform_email_sends")
          .update({ resend_message_id: messageId })
          .eq("business_id", business.id)
          .eq("template_key", template.key)
          .eq("event_date", eventDate)
          .eq("is_test", false);
      }

      await writePlatformAudit({
        actorUserId: null,
        actorEmail: "cron:platform-lifecycle",
        action: "lifecycle_email.send",
        targetBusinessId: business.id,
        targetType: "platform_email_template",
        targetId: template.id,
        metadata: {
          template_key: template.key,
          event_date: eventDate,
          recipients: emails,
          subject: rendered.subject,
          sent: anySent,
          messageId: messageId ?? null,
          error: lastError ?? null,
        },
      });

      if (anySent) {
        actions.push({
          action: "sent",
          templateKey: template.key,
          recipient: emails.join(", "),
          messageId,
        });
      } else {
        actions.push({
          action: "failed",
          templateKey: template.key,
          error: lastError || "send_failed",
        });
      }
    }

    return { businessId: business.id, businessName: business.name, ok: true, actions };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      businessId: business.id,
      businessName: business.name,
      ok: false,
      actions,
      error: message,
    };
  }
}

export async function sendLifecycleTestEmail(options: {
  template: PlatformEmailTemplateRow;
  business: LifecycleBusinessRow;
  to: string;
  actorUserId: string;
  actorEmail: string;
}): Promise<{ ok: boolean; error?: string; from?: string; subject?: string }> {
  const { emails: _ignored, ownerName } = await resolveLifecycleRecipients(options.business);
  const variables = await buildLifecycleVariables(options.business, ownerName);
  const rendered = renderLifecyclePreview(options.template, variables);

  const result = await sendPlatformEmail({
    to: options.to,
    subject: rendered.subject,
    title: options.template.name || "ShootPortal notice",
    body: rendered.body,
    ctaLabel: "Open billing",
    ctaUrl: variables.billingUrl,
    isTest: true,
  });

  const eventDate =
    toEventDateIso(options.business.trial_ends_at || new Date().toISOString()) ||
    new Date().toISOString().slice(0, 10);

  await recordSend({
    businessId: options.business.id,
    templateKey: options.template.key,
    templateId: options.template.id,
    eventDate,
    isTest: true,
    recipient: options.to,
    subject: result.subject,
    messageId: result.messageId,
  });

  await writePlatformAudit({
    actorUserId: options.actorUserId,
    actorEmail: options.actorEmail,
    action: "lifecycle_email.test_send",
    targetBusinessId: options.business.id,
    targetType: "platform_email_template",
    targetId: options.template.id,
    metadata: {
      template_key: options.template.key,
      to: options.to,
      subject: result.subject,
      sent: result.sent,
      from: result.from,
      is_test: true,
    },
  });

  if (!result.sent) {
    return { ok: false, error: result.error || result.skipReason || "send_failed", from: result.from };
  }
  return { ok: true, from: result.from, subject: result.subject };
}
