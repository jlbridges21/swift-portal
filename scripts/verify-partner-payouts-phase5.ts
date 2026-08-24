/**
 * Phase 5 payouts + adjustments smoke tests (no Stripe Connect / automated payouts).
 * Usage: npx tsx scripts/verify-partner-payouts-phase5.ts
 * Requires sk_test_ deploy mode.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { computePartnerBalance } from "../src/lib/partner-commissions";
import { createPartner } from "../src/lib/partners";
import {
  createPartnerAdjustment,
  PARTNER_ADJUST_DEBIT_CONFIRM,
  PARTNER_PAYOUT_DISCREPANCY_ACK,
  recordPartnerPayout,
} from "../src/lib/partner-payouts";
import { getStripeMode } from "../src/lib/stripe";
import { loadPartnerDashboardSummary } from "../src/lib/partner-dashboard";

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

async function main() {
  const mode = getStripeMode();
  assert(mode === "test", "REFUSE: run phase5 verify only with sk_test_ (got " + mode + ")");

  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: sa } = await raw
    .from("profiles")
    .select("id, email")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  assert(sa?.id, "need super_admin");
  const actor = { id: sa.id as string, email: (sa.email as string) ?? null };

  const stamp = Date.now().toString(36);
  const partnerResult = await createPartner(
    {
      name: `Payout Partner ${stamp}`,
      email: `payout-${stamp}@example.test`,
      brandName: `Payout Brand ${stamp}`,
      referralCode: `pay-${stamp}`,
      commissionRatePct: 25,
      sendInvite: false,
    },
    actor
  );
  const partner = partnerResult.partner;

  // Payable commission (past hold) + unpaid
  const earnedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const payableAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  // Need a payment row for FK (commission kind)
  const { data: biz } = await raw
    .from("businesses")
    .insert({
      name: `Payout Biz ${stamp}`,
      slug: `payout-biz-${stamp}`,
      plan: "studio",
      status: "active",
      created_via: "platform",
      subscription_status: "active",
    })
    .select("id")
    .single();
  assert(biz?.id, "biz create failed");

  await raw.from("partner_referrals").insert({
    partner_id: partner.id,
    business_id: biz.id,
    referral_code_used: partner.referral_code,
    source: "manual",
  });

  const { data: payment } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: `in_test_payout_${stamp}`,
      amount_paid_cents: 8000,
      currency: "usd",
      paid_at: earnedAt,
      stripe_mode: "test",
    })
    .select("id")
    .single();
  assert(payment?.id, "payment create failed");

  const { data: commission, error: cErr } = await raw
    .from("partner_commissions")
    .insert({
      partner_id: partner.id,
      business_id: biz.id,
      subscription_payment_id: payment.id,
      kind: "commission",
      commission_rate_pct: 25,
      source_amount_cents: 8000,
      amount_cents: 2000,
      currency: "usd",
      stripe_mode: "test",
      payable_at: payableAt,
      earned_at: earnedAt,
    })
    .select("id")
    .single();
  assert(!cErr && commission, cErr?.message || "commission insert failed");

  let bal = await computePartnerBalance(partner.id, "test");
  assert(bal.openNetCents === 2000, `expected openNet 2000 got ${bal.openNetCents}`);
  assert(bal.payableCents === 2000, `expected payable 2000 got ${bal.payableCents}`);

  // Negative balance block
  await createPartnerAdjustment({
    partnerId: partner.id,
    amountCents: -2500,
    note: "smoke debit to force negative open net",
    confirm: PARTNER_ADJUST_DEBIT_CONFIRM,
    actor,
  });
  bal = await computePartnerBalance(partner.id, "test");
  assert(bal.openNetCents === -500, `expected -500 got ${bal.openNetCents}`);
  try {
    await recordPartnerPayout({
      partnerId: partner.id,
      amountCents: 100,
      idempotencyKey: `neg-${stamp}`,
      actor,
    });
    throw new Error("expected negative payout to fail");
  } catch (err) {
    assert(
      err instanceof Error && /negative/i.test(err.message),
      `unexpected negative payout error: ${err}`
    );
    console.log("ok — negative balance blocks payout");
  }

  // Clear negative with credit so we can pay
  await createPartnerAdjustment({
    partnerId: partner.id,
    amountCents: 2500,
    note: "smoke credit restoring payable after debit test",
    actor,
  });
  bal = await computePartnerBalance(partner.id, "test");
  assert(bal.openNetCents === 2000, `restored openNet expected 2000 got ${bal.openNetCents}`);

  // Discrepancy without ack
  try {
    await recordPartnerPayout({
      partnerId: partner.id,
      amountCents: 1500,
      idempotencyKey: `disc-noack-${stamp}`,
      actor,
    });
    throw new Error("expected discrepancy without ack to fail");
  } catch (err) {
    assert(
      err instanceof Error && /discrepancy|does not match/i.test(err.message),
      `unexpected discrepancy error: ${err}`
    );
    console.log("ok — amount mismatch requires acknowledgement");
  }

  // Matching payout + idempotent double-submit
  const key = `payout-${stamp}`;
  const first = await recordPartnerPayout({
    partnerId: partner.id,
    amountCents: 2000,
    method: "Wise",
    reference: `wise-${stamp}`,
    note: "phase5 smoke",
    idempotencyKey: key,
    actor,
  });
  assert(!first.reusedExisting, "first payout should be new");
  assert(first.amountCents === 2000, "first amount");

  const second = await recordPartnerPayout({
    partnerId: partner.id,
    amountCents: 2000,
    method: "Wise",
    reference: `wise-${stamp}`,
    note: "phase5 smoke replay",
    idempotencyKey: key,
    actor,
  });
  assert(second.reusedExisting, "second submit must reuse");
  assert(second.payoutId === first.payoutId, "same payout id");
  console.log("ok — double-submit is idempotent");

  const { data: stamped } = await raw
    .from("partner_commissions")
    .select("id, payout_id, amount_cents")
    .eq("partner_id", partner.id)
    .eq("stripe_mode", "test");
  const withPayout = (stamped ?? []).filter((r) => r.payout_id === first.payoutId);
  const stampedSum = withPayout.reduce((s, r) => s + (r.amount_cents as number), 0);
  assert(stampedSum === 2000, `stamped sum ${stampedSum} != 2000`);
  assert(
    (stamped ?? []).every((r) => r.payout_id === first.payoutId),
    "all open rows should be stamped"
  );

  bal = await computePartnerBalance(partner.id, "test");
  assert(bal.payableCents === 0, `payable after payout ${bal.payableCents}`);
  assert(bal.paidCents === 2000, `paid after payout ${bal.paidCents}`);
  assert(bal.openNetCents === 0, `openNet after payout ${bal.openNetCents}`);

  const summary = await loadPartnerDashboardSummary(partner);
  assert(summary.balance.paidCents === bal.paidCents, "dashboard paid mismatch");
  assert(summary.balance.payableCents === bal.payableCents, "dashboard payable mismatch");
  assert(summary.balance.openNetCents === bal.openNetCents, "dashboard openNet mismatch");
  console.log("ok — partner dashboard figures match computePartnerBalance");

  // Refund-after-pay: unpaid reversal → negative open net for next cycle
  const { error: revErr } = await raw.from("partner_commissions").insert({
    partner_id: partner.id,
    business_id: biz.id,
    subscription_payment_id: payment.id,
    kind: "reversal",
    commission_rate_pct: 25,
    source_amount_cents: 8000,
    amount_cents: -500,
    currency: "usd",
    stripe_mode: "test",
    reverses_commission_id: commission.id,
    stripe_refund_id: `re_test_${stamp}`,
    payable_at: null,
    earned_at: new Date().toISOString(),
  });
  assert(!revErr, revErr?.message || "reversal insert failed");
  bal = await computePartnerBalance(partner.id, "test");
  assert(bal.openNetCents === -500, `post-refund openNet expected -500 got ${bal.openNetCents}`);
  assert(bal.payableCents === 0, "payable max(0, openNet)");
  console.log("ok — refund after payout yields negative open net");

  // Discrepancy with ack on a fresh partner with payable balance
  const partner2 = (
    await createPartner(
      {
        name: `Disc Partner ${stamp}`,
        email: `disc-${stamp}@example.test`,
        brandName: `Disc Brand ${stamp}`,
        referralCode: `disc-${stamp}`,
        commissionRatePct: 20,
        sendInvite: false,
      },
      actor
    )
  ).partner;
  const earned2 = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const pay2At = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const { data: biz2 } = await raw
    .from("businesses")
    .insert({
      name: `Disc Biz ${stamp}`,
      slug: `disc-biz-${stamp}`,
      plan: "studio",
      status: "active",
      created_via: "platform",
      subscription_status: "active",
    })
    .select("id")
    .single();
  assert(biz2?.id, "biz2");
  await raw.from("partner_referrals").insert({
    partner_id: partner2.id,
    business_id: biz2.id,
    referral_code_used: partner2.referral_code,
    source: "manual",
  });
  const { data: pay2 } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz2.id,
      stripe_invoice_id: `in_test_disc_${stamp}`,
      amount_paid_cents: 5000,
      currency: "usd",
      paid_at: earned2,
      stripe_mode: "test",
    })
    .select("id")
    .single();
  assert(pay2?.id, "pay2");
  await raw.from("partner_commissions").insert({
    partner_id: partner2.id,
    business_id: biz2.id,
    subscription_payment_id: pay2.id,
    kind: "commission",
    commission_rate_pct: 20,
    source_amount_cents: 5000,
    amount_cents: 1000,
    currency: "usd",
    stripe_mode: "test",
    payable_at: pay2At,
    earned_at: earned2,
  });

  const disc = await recordPartnerPayout({
    partnerId: partner2.id,
    amountCents: 800,
    method: "ACH",
    note: "operator chose lower amount",
    idempotencyKey: `disc-ack-${stamp}`,
    discrepancyAck: PARTNER_PAYOUT_DISCREPANCY_ACK,
    actor,
  });
  assert(disc.amountCents === 800, "discrepancy payout amount");
  const { data: discRows } = await raw
    .from("partner_commissions")
    .select("amount_cents, note, kind, payout_id")
    .eq("payout_id", disc.payoutId);
  const discSum = (discRows ?? []).reduce((s, r) => s + (r.amount_cents as number), 0);
  assert(discSum === 800, `discrepancy stamped sum ${discSum}`);
  assert(
    (discRows ?? []).some((r) => r.kind === "adjustment" && /DISCREPANCY/i.test(String(r.note))),
    "discrepancy note on bridging adjustment"
  );
  console.log("ok — discrepancy ack bridges with adjustment and reconciles");

  // Cleanup test partners' ledger (leave businesses for teardown scripts if needed)
  await raw.from("partner_commissions").delete().eq("partner_id", partner.id);
  await raw.from("partner_commissions").delete().eq("partner_id", partner2.id);
  await raw.from("partner_payouts").delete().eq("partner_id", partner.id);
  await raw.from("partner_payouts").delete().eq("partner_id", partner2.id);
  await raw.from("partner_referrals").delete().eq("partner_id", partner.id);
  await raw.from("partner_referrals").delete().eq("partner_id", partner2.id);
  await raw.from("platform_subscription_payments").delete().eq("id", payment.id);
  await raw.from("platform_subscription_payments").delete().eq("id", pay2.id);
  await raw.from("businesses").delete().eq("id", biz.id);
  await raw.from("businesses").delete().eq("id", biz2.id);
  await raw.from("partners").delete().eq("id", partner.id);
  await raw.from("partners").delete().eq("id", partner2.id);

  console.log("\nPhase 5 payout smoke verification passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
