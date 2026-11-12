/**
 * Stripe TEST-MODE integration checks for the duplicate-charge guards. Talks to Stripe only
 * (platform test account) — no database reads or writes. Refuses to run with a live key.
 *
 * Run: npx tsx --env-file=.env.local scripts/verify-checkout-guards-stripe.ts
 */
import { randomUUID } from "node:crypto";
import { getStripe, getStripeMode } from "../src/lib/stripe";
import { buildPaymentCheckoutParams } from "../src/lib/checkout-session-params";
import { buildStripePaymentMetadata } from "../src/lib/stripe-metadata";
import { closeOpenCheckoutsForPayment, findInFlightStripePayment, retirePaymentCheckouts } from "../src/lib/checkout-closure";

if (getStripeMode() !== "test") {
  console.error("Refusing to run: STRIPE_SECRET_KEY is not a test key.");
  process.exit(1);
}

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const { stripe } = getStripe();
  const paymentId = randomUUID();
  const projectId = randomUUID();
  const metadata = { ...buildStripePaymentMetadata({ paymentId, businessId: randomUUID(), projectId }), verify_script: "checkout-guards" };
  const payment = { id: paymentId, amount: 30000, description: "Verify script — guard test", project_id: projectId };
  const params = buildPaymentCheckoutParams({
    payment,
    method: "card",
    feeCents: 0,
    metadata,
    appUrl: "https://verify.shootportal.test",
    uiMode: "elements",
  });

  // 1. Concurrent identical requests → one Stripe session (idempotency key).
  const key = `sp-verify:${paymentId}`;
  const [a, b] = await Promise.all([
    stripe.checkout.sessions.create(params, { idempotencyKey: key }),
    stripe.checkout.sessions.create(params, { idempotencyKey: key }),
  ]);
  assert(a.id === b.id, "concurrent identical checkout requests resolve to one session");
  assert(a.ui_mode === "elements" && Boolean(a.client_secret), "in-app session has a client secret");
  assert(a.amount_total === 30000, "session amount is the server amount");

  // 2. Reuse check relies on return_url round-tripping unchanged.
  const fetched = await stripe.checkout.sessions.retrieve(a.id);
  assert(fetched.return_url === params.return_url, "return_url round-trips (session reuse on refresh / second tab works)");
  assert(Boolean(fetched.client_secret), "client_secret available on retrieve (reused session can be resumed)");

  // 3. Closing: the stored open session is expired; a Payment Link with no sessions is fine.
  const link = await stripe.paymentLinks.create({
    line_items: [{ price_data: { currency: "usd", product_data: { name: "Verify script link" }, unit_amount: 30000 }, quantity: 1 }],
    metadata,
    payment_intent_data: { metadata },
  });
  const closure = await closeOpenCheckoutsForPayment({
    id: paymentId,
    stripe_account_id: null,
    stripe_checkout_session_id: a.id,
    stripe_payment_link_id: link.id,
  });
  assert(closure.allClosed && !closure.completedSessionId, "closure reports all sessions closed");
  const afterClose = await stripe.checkout.sessions.retrieve(a.id);
  assert(afterClose.status === "expired", "stored open session is expired before a new one may open");

  // 4. A session id that doesn't exist on the account doesn't block payment forever.
  const missing = await closeOpenCheckoutsForPayment({
    id: paymentId,
    stripe_account_id: null,
    stripe_checkout_session_id: "cs_test_doesnotexist000000000000000000000000000000000000000",
    stripe_payment_link_id: null,
  });
  assert(missing.allClosed, "missing stored session is treated as closed");

  // 5. Retiring (cancel/delete) deactivates the emailed Payment Link.
  await retirePaymentCheckouts({ id: paymentId, stripe_account_id: null, stripe_checkout_session_id: null, stripe_payment_link_id: link.id });
  const linkAfter = await stripe.paymentLinks.retrieve(link.id);
  assert(linkAfter.active === false, "retire deactivates the Stripe Payment Link");

  // 6. In-flight search: a succeeded PaymentIntent for this payment id is found; once refunded it no longer blocks.
  const intent = await stripe.paymentIntents.create({
    amount: 30000,
    currency: "usd",
    payment_method: "pm_card_visa",
    payment_method_types: ["card"],
    confirm: true,
    metadata,
  });
  assert(intent.status === "succeeded", "test PaymentIntent succeeded (pm_card_visa)");
  let hit = null;
  for (let i = 0; i < 20 && !hit; i++) {
    hit = await findInFlightStripePayment({ id: paymentId, stripe_account_id: null });
    if (!hit) await sleep(3000);
  }
  assert(hit?.paymentIntentId === intent.id && hit.status === "succeeded", "in-flight search finds a charge the row doesn't point at");
  await stripe.refunds.create({ payment_intent: intent.id });
  let cleared = false;
  for (let i = 0; i < 20 && !cleared; i++) {
    cleared = (await findInFlightStripePayment({ id: paymentId, stripe_account_id: null })) === null;
    if (!cleared) await sleep(3000);
  }
  assert(cleared, "a fully refunded charge no longer blocks a new checkout");

  const other = await findInFlightStripePayment({ id: randomUUID(), stripe_account_id: null });
  assert(other === null, "search is scoped to the exact payment id");

  // 7. Completed in-app sessions emit the same event the webhooks already handle.
  // Event payloads use the account's API version, where in-app sessions are ui_mode "custom".
  const events = await stripe.events.list({ type: "checkout.session.completed", limit: 100 });
  const elementsEvent = events.data.find((e) => ["elements", "custom"].includes(String((e.data.object as { ui_mode?: string }).ui_mode)));
  if (elementsEvent) {
    const obj = elementsEvent.data.object as { payment_status?: string; metadata?: Record<string, string> };
    assert(Boolean(obj.metadata?.payment_id), "checkout.session.completed for an in-app session carries payment_id metadata");
    assert(obj.payment_status === "paid", "in-app card session completes with payment_status=paid");
  } else {
    console.log("SKIP: no completed in-app session in this test account's recent events (complete one in the browser to cover this)");
  }

  console.log(`\nAll ${passed} Stripe test-mode guard checks passed.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
