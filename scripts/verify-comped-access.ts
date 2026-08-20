/**
 * Unit checks for comped access + Stripe webhook forward guard.
 * Run: npx tsx scripts/verify-comped-access.ts
 */

import {
  getSubscriptionState,
  shouldApplyStripeSubscriptionUpdate,
} from "../src/lib/subscription";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

const now = new Date("2026-08-20T12:00:00Z");

const permanent = getSubscriptionState(
  {
    subscription_status: "comped",
    comped_until: null,
    comped_reason: "Platform owner",
  },
  now
);
assert(permanent.isComped && !permanent.requiresPayment && !permanent.isExpired, "permanent comp full access");
assert(permanent.daysLeftInComp === null, "permanent comp has no daysLeftInComp");

const future = getSubscriptionState(
  {
    subscription_status: "comped",
    comped_until: "2026-08-25T12:00:00Z",
    comped_reason: "Beta",
  },
  now
);
assert(future.isComped && !future.requiresPayment && future.daysLeftInComp === 5, "time-limited comp +5d");

const expired = getSubscriptionState(
  {
    subscription_status: "comped",
    comped_until: "2026-08-19T12:00:00Z",
  },
  now
);
assert(
  expired.requiresPayment && expired.isExpired && !expired.isComped,
  "expired comp paywalls live without cron"
);

assert(shouldApplyStripeSubscriptionUpdate("active") === true, "stripe may update active");
assert(shouldApplyStripeSubscriptionUpdate("trialing") === true, "stripe may update trialing");
assert(shouldApplyStripeSubscriptionUpdate("comped") === false, "stripe must NEVER overwrite comped");
assert(shouldApplyStripeSubscriptionUpdate(null) === true, "null status allows stripe apply");

console.log("verify-comped-access: all passed");
