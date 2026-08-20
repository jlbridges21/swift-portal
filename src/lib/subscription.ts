/**
 * ShootPortal subscription access model (no Stripe Checkout in this module).
 *
 * Expiry for `trialing` is computed LIVE from `trial_ends_at`.
 * Expiry for `comped` is computed LIVE from `comped_until` (NULL = permanent).
 * A cron that flips stored status is reporting-only — gates must stay correct
 * even if that cron never runs.
 *
 * DESIGN: subscription_status answers "do they pay"; plan answers "what can
 * they do". Comped businesses keep a real plan for entitlements.
 */

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "trial_expired",
  "comped",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type SubscriptionBusinessFields = {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
  comped_until?: string | null;
  comped_reason?: string | null;
  /** When set and still in the future, canceled access continues until this time. */
  subscription_current_period_end?: string | null;
  subscription_cancel_at_period_end?: boolean | null;
};

export type SubscriptionState = {
  status: SubscriptionStatus;
  isExpired: boolean;
  daysLeftInTrial: number | null;
  /** Days left on a time-limited comp; null when not comped or permanent. */
  daysLeftInComp: number | null;
  requiresPayment: boolean;
  isComped: boolean;
  /** Human reason for the paywall / banner / comp, when relevant. */
  reason: string | null;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return typeof value === "string" && (SUBSCRIPTION_STATUSES as readonly string[]).includes(value);
}

function daysUntil(iso: string, nowMs: number): number {
  const end = new Date(iso).getTime();
  if (!Number.isFinite(end)) return 0;
  const delta = end - nowMs;
  if (delta <= 0) return 0;
  return Math.ceil(delta / DAY_MS);
}

/**
 * Pure access rules for a business row (or host-resolution slice).
 * Unknown / missing status fails closed to paywall.
 */
export function getSubscriptionState(
  business: SubscriptionBusinessFields,
  now: Date = new Date()
): SubscriptionState {
  const raw = business.subscription_status;
  const status: SubscriptionStatus = isSubscriptionStatus(raw) ? raw : "trial_expired";
  const nowMs = now.getTime();
  const trialEndsAt = business.trial_ends_at ?? null;
  const compedUntil = business.comped_until ?? null;
  const compedReason = business.comped_reason?.trim() || null;

  if (status === "comped") {
    const permanent = compedUntil == null || compedUntil === "";
    const endMs = permanent ? null : new Date(compedUntil!).getTime();
    const stillActive = permanent || (Number.isFinite(endMs) && (endMs as number) > nowMs);
    if (stillActive) {
      return {
        status,
        isExpired: false,
        daysLeftInTrial: null,
        daysLeftInComp: permanent ? null : daysUntil(compedUntil!, nowMs),
        requiresPayment: false,
        isComped: true,
        reason: compedReason,
      };
    }
    return {
      status,
      isExpired: true,
      daysLeftInTrial: null,
      daysLeftInComp: 0,
      requiresPayment: true,
      isComped: false,
      reason: "Complimentary access has ended. Subscribe to continue using the admin portal.",
    };
  }

  if (status === "active") {
    return {
      status,
      isExpired: false,
      daysLeftInTrial: null,
      daysLeftInComp: null,
      requiresPayment: false,
      isComped: false,
      reason: business.subscription_cancel_at_period_end
        ? "Subscription cancels at period end — access continues until then."
        : null,
    };
  }

  if (status === "past_due") {
    return {
      status,
      isExpired: false,
      daysLeftInTrial: null,
      daysLeftInComp: null,
      requiresPayment: false,
      isComped: false,
      reason: "Payment failed — update billing to avoid interruption.",
    };
  }

  if (status === "trialing") {
    const trialLive =
      Boolean(trialEndsAt) &&
      Number.isFinite(new Date(trialEndsAt!).getTime()) &&
      new Date(trialEndsAt!).getTime() > nowMs;
    if (trialLive) {
      return {
        status,
        isExpired: false,
        daysLeftInTrial: daysUntil(trialEndsAt!, nowMs),
        daysLeftInComp: null,
        requiresPayment: false,
        isComped: false,
        reason: null,
      };
    }
    return {
      status,
      isExpired: true,
      daysLeftInTrial: 0,
      daysLeftInComp: null,
      requiresPayment: true,
      isComped: false,
      reason: "Your trial has ended. Subscribe to continue using the admin portal.",
    };
  }

  if (status === "canceled") {
    const periodEnd = business.subscription_current_period_end ?? null;
    const cancelAtPeriodEnd = Boolean(business.subscription_cancel_at_period_end);
    const periodLive =
      Boolean(periodEnd) &&
      Number.isFinite(new Date(periodEnd!).getTime()) &&
      new Date(periodEnd!).getTime() > nowMs;
    // Access continues only when cancel was scheduled for period end and the period is still open.
    if (cancelAtPeriodEnd && periodLive) {
      return {
        status,
        isExpired: false,
        daysLeftInTrial: null,
        daysLeftInComp: null,
        requiresPayment: false,
        isComped: false,
        reason: "Subscription cancels at period end — access continues until then.",
      };
    }
    return {
      status,
      isExpired: true,
      daysLeftInTrial: null,
      daysLeftInComp: null,
      requiresPayment: true,
      isComped: false,
      reason: "This subscription was canceled. Subscribe again to restore admin access.",
    };
  }

  // trial_expired or unknown
  return {
    status: "trial_expired",
    isExpired: true,
    daysLeftInTrial: 0,
    daysLeftInComp: null,
    requiresPayment: true,
    isComped: false,
    reason:
      status === "trial_expired"
        ? "Your trial has ended. Subscribe to continue using the admin portal."
        : "Subscription status is unknown. Subscribe or contact support to restore access.",
  };
}

export function paywallApiBody(state: SubscriptionState) {
  return {
    error: state.reason || "Subscription required.",
    code: "subscription_required",
    subscription_status: state.status,
    requires_payment: true,
  };
}

/**
 * Guard for Stripe billing webhooks.
 *
 * A Stripe webhook must NEVER overwrite `subscription_status` when the current
 * value is `comped`. Comped access is a platform grant (beta / owner / partner),
 * not a Stripe subscription state. Billing sync must skip or no-op those rows.
 *
 * Call this before applying any webhook-driven status change.
 */
export function shouldApplyStripeSubscriptionUpdate(currentStatus: string | null | undefined): boolean {
  // Never let Stripe clobber an active or expired-stored comp flag; operators
  // revoke comps explicitly via the platform console.
  if (currentStatus === "comped") return false;
  return true;
}

/** Client write APIs blocked when the photographer’s business is paywalled. */
export function isClientMutatingApi(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;

  if (pathname === "/api/messages" || pathname.startsWith("/api/messages/")) return true;
  if (pathname === "/api/approvals" || pathname.startsWith("/api/approvals/")) return true;
  if (pathname === "/api/request" || pathname.startsWith("/api/request/")) return true;
  if (/^\/api\/projects\/[^/]+\/messages\/?$/.test(pathname)) return true;
  return false;
}
