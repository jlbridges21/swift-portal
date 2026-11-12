/**
 * Pure checks for ShootPortal receipts (no database, no Stripe, no network).
 * Run: npx tsx scripts/verify-payment-receipt-view.ts
 */
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import {
  composeReceipt,
  factsFromCharge,
  isManualPayment,
  receiptGate,
  receiptMethodLabel,
  receiptNumberFor,
  type ReceiptFrozen,
  type StripeReceiptFacts,
} from "../src/lib/payment-receipt";
import { buildPaymentReceiptPdf } from "../src/lib/payment-receipt-pdf";
import { redactReceiptForPayLink, receiptPagePath } from "../src/lib/receipt-access";
import { paymentReceiptHref } from "../src/lib/payment-status";

const PAYMENT_ID = "3f2b1c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d";
const PROJECT_ID = "11111111-2222-4333-8444-555555555555";

const frozen: ReceiptFrozen = {
  business: { name: "Swift Media Co", addressLines: ["12 Main St", "Austin, TX 78701"], email: "hello@example.test", phone: "555-0100", website: "", logoUrl: "" },
  projectName: "123 Oak Lane shoot",
  propertyAddress: "123 Oak Lane, Austin TX",
  clientName: "Jamie Client",
  description: "Deposit (50%)",
  purchaseLabel: null,
  quote: { title: "Listing package", totalCents: 40000, lineItems: [{ description: "Photos", amountCents: 30000 }, { description: "Drone", amountCents: 10000 }] },
  frozenAt: "2026-01-01T00:00:00.000Z",
};

const stripePayment = {
  id: PAYMENT_ID,
  project_id: PROJECT_ID,
  amount: 20000,
  paid_at: "2026-02-03T15:00:00.000Z",
  client_fee_cents: 610,
  payment_method_type: "card" as const,
  card_last4: "4242",
  stripe_payment_intent_id: "pi_123",
  stripe_checkout_session_id: "cs_123",
  stripe_invoice_id: null,
};

const facts: StripeReceiptFacts = factsFromCharge(
  {
    id: "ch_123",
    amount: 20610,
    currency: "usd",
    created: 1770130800,
    amount_refunded: 0,
    disputed: false,
    payment_method_details: { type: "card", card: { brand: "visa", last4: "4242" } } as never,
  },
  "pi_123",
  null
);

// 1. Gate: only paid rows produce receipts.
assert.equal(receiptGate("paid"), null);
assert.equal(receiptGate("processing")?.code, "processing");
for (const s of ["pending", "sent", "draft", "failed", "cancelled", "expired"] as const) {
  assert.equal(receiptGate(s)?.code, "not_paid", `status ${s} must not get a receipt`);
}

// 2. Stable receipt number and links.
assert.equal(receiptNumberFor(PAYMENT_ID), "RCPT-3F2B1C4D5E");
assert.equal(receiptNumberFor(PAYMENT_ID), receiptNumberFor(PAYMENT_ID));
assert.equal(paymentReceiptHref(PAYMENT_ID), `/api/payments/${PAYMENT_ID}/receipt`);
assert.ok(!paymentReceiptHref(PAYMENT_ID).includes("stripe.com"));
assert.equal(receiptPagePath("business", PROJECT_ID, PAYMENT_ID), `/admin/projects/${PROJECT_ID}/receipts/${PAYMENT_ID}`);
assert.equal(receiptPagePath("client", PROJECT_ID, PAYMENT_ID), `/dashboard/projects/${PROJECT_ID}/receipts/${PAYMENT_ID}`);

// 3. Partial (deposit) payment: one line for this payment, never the full estimate.
const deposit = composeReceipt({ payment: stripePayment, frozen, stripe: facts, stripeSource: "live", stripeVerifiedAt: "2026-02-03T15:01:00.000Z" });
assert.equal(deposit.kind, "stripe");
assert.equal(deposit.status, "paid");
assert.equal(deposit.title, "Payment Receipt");
assert.deepEqual(deposit.lineItems.map((l) => [l.label, l.amountCents]), [["Deposit (50%)", 20000], ["Card processing fee", 610]]);
assert.equal(deposit.totalCents, 20610);
assert.match(deposit.appliedToward ?? "", /Applied toward Listing package \(estimate total \$400\.00\)/);
assert.equal(deposit.methodLabel, "Visa ending 4242");
assert.equal(deposit.verification.source, "stripe_live");
assert.equal(deposit.notes.length, 0);

// 4. A single payment covering the whole estimate shows the estimate's line items.
const full = composeReceipt({
  payment: { ...stripePayment, amount: 40000, client_fee_cents: 0 },
  frozen,
  stripe: { ...facts, amountCents: 40000 },
  stripeSource: "live",
  stripeVerifiedAt: null,
});
assert.deepEqual(full.lineItems.map((l) => l.label), ["Photos", "Drone"]);
assert.equal(full.appliedToward, null);

// 5. Refunds.
const partialRefund = composeReceipt({ payment: stripePayment, frozen, stripe: { ...facts, refundedCents: 5000, lastRefundAt: "2026-03-01T00:00:00.000Z" }, stripeSource: "live", stripeVerifiedAt: null });
assert.equal(partialRefund.status, "partially_refunded");
assert.equal(partialRefund.refundedCents, 5000);
const fullRefund = composeReceipt({ payment: stripePayment, frozen, stripe: { ...facts, refundedCents: 20610 }, stripeSource: "live", stripeVerifiedAt: null });
assert.equal(fullRefund.status, "refunded");

// 6. Stripe unreachable: record-only, with an honest note; saved snapshot says when it was verified.
const recordOnly = composeReceipt({ payment: stripePayment, frozen, stripe: null, stripeSource: null, stripeVerifiedAt: null });
assert.equal(recordOnly.verification.source, "record_only");
assert.equal(recordOnly.totalCents, 20610);
assert.equal(recordOnly.methodLabel, "Card ending 4242");
assert.match(recordOnly.notes[0], /could not be confirmed with Stripe/);
const saved = composeReceipt({ payment: stripePayment, frozen, stripe: facts, stripeSource: "saved", stripeVerifiedAt: "2026-02-03T15:01:00.000Z" });
assert.equal(saved.verification.source, "stripe_saved");
assert.match(saved.notes[0], /verified with Stripe on Feb 3, 2026/);

// 7. Stripe amount differs from the record: Stripe wins, and the receipt says so.
const mismatch = composeReceipt({ payment: stripePayment, frozen, stripe: { ...facts, amountCents: 19000 }, stripeSource: "live", stripeVerifiedAt: null });
assert.equal(mismatch.totalCents, 19000);
assert.match(mismatch.notes[0], /differs from the ShootPortal payment record/);

// 8. Manual payments are acknowledgments, not Stripe receipts, and carry no card fee.
const manualRow = { ...stripePayment, payment_method_type: "manual" as const, card_last4: null, client_fee_cents: 0 };
assert.ok(isManualPayment(manualRow));
assert.ok(isManualPayment({ payment_method_type: null, stripe_payment_intent_id: null, stripe_checkout_session_id: null, stripe_invoice_id: null }));
assert.ok(!isManualPayment(stripePayment));
const manual = composeReceipt({ payment: manualRow, frozen, stripe: null, stripeSource: null, stripeVerifiedAt: null });
assert.equal(manual.kind, "manual");
assert.equal(manual.title, "Payment Acknowledgment");
assert.equal(manual.methodLabel, "Recorded by the business");
assert.equal(manual.verification.source, "manual");
assert.match(manual.notes[0], /not processed through ShootPortal's Stripe checkout/);

// 9. ACH and Marketing Kit labels.
assert.equal(receiptMethodLabel({ kind: "stripe", methodType: "us_bank_account", bankName: "STRIPE TEST BANK", last4: "6789" }), "Bank transfer (ACH) · STRIPE TEST BANK ending 6789");
const kit = composeReceipt({ payment: { ...stripePayment, client_fee_cents: 0 }, frozen: { ...frozen, purchaseLabel: "Property Website", quote: null, description: "Property Website add-on" }, stripe: { ...facts, amountCents: 20000 }, stripeSource: "live", stripeVerifiedAt: null });
assert.equal(kit.description, "Property Website");
assert.equal(kit.lineItems[0].label, "Property Website add-on");

// 10. Card facts never carry more than brand + last 4.
assert.deepEqual(Object.keys(facts).sort(), ["amountCents", "bankName", "cardBrand", "chargeId", "createdAt", "currency", "disputed", "lastRefundAt", "last4", "methodType", "paymentIntentId", "refundedCents"].sort());

// 11. Pay-link receipts drop who paid and the property.
const redacted = redactReceiptForPayLink(deposit);
assert.equal(redacted.clientName, "");
assert.equal(redacted.propertyAddress, "");
assert.equal(redacted.projectName, "");
assert.equal(redacted.totalCents, deposit.totalCents);

// 12. PDF renders (with refunds + notes) and is a real PDF.
(async () => {
  const pdf = await buildPaymentReceiptPdf(partialRefund);
  assert.equal(Buffer.from(pdf.slice(0, 5)).toString(), "%PDF-");
  assert.ok(pdf.byteLength > 1500);
  const manualPdf = await buildPaymentReceiptPdf({ ...manual, business: { ...manual.business, name: "Émile’s Studio — Photo" } });
  assert.equal(Buffer.from(manualPdf.slice(0, 5)).toString(), "%PDF-");
  const out = process.env.RECEIPT_PDF_OUT;
  if (out) writeFileSync(out, pdf);
  console.log("verify-payment-receipt-view: all checks passed");
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
