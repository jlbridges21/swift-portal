/**
 * Unit tests for bank (ACH) payments and the optional card fee.
 * Run: npx tsx scripts/verify-ach-payments.ts
 */
import type Stripe from "stripe";
import { achFeeCents, cardFeeCents } from "../src/lib/card-fee";
import { isPaymentComplete, isPaymentCovered, isPaymentProcessing, paymentMethodLabel } from "../src/lib/payment-status";
import { paidCentsForQuote, quoteOutstandingBalanceCents } from "../src/lib/payment-quote";
import { paymentStepStatus, paymentSummaryLabel } from "../src/lib/pricing-workflow";
import { expectedChargeCents, pickAuthoritativeSucceededSession } from "../src/lib/stripe-payment-reconcile";
import { isProcessingBankIntent, paymentIntentIdFromSession } from "../src/lib/stripe-async-payments";
import { CLIENT_FEE_METADATA_KEY, parseClientFeeFromMetadata } from "../src/lib/stripe-metadata";
import { receiptDetailsFromCharge } from "../src/lib/stripe-receipt";
import { accountAcceptsAch } from "../src/lib/stripe-connect";
import { buildDefaultWorkflowSettings, sanitizePaymentAutomation } from "../src/lib/workflow-settings";
import type { Payment, PaymentStatus } from "../src/lib/types";

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}

function row(id: string, status: PaymentStatus, amount: number, quoteId = "q1", extra: Partial<Payment> = {}): Payment {
  return {
    id,
    project_id: "p1",
    client_id: "c1",
    quote_id: quoteId,
    amount,
    description: "Test",
    due_date: null,
    status,
    stripe_payment_link_id: null,
    stripe_payment_link_url: null,
    stripe_checkout_session_id: null,
    stripe_receipt_url: null,
    paid_at: null,
    created_at: "2026-10-27T00:00:00Z",
    updated_at: "2026-10-27T00:00:00Z",
    ...extra,
  };
}

// ---------------------------------------------------------------- card fee
assert(cardFeeCents(50000) === 1500, "$500 invoice: card fee capped at 3% = $15.00");
assert(cardFeeCents(10000) === 300, "$100 invoice: fee capped at $3.00 (gross-up would be $3.30)");
{
  // Large invoice: gross-up is under the 3% cap, so the business nets the full amount.
  const amount = 500000;
  const fee = cardFeeCents(amount);
  const stripeFee = Math.round((amount + fee) * 0.029) + 30;
  assert(fee <= amount * 0.03, "$5,000 invoice: fee never exceeds 3%");
  assert(amount + fee - stripeFee >= amount - 1, `$5,000 invoice: business keeps the invoice amount (fee ${fee})`);
}
assert(cardFeeCents(0) === 0 && cardFeeCents(-5) === 0 && cardFeeCents(Number.NaN) === 0, "no fee on zero, negative, or invalid amounts");
assert(achFeeCents(10000) === 80, "ACH fee on $100 is 80¢");
assert(achFeeCents(500000) === 500, "ACH fee capped at $5");

// ---------------------------------------------------------------- settings
assert(buildDefaultWorkflowSettings().payments.passCardFeeToClient === false, "card fee pass-through is off by default");
assert(
  sanitizePaymentAutomation({ ...buildDefaultWorkflowSettings().payments, passCardFeeToClient: "yes" as unknown as boolean }).passCardFeeToClient === false,
  "only a real true turns the card fee on"
);
assert(sanitizePaymentAutomation({ ...buildDefaultWorkflowSettings().payments, passCardFeeToClient: true }).passCardFeeToClient === true, "card fee setting persists");

// ---------------------------------------------------------------- statuses
assert(isPaymentProcessing("processing") && !isPaymentComplete("processing"), "processing is not complete");
assert(isPaymentCovered("processing") && isPaymentCovered("paid") && !isPaymentCovered("pending") && !isPaymentCovered("sent"), "processing and paid are covered");

// ---------------------------------------------------------------- balances
{
  const payments = [row("dep", "processing", 25000), row("bal", "sent", 25000)];
  assert(paidCentsForQuote(payments, "q1") === 25000, "a processing deposit counts toward the quote");
  assert(quoteOutstandingBalanceCents({ id: "q1", total_cents: 50000 }, payments) === 25000, "balance excludes the processing deposit");
  assert(paymentStepStatus(payments, { id: "q1", total_cents: 50000 }) === "Payment Sent", "balance still due → Payment Sent");
}
{
  const payments = [row("full", "processing", 50000)];
  assert(quoteOutstandingBalanceCents({ id: "q1", total_cents: 50000 }, payments) === 0, "processing full payment leaves no balance");
  assert(paymentStepStatus(payments, { id: "q1", total_cents: 50000 }) === "Processing", "workflow step shows Processing");
  assert(/processing/.test(paymentSummaryLabel(payments, { id: "q1", total_cents: 50000 })), "summary mentions the bank payment is processing");
  assert(paymentStepStatus([row("full", "paid", 50000)], { id: "q1", total_cents: 50000 }) === "Paid", "cleared payment shows Paid");
}

// ---------------------------------------------------------------- method labels
assert(paymentMethodLabel({ payment_method_type: "us_bank_account" }) === "Bank transfer (ACH)", "bank label");
assert(paymentMethodLabel({ payment_method_type: "card", card_last4: "4242" }) === "Card ending 4242", "card label");
assert(paymentMethodLabel({ payment_method_type: "manual" }) === "Recorded by the business", "manual label");
assert(paymentMethodLabel({ card_last4: "1111" }) === "Card ending 1111", "legacy rows fall back to card last four");

// ---------------------------------------------------------------- Stripe helpers
assert(parseClientFeeFromMetadata({ [CLIENT_FEE_METADATA_KEY]: "1500" }) === 1500, "fee read from metadata");
assert(parseClientFeeFromMetadata({ [CLIENT_FEE_METADATA_KEY]: "abc" }) === 0 && parseClientFeeFromMetadata(null) === 0, "bad or missing fee metadata is zero");
assert(expectedChargeCents(50000, { [CLIENT_FEE_METADATA_KEY]: "1500" }) === 51500, "expected charge includes the card fee");
assert(expectedChargeCents(50000, {}) === 50000, "expected charge without a fee");

{
  const sessions = [
    { id: "cs_fee", payment_status: "paid", amount_total: 51500, created: 1, metadata: { [CLIENT_FEE_METADATA_KEY]: "1500" } },
    { id: "cs_wrong", payment_status: "paid", amount_total: 51500, created: 0, metadata: {} },
  ] as unknown as Stripe.Checkout.Session[];
  assert(pickAuthoritativeSucceededSession(sessions, 50000)?.id === "cs_fee", "reconcile accepts a session paid with the card fee, rejects an unexplained overcharge");
}

assert(isProcessingBankIntent({ status: "processing", payment_method_types: ["us_bank_account"] }), "processing ACH intent detected");
assert(!isProcessingBankIntent({ status: "requires_action", payment_method_types: ["us_bank_account"] }), "unverified bank (microdeposits) is not processing");
assert(!isProcessingBankIntent({ status: "processing", payment_method_types: ["card"] }), "card intents are never treated as bank processing");
assert(paymentIntentIdFromSession({ payment_intent: "pi_1" }) === "pi_1" && paymentIntentIdFromSession({ payment_intent: { id: "pi_2" } as Stripe.PaymentIntent }) === "pi_2", "intent id from session");

assert(receiptDetailsFromCharge({ payment_method_details: { type: "us_bank_account" } }).methodType === "us_bank_account", "receipt detects a bank charge");
assert(receiptDetailsFromCharge({ payment_method_details: { type: "card", card: { last4: "4242" } } }).cardLast4 === "4242", "receipt keeps card last four");

assert(accountAcceptsAch({ charges_enabled: true, capabilities: { us_bank_account_ach_payments: "active" } } as Stripe.Account), "active ACH capability → bank payments on");
assert(!accountAcceptsAch({ charges_enabled: true, capabilities: { us_bank_account_ach_payments: "pending" } } as Stripe.Account), "pending capability → off");
assert(!accountAcceptsAch({ charges_enabled: false, capabilities: { us_bank_account_ach_payments: "active" } } as Stripe.Account), "charges disabled → off");
assert(!accountAcceptsAch({ charges_enabled: true, capabilities: {} } as Stripe.Account), "no capability → off");

console.log(`\n${passed} passed`);
