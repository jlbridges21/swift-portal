/**
 * Subscribe & Save — intro offer rules, trial conversion, grandfathered scheduled plans.
 * (docs/SIGNUP-CONVERSION.md → "Subscribe & Save")
 *
 * Run:        npx tsx scripts/verify-subscribe-and-save.ts
 * With Stripe test mode (test clocks; sk_test only, no DB writes, no real charges):
 *             npx tsx scripts/verify-subscribe-and-save.ts --stripe
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (!process.env[key]) process.env[key] = val;
  }
}
loadEnvLocal();

import type Stripe from "stripe";
import {
  decideIntroOffer,
  introCountdownLabel,
  introOfferCouponId,
  introOfferPromptCopy,
  introOfferSavingsLabel,
  introOfferTerms,
  introOfferWindowEndsAt,
  quoteInterval,
  quotePlan,
  type IntroOfferInput,
} from "../src/lib/intro-offer";
import { DAY_MS } from "../src/lib/trial-conversion";

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}

const NOW = new Date("2026-11-06T15:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();
const daysAgo = (d: number) => iso(NOW.getTime() - d * DAY_MS);
const daysFromNow = (d: number) => iso(NOW.getTime() + d * DAY_MS);

function pure() {
  // ── Pricing ────────────────────────────────────────────────────────────
  const m = quoteInterval("monthly", 2900, true);
  assert(m.firstChargeCents === 2400 && m.introInvoices === 3 && m.savingsCents === 1500, "monthly intro: $24 today, 3 discounted months, $15 saved");
  assert(m.summary === "$24/month for your first 3 months, then $29/month", `monthly summary copy (${m.summary})`);
  const a = quoteInterval("annual", 28800, true);
  assert(a.firstChargeCents === 26300 && a.introInvoices === 1 && a.savingsCents === 2500, "annual intro: $263 today, $25 saved");
  assert(a.summary === "$263 for your first year, then $288/year" && a.renewal === "Renews at $288/year", "annual summary + renewal copy");
  const plain = quoteInterval("monthly", 2900, false);
  assert(plain.firstChargeCents === 2900 && plain.savingsCents === 0, "no offer ⇒ regular $29");
  const plan = quotePlan({ monthlyCents: 2900, annualPerMonthCents: 2400 }, true);
  assert(plan.annual?.regularCents === 28800 && plan.annual.firstChargeCents === 26300, "plans row: annual = price_annual_cents × 12");
  assert(introOfferSavingsLabel() === "up to $25", "headline savings = up to $25");
  assert(introOfferSavingsLabel("monthly") === "$15" && introOfferSavingsLabel("annual") === "$25", "per-interval savings: $15 monthly, $25 annual");
  assert(introOfferTerms("six_month") === null, "an interval without terms (future 6-month plan) has no intro offer");
  assert(introOfferTerms("constructor") === null, "terms lookup is not fooled by prototype keys");
  assert(introOfferCouponId("monthly", introOfferTerms("monthly")!) === "sp_intro_monthly_500_3mo_v1", "deterministic monthly coupon id");
  assert(introOfferCouponId("annual", introOfferTerms("annual")!) === "sp_intro_annual_2500_once_v1", "deterministic annual coupon id");

  // ── Window ─────────────────────────────────────────────────────────────
  const created = daysAgo(3);
  assert(introOfferWindowEndsAt({ created_at: created, trial_ends_at: daysFromNow(11) }) === daysFromNow(11), "trial path: window = trial end");
  assert(introOfferWindowEndsAt({ created_at: created, trial_ends_at: null }) === daysFromNow(11), "Subscribe & Save path (no trial): window = signup + 14 days");
  assert(introOfferWindowEndsAt({ created_at: created, trial_ends_at: daysFromNow(14) }) === daysFromNow(11), "deferred trial started later never extends the window");
  assert(introOfferWindowEndsAt({ created_at: daysAgo(40), trial_ends_at: daysFromNow(5) }) === daysAgo(26), "admin-extended trial does not extend the original window");

  // ── Decisions ──────────────────────────────────────────────────────────
  const trial: IntroOfferInput = {
    subscription_status: "trialing",
    trial_ends_at: daysFromNow(14 - 3),
    created_at: daysAgo(3),
    referred: false,
    paidInvoiceCount: 0,
    redeemed: false,
    liveSubscription: null,
  };
  const yes = (input: IntroOfferInput, at = NOW) => decideIntroOffer(input, at).eligible;
  const why = (input: IntroOfferInput, at = NOW) => {
    const d = decideIntroOffer(input, at);
    return d.eligible ? "eligible" : d.reason;
  };
  assert(yes({ ...trial, subscription_status: "trial_expired", trial_ends_at: null, created_at: iso(NOW.getTime() - 60_000) }), "new customer pays immediately ⇒ discount");
  assert(yes({ ...trial, created_at: daysAgo(2), trial_ends_at: daysFromNow(12) }), "trial day 3 ⇒ discount");
  assert(yes({ ...trial, created_at: daysAgo(9), trial_ends_at: daysFromNow(5) }), "trial day 10 ⇒ discount");
  assert(yes({ ...trial, created_at: iso(NOW.getTime() - 14 * DAY_MS + 3600_000), trial_ends_at: iso(NOW.getTime() + 3600_000) }), "last day, before expiry ⇒ discount");
  const lastSecond = { ...trial, created_at: iso(NOW.getTime() - 14 * DAY_MS), trial_ends_at: iso(NOW.getTime()) };
  assert(why(lastSecond) === "expired", "at the exact expiry ⇒ no discount");
  assert(why({ ...trial, subscription_status: "trial_expired", created_at: daysAgo(17), trial_ends_at: daysAgo(3) }) === "status", "expired trial (Scenario C, day 17) ⇒ regular price");
  assert(why({ ...trial, subscription_status: "trialing", created_at: daysAgo(17), trial_ends_at: daysAgo(3) }) === "expired", "trial past end but status not yet synced ⇒ still expired");
  assert(why({ ...trial, subscription_status: "trial_expired", trial_ends_at: null, created_at: daysAgo(20) }) === "expired", "Subscribe & Save account returning after 14 days ⇒ regular price");
  assert(why({ ...trial, referred: true }) === "referred", "partner referral ⇒ no Subscribe & Save (referral offer wins, no stacking)");
  assert(why({ ...trial, paidInvoiceCount: 1, subscription_status: "canceled" }) === "paid_before", "former paying customer ⇒ no intro");
  assert(why({ ...trial, subscription_status: "canceled", paidInvoiceCount: 0 }) === "status", "canceled account ⇒ no intro");
  assert(why({ ...trial, redeemed: true }) === "redeemed", "already redeemed ⇒ never again");
  assert(why({ ...trial, paidInvoiceCount: null }) === "unknown_history", "billing history unreadable ⇒ fail closed (regular price)");
  assert(why({ ...trial, subscription_status: "comped" }) === "comped", "comped ⇒ no offer");
  assert(why({ ...trial, subscription_status: "active", liveSubscription: { status: "active", hasDiscount: false } }) === "already_subscribed", "paying $29/month customer (Scenario F) ⇒ no intro");
  assert(why({ ...trial, subscription_status: "past_due", liveSubscription: { status: "past_due", hasDiscount: false } }) === "already_subscribed", "past_due ⇒ no intro");
  const sched = decideIntroOffer({ ...trial, subscription_status: "active", liveSubscription: { status: "trialing", hasDiscount: false } }, NOW);
  assert(sched.eligible && sched.kind === "start_scheduled_now", "Scenario D: scheduled $288 plan inside the trial ⇒ may voluntarily start now at $263");
  assert(why({ ...trial, subscription_status: "active", liveSubscription: { status: "trialing", hasDiscount: true } }) === "existing_discount", "scheduled plan with a referral discount keeps it (no stacking)");
  assert(why({ ...trial, subscription_status: "active", created_at: daysAgo(15), trial_ends_at: daysAgo(1), liveSubscription: { status: "trialing", hasDiscount: false } }) === "expired", "scheduled plan after the window ⇒ no intro");

  // ── Countdown copy ─────────────────────────────────────────────────────
  assert(introCountdownLabel(6 * DAY_MS - 1000) === "6 days" && introCountdownLabel(DAY_MS + 1) === "2 days", "countdown rounds up to whole days");
  assert(introCountdownLabel(5 * 3600_000) === "5 hours", "under a day ⇒ hours");
  const calm = introOfferPromptCopy(6 * DAY_MS);
  assert(!calm.urgent && calm.headline === "Enjoying ShootPortal? Subscribe before your trial ends and save up to $25!", "mid-trial copy is calm");
  const urgent = introOfferPromptCopy(3 * DAY_MS - 1000);
  assert(urgent.urgent && urgent.headline === "Your free trial ends in 3 days. Subscribe now to save up to $25 on your first subscription.", "last 3 days: countdown copy");
}

async function pureServer() {
  const { trialEndForBillingStart, resolveSnapshotStatus } = await import("../src/lib/stripe-billing");
  const now = NOW.getTime();
  assert(trialEndForBillingStart({ status: "active", trial_end: null }, daysFromNow(9), now) === iso(now), "paid during trial ⇒ trial ends at payment time");
  assert(trialEndForBillingStart({ status: "active", trial_end: Math.floor(now / 1000) - 5 }, daysFromNow(9), now) === iso(now), "scheduled plan started early ⇒ trial ends now");
  assert(trialEndForBillingStart({ status: "trialing", trial_end: Math.floor(now / 1000) + 9 * 86400 }, daysFromNow(9), now) === null, "scheduled (still trialing) ⇒ trial untouched");
  assert(trialEndForBillingStart({ status: "active", trial_end: null }, daysAgo(1), now) === null, "plan that reached its scheduled start ⇒ stored trial end untouched");
  assert(trialEndForBillingStart({ status: "incomplete", trial_end: null }, daysFromNow(9), now) === null, "failed / abandoned payment ⇒ trial untouched, nothing activated");
  assert(trialEndForBillingStart({ status: "active", trial_end: null }, null, now) === null, "Subscribe & Save account (no trial) ⇒ nothing to end");
  assert(resolveSnapshotStatus("canceled", iso(now), now + 1000) === "canceled", "after a paid start, canceling does not fall back into a free trial");
  assert(resolveSnapshotStatus("incomplete", daysFromNow(5)) === null, "incomplete checkout never maps to paid access");
}

async function stripeE2E() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) throw new Error("--stripe requires a sk_test_ key (refusing to run against live).");
  const { getStripe } = await import("../src/lib/stripe");
  const { billingMetadata, mapStripeSubscriptionStatus } = await import("../src/lib/stripe-billing");
  const { ensureIntroOfferCoupon } = await import("../src/lib/intro-offer-server");
  const { stripe } = getStripe();

  const monthlyPrice = "price_1U6cDIE760MVjmKdXW2uY0Fe";
  const annualPrice = "price_1U6cDLE760MVjmKdBwVvdmPW";
  const [pm, pa] = await Promise.all([stripe.prices.retrieve(monthlyPrice), stripe.prices.retrieve(annualPrice)]);
  assert(pm.unit_amount === 2900 && pa.unit_amount === 28800, "Stripe test prices unchanged ($29 / $288)");

  const monthlyCoupon = await ensureIntroOfferCoupon("monthly");
  const annualCoupon = await ensureIntroOfferCoupon("annual");
  assert(monthlyCoupon === "sp_intro_monthly_500_3mo_v1" && annualCoupon === "sp_intro_annual_2500_once_v1", "intro coupons created / verified in Stripe");
  assert((await ensureIntroOfferCoupon("monthly")) === monthlyCoupon, "coupon ensure is idempotent");
  assert((await ensureIntroOfferCoupon("six_month")) === null, "no coupon for an interval without terms");

  const fakeBusinessId = "00000000-0000-4000-8000-00000000c15a";
  const meta = { ...billingMetadata(fakeBusinessId), verify_script: "subscribe-and-save" };
  const clocks: string[] = [];
  async function newClock(name: string) {
    const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name });
    clocks.push(clock.id);
    return clock;
  }
  async function advance(clockId: string, toUnix: number) {
    await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: toUnix });
    for (let i = 0; i < 90; i++) {
      const c = await stripe.testHelpers.testClocks.retrieve(clockId);
      if (c.status === "ready") return;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("test clock did not settle");
  }
  async function customerOn(clockId: string, pmToken: string) {
    const customer = await stripe.customers.create({ test_clock: clockId, metadata: meta, name: "verify-subscribe-and-save" });
    const attached = await stripe.paymentMethods.attach(pmToken, { customer: customer.id });
    await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: attached.id } });
    return { customer, pmId: attached.id };
  }
  async function paidAmounts(subId: string) {
    const list = await stripe.invoices.list({ subscription: subId, limit: 30 });
    return list.data
      .filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0)
      .sort((x, y) => x.created - y.created)
      .map((i) => i.amount_paid);
  }
  const DAY = 86400;

  try {
    // Scenario A/B — immediate monthly with intro: $24 ×3, then $29.
    {
      const clock = await newClock("verify s&s: monthly intro");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: monthlyPrice }],
        discounts: [{ coupon: monthlyCoupon! }],
        metadata: { ...meta, sp_intro_offer: "monthly_v1" },
        payment_behavior: "error_if_incomplete",
      });
      assert(sub.status === "active" && !sub.trial_end, "Scenario B: monthly active immediately, no trial attached");
      let t = clock.frozen_time;
      for (let i = 0; i < 4; i++) {
        t += 31 * DAY;
        await advance(clock.id, t);
      }
      const amounts = await paidAmounts(sub.id);
      assert(
        JSON.stringify(amounts.slice(0, 5)) === JSON.stringify([2400, 2400, 2400, 2900, 2900]),
        `Scenario B: $24, $24, $24, then $29/month (got ${amounts.join(", ")})`
      );
    }

    // Scenario A — immediate annual with intro: $263, renews $288.
    {
      const clock = await newClock("verify s&s: annual intro");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const sub = await stripe.subscriptions.create({
        customer: customer.id,
        items: [{ price: annualPrice }],
        discounts: [{ coupon: annualCoupon! }],
        metadata: { ...meta, sp_intro_offer: "annual_v1" },
        payment_behavior: "error_if_incomplete",
      });
      await advance(clock.id, clock.frozen_time + 366 * DAY);
      const amounts = await paidAmounts(sub.id);
      assert(JSON.stringify(amounts.slice(0, 2)) === JSON.stringify([26300, 28800]), `Scenario A: $263 today, $288 at renewal (got ${amounts.join(", ")})`);
    }

    // Scenario D (no action) — grandfathered scheduled $288 annual bills exactly as scheduled.
    {
      const clock = await newClock("verify s&s: grandfathered untouched");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const trialEnd = clock.frozen_time + 9 * DAY + 77;
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: annualPrice }], trial_end: trialEnd, metadata: meta });
      assert((await paidAmounts(sub.id)).length === 0, "Scenario D: nothing charged before the original date");
      await advance(clock.id, trialEnd + 3600);
      const after = await stripe.subscriptions.retrieve(sub.id);
      assert(after.status === "active" && JSON.stringify(await paidAmounts(sub.id)) === "[28800]", "Scenario D: $288 charged on the original date when the customer does nothing");
    }

    // Scenario D (voluntary) — start the SAME subscription now at $263.
    {
      const clock = await newClock("verify s&s: grandfathered start now");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const trialEnd = clock.frozen_time + 9 * DAY;
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: annualPrice }], trial_end: trialEnd, metadata: meta });
      const params: Stripe.SubscriptionUpdateParams = {
        trial_end: "now",
        proration_behavior: "none",
        payment_behavior: "error_if_incomplete",
        discounts: [{ coupon: annualCoupon! }],
        metadata: { sp_started_early: "true", sp_originally_scheduled_for: new Date(trialEnd * 1000).toISOString(), sp_intro_offer: "annual_v1" },
      };
      // Same deterministic key shape as /api/billing/start-plan-now.
      const key = `verify-start-now-${sub.id}-${sub.trial_end}-pm-${annualCoupon}`;
      const updated = await stripe.subscriptions.update(sub.id, params, { idempotencyKey: key });
      const replay = await stripe.subscriptions.update(sub.id, params, { idempotencyKey: key });
      assert(updated.id === sub.id && updated.status === "active", "Scenario D: same subscription, now active (no duplicate created)");
      assert(mapStripeSubscriptionStatus(updated.status) === "active", "started plan maps to paid access");
      assert(replay.id === sub.id, "double-click replay returns the same result");
      assert(updated.metadata.business_id === fakeBusinessId && updated.metadata.shootportal_billing === "true", "billing metadata preserved on update (webhook still attributes it)");
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all" });
      assert(subs.data.length === 1, "exactly one subscription on the customer");
      assert(JSON.stringify(await paidAmounts(sub.id)) === "[26300]", "Scenario D: $263 charged once, immediately");
      // A second tab sends the identical request (same state ⇒ same key and params).
      const otherTab = await stripe.subscriptions.update(sub.id, params, { idempotencyKey: key });
      assert(otherTab.id === sub.id && (otherTab.discounts?.length ?? 0) <= 1, "another tab gets the same single result");
      assert(JSON.stringify(await paidAmounts(sub.id)) === "[26300]", "another tab charges nothing more");
      await advance(clock.id, trialEnd + 3600);
      assert(JSON.stringify(await paidAmounts(sub.id)) === "[26300]", "no extra charge on the original scheduled date");
      await advance(clock.id, clock.frozen_time + 367 * DAY);
      assert(JSON.stringify(await paidAmounts(sub.id)) === "[26300,28800]", "renews at $288 a year after starting");
    }

    // Monthly scheduled → start now: $24 × 3 then $29.
    {
      const clock = await newClock("verify s&s: scheduled monthly start now");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: monthlyPrice }], trial_end: clock.frozen_time + 5 * DAY, metadata: meta });
      await stripe.subscriptions.update(sub.id, { trial_end: "now", proration_behavior: "none", payment_behavior: "error_if_incomplete", discounts: [{ coupon: monthlyCoupon! }] });
      let t = clock.frozen_time;
      for (let i = 0; i < 3; i++) {
        t += 31 * DAY;
        await advance(clock.id, t);
      }
      const amounts = await paidAmounts(sub.id);
      assert(JSON.stringify(amounts.slice(0, 4)) === JSON.stringify([2400, 2400, 2400, 2900]), `scheduled monthly started early: $24 ×3 then $29 (got ${amounts.join(", ")})`);
    }

    // Declined card on start-now: subscription unchanged, nothing charged.
    {
      const clock = await newClock("verify s&s: start now declined");
      const { customer } = await customerOn(clock.id, "pm_card_chargeCustomerFail");
      const trialEnd = clock.frozen_time + 8 * DAY;
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: annualPrice }], trial_end: trialEnd, metadata: meta });
      let threw = false;
      try {
        await stripe.subscriptions.update(sub.id, {
          trial_end: "now",
          proration_behavior: "none",
          payment_behavior: "error_if_incomplete",
          discounts: [{ coupon: annualCoupon! }],
          metadata: { sp_started_early: "true", sp_intro_offer: "annual_v1" },
        });
      } catch (err) {
        threw = (err as { statusCode?: number }).statusCode === 402 || (err as { type?: string }).type === "StripeCardError";
      }
      const after = await stripe.subscriptions.retrieve(sub.id);
      assert(threw, "declined card ⇒ Stripe returns a card error (402)");
      assert(after.status === "trialing" && after.trial_end === trialEnd, "declined start-now leaves the plan scheduled for its ORIGINAL date");
      assert((after.discounts?.length ?? 0) === 0 && !after.metadata.sp_intro_offer, "declined start-now attaches no discount and no redemption marker");
      assert((await paidAmounts(sub.id)).length === 0, "declined start-now charged nothing");
    }

    // Checkout shape: subscription mode, intro discount, no trial — accepted by Stripe.
    {
      const customer = await stripe.customers.create({ metadata: meta, name: "verify-subscribe-and-save" });
      const origin = "https://example.shootportal.app";
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customer.id,
        line_items: [{ price: monthlyPrice, quantity: 1 }],
        metadata: meta,
        subscription_data: { metadata: { ...meta, sp_intro_offer: "monthly_v1", sp_checkout_from: "trial" } },
        discounts: [{ coupon: monthlyCoupon! }],
        success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${origin}/billing?checkout=cancelled`,
        client_reference_id: fakeBusinessId,
      });
      assert(Boolean(session.url), "Checkout with intro discount and no trial accepted");
      assert(session.amount_total === 2400, `Checkout total shown to the customer is $24 (got ${session.amount_total})`);
      await stripe.checkout.sessions.expire(session.id);
      await stripe.customers.del(customer.id);
    }
  } finally {
    for (const id of clocks) await stripe.testHelpers.testClocks.del(id).catch(() => undefined);
  }
}

(async () => {
  pure();
  await pureServer();
  if (process.argv.includes("--stripe")) await stripeE2E();
  console.log(`\nverify-subscribe-and-save: ${passed} checks passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
