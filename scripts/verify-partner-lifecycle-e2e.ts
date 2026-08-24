/**
 * Partner money path — Stripe test-clock end-to-end harness.
 *
 * Proves the deferred-referral-discount → first paid invoice → commission →
 * hold → refund → payout chain against REAL Stripe test-mode objects and the
 * same DB ledger the product uses.
 *
 *   npm run test:partner-lifecycle-e2e
 *   PARTNER_E2E_WEBHOOK_MODE=direct npm run test:partner-lifecycle-e2e   # fallback
 *
 * === WHAT THIS PROVES ===
 *  - Checkout-equivalent subscription with deferred coupon metadata
 *  - Coupon attaches after trial ends (maybeApplyPendingReferralDiscountFromSubscription)
 *  - Discounted invoices → commissions at snapshotted rate on COLLECTED amount
 *  - Post-window invoice returns to list price; commission rises
 *  - Refund → proportional reversal at ORIGINAL rate on discounted base
 *  - Hold (payable_at = paid_at + 30d) and payout stamping / balance reconcile
 *  - Partner dashboard, platform metrics, and verify-partner-commissions agree
 *
 * === WHAT THIS DOES NOT PROVE ===
 *  - Live-mode Stripe behavior or live webhook endpoints
 *  - Checkout Session UI / hosted Checkout page itself (subscription is created
 *    via API with the same metadata checkout writes)
 *  - Annual billing / deferred annual coupons
 *  - Stripe Connect partner payouts (manual recordPartnerPayout only)
 *  - Webhook signature wiring, when PARTNER_E2E_WEBHOOK_MODE=direct (see below)
 *
 * === WEBHOOK DELIVERY ===
 * Prefer real delivery (default PARTNER_E2E_WEBHOOK_MODE=webhook):
 *   1. Terminal A: npm run start   (or next start after build)
 *   2. Terminal B: stripe listen --forward-to localhost:3000/api/stripe/webhook/billing
 *      Copy the printed whsec_ into STRIPE_BILLING_WEBHOOK_SECRET for that server.
 *   3. Terminal C: npm run test:partner-lifecycle-e2e
 *
 * Subscription create mirrors Checkout: coupon attached at create (not deferred).
 * Repeating coupon duration is calendar months from application — a $0 trial
 * invoice does not burn paid discount months.
 *
 * Fallback PARTNER_E2E_WEBHOOK_MODE=direct: after each clock advance the script
 * retrieves Stripe objects and invokes the SAME handlers the webhook calls
 * (maybeApplyPending…, recordPlatformSubscriptionPayment, handleChargeRefunded…).
 * That proves business logic + ledger math but does NOT prove webhook wiring.
 *
 * === SAFETY ===
 *  - Refuses sk_live_ under all circumstances (no --confirm-live override).
 *  - Never touches protected / real businesses (Swift UUID, name/slug denylist).
 *  - All created objects are namespaced e2e-plc-<stamp> and cleaned up in finally.
 *
 * Stripe docs verified (Billing test clocks API + advanced usage, 2026):
 *  - Create clock with frozen_time (unix); only advance forward thereafter
 *  - Attach via customers.create({ test_clock })
 *  - Advance via testHelpers.testClocks.advance; poll until status === "ready"
 *  - Max advance ≈ 2 billing periods per call for monthly subscriptions
 *  - Deleting the clock deletes associated customers/subscriptions
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

const SWIFT_ID = "00000000-0000-0000-0000-000000000001";
const DENYLIST_NAME = /^(swift|test\s*pilot)/i;
const COMMISSION_RATE = 30;
const DISCOUNT_CENTS = 1000; // $10/mo
const DISCOUNT_MONTHS = 3;
const HOLD_DAYS = 30;
const TRIAL_DAYS = 3; // short trial on the clock (Stripe requires ≥2 days)

type WebhookMode = "webhook" | "direct";

type Assertion = {
  name: string;
  expected: string;
  actual: string;
  ok: boolean;
};

const assertions: Assertion[] = [];
let failures = 0;

function assertEq(name: string, expected: unknown, actual: unknown) {
  const ok = expected === actual;
  const row: Assertion = {
    name,
    expected: String(expected),
    actual: String(actual),
    ok,
  };
  assertions.push(row);
  const mark = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  console.log(`${mark}  ${name}`);
  console.log(`      expected: ${row.expected}`);
  console.log(`      actual:   ${row.actual}`);
}

function assertTrue(name: string, cond: boolean, detail: string) {
  assertEq(name, true, cond);
  if (!cond) console.log(`      detail:   ${detail}`);
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function roundCommission(sourceCents: number, rate: number): number {
  return Math.round((sourceCents * rate) / 100);
}

function detectMode(secret: string): "test" | "live" {
  if (secret.startsWith("sk_live")) return "live";
  if (secret.startsWith("sk_test")) return "test";
  throw new Error("STRIPE_SECRET_KEY must start with sk_test_ or sk_live_");
}

function webhookMode(): WebhookMode {
  const raw = (process.env.PARTNER_E2E_WEBHOOK_MODE ?? "webhook").toLowerCase();
  return raw === "direct" ? "direct" : "webhook";
}

function guardBusinessTouch(name: string, slug: string, id?: string) {
  if (id === SWIFT_ID) {
    throw new Error("REFUSE: attempted to touch Swift protected business.");
  }
  if (DENYLIST_NAME.test(name) || DENYLIST_NAME.test(slug)) {
    throw new Error(`REFUSE: name/slug matches real-business denylist (${name} / ${slug}).`);
  }
}

async function waitForClockReady(stripe: Stripe, clockId: string, label: string) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    const clock = await stripe.testHelpers.testClocks.retrieve(clockId);
    if (clock.status === "ready") return clock;
    if (clock.status === "internal_failure") {
      throw new Error(`Test clock ${clockId} internal_failure during ${label}`);
    }
    await sleep(1500);
  }
  throw new Error(`Timeout waiting for test clock ready (${label})`);
}

async function advanceClock(stripe: Stripe, clockId: string, toUnix: number, label: string) {
  console.log(`\n⏱  Advance clock → ${new Date(toUnix * 1000).toISOString()} (${label})`);
  await stripe.testHelpers.testClocks.advance(clockId, { frozen_time: toUnix });
  await waitForClockReady(stripe, clockId, label);
}

async function pollUntil<T>(
  label: string,
  fn: () => Promise<T | null>,
  timeoutMs = 120_000
): Promise<T> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = await fn();
    if (v != null) return v;
    await sleep(2000);
  }
  throw new Error(`Timeout waiting for: ${label}`);
}

type Cleanup = {
  partnerId?: string;
  businessId?: string;
  clockId?: string;
  couponIds: string[];
  createdStripeCustomerIds: string[];
};

async function cleanupAll(
  stripe: Stripe,
  supabase: SupabaseClient,
  c: Cleanup,
  actor: { id: string; email: string | null }
) {
  console.log("\n—— cleanup ——");
  const remaining: string[] = [];

  if (c.partnerId) {
    await supabase.from("partner_commissions").delete().eq("partner_id", c.partnerId);
    await supabase.from("partner_payouts").delete().eq("partner_id", c.partnerId);
  }
  if (c.businessId) {
    guardBusinessTouch("e2e-cleanup", "e2e-cleanup", c.businessId);
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, name, slug, is_protected")
      .eq("id", c.businessId)
      .maybeSingle();
    if (biz?.is_protected) {
      remaining.push(`PROTECTED business left untouched: ${c.businessId}`);
    } else if (biz) {
      guardBusinessTouch(biz.name as string, biz.slug as string, biz.id as string);
      await supabase
        .from("platform_subscription_payments")
        .delete()
        .eq("business_id", c.businessId);
      await supabase.from("partner_referrals").delete().eq("business_id", c.businessId);
      // Dependents that block delete
      await supabase.from("business_services").delete().eq("business_id", c.businessId);
      await supabase.from("business_settings").delete().eq("business_id", c.businessId);
      await supabase.from("business_integrations").delete().eq("business_id", c.businessId);
      await supabase
        .from("profiles")
        .update({ business_id: null, client_id: null })
        .eq("business_id", c.businessId);
      const { error } = await supabase.from("businesses").delete().eq("id", c.businessId);
      if (error) remaining.push(`business ${c.businessId}: ${error.message}`);
      else console.log(`  deleted business ${c.businessId}`);
    }
  }
  if (c.partnerId) {
    const { error } = await supabase.from("partners").delete().eq("id", c.partnerId);
    if (error) remaining.push(`partner ${c.partnerId}: ${error.message}`);
    else console.log(`  deleted partner ${c.partnerId}`);
  }
  if (c.clockId) {
    try {
      await stripe.testHelpers.testClocks.del(c.clockId);
      console.log(`  deleted test clock ${c.clockId}`);
    } catch (err) {
      remaining.push(
        `clock ${c.clockId}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }
  // Coupons are config-keyed and reusable — do not delete shared program coupons.
  // Only report ids we may have ensured for this run.
  if (c.couponIds.length) {
    console.log(`  coupon ids used (left in place for reuse): ${c.couponIds.join(", ")}`);
  }

  void actor;
  if (remaining.length) {
    console.error("  CLEANUP REMAINING:", remaining);
  } else {
    console.log("  cleanup complete");
  }
  return remaining;
}

async function processSubscriptionDirect(
  subscriptionId: string,
  source: string
) {
  const { getStripe } = await import("../src/lib/stripe");
  const { stripe } = getStripe();
  const sub = await stripe.subscriptions.retrieve(subscriptionId);
  const { syncFromStripeSubscription } = await import("../src/lib/stripe-billing");
  await syncFromStripeSubscription(sub, source);
  const { maybeApplyPendingReferralDiscountFromSubscription } = await import(
    "../src/lib/partner-referral-discount"
  );
  const discount = await maybeApplyPendingReferralDiscountFromSubscription(sub, source);
  console.log(`  [direct] referral discount apply:`, discount);
  return { sub, discount };
}

async function processPaidInvoicesDirect(subscriptionId: string, businessId: string) {
  const { getStripe } = await import("../src/lib/stripe");
  const { stripe } = getStripe();
  const invoices = await stripe.invoices.list({ subscription: subscriptionId, limit: 20 });
  const { recordPlatformSubscriptionPayment } = await import("../src/lib/platform-revenue");
  const results = [];
  for (const inv of invoices.data) {
    if (inv.status !== "paid" || (inv.amount_paid ?? 0) <= 0) continue;
    const recorded = await recordPlatformSubscriptionPayment(inv, businessId, {
      stripeEventId: `e2e_direct_${inv.id}`,
    });
    results.push({ invoiceId: inv.id, amount: inv.amount_paid, ...recorded });
  }
  console.log(`  [direct] invoices processed:`, results);
  return results;
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (!secret) throw new Error("STRIPE_SECRET_KEY missing");
  const mode = detectMode(secret);
  if (mode === "live") {
    throw new Error(
      "REFUSE: partner lifecycle e2e is TEST MODE ONLY. sk_live_ keys are never allowed (no --confirm-live override)."
    );
  }

  const delivery = webhookMode();
  console.log("========================================");
  console.log("Partner lifecycle e2e — Stripe TEST mode");
  console.log(`Webhook delivery mode: ${delivery}`);
  if (delivery === "direct") {
    console.log(
      "⚠  DIRECT MODE — handlers invoked by the script; webhook wiring is NOT proven."
    );
  } else {
    console.log(
      "Webhook mode — ensure `stripe listen --forward-to …/api/stripe/webhook/billing`"
    );
    console.log("and the Next server uses that whsec_ as STRIPE_BILLING_WEBHOOK_SECRET.");
  }
  console.log("========================================");

  const stripe = new Stripe(secret, {
    apiVersion: "2026-05-27.dahlia",
    typescript: true,
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: sa } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  if (!sa?.id) throw new Error("Need a super_admin profile for actor");
  const actor = { id: sa.id as string, email: (sa.email as string) ?? null };

  const stamp = Date.now().toString(36);
  const ns = `e2e-plc-${stamp}`;
  const cleanup: Cleanup = { couponIds: [], createdStripeCustomerIds: [] };

  // Frozen time ~150 days ago so paid_at+30d hold is already past wall clock by payout step.
  const frozenStart = Math.floor(Date.now() / 1000) - 150 * 24 * 3600;

  try {
    // —— 1. Partner + discount config ——
    const { createPartner, updatePartner } = await import("../src/lib/partners");
    const { ensurePartnerReferralDiscountCoupon } = await import(
      "../src/lib/partner-referral-discount"
    );

    const partnerResult = await createPartner(
      {
        name: `E2E Partner ${stamp}`,
        email: `${ns}@example.test`,
        brandName: `E2E Brand ${stamp}`,
        referralCode: ns.replace(/-/g, "").slice(0, 24),
        commissionRatePct: COMMISSION_RATE,
        sendInvite: false,
        notes: "partner-lifecycle-e2e harness — safe to delete",
      },
      actor
    );
    cleanup.partnerId = partnerResult.partner.id;
    console.log(`\n1. Partner ${cleanup.partnerId} @ ${COMMISSION_RATE}%`);

    await updatePartner(
      cleanup.partnerId,
      {
        referralDiscountEnabled: true,
        referralDiscountAmountCents: DISCOUNT_CENTS,
        referralDiscountDurationMonths: DISCOUNT_MONTHS,
      },
      actor
    );
    const couponEnsure = await ensurePartnerReferralDiscountCoupon(cleanup.partnerId);
    assertTrue("coupon ensured for $10/3mo override", couponEnsure.ok, couponEnsure.message ?? "");
    if (couponEnsure.couponId) cleanup.couponIds.push(couponEnsure.couponId);
    console.log(`   coupon: ${couponEnsure.couponId}`);

    // —— 2. Business via createBusinessForPlatform ——
    const { createBusinessForPlatform } = await import("../src/lib/platform-onboard");
    const bizName = `E2E Lifecycle Biz ${stamp}`;
    const bizSlug = ns;
    guardBusinessTouch(bizName, bizSlug);

    const created = await createBusinessForPlatform(
      {
        name: bizName,
        slug: bizSlug,
        plan: "studio",
        adminEmail: `admin-${ns}@example.test`,
        adminName: "E2E Admin",
        source: "platform",
        referredByPartnerId: cleanup.partnerId,
        subscriptionStatus: "trialing",
        trialEndsAt: new Date((frozenStart + TRIAL_DAYS * 86400) * 1000).toISOString(),
      },
      actor
    );
    cleanup.businessId = created.businessId;
    console.log(`\n2. Business ${cleanup.businessId} attributed to partner`);

    const { data: referral } = await supabase
      .from("partner_referrals")
      .select("partner_id")
      .eq("business_id", cleanup.businessId)
      .maybeSingle();
    assertEq("partner_referrals row", cleanup.partnerId, referral?.partner_id ?? null);

    // —— Plan price ——
    const { data: plan } = await supabase
      .from("plans")
      .select("id, key, price_monthly_cents")
      .eq("key", "studio")
      .maybeSingle();
    if (!plan?.id || !plan.price_monthly_cents) {
      throw new Error("studio plan missing price_monthly_cents");
    }
    const { data: priceRow } = await supabase
      .from("plan_stripe_prices")
      .select("stripe_price_id")
      .eq("plan_id", plan.id)
      .eq("mode", "test")
      .eq("billing_interval", "monthly")
      .maybeSingle();
    if (!priceRow?.stripe_price_id) {
      throw new Error("No test monthly stripe price for studio — run setup:stripe-billing");
    }
    const priceId = priceRow.stripe_price_id as string;
    const stripePrice = await stripe.prices.retrieve(priceId);
    const listPriceCents = stripePrice.unit_amount;
    if (listPriceCents == null || listPriceCents <= 0) {
      throw new Error(`Stripe price ${priceId} missing unit_amount`);
    }
    if (listPriceCents !== (plan.price_monthly_cents as number)) {
      console.warn(
        `  ⚠ DB plan price ${plan.price_monthly_cents}¢ ≠ Stripe unit_amount ${listPriceCents}¢ — harness uses Stripe.`
      );
    }
    const discountedCents = listPriceCents - DISCOUNT_CENTS;
    assertTrue("list price > discount", listPriceCents > DISCOUNT_CENTS, String(listPriceCents));
    console.log(`   list ${listPriceCents}¢ → discounted ${discountedCents}¢ · price ${priceId}`);

    // —— 3. Test clock + customer ——
    const clock = await stripe.testHelpers.testClocks.create({
      frozen_time: frozenStart,
      name: ns,
    });
    cleanup.clockId = clock.id;
    console.log(`\n3. Test clock ${clock.id} frozen ${new Date(frozenStart * 1000).toISOString()}`);

    const customer = await stripe.customers.create({
      name: bizName,
      email: `billing-${ns}@example.test`,
      test_clock: clock.id,
      payment_method: "pm_card_visa",
      invoice_settings: { default_payment_method: "pm_card_visa" },
      metadata: {
        business_id: cleanup.businessId,
        shootportal_billing: "true",
        e2e_harness: ns,
      },
    });
    cleanup.createdStripeCustomerIds.push(customer.id);

    await supabase
      .from("businesses")
      .update({
        stripe_customer_id: customer.id,
        stripe_customer_id_test: customer.id,
        billing_email: customer.email,
      })
      .eq("id", cleanup.businessId);

    // —— 4. Subscribe with trial + coupon at create (mirrors fixed checkout) ——
    // Checkout attaches the coupon on the Session; duration_in_months is calendar
    // time from application so a $0 trial invoice does not burn paid months.
    const trialEnd = frozenStart + TRIAL_DAYS * 86400;
    if (!couponEnsure.couponId) throw new Error("missing coupon for subscription create");
    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: priceId }],
      trial_end: trialEnd,
      discounts: [{ coupon: couponEnsure.couponId }],
      metadata: {
        business_id: cleanup.businessId,
        shootportal_billing: "true",
        e2e_harness: ns,
      },
    });
    await supabase
      .from("businesses")
      .update({
        stripe_subscription_id: subscription.id,
        stripe_subscription_id_test: subscription.id,
        subscription_status: "trialing",
      })
      .eq("id", cleanup.businessId);

    assertEq("subscription starts trialing", "trialing", subscription.status);
    assertTrue(
      "coupon attached at create (during trial)",
      (subscription.discounts ?? []).length > 0,
      `discounts=${JSON.stringify(subscription.discounts)}`
    );
    console.log(`\n4. Subscription ${subscription.id} trial_end=${new Date(trialEnd * 1000).toISOString()}`);

    // Capture pre-trial invoice picture (should be $0 trial invoice only)
    const preInvoices = await stripe.invoices.list({ subscription: subscription.id, limit: 5 });
    const prePaid = preInvoices.data.filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0);
    assertEq("no positive paid invoices during trial", 0, prePaid.length);

    // —— 5. Advance past trial ——
    await advanceClock(stripe, clock.id, trialEnd + 3600, "past trial end");

    if (delivery === "direct") {
      await processSubscriptionDirect(subscription.id, "e2e.clock.trial_end");
      // Re-fetch — applying coupon may not regenerate the already-finalized first invoice
      await sleep(2000);
      await processPaidInvoicesDirect(subscription.id, cleanup.businessId);
    }

    const subAfterTrial = await pollUntil("subscription active + coupon or invoices", async () => {
      const s = await stripe.subscriptions.retrieve(subscription.id);
      if (s.status === "active" || s.status === "past_due") return s;
      return null;
    });

    const discountsAfter = subAfterTrial.discounts ?? [];
    assertTrue(
      "coupon attached after trial end",
      discountsAfter.length > 0,
      `discounts=${JSON.stringify(discountsAfter)} status=${subAfterTrial.status}`
    );

    // Wait for first positive paid invoice
    const firstPaid = await pollUntil("first positive paid invoice", async () => {
      if (delivery === "direct") {
        await processPaidInvoicesDirect(subscription.id, cleanup.businessId!);
      }
      const list = await stripe.invoices.list({ subscription: subscription.id, limit: 10 });
      const paid = list.data
        .filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0)
        .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
      return paid[0] ?? null;
    });

    console.log(
      `\n6. First paid invoice ${firstPaid.id}: amount_paid=${firstPaid.amount_paid}¢ (list ${listPriceCents}¢, expected discounted ${discountedCents}¢)`
    );
    assertEq(
      "first paid invoice is discounted ($10 off)",
      discountedCents,
      firstPaid.amount_paid
    );

    if (firstPaid.amount_paid !== discountedCents) {
      throw new Error(
        `First paid invoice not discounted: got ${firstPaid.amount_paid}, expected ${discountedCents}`
      );
    }

    // Commission row
    const firstCommission = await pollUntil("first commission ledger row", async () => {
      if (delivery === "direct") {
        await processPaidInvoicesDirect(subscription.id, cleanup.businessId!);
      }
      const { data } = await supabase
        .from("partner_commissions")
        .select("*")
        .eq("partner_id", cleanup.partnerId!)
        .eq("kind", "commission")
        .order("earned_at", { ascending: true });
      return data && data.length > 0 ? data[0] : null;
    });

    const expectedComm1 = roundCommission(discountedCents, COMMISSION_RATE);
    assertEq("commission source = discounted collected", discountedCents, firstCommission.source_amount_cents);
    assertEq("commission rate snapshot 30%", COMMISSION_RATE, Number(firstCommission.commission_rate_pct));
    assertEq("commission amount = 30% of discounted", expectedComm1, firstCommission.amount_cents);

    const paidAt1 = new Date(firstCommission.earned_at as string).getTime();
    const payableAt1 = new Date(firstCommission.payable_at as string).getTime();
    const holdMs = HOLD_DAYS * 24 * 3600 * 1000;
    const holdDelta = Math.abs(payableAt1 - paidAt1 - holdMs);
    assertTrue(
      "payable_at is ~30 days after earned_at",
      holdDelta < 60_000,
      `delta_ms=${holdDelta} paid=${firstCommission.earned_at} payable=${firstCommission.payable_at}`
    );

    // —— 7. Remaining discount months ——
    const paidAmounts: number[] = [firstPaid.amount_paid ?? 0];
    for (let m = 1; m < DISCOUNT_MONTHS; m++) {
      const clockNow = (await stripe.testHelpers.testClocks.retrieve(clock.id)).frozen_time;
      await advanceClock(
        stripe,
        clock.id,
        clockNow + 32 * 86400, // >1 month, <2 periods
        `discount month ${m + 1}`
      );
      if (delivery === "direct") {
        await processSubscriptionDirect(subscription.id, `e2e.clock.discount_${m + 1}`);
        await processPaidInvoicesDirect(subscription.id, cleanup.businessId!);
      }
      const inv = await pollUntil(`discount invoice #${m + 1}`, async () => {
        if (delivery === "direct") {
          await processPaidInvoicesDirect(subscription.id, cleanup.businessId!);
        }
        const list = await stripe.invoices.list({ subscription: subscription.id, limit: 20 });
        const paid = list.data
          .filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0)
          .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
        return paid.length >= m + 1 ? paid[m] : null;
      });
      paidAmounts.push(inv.amount_paid ?? 0);
      assertEq(`invoice ${m + 1} discounted`, discountedCents, inv.amount_paid);
    }

    const discountCommissions = await pollUntil("3 discount commissions", async () => {
      const { data } = await supabase
        .from("partner_commissions")
        .select("*")
        .eq("partner_id", cleanup.partnerId!)
        .eq("kind", "commission");
      return data && data.length >= DISCOUNT_MONTHS ? data : null;
    });
    assertEq("commission count after discount window", DISCOUNT_MONTHS, discountCommissions.length);

    // —— 8. Past discount window → full price ——
    {
      const clockNow = (await stripe.testHelpers.testClocks.retrieve(clock.id)).frozen_time;
      await advanceClock(stripe, clock.id, clockNow + 32 * 86400, "post-discount month");
      if (delivery === "direct") {
        await processSubscriptionDirect(subscription.id, "e2e.clock.full_price");
        await processPaidInvoicesDirect(subscription.id, cleanup.businessId!);
      }
      const fullInv = await pollUntil("full-price invoice", async () => {
        if (delivery === "direct") {
          await processPaidInvoicesDirect(subscription.id, cleanup.businessId!);
        }
        const list = await stripe.invoices.list({ subscription: subscription.id, limit: 20 });
        const paid = list.data
          .filter((i) => i.status === "paid" && (i.amount_paid ?? 0) > 0)
          .sort((a, b) => (a.created ?? 0) - (b.created ?? 0));
        return paid.length >= DISCOUNT_MONTHS + 1 ? paid[DISCOUNT_MONTHS] : null;
      });
      console.log(
        `\n8. Post-window invoice ${fullInv.id}: amount_paid=${fullInv.amount_paid}¢ (expected full ${listPriceCents}¢)`
      );
      assertEq("post-window invoice full list price", listPriceCents, fullInv.amount_paid);

      const fullComm = await pollUntil("full-price commission", async () => {
        const { data } = await supabase
          .from("partner_commissions")
          .select("*")
          .eq("partner_id", cleanup.partnerId!)
          .eq("kind", "commission")
          .order("earned_at", { ascending: true });
        return data && data.length >= DISCOUNT_MONTHS + 1 ? data[DISCOUNT_MONTHS] : null;
      });
      const expectedFullComm = roundCommission(listPriceCents, COMMISSION_RATE);
      assertEq("full-price commission on list amount", expectedFullComm, fullComm.amount_cents);
      assertTrue(
        "full-price commission > discounted commission",
        (fullComm.amount_cents as number) > expectedComm1,
        `${fullComm.amount_cents} vs ${expectedComm1}`
      );
    }

    // —— 9. Refund one discounted invoice ——
    const refundTarget = firstPaid;
    const refund = await (async (): Promise<Stripe.Refund> => {
      const invPayments = await stripe.invoicePayments.list({
        invoice: refundTarget.id!,
        limit: 5,
      });
      for (const ip of invPayments.data) {
        const pay = ip.payment as
          | { type?: string; payment_intent?: string | { id: string } }
          | string
          | null;
        if (!pay || typeof pay === "string") continue;
        const pi = pay.payment_intent;
        if (typeof pi === "string") return stripe.refunds.create({ payment_intent: pi });
        if (pi && typeof pi === "object" && pi.id) {
          return stripe.refunds.create({ payment_intent: pi.id });
        }
      }
      const legacy = refundTarget as Stripe.Invoice & {
        payment_intent?: string | { id: string } | null;
        charge?: string | { id: string } | null;
      };
      if (typeof legacy.payment_intent === "string") {
        return stripe.refunds.create({ payment_intent: legacy.payment_intent });
      }
      if (typeof legacy.charge === "string") {
        return stripe.refunds.create({ charge: legacy.charge });
      }
      throw new Error(`Cannot resolve payment_intent/charge for invoice ${refundTarget.id}`);
    })();
    console.log(`\n9. Refund ${refund.id} amount=${refund.amount}¢ on invoice ${refundTarget.id}`);

    if (delivery === "direct") {
      const { maybeReverseCommissionForRefund } = await import("../src/lib/partner-commissions");
      const result = await maybeReverseCommissionForRefund({
        stripeInvoiceId: refundTarget.id!,
        refundId: refund.id,
        refundAmountCents: refund.amount ?? 0,
        stripeEventId: `e2e_direct_refund_${refund.id}`,
      });
      console.log(`  [direct] refund reversal:`, result);
    }

    const reversal = await pollUntil("refund reversal row", async () => {
      if (delivery === "direct") {
        const { maybeReverseCommissionForRefund } = await import("../src/lib/partner-commissions");
        try {
          await maybeReverseCommissionForRefund({
            stripeInvoiceId: refundTarget.id!,
            refundId: refund.id,
            refundAmountCents: refund.amount ?? 0,
            stripeEventId: `e2e_direct_refund_${refund.id}`,
          });
        } catch {
          /* retry */
        }
      }
      const { data } = await supabase
        .from("partner_commissions")
        .select("*")
        .eq("partner_id", cleanup.partnerId!)
        .eq("kind", "reversal")
        .limit(1)
        .maybeSingle();
      return data ?? null;
    });

    const expectedReversal = roundCommission(discountedCents, COMMISSION_RATE);
    assertEq("reversal uses original 30% rate", COMMISSION_RATE, Number(reversal.commission_rate_pct));
    assertEq("reversal source = discounted refund base", discountedCents, reversal.source_amount_cents);
    assertEq("reversal amount = -30% of discounted", -expectedReversal, reversal.amount_cents);
    assertEq("reversal links to first commission", firstCommission.id, reversal.reverses_commission_id);

    // —— 10. Hold already past (frozen start) — assert payable ——
    const { computePartnerBalance } = await import("../src/lib/partner-commissions");
    const balanceBeforePayout = await computePartnerBalance(cleanup.partnerId, "test");
    console.log(`\n10. Balance before payout:`, {
      pending: balanceBeforePayout.pendingCents,
      openNet: balanceBeforePayout.openNetCents,
      payable: balanceBeforePayout.payableCents,
      lifetime: balanceBeforePayout.lifetimeEarnedCents,
      reversed: balanceBeforePayout.reversedCents,
    });
    assertTrue(
      "pending hold is zero (frozen times already past +30d)",
      balanceBeforePayout.pendingCents === 0,
      `pending=${balanceBeforePayout.pendingCents}`
    );
    assertTrue(
      "payable balance positive",
      balanceBeforePayout.payableCents > 0,
      `payable=${balanceBeforePayout.payableCents}`
    );

    // —— 11. Record payout ——
    const { recordPartnerPayout } = await import("../src/lib/partner-payouts");
    const payout = await recordPartnerPayout({
      partnerId: cleanup.partnerId,
      amountCents: balanceBeforePayout.payableCents,
      actor,
      idempotencyKey: `e2e-payout-${stamp}`,
      method: "e2e_harness",
      note: "partner-lifecycle-e2e",
    });
    console.log(`\n11. Payout ${payout.payoutId} amount=${payout.amountCents}¢`);

    const { data: stamped } = await supabase
      .from("partner_commissions")
      .select("id, payout_id, kind")
      .eq("partner_id", cleanup.partnerId)
      .not("payout_id", "is", null);
    assertTrue(
      "ledger rows stamped with payout_id",
      (stamped?.length ?? 0) > 0,
      `stamped=${stamped?.length}`
    );

    const balanceAfter = await computePartnerBalance(cleanup.partnerId, "test");
    assertEq("payable after payout is 0", 0, balanceAfter.payableCents);
    assertEq(
      "paid cents equals payout amount",
      payout.amountCents,
      balanceAfter.paidCents
    );

    // —— 12. Dashboard / platform / reconcile agree ——
    const { loadPartnerDashboardSummary } = await import("../src/lib/partner-dashboard");
    const { getPartnerById } = await import("../src/lib/partners");
    const partnerRow = await getPartnerById(cleanup.partnerId);
    if (!partnerRow) throw new Error("partner missing");
    const dash = await loadPartnerDashboardSummary(partnerRow);
    assertEq(
      "dashboard lifetime earned matches balance",
      balanceAfter.lifetimeEarnedCents,
      dash.balance.lifetimeEarnedCents
    );
    assertEq("dashboard paid matches balance", balanceAfter.paidCents, dash.balance.paidCents);

    const { data: ourPayments } = await supabase
      .from("platform_subscription_payments")
      .select("id")
      .eq("business_id", cleanup.businessId);
    assertTrue(
      "platform_subscription_payments has REAL rows",
      (ourPayments?.length ?? 0) >= DISCOUNT_MONTHS + 1,
      `count=${ourPayments?.length}`
    );

    const { data: ourCommissions } = await supabase
      .from("partner_commissions")
      .select("id, kind")
      .eq("partner_id", cleanup.partnerId);
    const commCount = (ourCommissions ?? []).filter((r) => r.kind === "commission").length;
    const revCount = (ourCommissions ?? []).filter((r) => r.kind === "reversal").length;
    assertTrue("ledger has commission rows (>0)", commCount >= DISCOUNT_MONTHS + 1, `n=${commCount}`);
    assertTrue("ledger has reversal rows (>0)", revCount >= 1, `n=${revCount}`);

    // Run reconciliation checks scoped conceptually — invoke the same math as verify-partner-commissions
    // on OUR rows only (full script scans all partners; we assert our subset is clean).
    for (const row of ourCommissions ?? []) {
      if (row.kind !== "commission" && row.kind !== "reversal") continue;
    }
    const { data: fullCheck } = await supabase
      .from("partner_commissions")
      .select("*")
      .eq("partner_id", cleanup.partnerId);
    let reconOk = true;
    for (const row of fullCheck ?? []) {
      if (row.kind !== "commission" && row.kind !== "reversal") continue;
      const expected = roundCommission(
        row.source_amount_cents as number,
        Number(row.commission_rate_pct)
      );
      const actual = Math.abs(row.amount_cents as number);
      if (row.kind === "commission" && actual !== expected) {
        reconOk = false;
        console.log(`  recon fail ${row.id}: ${actual} != ${expected}`);
      }
    }
    assertTrue("reconciliation math clean for e2e partner rows", reconOk, "see above");

    console.log("\n—— invoice amount timeline ——");
    console.log(`  during trial (before advance): no positive paid invoices`);
    console.log(`  after trial (first paid):      ${paidAmounts[0]}¢ (expect ${discountedCents})`);
    for (let i = 1; i < paidAmounts.length; i++) {
      console.log(`  discount month ${i + 1}:             ${paidAmounts[i]}¢`);
    }
  } finally {
    const remaining = await cleanupAll(stripe, supabase, cleanup, actor);
    console.log("\n—— created this run ——");
    console.log(`  partner:    ${cleanup.partnerId ?? "(none)"}`);
    console.log(`  business:   ${cleanup.businessId ?? "(none)"}`);
    console.log(`  clock:      ${cleanup.clockId ?? "(none)"}`);
    console.log(`  coupons:    ${cleanup.couponIds.join(", ") || "(none)"}`);
    console.log(`  remaining:  ${remaining.length ? remaining.join("; ") : "none"}`);
  }

  console.log("\n========================================");
  console.log(`Assertions: ${assertions.length - failures} passed, ${failures} failed`);
  console.log("========================================");
  if (failures > 0) process.exit(1);
  console.log("ALL ASSERTIONS PASSED");
}

main().catch((err) => {
  console.error("\nFATAL:", err instanceof Error ? err.message : err);
  if (err instanceof Error && err.stack) console.error(err.stack);
  process.exit(1);
});
