/**
 * Unit tests for Flow A vs Flow B Stripe webhook separation + access rules.
 * Run: npx tsx scripts/verify-stripe-billing-guards.ts
 */

import {
  getSubscriptionState,
  shouldApplyStripeSubscriptionUpdate,
  isPaywallApiExempt,
} from "../src/lib/subscription";
import {
  isShootPortalBillingInvoiceSignals,
  isShootPortalBillingMetadata,
  mapStripeSubscriptionStatus,
} from "../src/lib/stripe-billing";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

// --- Metadata marker ---
assert(
  isShootPortalBillingMetadata({ shootportal_billing: "true", business_id: "x" }),
  "billing metadata recognized"
);
assert(
  !isShootPortalBillingMetadata({ payment_id: "pay_1", business_id: "x" }),
  "tenant→client metadata is not billing"
);
assert(!isShootPortalBillingMetadata(null), "null metadata is not billing");

// --- Invoice skip signals (platform webhook) ---
assert(
  isShootPortalBillingInvoiceSignals({
    hasSubscription: true,
    metadataLooksBilling: true,
    customerMatchesBusinessBillingCustomer: false,
  }),
  "skip: subscription + billing metadata"
);
assert(
  isShootPortalBillingInvoiceSignals({
    hasSubscription: true,
    metadataLooksBilling: false,
    customerMatchesBusinessBillingCustomer: true,
  }),
  "skip: subscription + SaaS customer match"
);
assert(
  !isShootPortalBillingInvoiceSignals({
    hasSubscription: false,
    metadataLooksBilling: true,
    customerMatchesBusinessBillingCustomer: true,
  }),
  "do NOT skip: no subscription (tenant invoice-like)"
);
assert(
  !isShootPortalBillingInvoiceSignals({
    hasSubscription: true,
    metadataLooksBilling: false,
    customerMatchesBusinessBillingCustomer: false,
  }),
  "do NOT skip: subscription alone without SaaS signals"
);

// --- Status mapping ---
assert(mapStripeSubscriptionStatus("active") === "active", "active→active");
assert(mapStripeSubscriptionStatus("trialing") === "active", "trialing→active");
assert(mapStripeSubscriptionStatus("past_due") === "past_due", "past_due");
assert(mapStripeSubscriptionStatus("unpaid") === "past_due", "unpaid→past_due");
assert(mapStripeSubscriptionStatus("canceled") === "canceled", "canceled");
assert(mapStripeSubscriptionStatus("incomplete") === null, "incomplete unmapped");

// --- Comped protection ---
assert(shouldApplyStripeSubscriptionUpdate("comped") === false, "comped never overwritten");
assert(shouldApplyStripeSubscriptionUpdate("active") === true, "active may update");

// --- Cancel at period end keeps access ---
const now = new Date("2026-08-20T12:00:00Z");
const canceledStillPaid = getSubscriptionState(
  {
    subscription_status: "canceled",
    subscription_cancel_at_period_end: true,
    subscription_current_period_end: "2026-09-01T12:00:00Z",
  },
  now
);
assert(
  !canceledStillPaid.requiresPayment && !canceledStillPaid.isExpired,
  "canceled + future period end keeps access"
);

const canceledImmediate = getSubscriptionState(
  {
    subscription_status: "canceled",
    subscription_cancel_at_period_end: false,
    subscription_current_period_end: "2026-09-01T12:00:00Z",
  },
  now
);
assert(
  canceledImmediate.requiresPayment && canceledImmediate.isExpired,
  "immediate cancel paywalls even if period end is future"
);

const canceledEnded = getSubscriptionState(
  {
    subscription_status: "canceled",
    subscription_cancel_at_period_end: true,
    subscription_current_period_end: "2026-08-01T12:00:00Z",
  },
  now
);
assert(canceledEnded.requiresPayment && canceledEnded.isExpired, "canceled + past period paywalls");

const activeCancelScheduled = getSubscriptionState(
  {
    subscription_status: "active",
    subscription_cancel_at_period_end: true,
    subscription_current_period_end: "2026-09-01T12:00:00Z",
  },
  now
);
assert(
  !activeCancelScheduled.requiresPayment && activeCancelScheduled.reason != null,
  "active cancel-at-period-end still has access + reason"
);

assert(isPaywallApiExempt("/api/auth/signout"), "paywall exempt: auth");
assert(isPaywallApiExempt("/api/billing/checkout"), "paywall exempt: checkout");
assert(isPaywallApiExempt("/api/billing/portal"), "paywall exempt: portal");
assert(!isPaywallApiExempt("/api/projects"), "paywall NOT exempt: projects");
assert(!isPaywallApiExempt("/api/admin/settings"), "paywall NOT exempt: settings");

console.log("verify-stripe-billing-guards: all passed");
