/**
 * Signup paths, early subscription during a trial, trial modals (docs/SIGNUP-CONVERSION.md).
 *
 * Run:        npx tsx scripts/verify-signup-conversion.ts
 * With Stripe test mode (test clocks; sk_test only, no DB writes, no real charges):
 *             npx tsx scripts/verify-signup-conversion.ts --stripe
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
  intentFromSearchParams,
  normalizeSignupIntent,
  parseSignupIntentCookie,
  serializeSignupIntent,
  signupHref,
  signupIntentCookieDomain,
} from "../src/lib/signup-intent";
import {
  DAY_MS,
  annualTotalCents,
  decideTrialModal,
  formatBillingDate,
  formatUsd,
  getScheduledPlan,
  isCalmAdminPath,
  milestoneForElapsed,
  trialModalCopy,
  type TrialMilestone,
} from "../src/lib/trial-conversion";
import {
  canStartDeferredTrial,
  getSubscriptionState,
  isAwaitingFirstSubscription,
  isPaywallApiExempt,
} from "../src/lib/subscription";

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}

const NOW = new Date("2026-11-05T15:00:00.000Z");
const iso = (ms: number) => new Date(ms).toISOString();

// ---------------------------------------------------------------------------
// Signup intent
// ---------------------------------------------------------------------------
{
  const def = intentFromSearchParams({});
  assert(def.path === "subscribe" && def.interval === "annual", "plain /signup ⇒ plan picker, annual preselected");
  const trial = intentFromSearchParams({ intent: "trial", source: "demo" });
  assert(trial.path === "trial" && trial.interval === null && trial.source === "demo", "?intent=trial ⇒ free trial view");
  const annual = intentFromSearchParams({ plan: "annual", source: "demo" });
  assert(annual.path === "subscribe" && annual.interval === "annual" && annual.source === "demo", "?plan=annual&source=demo ⇒ subscribe annual, demo attribution");
  assert(intentFromSearchParams({ plan: "monthly" }).interval === "monthly", "?plan=monthly ⇒ monthly");
  assert(intentFromSearchParams({ plan: "lifetime" }).interval === "annual", "unknown plan ⇒ default annual picker (no invented plan)");
  assert(intentFromSearchParams({ plan: "annual", source: "<script>" }).source === null, "source is strictly validated");
  const round = parseSignupIntentCookie(serializeSignupIntent(annual));
  assert(round?.path === "subscribe" && round.interval === "annual" && round.source === "demo", "intent cookie round-trips");
  assert(parseSignupIntentCookie("v1.subscribe.annual.demo.extra") === null, "malformed cookie rejected");
  assert(parseSignupIntentCookie("v2.subscribe.annual.-") === null, "unknown cookie version rejected");
  assert(normalizeSignupIntent({ signupPath: "admin", interval: "annual" }).path === "trial", "tampered body path ⇒ trial");
  assert(normalizeSignupIntent({ signupPath: "trial", interval: "annual" }).interval === null, "trial path carries no interval");
  assert(signupIntentCookieDomain("www.shootportal.app", "shootportal.app") === ".shootportal.app", "cookie shared with tenant subdomains");
  assert(signupIntentCookieDomain("acme.shootportal.app", "shootportal.app") === ".shootportal.app", "tenant subdomain reads same cookie");
  assert(signupIntentCookieDomain("localhost", "localhost:3000") === null, "localhost cookie stays host-only");
  assert(signupIntentCookieDomain("evil.com", "shootportal.app") === null, "foreign host never gets a Domain cookie");
  assert(signupHref({ interval: "annual", source: "demo" }) === "/signup?plan=annual&source=demo", "signupHref builds subscribe link");
  assert(signupHref() === "/signup", "trial buttons land on plain /signup (plan picker)");
  assert(signupHref({ source: "demo" }) === "/signup?source=demo", "trial link keeps attribution");
}

// ---------------------------------------------------------------------------
// Pricing display (from plans row — annual stored per-month)
// ---------------------------------------------------------------------------
{
  const p = { monthlyCents: 2900, annualPerMonthCents: 2400 };
  assert(annualTotalCents(p) === 28800, "annual total = 24 × 12 = $288");
  assert(formatUsd(2900) === "$29" && formatUsd(28800) === "$288" && formatUsd(2450) === "$24.50", "formatUsd");
  assert(formatBillingDate("2026-11-15T15:00:00Z", NOW) === "November 15", "billing date label (same year)");
}

// ---------------------------------------------------------------------------
// Subscribe Now accounts (no trial) + deferred trial fallback
// ---------------------------------------------------------------------------
{
  const pending = { subscription_status: "trial_expired", trial_ends_at: null, created_via: "signup" };
  assert(isAwaitingFirstSubscription(pending), "Subscribe Now account (no trial) is awaiting first subscription");
  assert(getSubscriptionState(pending, NOW).requiresPayment, "Subscribe Now account is paywalled ⇒ checkout (no trial assigned)");
  assert(canStartDeferredTrial(pending), "never-trialed signup may start the one-time free trial instead");
  assert(!canStartDeferredTrial({ ...pending, trial_ends_at: iso(NOW.getTime() - DAY_MS) }), "expired trial can NOT restart a trial");
  assert(!canStartDeferredTrial({ ...pending, stripe_subscription_id_test: "sub_x" }), "ex-subscriber can NOT start a trial");
  assert(!canStartDeferredTrial({ ...pending, created_via: "platform" }), "platform-created business can NOT self-start a trial");
  assert(!isAwaitingFirstSubscription({ subscription_status: "trial_expired", trial_ends_at: iso(NOW.getTime() - DAY_MS) }), "expired trial is not 'awaiting first subscription'");
  assert(isPaywallApiExempt("/api/billing/start-trial"), "start-trial reachable from the paywall");
  assert(!isPaywallApiExempt("/api/billing/trial-modal"), "trial-modal API stays behind the paywall");
}

// ---------------------------------------------------------------------------
// Scheduled plan detection (Scenario F, G)
// ---------------------------------------------------------------------------
{
  const trialEnd = iso(NOW.getTime() + 10 * DAY_MS);
  const sched = getScheduledPlan({ subscription_status: "active", trial_ends_at: trialEnd, journey: { stripe_subscription_status: "trialing", subscription_interval: "annual", subscription_amount_cents: 28800 } }, NOW);
  assert(sched?.interval === "annual" && sched.firstPaymentAt === trialEnd && sched.amountCents === 28800, "active + future trial end ⇒ scheduled annual plan on the STORED trial end");
  assert(getScheduledPlan({ subscription_status: "active", trial_ends_at: trialEnd }, NOW) !== null, "scheduled detected before migration (no journey)");
  assert(getScheduledPlan({ subscription_status: "active", trial_ends_at: iso(NOW.getTime() - DAY_MS) }, NOW) === null, "trial over ⇒ normal paid, not scheduled");
  assert(getScheduledPlan({ subscription_status: "active", trial_ends_at: null }, NOW) === null, "Subscribe Now paid account is never 'scheduled' (Scenario G)");
  assert(getScheduledPlan({ subscription_status: "trialing", trial_ends_at: trialEnd }, NOW) === null, "trialing without a plan is not scheduled");
  assert(getScheduledPlan({ subscription_status: "active", trial_ends_at: trialEnd, journey: { stripe_subscription_status: "active" } }, NOW) === null, "Stripe already active ⇒ not scheduled");
  assert(getScheduledPlan({ subscription_status: "active", trial_ends_at: trialEnd, subscription_cancel_at_period_end: true }, NOW)?.canceled === true, "canceled-at-period-end scheduled plan flagged");
}

// ---------------------------------------------------------------------------
// Trial milestones (Scenario H) + modal rules
// ---------------------------------------------------------------------------
{
  const cases: [number, TrialMilestone | null][] = [
    [0, "day1"], [0.99, "day1"], [1, "day2"], [3.9, "day2"], [4, "day5"], [8.9, "day5"],
    [9, "day10"], [11.9, "day10"], [12, "day13"], [13.9, "day13"], [-1, null],
  ];
  for (const [d, m] of cases) assert(milestoneForElapsed(d * DAY_MS) === m, `elapsed ${d}d ⇒ ${m ?? "none"} (non-overlapping windows)`);

  const start = NOW.getTime() - 9.5 * DAY_MS; // trial day 10, missed day2/day5
  const base = {
    subscription_status: "trialing",
    trial_ends_at: iso(start + 14 * DAY_MS),
    trialStartedAt: iso(start),
    scheduled: false,
    seen: new Set<TrialMilestone>(),
  };
  const d10 = decideTrialModal(base, NOW);
  assert(d10.show && d10.milestone === "day10" && d10.trialDay === 10, "missed day 5 ⇒ only the day 10 modal (Scenario H)");
  assert(!decideTrialModal({ ...base, seen: new Set<TrialMilestone>(["day10"]) }, NOW).show, "dismissed/viewed milestone never shows again (refresh / other device)");
  const later = new Date(start + 12.5 * DAY_MS);
  const d13 = decideTrialModal({ ...base, seen: new Set<TrialMilestone>(["day10"]) }, later);
  assert(d13.show && d13.milestone === "day13", "after closing day 10 the day 13 modal can still appear");
  assert(!decideTrialModal({ ...base, scheduled: true }, NOW).show, "scheduled plan ⇒ no promo modal (Scenario F)");
  assert(!decideTrialModal({ ...base, subscription_status: "active" }, NOW).show, "paid ⇒ no trial modal (Scenario G)");
  assert(!decideTrialModal({ ...base, trial_ends_at: iso(NOW.getTime() - 1000) }, NOW).show, "expired trial ⇒ no trial modal");
  assert(!decideTrialModal({ ...base, seen: null }, NOW).show, "no persistent state (pre-migration) ⇒ no modal");
  // Legacy user created before the feature, now on day 6 — only day5 applies, nothing backfilled.
  const legacy = decideTrialModal({ ...base, trialStartedAt: iso(NOW.getTime() - 5.2 * DAY_MS), trial_ends_at: iso(NOW.getTime() + 8.8 * DAY_MS) }, NOW);
  assert(legacy.show && legacy.milestone === "day5", "pre-existing trial gets only its current milestone");

  const c10 = trialModalCopy("day10", 4 * DAY_MS - 60_000);
  assert(c10.headline === "Your Free Trial Ends in 4 Days." && c10.showPlans, "day 10 headline uses actual remaining time");
  assert(trialModalCopy("day10", 2.2 * DAY_MS).headline === "Your Free Trial Ends in 3 Days.", "day 10 copy adapts when trial end differs");
  assert(trialModalCopy("day13", 1.5 * DAY_MS).headline === "Your ShootPortal Trial Ends Tomorrow.", "day 13 'tomorrow'");
  assert(trialModalCopy("day13", 5 * 60 * 60 * 1000).headline === "Your ShootPortal Trial Ends in 5 Hours.", "day 13 under a day ⇒ hours, not 'tomorrow'");
  assert(!trialModalCopy("day1", 13 * DAY_MS).showPlans && trialModalCopy("day1", 13 * DAY_MS).secondary === "View Plans", "day 1 is a welcome, not a sales pitch");

  assert(isCalmAdminPath("/admin") && isCalmAdminPath("/admin/projects") && isCalmAdminPath("/b/acme/admin"), "calm admin pages allow modals");
  assert(!isCalmAdminPath("/admin/projects/123") && !isCalmAdminPath("/admin/media") && !isCalmAdminPath("/admin/settings/billing") && !isCalmAdminPath("/onboarding"), "uploads / delivery / settings / onboarding never interrupted");
}

async function stripeE2E() {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  if (!key.startsWith("sk_test_")) throw new Error("--stripe requires a sk_test_ key (refusing to run against live).");
  const { getStripe } = await import("../src/lib/stripe");
  const { resolveSnapshotStatus, mapStripeSubscriptionStatus, billingMetadata, invoiceSubscriptionId } = await import("../src/lib/stripe-billing");
  const { trialHandoffMode, findLiveBillingSubscription, intervalFromSubscription } = await import("../src/lib/billing-subscriptions");
  const { stripe } = getStripe();

  // Studio test prices from the catalog (read-only).
  const monthlyPrice = "price_1U6cDIE760MVjmKdXW2uY0Fe";
  const annualPrice = "price_1U6cDLE760MVjmKdBwVvdmPW";
  const [pm, pa] = await Promise.all([stripe.prices.retrieve(monthlyPrice), stripe.prices.retrieve(annualPrice)]);
  assert(pm.unit_amount === 2900 && pm.recurring?.interval === "month", "Stripe test monthly price is $29/month (unchanged)");
  assert(pa.unit_amount === 28800 && pa.recurring?.interval === "year", "Stripe test annual price is $288/year (unchanged)");

  const fakeBusinessId = "00000000-0000-4000-8000-00000000c0de";
  const meta = { ...billingMetadata(fakeBusinessId), verify_script: "signup-conversion" };
  const clocks: string[] = [];

  async function newClock(name: string) {
    const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name });
    clocks.push(clock.id);
    return clock;
  }
  async function advance(clockId: string, toUnix: number) {
    await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: toUnix });
    for (let i = 0; i < 60; i++) {
      const c = await stripe.testHelpers.testClocks.retrieve(clockId);
      if (c.status === "ready") return;
      await new Promise((r) => setTimeout(r, 2000));
    }
    throw new Error("test clock did not settle");
  }
  async function customerOn(clockId: string, pmToken: string) {
    const customer = await stripe.customers.create({ test_clock: clockId, metadata: meta, name: "verify-signup-conversion" });
    const attached = await stripe.paymentMethods.attach(pmToken, { customer: customer.id });
    await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: attached.id } });
    return { customer, pmId: attached.id };
  }
  async function latestInvoice(sub: Stripe.Subscription) {
    const id = typeof sub.latest_invoice === "string" ? sub.latest_invoice : sub.latest_invoice?.id;
    return id ? stripe.invoices.retrieve(id) : null;
  }

  try {
    // Scenario B/C — Subscribe Now: charged immediately, no trial.
    {
      const clock = await newClock("verify: immediate monthly");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: monthlyPrice }], metadata: meta, payment_behavior: "error_if_incomplete" });
      const inv = await latestInvoice(sub);
      assert(sub.status === "active" && !sub.trial_end, "Scenario B: monthly subscription active immediately, no trial");
      assert(inv?.status === "paid" && inv.amount_paid === 2900, "Scenario B: $29 collected immediately");
      assert(mapStripeSubscriptionStatus(sub.status) === "active", "Scenario B: maps to paid access");
      assert(invoiceSubscriptionId(inv!) === sub.id, "invoice → subscription link resolves (webhook path)");

      const fakeBusiness = {
        id: fakeBusinessId, name: "verify", slug: "verify", custom_domain: null, plan: "studio",
        subscription_status: "active", trial_ends_at: null, comped_until: null, comped_reason: null,
        stripe_customer_id: customer.id, stripe_subscription_id: null, stripe_customer_id_test: customer.id,
        stripe_customer_id_live: null, stripe_subscription_id_test: null, stripe_subscription_id_live: null,
        billing_email: null, subscription_current_period_end: null, subscription_cancel_at_period_end: false,
      };
      const live = await findLiveBillingSubscription(fakeBusiness);
      assert(live?.id === sub.id, "Scenario K/L: live subscription found even before the webhook lands ⇒ second checkout refused");
    }
    {
      const clock = await newClock("verify: immediate annual");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: annualPrice }], metadata: meta, payment_behavior: "error_if_incomplete" });
      const inv = await latestInvoice(sub);
      assert(sub.status === "active" && inv?.amount_paid === 28800, "Scenario C: $288 collected immediately, annual active");
      assert(intervalFromSubscription(sub) === "annual", "interval read from the Stripe price");
    }

    // Scenario E — trial user picks Annual on day 10: card saved, $0 now, $288 at the stored trial end.
    {
      const clock = await newClock("verify: trial annual scheduled");
      const now = clock.frozen_time;
      const trialEndsAt = new Date((now + 4 * 86400 + 1234) * 1000).toISOString(); // odd seconds: exact timestamp kept
      const handoff = trialHandoffMode({ subscription_status: "trialing", trial_ends_at: trialEndsAt }, now * 1000);
      assert(handoff.kind === "trial_end" && handoff.trialEndUnix === now + 4 * 86400 + 1234, "≥48h left ⇒ Checkout trial_end = the stored trial end, to the second");
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: annualPrice }], trial_end: handoff.trialEndUnix!, metadata: meta });
      const inv0 = await latestInvoice(sub);
      assert(sub.status === "trialing" && sub.trial_end === handoff.trialEndUnix, "Scenario E: subscription trialing until the existing trial end (not extended)");
      assert((inv0?.amount_paid ?? 0) === 0, "Scenario E: no charge today");
      assert(mapStripeSubscriptionStatus(sub.status) === "active", "Scenario E: scheduled users keep access (no trial paywall while waiting)");
      await advance(clock.id, handoff.trialEndUnix! + 3600);
      const after = await stripe.subscriptions.retrieve(sub.id);
      const inv1 = await latestInvoice(after);
      assert(after.status === "active" && inv1?.status === "paid" && inv1.amount_paid === 28800, "Scenario E: $288 charged automatically at trial end (test clock)");
    }

    // Scenario D (late) — < 48h left: setup-mode card + server-created subscription.
    {
      const clock = await newClock("verify: trial monthly <48h");
      const now = clock.frozen_time;
      const trialEndsAt = new Date((now + 20 * 3600) * 1000).toISOString();
      const handoff = trialHandoffMode({ subscription_status: "trialing", trial_ends_at: trialEndsAt }, now * 1000);
      assert(handoff.kind === "setup", "< 48h left ⇒ setup mode (Checkout can't set trial_end that close)");
      const { customer, pmId } = await customerOn(clock.id, "pm_card_visa");
      const si = await stripe.setupIntents.create({ customer: customer.id, payment_method: pmId, confirm: true, usage: "off_session", automatic_payment_methods: { enabled: true, allow_redirects: "never" } });
      assert(si.status === "succeeded", "card saved via SetupIntent (no charge)");
      const sub = await stripe.subscriptions.create(
        { customer: customer.id, items: [{ price: monthlyPrice }], default_payment_method: pmId, trial_end: handoff.trialEndUnix!, metadata: meta },
        { idempotencyKey: `verify-setup-sub-${clock.id}` }
      );
      const again = await stripe.subscriptions.create(
        { customer: customer.id, items: [{ price: monthlyPrice }], default_payment_method: pmId, trial_end: handoff.trialEndUnix!, metadata: meta },
        { idempotencyKey: `verify-setup-sub-${clock.id}` }
      );
      assert(again.id === sub.id, "Scenario K: replayed setup completion returns the SAME subscription (idempotency key)");
      assert(sub.status === "trialing" && sub.trial_end === handoff.trialEndUnix, "Scenario D: monthly billing scheduled for the exact trial end");
      await advance(clock.id, handoff.trialEndUnix! + 3600);
      const inv = await latestInvoice(await stripe.subscriptions.retrieve(sub.id));
      assert(inv?.status === "paid" && inv.amount_paid === 2900, "Scenario D: $29 charged at trial end (test clock)");
    }

    // Scenario J — scheduled plan whose first payment fails.
    {
      const clock = await newClock("verify: first payment fails");
      const now = clock.frozen_time;
      const { customer } = await customerOn(clock.id, "pm_card_chargeCustomerFail");
      const trialEnd = now + 3 * 86400;
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: monthlyPrice }], trial_end: trialEnd, metadata: meta });
      await advance(clock.id, trialEnd + 3600);
      const after = await stripe.subscriptions.retrieve(sub.id);
      assert(after.status === "past_due", `Scenario J: failed first charge ⇒ Stripe past_due (got ${after.status})`);
      assert(mapStripeSubscriptionStatus(after.status) === "past_due", "Scenario J: app shows payment-failed banner (existing dunning policy)");
      assert(resolveSnapshotStatus("unpaid", null) === "past_due" && resolveSnapshotStatus("canceled", null) === "canceled", "unpaid stays past_due (existing dunning policy); canceled ⇒ paywall");
    }

    // Scenario N — cancel scheduled plan before billing.
    {
      const clock = await newClock("verify: cancel before billing");
      const now = clock.frozen_time;
      const { customer } = await customerOn(clock.id, "pm_card_visa");
      const trialEnd = now + 6 * 86400;
      const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price: annualPrice }], trial_end: trialEnd, metadata: meta });
      const canceled = await stripe.subscriptions.cancel(sub.id);
      const trialEndsAt = new Date(trialEnd * 1000).toISOString();
      assert(canceled.status === "canceled", "Scenario N: portal-style immediate cancel");
      assert(resolveSnapshotStatus(canceled.status, trialEndsAt, now * 1000) === "trialing", "Scenario N: original trial restored (same trial_ends_at, not extended)");
      assert(resolveSnapshotStatus(canceled.status, trialEndsAt, (trialEnd + 1) * 1000) === "canceled", "Scenario N: after the original trial end ⇒ normal paywall");
      const invoices = await stripe.invoices.list({ subscription: sub.id });
      assert(invoices.data.every((i) => (i.amount_paid ?? 0) === 0), "Scenario N: nothing charged");
    }

    // Checkout parameter shapes accepted by Stripe (sessions expired right away).
    {
      const customer = await stripe.customers.create({ metadata: meta, name: "verify-signup-conversion" });
      const origin = "https://example.shootportal.app";
      const trialEnd = Math.floor(Date.now() / 1000) + 5 * 86400;
      const sub = await stripe.checkout.sessions.create({
        mode: "subscription", customer: customer.id, line_items: [{ price: annualPrice, quantity: 1 }], metadata: meta,
        subscription_data: { metadata: meta, trial_end: trialEnd },
        success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/billing?checkout=cancelled`,
        client_reference_id: fakeBusinessId,
      });
      assert(Boolean(sub.url), "Checkout (subscription + trial_end) accepted");
      let rejected = false;
      try {
        await stripe.checkout.sessions.create({
          mode: "subscription", customer: customer.id, line_items: [{ price: annualPrice, quantity: 1 }],
          subscription_data: { trial_end: Math.floor(Date.now() / 1000) + 20 * 3600 },
          success_url: `${origin}/billing`, cancel_url: `${origin}/billing`,
        });
      } catch {
        rejected = true;
      }
      assert(rejected, "Stripe rejects Checkout trial_end < 48h (why setup mode exists)");
      const setup = await stripe.checkout.sessions.create({
        mode: "setup", customer: customer.id, currency: "usd",
        metadata: { ...meta, sp_schedule_price: monthlyPrice, sp_schedule_interval: "monthly" },
        setup_intent_data: { metadata: meta },
        success_url: `${origin}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/billing?checkout=cancelled`,
        client_reference_id: fakeBusinessId,
      });
      assert(Boolean(setup.url), "Checkout setup mode accepted");
      await stripe.checkout.sessions.expire(sub.id);
      await stripe.checkout.sessions.expire(setup.id);
      const expired = await stripe.checkout.sessions.retrieve(setup.id);
      assert(expired.status === "expired", "previous open Checkout can be expired (no double completion)");
      await stripe.customers.del(customer.id);
    }
  } finally {
    for (const id of clocks) {
      await stripe.testHelpers.testClocks.del(id).catch(() => undefined);
    }
  }
}

(async () => {
  if (process.argv.includes("--stripe")) await stripeE2E();
  console.log(`\nverify-signup-conversion: ${passed} checks passed`);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
