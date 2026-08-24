/**
 * Phase 3 commission engine smoke tests (no live Stripe required).
 * Usage: npx tsx scripts/verify-partner-commissions-phase3.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  maybeCreateCommissionForPayment,
  maybeReverseCommissionForRefund,
  computePartnerBalance,
  PARTNER_COMMISSION_HOLD_DAYS,
} from "../src/lib/partner-commissions";
import { createPartner, updatePartner } from "../src/lib/partners";
import { getStripeMode } from "../src/lib/stripe";

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
  assert(mode === "test", "REFUSE: run phase3 verify only with sk_test_ (got " + mode + ")");

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

  const stamp = Date.now().toString(36);
  const partnerResult = await createPartner(
    {
      name: `Comm Partner ${stamp}`,
      email: `comm-${stamp}@example.test`,
      brandName: `Comm Brand ${stamp}`,
      referralCode: `comm-${stamp}`,
      commissionRatePct: 30,
      sendInvite: false,
    },
    { id: sa.id, email: sa.email }
  );
  const partner = partnerResult.partner;

  // Temporary business + referral + payment
  const { data: biz, error: bizErr } = await raw
    .from("businesses")
    .insert({
      name: `Comm Biz ${stamp}`,
      slug: `comm-biz-${stamp}`,
      plan: "studio",
      status: "active",
      created_via: "platform",
      subscription_status: "active",
    })
    .select("id")
    .single();
  assert(!bizErr && biz, bizErr?.message || "biz create failed");

  await raw.from("partner_referrals").insert({
    partner_id: partner.id,
    business_id: biz.id,
    referral_code_used: partner.referral_code,
    source: "manual",
  });
  await raw.from("businesses").update({ referred_by_partner_id: partner.id }).eq("id", biz.id);

  const paidAt = new Date().toISOString();
  const invoiceId = `in_test_comm_${stamp}`;
  const { data: payment, error: payErr } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: invoiceId,
      stripe_subscription_id: `sub_test_${stamp}`,
      amount_paid_cents: 10000,
      currency: "usd",
      paid_at: paidAt,
      stripe_mode: "test",
    })
    .select("id")
    .single();
  assert(!payErr && payment, payErr?.message || "payment insert failed");

  const created = await maybeCreateCommissionForPayment({
    paymentId: payment.id,
    businessId: biz.id,
    amountPaidCents: 10000,
    currency: "usd",
    stripeMode: "test",
    paidAt,
    stripeEventId: `evt_test_${stamp}`,
  });
  assert(created.created, `commission not created: ${created.reason}`);

  const { data: row } = await raw
    .from("partner_commissions")
    .select("*")
    .eq("id", created.commissionId!)
    .single();
  assert(row?.amount_cents === 3000, `expected 3000 got ${row?.amount_cents}`);
  assert(Number(row?.commission_rate_pct) === 30, "rate snapshot wrong");
  const payable = new Date(row!.payable_at as string).getTime();
  const earned = new Date(row!.earned_at as string).getTime();
  const holdMs = PARTNER_COMMISSION_HOLD_DAYS * 24 * 60 * 60 * 1000;
  assert(Math.abs(payable - earned - holdMs) < 2000, "payable_at not ~earned+30d");
  console.log("ok commission 30% of $100 = $30, payable_at +30d");

  // Idempotency: second create for same payment
  const again = await maybeCreateCommissionForPayment({
    paymentId: payment.id,
    businessId: biz.id,
    amountPaidCents: 10000,
    currency: "usd",
    stripeMode: "test",
    paidAt,
    stripeEventId: `evt_test_replay_${stamp}`,
  });
  assert(!again.created && again.reason === "already_commissioned", `replay: ${again.reason}`);
  const { count } = await raw
    .from("partner_commissions")
    .select("id", { count: "exact", head: true })
    .eq("subscription_payment_id", payment.id)
    .eq("kind", "commission");
  assert(count === 1, `expected 1 commission after replay, got ${count}`);
  console.log("ok invoice.paid replay → no second commission");

  // Rate change: new payment uses 40; old keeps 30
  await updatePartner(
    partner.id,
    { commissionRatePct: 40 },
    { id: sa.id, email: sa.email }
  );
  const invoice2 = `in_test_comm2_${stamp}`;
  const { data: payment2 } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: invoice2,
      amount_paid_cents: 10000,
      currency: "usd",
      paid_at: new Date().toISOString(),
      stripe_mode: "test",
    })
    .select("id")
    .single();
  const c2 = await maybeCreateCommissionForPayment({
    paymentId: payment2!.id,
    businessId: biz.id,
    amountPaidCents: 10000,
    currency: "usd",
    stripeMode: "test",
    paidAt: new Date().toISOString(),
  });
  assert(c2.created, c2.reason);
  const { data: row2 } = await raw
    .from("partner_commissions")
    .select("commission_rate_pct, amount_cents")
    .eq("id", c2.commissionId!)
    .single();
  assert(Number(row2?.commission_rate_pct) === 40 && row2?.amount_cents === 4000, "new rate not applied");
  const { data: still30 } = await raw
    .from("partner_commissions")
    .select("commission_rate_pct")
    .eq("id", created.commissionId!)
    .single();
  assert(Number(still30?.commission_rate_pct) === 30, "historical rate mutated");
  console.log("ok rate snapshot: old 30, new 40");

  // Partial refund 2500 → reverse 750 at original 30%
  const rev = await maybeReverseCommissionForRefund({
    stripeInvoiceId: invoiceId,
    refundId: `re_test_${stamp}`,
    refundAmountCents: 2500,
    stripeEventId: `evt_ref_${stamp}`,
  });
  assert(rev.created, rev.reason);
  const { data: revRow } = await raw
    .from("partner_commissions")
    .select("*")
    .eq("id", rev.reversalId!)
    .single();
  assert(revRow?.amount_cents === -750, `expected -750 got ${revRow?.amount_cents}`);
  assert(Number(revRow?.commission_rate_pct) === 30, "reversal used current rate");
  assert(revRow?.reverses_commission_id === created.commissionId, "missing parent link");
  console.log("ok partial refund → -750 at original 30%");

  const revReplay = await maybeReverseCommissionForRefund({
    stripeInvoiceId: invoiceId,
    refundId: `re_test_${stamp}`,
    refundAmountCents: 2500,
    stripeEventId: `evt_ref_replay_${stamp}`,
  });
  assert(!revReplay.created && revReplay.reason === "already_reversed", revReplay.reason);
  console.log("ok refund replay → no double reversal");

  // Suspended partner: no new commission
  await updatePartner(partner.id, { status: "suspended" }, { id: sa.id, email: sa.email });
  const { data: payment3 } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: `in_test_susp_${stamp}`,
      amount_paid_cents: 5000,
      currency: "usd",
      paid_at: new Date().toISOString(),
      stripe_mode: "test",
    })
    .select("id")
    .single();
  const susp = await maybeCreateCommissionForPayment({
    paymentId: payment3!.id,
    businessId: biz.id,
    amountPaidCents: 5000,
    currency: "usd",
    stripeMode: "test",
    paidAt: new Date().toISOString(),
  });
  assert(!susp.created && susp.reason === "partner_suspended", susp.reason);
  const { count: stillCount } = await raw
    .from("partner_commissions")
    .select("id", { count: "exact", head: true })
    .eq("partner_id", partner.id)
    .eq("kind", "commission");
  assert((stillCount ?? 0) === 2, "existing commissions changed on suspend");
  console.log("ok suspended partner earns nothing new; history intact");

  // Force-fail must not throw past try/catch pattern used in platform-revenue
  process.env.PARTNER_COMMISSION_FORCE_FAIL = "1";
  let threw = false;
  try {
    await maybeCreateCommissionForPayment({
      paymentId: payment3!.id,
      businessId: biz.id,
      amountPaidCents: 5000,
      currency: "usd",
      stripeMode: "test",
      paidAt: new Date().toISOString(),
    });
  } catch {
    threw = true;
  }
  delete process.env.PARTNER_COMMISSION_FORCE_FAIL;
  assert(threw, "force fail should throw inside commission helper");
  console.log("ok PARTNER_COMMISSION_FORCE_FAIL throws (caller must catch → Stripe 200)");

  const bal = await computePartnerBalance(partner.id, "test");
  assert(bal.lifetimeEarnedCents === 3000 + 4000, `earned ${bal.lifetimeEarnedCents}`);
  assert(bal.reversedCents === 750, `reversed ${bal.reversedCents}`);
  console.log("ok balance helper", bal);

  // Cleanup (delete commissions before payments/business)
  await raw.from("partner_commissions").delete().eq("partner_id", partner.id);
  await raw.from("partner_referrals").delete().eq("business_id", biz.id);
  await raw.from("platform_subscription_payments").delete().eq("business_id", biz.id);
  await raw.from("businesses").update({ referred_by_partner_id: null }).eq("id", biz.id);
  await raw.from("businesses").delete().eq("id", biz.id);
  await raw.from("partners").delete().eq("id", partner.id);
  console.log("ok cleanup");
  console.log("\nPhase 3 commission smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
