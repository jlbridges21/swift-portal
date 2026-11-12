/**
 * Unit tests for embedded (in-app) Stripe checkout and signed pay links. Pure — no Stripe or
 * database calls, safe to run anywhere.
 * Run: npx tsx scripts/verify-embedded-checkout.ts
 */
import { buildPaymentCheckoutParams } from "../src/lib/checkout-session-params";
import { buildStripePaymentMetadata, CLIENT_FEE_METADATA_KEY } from "../src/lib/stripe-metadata";
import { CARD_FEE_LINE_NAME, cardFeeCents } from "../src/lib/card-fee";

process.env.PAY_LINK_SECRET = "test-secret-for-verify-script";

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}

const payment = { id: "11111111-1111-4111-8111-111111111111", amount: 125000, description: "Final payment — 12 Oak St", project_id: "22222222-2222-4222-8222-222222222222" };
const metadata = buildStripePaymentMetadata({ paymentId: payment.id, businessId: "33333333-3333-4333-8333-333333333333", projectId: payment.project_id });
const appUrl = "https://acme.shootportal.app";

async function main() {
  // --- Hosted checkout is unchanged ---------------------------------------------------------
  const hosted = buildPaymentCheckoutParams({ payment, method: "card", feeCents: 0, metadata, appUrl });
  assert(hosted.ui_mode === undefined, "hosted: no ui_mode (Stripe default hosted page)");
  assert(hosted.success_url === `${appUrl}/dashboard/projects/${payment.project_id}?payment=success#payments`, "hosted: success_url unchanged");
  assert(hosted.cancel_url?.includes("payment=cancelled"), "hosted: cancel_url unchanged");
  assert(hosted.return_url === undefined, "hosted: no return_url");

  // --- Embedded checkout (Checkout Sessions + Payment Element) -------------------------------
  const fee = cardFeeCents(payment.amount);
  const embedded = buildPaymentCheckoutParams({
    payment,
    method: "card",
    feeCents: fee,
    metadata: { ...metadata, [CLIENT_FEE_METADATA_KEY]: String(fee) },
    appUrl,
    uiMode: "elements",
    customerEmail: "client@example.com",
  });
  assert(embedded.ui_mode === "elements", "embedded: ui_mode elements");
  assert(embedded.success_url === undefined && embedded.cancel_url === undefined, "embedded: no success/cancel redirect URLs");
  assert(
    embedded.return_url === `${appUrl}/dashboard/projects/${payment.project_id}?payment=returned&payment_id=${payment.id}&session_id={CHECKOUT_SESSION_ID}#payments`,
    "embedded: return_url comes back to the project with the session template"
  );
  assert(embedded.line_items?.[0]?.price_data?.unit_amount === payment.amount, "embedded: line item amount is the payment row amount");
  assert(embedded.line_items?.[1]?.price_data?.product_data?.name === CARD_FEE_LINE_NAME, "embedded: card fee line kept");
  assert(embedded.line_items?.[1]?.price_data?.unit_amount === fee, "embedded: card fee amount kept");
  assert(JSON.stringify(embedded.payment_method_types) === JSON.stringify(["card"]), "embedded: card fee → cards only (same as hosted)");
  assert(embedded.metadata?.payment_id === payment.id && embedded.payment_intent_data?.metadata?.payment_id === payment.id, "embedded: webhook metadata on session and PaymentIntent");
  assert(embedded.client_reference_id === payment.id, "embedded: client_reference_id kept");
  assert(embedded.customer_email === "client@example.com", "embedded: receipt email prefilled");
  assert(embedded.mode === "payment", "embedded: payment mode");

  const embeddedNoFee = buildPaymentCheckoutParams({ payment, method: "card", feeCents: 0, metadata, appUrl, uiMode: "elements" });
  assert(JSON.stringify(embeddedNoFee.excluded_payment_method_types) === JSON.stringify(["us_bank_account"]), "embedded: no fee → all methods except bank");
  assert(embeddedNoFee.customer_email === undefined, "embedded: no email when none on file");

  const badEmail = buildPaymentCheckoutParams({ payment, method: "card", feeCents: 0, metadata, appUrl, uiMode: "elements", customerEmail: "not an email" });
  assert(badEmail.customer_email === undefined, "embedded: invalid email is not sent to Stripe");

  const bank = buildPaymentCheckoutParams({ payment, method: "bank", feeCents: 999, metadata, appUrl, uiMode: "elements" });
  assert(JSON.stringify(bank.payment_method_types) === JSON.stringify(["us_bank_account"]), "embedded bank: ACH only");
  assert(bank.line_items?.length === 1, "embedded bank: never charges the card fee");

  const marketing = buildPaymentCheckoutParams({ payment, method: "card", feeCents: 0, metadata, appUrl, uiMode: "elements", returnTo: "marketing" });
  assert(marketing.return_url?.startsWith(`${appUrl}/dashboard/projects/${payment.project_id}/marketing?payment=returned`), "embedded: marketing return path");

  const payPage = buildPaymentCheckoutParams({ payment, method: "card", feeCents: 0, metadata, appUrl, uiMode: "elements", returnTo: { path: "/pay/abc.def" } });
  assert(payPage.return_url?.startsWith(`${appUrl}/pay/abc.def?payment=returned`), "embedded: public pay page return path");

  const evil = buildPaymentCheckoutParams({ payment, method: "card", feeCents: 0, metadata, appUrl, uiMode: "elements", returnTo: { path: "//evil.example/steal" } });
  assert(evil.return_url?.startsWith(`${appUrl}/dashboard/projects/`), "embedded: protocol-relative return path rejected");
  const evil2 = buildPaymentCheckoutParams({ payment, method: "card", feeCents: 0, metadata, appUrl, uiMode: "elements", returnTo: { path: "https://evil.example" } });
  assert(evil2.return_url?.startsWith(`${appUrl}/dashboard/projects/`), "embedded: absolute return URL rejected");

  // --- Signed pay links ----------------------------------------------------------------------
  const { parsePayLinkToken, signPayLinkToken, verifyPayLinkToken, payLinkPath } = await import("../src/lib/pay-link");
  const businessA = "33333333-3333-4333-8333-333333333333";
  const businessB = "44444444-4444-4444-8444-444444444444";
  const token = signPayLinkToken(payment.id, businessA);
  assert(/^[0-9a-f-]{36}\.[0-9a-f]{32}$/.test(token), "pay link: token is id.signature");
  assert(verifyPayLinkToken(token, businessA), "pay link: verifies for its business");
  assert(!verifyPayLinkToken(token, businessB), "pay link: rejected for another business (no cross-tenant use)");
  assert(verifyPayLinkToken(token, businessA.toUpperCase()), "pay link: business id case-insensitive");
  const tampered = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
  assert(!verifyPayLinkToken(tampered, businessA), "pay link: tampered signature rejected");
  const otherPayment = signPayLinkToken("55555555-5555-4555-8555-555555555555", businessA);
  const swapped = `${payment.id}.${otherPayment.split(".")[1]}`;
  assert(!verifyPayLinkToken(swapped, businessA), "pay link: signature from another payment rejected");
  assert(parsePayLinkToken("not-a-token") === null, "pay link: malformed token rejected");
  assert(parsePayLinkToken(`${token}.extra`) === null, "pay link: extra segment rejected");
  assert(parsePayLinkToken(`${payment.id}.${"g".repeat(32)}`) === null, "pay link: non-hex signature rejected");
  assert(!verifyPayLinkToken(token, null), "pay link: missing business rejected");
  assert(payLinkPath(token) === `/pay/${token}`, "pay link: path");

  process.env.PAY_LINK_SECRET = "rotated-secret";
  assert(!verifyPayLinkToken(token, businessA), "pay link: different secret does not verify");


  // --- Deposits must not deliver the project (download gate) ---------------------------------
  const { quoteBalanceAfterPaymentCents, classifyUnexpectedStripePayment } = await import("../src/lib/stripe-payments");
  const dep = { id: "dep", amount: 50000 };
  assert(quoteBalanceAfterPaymentCents(200000, [{ id: "dep", amount: 50000, status: "pending" }], dep) === 150000, "deposit: leaves a balance → no Delivered move");
  assert(
    quoteBalanceAfterPaymentCents(200000, [{ id: "dep", amount: 50000, status: "paid" }, { id: "bal", amount: 150000, status: "pending" }], { id: "bal", amount: 150000 }) === 0,
    "balance payment: covers the quote → Delivered allowed"
  );
  assert(quoteBalanceAfterPaymentCents(200000, [{ id: "full", amount: 200000, status: "sent" }], { id: "full", amount: 200000 }) === 0, "pay in full: no balance");
  assert(
    quoteBalanceAfterPaymentCents(200000, [{ id: "a", amount: 50000, status: "cancelled" }], { id: "b", amount: 50000 }) === 150000,
    "cancelled rows don't count toward the quote"
  );
  assert(
    quoteBalanceAfterPaymentCents(200000, [{ id: "a", amount: 50000, status: "processing" }], { id: "b", amount: 150000 }) === 0,
    "processing bank payments count toward the quote"
  );

  // --- Second charge on a settled / closed row is flagged, never silent ----------------------
  const paidRow = { status: "paid" as const, stripe_payment_intent_id: "pi_original", payment_method_type: "card" as const };
  assert(classifyUnexpectedStripePayment(paidRow, "pi_original", "checkout.session.completed") === null, "same PaymentIntent (webhook retry) → not a duplicate");
  assert(classifyUnexpectedStripePayment(paidRow, "pi_second", "checkout.session.completed") === "duplicate", "different PaymentIntent on a paid row → duplicate");
  assert(
    classifyUnexpectedStripePayment({ status: "paid", stripe_payment_intent_id: null, payment_method_type: "manual" }, "pi_card", "checkout.session.completed") === "duplicate",
    "card payment after a manual mark-paid → duplicate"
  );
  assert(
    classifyUnexpectedStripePayment({ status: "paid", stripe_payment_intent_id: null, payment_method_type: null }, "pi_x", "checkout.session.completed") === null,
    "legacy paid row without a stored PaymentIntent → not flagged (no false alarms)"
  );
  assert(
    classifyUnexpectedStripePayment({ status: "cancelled", stripe_payment_intent_id: null, payment_method_type: null }, "pi_x", "payment_intent.succeeded") === "not_payable",
    "payment on a cancelled request → flagged"
  );
  assert(
    classifyUnexpectedStripePayment({ status: "sent", stripe_payment_intent_id: null, payment_method_type: null }, "pi_x", "checkout.session.completed") === null,
    "normal first payment → not flagged"
  );
  assert(classifyUnexpectedStripePayment(paidRow, "pi_second", "manual_admin") === null, "manual mark-paid is never flagged");

  // --- Expired-session notifications only for real timeouts ----------------------------------
  const { wasClosedEarly } = await import("../src/lib/checkout-closure");
  const expiresAt = 1_800_000_000;
  assert(wasClosedEarly({ expires_at: expiresAt }, expiresAt - 3600), "session expired an hour early → closed by ShootPortal");
  assert(!wasClosedEarly({ expires_at: expiresAt }, expiresAt + 5), "session expired at its deadline → natural timeout");

  console.log(`\nAll ${passed} embedded checkout checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
