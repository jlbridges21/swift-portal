/**
 * Trial-to-paid conversion rules. Pure and client-safe: no DB, no Stripe, no dates from the device.
 * Callers pass server timestamps (trial start / trial_ends_at / now) so every screen agrees.
 */

import type { SignupInterval } from "@/lib/signup-intent";

export const DAY_MS = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Plan pricing (from the plans row — never hard-coded)
// ---------------------------------------------------------------------------

export type PlanPricing = {
  monthlyCents: number | null;
  /** plans.price_annual_cents is the per-month equivalent; the yearly charge is ×12. */
  annualPerMonthCents: number | null;
};

export function annualTotalCents(p: PlanPricing): number | null {
  return p.annualPerMonthCents == null ? null : p.annualPerMonthCents * 12;
}

export function intervalChargeCents(p: PlanPricing, interval: SignupInterval): number | null {
  return interval === "annual" ? annualTotalCents(p) : p.monthlyCents;
}

/** $29 / $288 / $24.50 */
export function formatUsd(cents: number | null | undefined): string {
  if (cents == null || !Number.isFinite(cents)) return "—";
  const dollars = cents / 100;
  return Number.isInteger(dollars)
    ? `$${dollars.toLocaleString("en-US")}`
    : `$${dollars.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function intervalLabel(interval: SignupInterval): "Monthly" | "Annual" {
  return interval === "annual" ? "Annual" : "Monthly";
}

// ---------------------------------------------------------------------------
// Scheduled plan ("trialing with a scheduled paid plan")
// ---------------------------------------------------------------------------

export type ScheduleInputs = {
  subscription_status: string | null | undefined;
  trial_ends_at: string | null | undefined;
  subscription_cancel_at_period_end?: boolean | null;
  /** business_billing_journey snapshot, when the migration has run. */
  journey?: {
    stripe_subscription_status?: string | null;
    subscription_interval?: string | null;
    subscription_amount_cents?: number | null;
    scheduled_first_payment_at?: string | null;
  } | null;
};

export type ScheduledPlan = {
  interval: SignupInterval | null;
  /** The stored trial expiration — billing starts exactly then. */
  firstPaymentAt: string;
  amountCents: number | null;
  /** Customer canceled the scheduled plan; access ends at the original trial end. */
  canceled: boolean;
};

/**
 * A trial user who picked a plan: Stripe subscription is `trialing` until the stored
 * trial_ends_at, which the billing sync maps to subscription_status = 'active'.
 * So "active + trial end still in the future" is the scheduled state. It works without the
 * journey table; the journey adds interval / amount for display.
 */
export function getScheduledPlan(input: ScheduleInputs, now: Date = new Date()): ScheduledPlan | null {
  if (input.subscription_status !== "active") return null;
  const trialEnd = input.trial_ends_at ? new Date(input.trial_ends_at).getTime() : NaN;
  if (!Number.isFinite(trialEnd) || trialEnd <= now.getTime()) return null;
  const j = input.journey ?? null;
  // Journey says Stripe already moved past trialing (paid early / plan change) → not scheduled.
  if (j?.stripe_subscription_status && j.stripe_subscription_status !== "trialing") return null;
  const interval =
    j?.subscription_interval === "annual" || j?.subscription_interval === "monthly"
      ? j.subscription_interval
      : null;
  return {
    interval,
    firstPaymentAt: new Date(trialEnd).toISOString(),
    amountCents: typeof j?.subscription_amount_cents === "number" ? j.subscription_amount_cents : null,
    canceled: Boolean(input.subscription_cancel_at_period_end),
  };
}

/** "November 15" (or "November 15, 2027" when not this year). Server-side default tz: UTC-safe date. */
export function formatBillingDate(iso: string, now: Date = new Date(), timeZone?: string): string {
  const d = new Date(iso);
  const sameYear = d.getUTCFullYear() === now.getUTCFullYear();
  return d.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
    ...(timeZone ? { timeZone } : {}),
  });
}

// ---------------------------------------------------------------------------
// Trial milestones (in-app modals)
// ---------------------------------------------------------------------------

export const TRIAL_MILESTONES = ["day1", "day2", "day5", "day10", "day13"] as const;
export type TrialMilestone = (typeof TRIAL_MILESTONES)[number];

export function isTrialMilestone(v: unknown): v is TrialMilestone {
  return typeof v === "string" && (TRIAL_MILESTONES as readonly string[]).includes(v);
}

/**
 * Non-overlapping windows on ELAPSED trial time (server timestamps, not device calendar days).
 * "Day N" = the Nth 24h block since the trial started.
 *   day1:  [0d, 1d)    day2: [1d, 4d)    day5: [4d, 9d)    day10: [9d, 12d)    day13: [12d, trial end)
 * A user who skips days only ever lands in one window, so only the current milestone can show.
 */
const WINDOWS: { milestone: TrialMilestone; fromDays: number; toDays: number }[] = [
  { milestone: "day1", fromDays: 0, toDays: 1 },
  { milestone: "day2", fromDays: 1, toDays: 4 },
  { milestone: "day5", fromDays: 4, toDays: 9 },
  { milestone: "day10", fromDays: 9, toDays: 12 },
  { milestone: "day13", fromDays: 12, toDays: Number.POSITIVE_INFINITY },
];

export function milestoneForElapsed(elapsedMs: number): TrialMilestone | null {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0) return null;
  const days = elapsedMs / DAY_MS;
  return WINDOWS.find((w) => days >= w.fromDays && days < w.toDays)?.milestone ?? null;
}

export type TrialModalEligibilityInput = {
  subscription_status: string | null | undefined;
  trial_ends_at: string | null | undefined;
  /** journey.trial_started_at ?? businesses.created_at */
  trialStartedAt: string | null | undefined;
  scheduled: boolean;
  /** Milestones this user has already seen (from trial_modal_events). null = state unavailable. */
  seen: ReadonlySet<TrialMilestone> | null;
};

export type TrialModalDecision =
  | {
      show: true;
      milestone: TrialMilestone;
      trialDay: number;
      msRemaining: number;
      trialEndsAt: string;
    }
  | { show: false; reason: string };

export function decideTrialModal(input: TrialModalEligibilityInput, now: Date = new Date()): TrialModalDecision {
  if (input.subscription_status !== "trialing") return { show: false, reason: "not_trialing" };
  if (input.scheduled) return { show: false, reason: "scheduled" };
  // Without persistent state we cannot guarantee "once per trial" — show nothing.
  if (!input.seen) return { show: false, reason: "state_unavailable" };
  const end = input.trial_ends_at ? new Date(input.trial_ends_at).getTime() : NaN;
  if (!Number.isFinite(end)) return { show: false, reason: "no_trial_end" };
  const msRemaining = end - now.getTime();
  if (msRemaining <= 0) return { show: false, reason: "trial_expired" };
  const start = input.trialStartedAt ? new Date(input.trialStartedAt).getTime() : NaN;
  if (!Number.isFinite(start) || start > now.getTime()) return { show: false, reason: "no_trial_start" };
  const elapsed = now.getTime() - start;
  const milestone = milestoneForElapsed(elapsed);
  if (!milestone) return { show: false, reason: "no_window" };
  if (input.seen.has(milestone)) return { show: false, reason: "already_seen" };
  return {
    show: true,
    milestone,
    trialDay: Math.floor(elapsed / DAY_MS) + 1,
    msRemaining,
    trialEndsAt: new Date(end).toISOString(),
  };
}

/** "4 days" / "1 day" / "6 hours" — from remaining ms, never a hard-coded count. */
export function remainingLabel(msRemaining: number): string {
  if (msRemaining <= 0) return "today";
  const hours = msRemaining / (60 * 60 * 1000);
  if (hours < 24) {
    const h = Math.max(1, Math.ceil(hours));
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const days = Math.ceil(msRemaining / DAY_MS);
  return `${days} day${days === 1 ? "" : "s"}`;
}

export type TrialModalCopy = {
  headline: string;
  body: string;
  primary: string;
  secondary: string;
  /** Conversion milestones show plan choice; day1 is a welcome. */
  showPlans: boolean;
  /** day1 secondary opens /billing instead of closing. */
  secondaryOpensPlans: boolean;
};

/**
 * Modal copy. Subscribing during a trial bills TODAY and ends the trial, so no milestone promises
 * "you won't be charged until your trial ends". `introSavings` ("up to $25") is set only while the
 * Subscribe & Save offer is available to this account (never for partner-referred accounts).
 */
export function trialModalCopy(
  milestone: TrialMilestone,
  msRemaining: number,
  trialDays = 14,
  introSavings: string | null = null
): TrialModalCopy {
  // Headline case: "4 Days", "6 Hours".
  const left = remainingLabel(msRemaining).replace(/\b[a-z]/g, (c) => c.toUpperCase());
  const endsWithinDay = msRemaining <= DAY_MS;
  const endsWithinTwoDays = msRemaining <= 2 * DAY_MS;
  const save = introSavings;
  switch (milestone) {
    case "day1":
      return {
        headline: "Welcome to ShootPortal!",
        body: save
          ? `Your ${trialDays}-day free trial is officially underway. You've got full access to explore everything ShootPortal has to offer — and if you subscribe before your trial ends, you'll save ${save}.`
          : `Your ${trialDays}-day free trial is officially underway. You've got full access to explore everything ShootPortal has to offer.`,
        primary: "Start Exploring",
        secondary: "View Plans",
        showPlans: false,
        secondaryOpensPlans: true,
      };
    case "day2":
      return {
        headline: "Finding Your Groove with ShootPortal?",
        body: save
          ? `If you already know ShootPortal is right for your business, subscribe today and save ${save}. Subscribing ends your free trial and starts your paid plan right away.`
          : "If you already know ShootPortal is right for your business, you can subscribe today. Subscribing ends your free trial and starts your paid plan right away.",
        primary: save ? "Subscribe & Save" : "Subscribe Now",
        secondary: "Keep Exploring",
        showPlans: true,
        secondaryOpensPlans: false,
      };
    case "day5":
      return {
        headline: "Make ShootPortal Part of Your Workflow.",
        body: save
          ? `Enjoying ShootPortal? Subscribe before your trial ends and save ${save} on your first subscription.`
          : "Enjoying ShootPortal? Subscribe now and keep using the platform without interruption.",
        primary: save ? "Subscribe & Save" : "Subscribe Now",
        secondary: "Remind Me Later",
        showPlans: true,
        secondaryOpensPlans: false,
      };
    case "day10":
      return {
        headline: `Your Free Trial Ends in ${left}.`,
        body: save
          ? `Subscribe now to save ${save} on your first subscription and keep your projects, clients, and workflow moving without interruption.`
          : "Want to keep your projects, clients, and workflow moving without interruption? Subscribe now to keep full access.",
        primary: save ? "Subscribe & Save" : "Subscribe Now",
        secondary: "Continue Trial",
        showPlans: true,
        secondaryOpensPlans: false,
      };
    case "day13":
      return {
        headline: endsWithinDay
          ? `Your ShootPortal Trial Ends in ${left}.`
          : endsWithinTwoDays
            ? "Your ShootPortal Trial Ends Tomorrow."
            : `Your ShootPortal Trial Ends in ${left}.`,
        body: save
          ? `Keep everything running smoothly. Subscribe before your trial ends to save ${save} — after that, regular pricing applies.`
          : "Keep everything running smoothly. Subscribe now to avoid losing access when your trial ends.",
        primary: save ? "Subscribe & Save" : "Continue with ShootPortal",
        secondary: "Maybe Later",
        showPlans: true,
        secondaryOpensPlans: false,
      };
  }
}

/**
 * Admin pages where a promotional modal may appear. Everything else (project detail with uploads
 * and delivery, media library, messages, settings forms, onboarding, billing) is never interrupted.
 */
export function isCalmAdminPath(pathname: string): boolean {
  const p = (pathname.split("?")[0] || "/").replace(/\/+$/, "") || "/";
  // Path-based tenant prefix (/b/{slug}/admin…) on non-subdomain hosts.
  const normalized = p.replace(/^\/b\/[^/]+/, "") || "/";
  return (
    normalized === "/admin" ||
    normalized === "/admin/projects" ||
    normalized === "/admin/clients" ||
    normalized === "/admin/calendar" ||
    normalized === "/admin/leads"
  );
}
