/**
 * ShootPortal subscription access model (no Stripe in this module).
 *
 * Expiry for `trialing` is computed LIVE from `trial_ends_at`. A cron that
 * flips stored status to `trial_expired` is reporting-only — the gate must
 * stay correct even if that cron never runs.
 */

export const SUBSCRIPTION_STATUSES = [
  "trialing",
  "active",
  "past_due",
  "canceled",
  "trial_expired",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

export type SubscriptionBusinessFields = {
  subscription_status?: string | null;
  trial_ends_at?: string | null;
};

export type SubscriptionState = {
  status: SubscriptionStatus;
  isExpired: boolean;
  daysLeftInTrial: number | null;
  requiresPayment: boolean;
  /** Human reason for the paywall / banner, when relevant. */
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

  if (status === "active") {
    return {
      status,
      isExpired: false,
      daysLeftInTrial: null,
      requiresPayment: false,
      reason: null,
    };
  }

  if (status === "past_due") {
    return {
      status,
      isExpired: false,
      daysLeftInTrial: null,
      requiresPayment: false,
      reason: "Payment failed — update billing to avoid interruption.",
    };
  }

  if (status === "trialing") {
    const trialLive =
      Boolean(trialEndsAt) && Number.isFinite(new Date(trialEndsAt!).getTime()) && new Date(trialEndsAt!).getTime() > nowMs;
    if (trialLive) {
      return {
        status,
        isExpired: false,
        daysLeftInTrial: daysUntil(trialEndsAt!, nowMs),
        requiresPayment: false,
        reason: null,
      };
    }
    return {
      status,
      isExpired: true,
      daysLeftInTrial: 0,
      requiresPayment: true,
      reason: "Your trial has ended. Subscribe to continue using the admin portal.",
    };
  }

  if (status === "canceled") {
    return {
      status,
      isExpired: true,
      daysLeftInTrial: null,
      requiresPayment: true,
      reason: "This subscription was canceled. Subscribe again to restore admin access.",
    };
  }

  // trial_expired or unknown
  return {
    status: status === "trial_expired" ? "trial_expired" : "trial_expired",
    isExpired: true,
    daysLeftInTrial: 0,
    requiresPayment: true,
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

/** Client write APIs blocked when the photographer’s business is paywalled. */
export function isClientMutatingApi(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return false;

  if (pathname === "/api/messages" || pathname.startsWith("/api/messages/")) return true;
  if (pathname === "/api/approvals" || pathname.startsWith("/api/approvals/")) return true;
  if (pathname === "/api/request" || pathname.startsWith("/api/request/")) return true;
  // Project-scoped client messaging
  if (/^\/api\/projects\/[^/]+\/messages\/?$/.test(pathname)) return true;
  return false;
}
