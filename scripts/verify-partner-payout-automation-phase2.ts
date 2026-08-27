/**
 * Phase 2 automated partner payout run verification.
 * Real transfer / idempotency tests use ONLY the dedicated verification partner (683726a2-…).
 * Skip-path scenarios use ephemeral @example.test partners — never touches live partner rows.
 *
 * Usage: npx tsx scripts/verify-partner-payout-automation-phase2.ts
 * Requires sk_test_ deploy mode.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import { computePartnerBalance } from "../src/lib/partner-commissions";
import {
  automatedPayoutIdempotencyKey,
  currentPayoutPeriodKey,
  loadPartnerPayoutAutomationSettings,
  updatePartnerPayoutAutomationSettings,
} from "../src/lib/partner-payout-automation";
import {
  evaluatePartnerForPayout,
  previewPartnerPayoutRun,
  runPartnerPayouts,
} from "../src/lib/partner-payout-run";
import {
  applyPartnerStripeAccountSnapshot,
  createPartnerExpressAccount,
  retrievePartnerExpressAccount,
} from "../src/lib/partner-stripe-connect";
import {
  createPartnerAdjustment,
  PARTNER_ADJUST_DEBIT_CONFIRM,
} from "../src/lib/partner-payouts";
import { getStripe, getStripeMode } from "../src/lib/stripe";

const VERIFICATION_PARTNER_ID = "683726a2-56e6-4376-93ef-ef06adf0d0c7";
const LIVE_PARTNER_ID = "140ccbea-1c16-4b76-9412-a95ad4f5311c";
const FIXTURE_NOTE_PREFIX = "phase2-payout-verify";
const VERIFY_PAYABLE_CENTS = 6000;

async function ensureVerificationPayableBalance(
  raw: ReturnType<typeof createClient>,
  partner: { id: string; referral_code: string },
  stamp: string
) {
  const bal = await computePartnerBalance(VERIFICATION_PARTNER_ID, "test");
  if (bal.openNetCents >= 5000) return bal;

  log("0b. Re-seeding verification partner payable balance", { openNetCents: bal.openNetCents });
  const earnedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const payableAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const { data: biz } = await raw
    .from("businesses")
    .insert({
      name: `Payout Verify Re-seed ${stamp}`,
      slug: `payout-verify-reseed-${stamp}`,
      plan: "studio",
      status: "active",
      created_via: "platform",
      subscription_status: "active",
    })
    .select("id")
    .single();
  assert(biz?.id, "re-seed biz failed");
  await raw.from("partner_referrals").insert({
    partner_id: VERIFICATION_PARTNER_ID,
    business_id: biz.id,
    referral_code_used: partner.referral_code,
    source: "manual",
  });
  const { data: payment } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: `in_reseed_${stamp}`,
      amount_paid_cents: VERIFY_PAYABLE_CENTS * 4,
      currency: "usd",
      paid_at: earnedAt,
      stripe_mode: "test",
    })
    .select("id")
    .single();
  assert(payment?.id, "re-seed payment failed");
  await raw.from("partner_commissions").insert({
    partner_id: VERIFICATION_PARTNER_ID,
    business_id: biz.id,
    subscription_payment_id: payment.id,
    kind: "commission",
    commission_rate_pct: 25,
    source_amount_cents: VERIFY_PAYABLE_CENTS * 4,
    amount_cents: VERIFY_PAYABLE_CENTS,
    currency: "usd",
    stripe_mode: "test",
    payable_at: payableAt,
    earned_at: earnedAt,
    note: `${FIXTURE_NOTE_PREFIX} re-seed ${stamp}`,
  });
  return computePartnerBalance(VERIFICATION_PARTNER_ID, "test");
}

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  const k = m[1].trim();
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(k in process.env)) process.env[k] = v;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function log(section: string, data: unknown) {
  console.log(`\n=== ${section} ===`);
  console.log(typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

async function createFixturePartner(raw: ReturnType<typeof createClient>, stamp: string) {
  const email = `auto-payout-${stamp}@example.test`;
  const { data: partner, error } = await raw
    .from("partners")
    .insert({
      name: `Auto Payout ${stamp}`,
      email,
      brand_name: `Auto Brand ${stamp}`,
      referral_code: `ap-${stamp}`,
      commission_rate_pct: 30,
      status: "active",
    })
    .select(
      "id, email, name, brand_name, status, stripe_connect_account_id, stripe_connect_payouts_enabled, stripe_connect_requirements_due, stripe_connect_requirements_summary, stripe_connect_mode, stripe_connect_account_status"
    )
    .single();
  assert(!error && partner, error?.message || "partner create failed");
  return partner;
}

async function seedPayableCommission(
  raw: ReturnType<typeof createClient>,
  partnerId: string,
  amountCents: number,
  stamp: string
) {
  const earnedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const payableAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
  const { data: biz } = await raw
    .from("businesses")
    .insert({
      name: `Auto Biz ${stamp}`,
      slug: `auto-biz-${stamp}`,
      plan: "studio",
      status: "active",
      created_via: "platform",
      subscription_status: "active",
    })
    .select("id")
    .single();
  assert(biz?.id, "biz failed");
  await raw.from("partner_referrals").insert({
    partner_id: partnerId,
    business_id: biz.id,
    referral_code_used: `ap-${stamp}`,
    source: "manual",
  });
  const { data: payment } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: `in_auto_payout_${stamp}`,
      amount_paid_cents: amountCents * 4,
      currency: "usd",
      paid_at: earnedAt,
      stripe_mode: "test",
    })
    .select("id")
    .single();
  assert(payment?.id, "payment failed");
  await raw.from("partner_commissions").insert({
    partner_id: partnerId,
    business_id: biz.id,
    subscription_payment_id: payment.id,
    kind: "commission",
    commission_rate_pct: 25,
    source_amount_cents: amountCents * 4,
    amount_cents: amountCents,
    currency: "usd",
    stripe_mode: "test",
    payable_at: payableAt,
    earned_at: earnedAt,
    note: `phase2-verify-${stamp}`,
  });
  const bal = await computePartnerBalance(partnerId, "test");
  assert(bal.openNetCents === amountCents, `seed expected openNet ${amountCents} got ${bal.openNetCents}`);
  return { bizId: biz.id, paymentId: payment.id };
}

async function markConnectReady(
  raw: ReturnType<typeof createClient>,
  partnerId: string,
  accountId: string,
  overrides?: Partial<{
    payoutsEnabled: boolean;
    requirementsDue: boolean;
    requirementsSummary: string | null;
    status: string;
  }>
) {
  await raw
    .from("partners")
    .update({
      stripe_connect_account_id: accountId,
      stripe_connect_account_status: overrides?.status ?? "ready",
      stripe_connect_payouts_enabled: overrides?.payoutsEnabled ?? true,
      stripe_connect_details_submitted: true,
      stripe_connect_requirements_due: overrides?.requirementsDue ?? false,
      stripe_connect_requirements_summary: overrides?.requirementsSummary ?? null,
      stripe_connect_mode: "test",
      stripe_connect_connected_at: new Date().toISOString(),
      stripe_connect_updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);
}

async function linkExpressAccount(
  raw: ReturnType<typeof createClient>,
  partner: { id: string; email: string; name: string; brand_name: string | null },
  stamp: string,
  overrides?: Parameters<typeof markConnectReady>[3]
) {
  const row = {
    id: partner.id,
    email: partner.email,
    name: partner.name,
    brand_name: partner.brand_name,
    referral_code: `ap-${stamp}`,
    commission_rate_pct: 30,
    status: "active" as const,
  };
  const account = await createPartnerExpressAccount(row);
  await markConnectReady(raw, partner.id, account.id, overrides);
  return account.id;
}

async function loadPartnerRow(raw: ReturnType<typeof createClient>, id: string) {
  const { data } = await raw
    .from("partners")
    .select(
      "id, email, name, brand_name, status, referral_code, stripe_connect_account_id, stripe_connect_payouts_enabled, stripe_connect_requirements_due, stripe_connect_requirements_summary, stripe_connect_mode, stripe_connect_account_status"
    )
    .eq("id", id)
    .single();
  assert(data, "partner missing");
  return data;
}

async function cleanupEphemeral(
  raw: ReturnType<typeof createClient>,
  partnerId: string,
  extras?: { bizId?: string; stripeAccountId?: string }
) {
  await raw.from("partner_payout_run_items").delete().eq("partner_id", partnerId);
  const { data: refs } = await raw
    .from("partner_referrals")
    .select("business_id")
    .eq("partner_id", partnerId);
  const bizIds = (refs ?? []).map((r) => r.business_id as string).filter(Boolean);
  await raw.from("partner_commissions").delete().eq("partner_id", partnerId);
  await raw.from("partner_payouts").delete().eq("partner_id", partnerId);
  for (const bizId of bizIds) {
    await raw.from("platform_subscription_payments").delete().eq("business_id", bizId);
    await raw.from("partner_referrals").delete().eq("business_id", bizId);
    await raw.from("businesses").delete().eq("id", bizId);
  }
  if (extras?.bizId && !bizIds.includes(extras.bizId)) {
    await raw.from("platform_subscription_payments").delete().eq("business_id", extras.bizId);
    await raw.from("partner_referrals").delete().eq("business_id", extras.bizId);
    await raw.from("businesses").delete().eq("id", extras.bizId);
  }
  await raw.from("partners").delete().eq("id", partnerId);
  if (extras?.stripeAccountId) {
    try {
      const { stripe } = getStripe();
      await stripe.accounts.del(extras.stripeAccountId);
    } catch {
      /* orphan ok in test */
    }
  }
}

/** Reset verification partner automated payout for a period so idempotency can be re-tested. */
async function resetVerificationPeriodPayout(
  raw: ReturnType<typeof createClient>,
  partnerId: string,
  periodKey: string
) {
  const idempotencyKey = automatedPayoutIdempotencyKey({
    partnerId,
    periodKey,
    stripeMode: "test",
  });
  const { data: payout } = await raw
    .from("partner_payouts")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();
  if (payout?.id) {
    await raw
      .from("partner_commissions")
      .update({ payout_id: null })
      .eq("partner_id", partnerId)
      .eq("payout_id", payout.id);
    await raw.from("partner_payouts").delete().eq("id", payout.id);
  }
}

async function assertLivePartnerUntouched(
  raw: ReturnType<typeof createClient>,
  before: Record<string, unknown>
) {
  const { data: after } = await raw
    .from("partners")
    .select(
      "id, status, stripe_connect_account_id, stripe_connect_payouts_enabled, stripe_connect_account_status, updated_at"
    )
    .eq("id", LIVE_PARTNER_ID)
    .single();
  assert(after, "live partner missing");
  assert(
    after.stripe_connect_account_id === before.stripe_connect_account_id &&
      after.status === before.status &&
      after.stripe_connect_payouts_enabled === before.stripe_connect_payouts_enabled,
    `LIVE PARTNER TOUCHED: before=${JSON.stringify(before)} after=${JSON.stringify(after)}`
  );
}

async function listStripeTransfersForAccount(stripe: Stripe, accountId: string) {
  const transfers = await stripe.transfers.list({ destination: accountId, limit: 10 });
  return transfers.data.map((t) => ({
    id: t.id,
    amount: t.amount,
    created: t.created,
    metadata: t.metadata,
  }));
}

/** Stripe test mode: use tok_bypassPending only — never pass raw card numbers to the API. */
async function ensureStripePlatformBalance(stripe: Stripe, minCents: number) {
  const balance = await stripe.balance.retrieve();
  const usd = balance.available.find((b) => b.currency === "usd")?.amount ?? 0;
  if (usd >= minCents) {
    log("Platform Stripe balance OK", { availableUsdCents: usd, requiredCents: minCents });
    return usd;
  }
  const topUp = Math.max(minCents - usd + 10_000, 50_000);
  log("Platform Stripe balance low — topping up via test charge", {
    availableUsdCents: usd,
    topUpCents: topUp,
  });
  const charge = await stripe.charges.create({
    amount: topUp,
    currency: "usd",
    source: "tok_bypassPending",
    description: "Partner payout verification platform balance top-up",
  });
  log("Platform top-up charge", { id: charge.id, status: charge.status, paid: charge.paid });
  const after = await stripe.balance.retrieve();
  const usdAfter = after.available.find((b) => b.currency === "usd")?.amount ?? 0;
  log("Platform Stripe balance after top-up", { availableUsdCents: usdAfter });
  if (usdAfter < minCents) {
    throw new Error(
      `Platform Stripe available balance still ${usdAfter} cents after top-up (need ${minCents}). Add test funds manually.`
    );
  }
  return usdAfter;
}

async function assertVerificationPartnerIsExpressReady(
  stripe: Stripe,
  raw: ReturnType<typeof createClient>,
  partnerId: string,
  stripeConnectAccountId: string
) {
  const account = await stripe.accounts.retrieve(stripeConnectAccountId);
  log("0a. Stripe Connect account (verification partner)", {
    id: account.id,
    type: account.type,
    payouts_enabled: account.payouts_enabled,
    transfers: account.capabilities?.transfers,
    details_submitted: account.details_submitted,
    requirements_due: account.requirements?.currently_due,
  });
  assert(account.type === "express", `verification partner must use Express (got ${account.type})`);
  assert(
    account.capabilities?.transfers === "active",
    "Express transfers capability must be active — complete Account Link onboarding in test mode first"
  );
  assert(account.payouts_enabled, "Express payouts_enabled must be true");

  const { data: before } = await raw
    .from("partners")
    .select(
      "stripe_connect_account_status, stripe_connect_payouts_enabled, stripe_connect_requirements_due, stripe_connect_updated_at"
    )
    .eq("id", partnerId)
    .single();
  assert(before, "verification partner row missing");

  // Same handler path as account.updated in /api/stripe/webhook/partner-connect/route.ts
  await applyPartnerStripeAccountSnapshot(partnerId, account);

  const { data: after } = await raw
    .from("partners")
    .select(
      "stripe_connect_account_status, stripe_connect_payouts_enabled, stripe_connect_requirements_due, stripe_connect_updated_at"
    )
    .eq("id", partnerId)
    .single();
  log("0a. account.updated webhook path (applyPartnerStripeAccountSnapshot)", {
    before,
    after,
    note: "Exercises partner-connect/route.ts account.updated handler for Express accounts",
  });
  assert(after?.stripe_connect_account_status === "ready", "snapshot must mark Connect ready");
  assert(after?.stripe_connect_payouts_enabled === true, "snapshot must set payouts enabled");

  return account;
}

async function main() {
  const mode = getStripeMode();
  assert(mode === "test", `REFUSE: test mode only (got ${mode})`);

  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: sa } = await raw
    .from("profiles")
    .select("id")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  assert(sa?.id, "need super_admin");
  const actorId = sa.id as string;

  const stamp = `p2-${Date.now().toString(36)}`;
  const periodKey = currentPayoutPeriodKey();
  /** Fresh period slice avoids Stripe idempotency cache from prior failed transfer attempts on 2026-08. */
  const verifyPeriodKey = `${periodKey}-verify-${stamp}`;

  const { stripe } = getStripe();
  await ensureStripePlatformBalance(stripe, 20_000);

  const { data: liveBefore } = await raw
    .from("partners")
    .select(
      "id, status, stripe_connect_account_id, stripe_connect_payouts_enabled, stripe_connect_account_status"
    )
    .eq("id", LIVE_PARTNER_ID)
    .single();
  assert(liveBefore, "live partner row required for guard");

  const verifyPartner = await loadPartnerRow(raw, VERIFICATION_PARTNER_ID);
  log("0. Dedicated verification partner", verifyPartner);
  assert(verifyPartner.status === "active", "verification partner must be active");
  assert(verifyPartner.stripe_connect_account_id, "verification partner needs Connect account");

  const destAccount = verifyPartner.stripe_connect_account_id as string;
  await assertVerificationPartnerIsExpressReady(stripe, raw, VERIFICATION_PARTNER_ID, destAccount);

  const verifyPartnerAfterSnapshot = await loadPartnerRow(raw, VERIFICATION_PARTNER_ID);
  log("0. Verification partner after account.updated snapshot", verifyPartnerAfterSnapshot);
  assert(
    verifyPartnerAfterSnapshot.stripe_connect_payouts_enabled,
    "verification partner payouts must be enabled"
  );
  assert(
    verifyPartnerAfterSnapshot.stripe_connect_account_status === "ready",
    "verification partner Connect must be ready"
  );

  const verifyBalBefore = await ensureVerificationPayableBalance(
    raw,
    verifyPartnerAfterSnapshot,
    stamp
  );
  log("0. Verification partner balance", verifyBalBefore);
  assert(verifyBalBefore.openNetCents >= 5000, "verification partner needs >= $50 payable balance");

  // Remove stale ephemeral partners from prior failed runs
  const { data: stale } = await raw.from("partners").select("id").like("email", "auto-payout-%@example.test");
  for (const row of stale ?? []) {
    await cleanupEphemeral(raw, row.id as string);
  }

  const settingsBefore = await loadPartnerPayoutAutomationSettings();

  log("1. TEST dry run", "starting…");
  const dryRun = await runPartnerPayouts({
    triggeredBy: "manual",
    dryRunRequested: true,
    skipAutomationGate: true,
    sendEmails: false,
  });
  log("1. TEST dry run result", dryRun);
  await assertLivePartnerUntouched(raw, liveBefore);

  // Skip-path scenarios — ephemeral partners only
  const belowPartner = await createFixturePartner(raw, `${stamp}-below`);
  await seedPayableCommission(raw, belowPartner.id, 2000, `${stamp}-below`);
  await linkExpressAccount(raw, belowPartner, `${stamp}-below`);
  const belowEval = await evaluatePartnerForPayout({
    partner: await loadPartnerRow(raw, belowPartner.id),
    periodKey,
    stripeMode: "test",
    minimumCents: 5000,
  });
  log("5. Below threshold", belowEval);
  assert(belowEval.skipReason === "below_minimum_threshold");

  const reqPartner = await createFixturePartner(raw, `${stamp}-req`);
  await seedPayableCommission(raw, reqPartner.id, 6000, `${stamp}-req`);
  await linkExpressAccount(raw, reqPartner, `${stamp}-req`, {
    payoutsEnabled: true,
    requirementsDue: true,
    requirementsSummary: "individual.verification.document",
    status: "action_required",
  });
  const reqEval = await evaluatePartnerForPayout({
    partner: await loadPartnerRow(raw, reqPartner.id),
    periodKey,
    stripeMode: "test",
    minimumCents: 5000,
  });
  log("6. Requirements outstanding", reqEval);
  assert(reqEval.skipReason === "connect_requirements_due");

  const negPartner = await createFixturePartner(raw, `${stamp}-neg`);
  await seedPayableCommission(raw, negPartner.id, 6000, `${stamp}-neg`);
  await linkExpressAccount(raw, negPartner, `${stamp}-neg`);
  await createPartnerAdjustment({
    partnerId: negPartner.id,
    amountCents: -8000,
    note: "phase2 verify negative adjustment",
    confirm: PARTNER_ADJUST_DEBIT_CONFIRM,
    actor: { id: actorId, email: null },
  });
  const negEval = await evaluatePartnerForPayout({
    partner: await loadPartnerRow(raw, negPartner.id),
    periodKey,
    stripeMode: "test",
    minimumCents: 5000,
  });
  log("7. Negative balance", negEval);
  assert(negEval.skipReason === "negative_balance");

  // --- Real transfer tests on VERIFICATION PARTNER ONLY ---
  await resetVerificationPeriodPayout(raw, VERIFICATION_PARTNER_ID, verifyPeriodKey);
  const idempotencyKey = automatedPayoutIdempotencyKey({
    partnerId: VERIFICATION_PARTNER_ID,
    periodKey: verifyPeriodKey,
    stripeMode: "test",
  });
  log("2/3. Idempotency key", { periodKey: verifyPeriodKey, idempotencyKey });

  await updatePartnerPayoutAutomationSettings({
    automated_payouts_test_transfers_enabled: true,
    automated_payouts_dry_run: false,
  });
  process.env.PARTNER_PAYOUT_SIMULATE_PLATFORM_BALANCE_CENTS = "500000";

  const transfersBefore = await listStripeTransfersForAccount(stripe, destAccount);
  log("2. Stripe transfers BEFORE concurrent test", transfersBefore);

  const [runA, runB] = await Promise.all([
    runPartnerPayouts({
      triggeredBy: "manual",
      executeTransfersRequested: true,
      partnerIds: [VERIFICATION_PARTNER_ID],
      periodKey: verifyPeriodKey,
      skipAutomationGate: true,
      sendEmails: false,
    }),
    runPartnerPayouts({
      triggeredBy: "manual",
      executeTransfersRequested: true,
      partnerIds: [VERIFICATION_PARTNER_ID],
      periodKey: verifyPeriodKey,
      skipAutomationGate: true,
      sendEmails: false,
    }),
  ]);
  log("3. Concurrent run A", runA);
  log("3. Concurrent run B", runB);

  const paidA = runA.partners.find((p) => p.partnerId === VERIFICATION_PARTNER_ID);
  const paidB = runB.partners.find((p) => p.partnerId === VERIFICATION_PARTNER_ID);
  log("3. Per-partner outcomes", { paidA, paidB });

  const transferIds = [paidA?.stripeTransferId, paidB?.stripeTransferId].filter(Boolean);
  const uniqueTransferIds = [...new Set(transferIds)];
  log("3. Stripe transfer ids from both runs", { transferIds, uniqueTransferIds });

  const { data: payouts } = await raw
    .from("partner_payouts")
    .select("*")
    .eq("partner_id", VERIFICATION_PARTNER_ID)
    .eq("source", "automated")
    .eq("idempotency_key", idempotencyKey);
  log("4. partner_payouts rows for period", payouts);

  const transfersAfterConcurrent = await listStripeTransfersForAccount(stripe, destAccount);
  log("4. Stripe transfers AFTER concurrent test", transfersAfterConcurrent);

  const newTransfers = transfersAfterConcurrent.filter(
    (t) => !transfersBefore.some((b) => b.id === t.id)
  );
  log("4. NEW Stripe transfers this test", newTransfers);

  const transferSucceeded =
    uniqueTransferIds.length === 1 &&
    (payouts ?? []).length === 1 &&
    newTransfers.length === 1 &&
    runA.totalPaid + runB.totalPaid >= 1;

  if (transferSucceeded) {
    assert(uniqueTransferIds[0] === (payouts ?? [])[0]?.reference, "payout reference must match transfer id");
    const transferObj = await stripe.transfers.retrieve(uniqueTransferIds[0]!);
    log("2/4. Stripe transfer object (both runs same id)", transferObj);

    const { data: linked } = await raw
      .from("partner_commissions")
      .select("id, payout_id, amount_cents")
      .eq("partner_id", VERIFICATION_PARTNER_ID)
      .not("payout_id", "is", null);
    log("4. Linked ledger entries after concurrent payout", linked);
    assert((linked ?? []).length > 0, "ledger must be linked once");

    // Sequential cron-retry: second run after success must no-op (already_paid_this_period)
    const seqRun = await runPartnerPayouts({
      triggeredBy: "manual",
      executeTransfersRequested: true,
      partnerIds: [VERIFICATION_PARTNER_ID],
      periodKey: verifyPeriodKey,
      skipAutomationGate: true,
      sendEmails: false,
    });
    log("3b. Sequential retry after paid", seqRun);
    const seqItem = seqRun.partners.find((p) => p.partnerId === VERIFICATION_PARTNER_ID);
    assert(
      seqItem?.outcome === "skipped" &&
        (seqItem.skipReason === "already_paid_this_period" ||
          seqItem.skipReason === "zero_payable"),
      `expected already_paid or zero_payable on retry, got ${JSON.stringify(seqItem)}`
    );
    const transfersAfterSeq = await listStripeTransfersForAccount(stripe, destAccount);
    assert(
      transfersAfterSeq.filter((t) => !transfersBefore.some((b) => b.id === t.id)).length === 1,
      "sequential retry must not create a second Stripe transfer"
    );

    // Ledger-fail recovery: simulate transfer OK + DB write fail, then self-heal
    await resetVerificationPeriodPayout(raw, VERIFICATION_PARTNER_ID, verifyPeriodKey);
    process.env.PARTNER_PAYOUT_FORCE_LEDGER_FAIL_PARTNER_ID = VERIFICATION_PARTNER_ID;
    const ledgerFailRun = await runPartnerPayouts({
      triggeredBy: "manual",
      executeTransfersRequested: true,
      partnerIds: [VERIFICATION_PARTNER_ID],
      periodKey: verifyPeriodKey,
      skipAutomationGate: true,
      sendEmails: false,
    });
    delete process.env.PARTNER_PAYOUT_FORCE_LEDGER_FAIL_PARTNER_ID;
    log("3c. Ledger-fail simulation run", ledgerFailRun);
    const failItem = ledgerFailRun.partners.find((p) => p.partnerId === VERIFICATION_PARTNER_ID);
    assert(failItem?.outcome === "failed", "expected failed outcome when ledger write forced");
    assert(
      String(failItem?.error ?? "").includes("transfer_ok_ledger_failed") ||
        String(failItem?.error ?? "").includes("Simulated ledger"),
      `expected ledger fail error, got ${failItem?.error}`
    );

    const { data: payoutAfterFail } = await raw
      .from("partner_payouts")
      .select("id")
      .eq("partner_id", VERIFICATION_PARTNER_ID)
      .eq("idempotency_key", idempotencyKey);
    assert((payoutAfterFail ?? []).length === 0, "no payout row after ledger fail");

    const balStillPayable = await computePartnerBalance(VERIFICATION_PARTNER_ID, "test");
    log("3c. Balance still payable after ledger fail", balStillPayable);
    assert(balStillPayable.openNetCents >= 5000, "ledger unstamped — balance still payable");

    const healRun = await runPartnerPayouts({
      triggeredBy: "manual",
      executeTransfersRequested: true,
      partnerIds: [VERIFICATION_PARTNER_ID],
      periodKey: verifyPeriodKey,
      skipAutomationGate: true,
      sendEmails: false,
    });
    log("3d. Self-heal retry after ledger fail", healRun);
    const healItem = healRun.partners.find((p) => p.partnerId === VERIFICATION_PARTNER_ID);
    assert(healItem?.outcome === "paid", `self-heal must record payout, got ${JSON.stringify(healItem)}`);

    const healTransferId = healItem?.stripeTransferId;
    const failTransferId = failItem?.stripeTransferId;
    log("3d. Transfer ids ledger-fail vs heal", { failTransferId, healTransferId });
    assert(
      healTransferId && failTransferId && healTransferId === failTransferId,
      "Stripe idempotency key must return the same transfer on heal retry"
    );

    const { data: linkedAfterHeal } = await raw
      .from("partner_commissions")
      .select("id, payout_id")
      .eq("partner_id", VERIFICATION_PARTNER_ID)
      .not("payout_id", "is", null);
    log("3d. Ledger linked after self-heal", linkedAfterHeal);
    assert((linkedAfterHeal ?? []).length > 0, "ledger must link after self-heal");
  } else {
    log("2/3/4. IDEMPOTENCY NOT PROVEN", {
      reason: "Real Stripe transfer did not succeed end-to-end",
      uniqueTransferIds,
      payoutRows: (payouts ?? []).length,
      newTransfers,
      paidAOutcome: paidA?.outcome,
      paidBOutcome: paidB?.outcome,
      paidAError: paidA?.error,
      paidBError: paidB?.error,
    });
    throw new Error("Idempotency requires successful Stripe transfer — not proven.");
  }

  delete process.env.PARTNER_PAYOUT_SIMULATE_PLATFORM_BALANCE_CENTS;
  await updatePartnerPayoutAutomationSettings({
    automated_payouts_test_transfers_enabled: false,
    automated_payouts_dry_run: true,
  });

  // Insufficient platform balance — ephemeral
  process.env.PARTNER_PAYOUT_SIMULATE_PLATFORM_BALANCE_CENTS = "1000";
  const insufPartner = await createFixturePartner(raw, `${stamp}-insuf`);
  await seedPayableCommission(raw, insufPartner.id, 6000, `${stamp}-insuf`);
  await linkExpressAccount(raw, insufPartner, `${stamp}-insuf`);
  await updatePartnerPayoutAutomationSettings({
    automated_payouts_test_transfers_enabled: true,
    automated_payouts_dry_run: false,
  });
  const insufRun = await runPartnerPayouts({
    triggeredBy: "manual",
    executeTransfersRequested: true,
    partnerIds: [insufPartner.id],
    skipAutomationGate: true,
    sendEmails: false,
  });
  delete process.env.PARTNER_PAYOUT_SIMULATE_PLATFORM_BALANCE_CENTS;
  log("8. Insufficient platform balance", insufRun);
  assert(
    insufRun.partners.some((p) => p.skipReason === "insufficient_platform_balance"),
    "expected insufficient_platform_balance skip"
  );

  process.env.PARTNER_PAYOUT_SIMULATE_PLATFORM_BALANCE_CENTS = "500000";
  process.env.PARTNER_PAYOUT_FORCE_TRANSFER_FAIL_PARTNER_ID = insufPartner.id;
  const failRun = await runPartnerPayouts({
    triggeredBy: "manual",
    executeTransfersRequested: true,
    partnerIds: [insufPartner.id],
    skipAutomationGate: true,
    sendEmails: false,
  });
  delete process.env.PARTNER_PAYOUT_FORCE_TRANSFER_FAIL_PARTNER_ID;
  delete process.env.PARTNER_PAYOUT_SIMULATE_PLATFORM_BALANCE_CENTS;
  log("9. Transfer failure", failRun);
  assert(failRun.partners.some((p) => p.outcome === "failed"), "expected failed outcome");

  await updatePartnerPayoutAutomationSettings({
    automated_payouts_test_transfers_enabled: false,
    automated_payouts_dry_run: true,
  });

  await updatePartnerPayoutAutomationSettings({ automated_payouts_enabled: false });
  const cronOff = await runPartnerPayouts({ triggeredBy: "cron" });
  log("11. Automation OFF — cron no-op", cronOff);
  assert(cronOff.automationDisabled === true && cronOff.status === "skipped");

  const { data: runs } = await raw
    .from("partner_payout_runs")
    .select("id, period_key, status, dry_run, execute_transfers, total_paid, total_skipped")
    .order("started_at", { ascending: false })
    .limit(5);
  log("13. Recent audit runs", runs);

  await updatePartnerPayoutAutomationSettings(settingsBefore);
  await assertLivePartnerUntouched(raw, liveBefore);

  for (const p of [
    { partner: belowPartner },
    { partner: reqPartner },
    { partner: negPartner },
    { partner: insufPartner },
  ]) {
    await cleanupEphemeral(raw, p.partner.id);
  }

  console.log("\n✓ Phase 2 verification complete (test mode, verification partner only for transfers).");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
