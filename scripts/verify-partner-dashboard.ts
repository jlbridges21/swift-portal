/**
 * Seed partner dashboard fixtures and assert headline numbers match computePartnerBalance.
 * Usage: npx tsx scripts/verify-partner-dashboard.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { createPartner, updatePartner } from "../src/lib/partners";
import {
  maybeCreateCommissionForPayment,
  maybeReverseCommissionForRefund,
  computePartnerBalance,
} from "../src/lib/partner-commissions";
import { loadPartnerDashboardSummary } from "../src/lib/partner-dashboard";
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
  assert(getStripeMode() === "test", "test mode only");
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
  const { partner } = await createPartner(
    {
      name: `Dash Partner ${stamp}`,
      email: `dash-${stamp}@example.test`,
      brandName: `Dash Brand ${stamp}`,
      referralCode: `dash-${stamp}`,
      commissionRatePct: 30,
      sendInvite: false,
    },
    { id: sa.id, email: sa.email }
  );

  const bizIds: string[] = [];
  const paymentInvoices: string[] = [];

  for (let i = 0; i < 2; i++) {
    const { data: biz } = await raw
      .from("businesses")
      .insert({
        name: `Dash Biz ${i} ${stamp}`,
        slug: `dash-biz-${i}-${stamp}`,
        plan: "studio",
        status: "active",
        created_via: "platform",
        subscription_status: i === 0 ? "active" : "trialing",
      })
      .select("id")
      .single();
    assert(biz, "biz");
    bizIds.push(biz.id);
    await raw.from("partner_referrals").insert({
      partner_id: partner.id,
      business_id: biz.id,
      referral_code_used: partner.referral_code,
      source: "manual",
    });
    await raw.from("businesses").update({ referred_by_partner_id: partner.id }).eq("id", biz.id);

    const inv = `in_dash_${i}_${stamp}`;
    paymentInvoices.push(inv);
    const paidAt = new Date().toISOString();
    const { data: pay } = await raw
      .from("platform_subscription_payments")
      .insert({
        business_id: biz.id,
        stripe_invoice_id: inv,
        amount_paid_cents: 10000,
        currency: "usd",
        paid_at: paidAt,
        stripe_mode: "test",
      })
      .select("id")
      .single();
    assert(pay, "pay");
    await maybeCreateCommissionForPayment({
      paymentId: pay.id,
      businessId: biz.id,
      amountPaidCents: 10000,
      currency: "usd",
      stripeMode: "test",
      paidAt,
    });
  }

  // Mid-history rate change + new payment on biz 0
  await updatePartner(partner.id, { commissionRatePct: 40 }, { id: sa.id, email: sa.email });
  const invNew = `in_dash_new_${stamp}`;
  paymentInvoices.push(invNew);
  const { data: payNew } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: bizIds[0],
      stripe_invoice_id: invNew,
      amount_paid_cents: 10000,
      currency: "usd",
      paid_at: new Date().toISOString(),
      stripe_mode: "test",
    })
    .select("id")
    .single();
  await maybeCreateCommissionForPayment({
    paymentId: payNew!.id,
    businessId: bizIds[0]!,
    amountPaidCents: 10000,
    currency: "usd",
    stripeMode: "test",
    paidAt: new Date().toISOString(),
  });

  // Refund on first invoice
  await maybeReverseCommissionForRefund({
    stripeInvoiceId: paymentInvoices[0]!,
    refundId: `re_dash_${stamp}`,
    refundAmountCents: 5000,
  });

  const refreshed = (await raw.from("partners").select("*").eq("id", partner.id).single()).data!;
  const balance = await computePartnerBalance(partner.id, "test");
  const summary = await loadPartnerDashboardSummary(refreshed as typeof partner);

  assert(summary.balance.lifetimeEarnedCents === balance.lifetimeEarnedCents, "earned mismatch");
  assert(summary.balance.pendingCents === balance.pendingCents, "pending mismatch");
  assert(summary.balance.payableCents === balance.payableCents, "payable mismatch");
  assert(summary.balance.paidCents === balance.paidCents, "paid mismatch");
  assert(summary.balance.reversedCents === balance.reversedCents, "reversed mismatch");
  assert(
    summary.balance.recurringMonthlyEstimateCents === balance.recurringMonthlyEstimateCents,
    "recurring mismatch"
  );
  assert(summary.totalReferredCustomers === 2, "referred count");
  assert(summary.activePayingReferrals === 1, "active paying");
  assert(summary.totalRevenueGeneratedCents === 30000, "revenue generated");
  assert(balance.lifetimeEarnedCents === 3000 + 3000 + 4000, `earned ${balance.lifetimeEarnedCents}`);
  assert(balance.reversedCents === 1500, `reversed ${balance.reversedCents}`);

  // Snapshot: first commissions still 30%
  const { data: rows } = await raw
    .from("partner_commissions")
    .select("commission_rate_pct, kind, amount_cents")
    .eq("partner_id", partner.id)
    .eq("kind", "commission")
    .order("earned_at", { ascending: true });
  assert(Number(rows?.[0]?.commission_rate_pct) === 30, "old rate");
  assert(Number(rows?.[2]?.commission_rate_pct) === 40, "new rate");

  console.log("ok dashboard summary matches computePartnerBalance exactly");
  console.log("ok headlines", {
    referred: summary.totalReferredCustomers,
    revenue: summary.totalRevenueGeneratedCents,
    earned: summary.balance.lifetimeEarnedCents,
    pending: summary.balance.pendingCents,
    payable: summary.balance.payableCents,
    paid: summary.balance.paidCents,
    reversed: summary.balance.reversedCents,
    recurring: summary.balance.recurringMonthlyEstimateCents,
  });

  // Cleanup
  await raw.from("partner_commissions").delete().eq("partner_id", partner.id);
  for (const id of bizIds) {
    await raw.from("partner_referrals").delete().eq("business_id", id);
    await raw.from("platform_subscription_payments").delete().eq("business_id", id);
    await raw.from("businesses").update({ referred_by_partner_id: null }).eq("id", id);
    await raw.from("businesses").delete().eq("id", id);
  }
  await raw.from("partners").delete().eq("id", partner.id);
  console.log("ok cleanup");
  console.log("\nPartner dashboard verification passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
