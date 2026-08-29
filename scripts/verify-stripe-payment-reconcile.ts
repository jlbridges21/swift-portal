/**
 * Unit tests for Stripe payment reconciliation helpers.
 * Run: npx tsx scripts/verify-stripe-payment-reconcile.ts
 */

import {
  pickAuthoritativeSucceededSession,
  type StripeSucceededPayment,
} from "../src/lib/stripe-payment-reconcile";
import { isPaymentComplete } from "../src/lib/payment-status";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
  console.log("OK:", msg);
}

assert(isPaymentComplete("paid"), "paid is complete");
assert(!isPaymentComplete("sent"), "sent is outstanding");

const sessions = [
  {
    id: "cs_first",
    payment_status: "paid",
    amount_total: 25000,
    created: 100,
    payment_intent: "pi_good",
  },
  {
    id: "cs_duplicate",
    payment_status: "paid",
    amount_total: 25000,
    created: 200,
    payment_intent: "pi_dup",
  },
  {
    id: "cs_wrong_amount",
    payment_status: "paid",
    amount_total: 100,
    created: 50,
    payment_intent: "pi_wrong",
  },
] as Parameters<typeof pickAuthoritativeSucceededSession>[0];

const picked = pickAuthoritativeSucceededSession(sessions, 25000);
assert(picked?.id === "cs_first", "picks earliest matching amount");

const none = pickAuthoritativeSucceededSession(
  [{ id: "x", payment_status: "unpaid", amount_total: 25000, created: 1 }] as Parameters<
    typeof pickAuthoritativeSucceededSession
  >[0],
  25000
);
assert(none === null, "ignores unpaid sessions");

const sample: StripeSucceededPayment = {
  checkoutSessionId: "cs_1",
  paymentIntentId: "pi_1",
  receiptUrl: null,
  metadata: { payment_id: "00000000-0000-0000-0000-000000000001" },
  amountReceived: 25000,
  paidAt: new Date().toISOString(),
};
assert(sample.paymentIntentId === "pi_1", "fixture shape ok");

console.log("verify-stripe-payment-reconcile: all passed");
