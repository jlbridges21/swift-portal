/**
 * Self-referral: attribution allowed (discount path), commission ledger blocked.
 * Usage: npx tsx scripts/verify-partner-self-referral-commission.ts
 */
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { attributeBusinessToPartner } from "../src/lib/partner-referral";
import { maybeCreateCommissionForPayment } from "../src/lib/partner-commissions";
import { getStripeMode } from "../src/lib/stripe";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

async function main() {
  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const stamp = Date.now().toString(36);
  const email = `selfref-${stamp}@example.test`;
  const pw = `SelfRef-${randomBytes(4).toString("hex")}!aA1`;
  const mode = getStripeMode();

  const { data: auth, error: createErr } = await raw.auth.admin.createUser({
    email,
    password: pw,
    email_confirm: true,
  });
  if (createErr || !auth.user) throw new Error(createErr?.message || "create user");

  // Create a disposable business owned by this user
  const { data: biz, error: bizErr } = await raw
    .from("businesses")
    .insert({
      name: `SelfRef Biz ${stamp}`,
      slug: `selfref-${stamp}`,
      status: "active",
      subscription_status: "active",
      plan: "studio",
    })
    .select("id")
    .single();
  if (bizErr || !biz) throw new Error(bizErr?.message || "biz");

  await raw.from("profiles").upsert({
    id: auth.user.id,
    email,
    role: "admin",
    business_id: biz.id,
  });

  const { data: partner, error: pErr } = await raw
    .from("partners")
    .insert({
      name: "Self Ref Partner",
      email,
      brand_name: `Self Ref ${stamp}`,
      referral_code: `selfref-${stamp}`,
      commission_rate_pct: 30,
      status: "active",
      user_id: auth.user.id,
    })
    .select("*")
    .single();
  if (pErr || !partner) throw new Error(pErr?.message || "partner");

  const attributed = await attributeBusinessToPartner({
    businessId: biz.id,
    partnerId: partner.id,
    referralCodeUsed: partner.referral_code,
    source: "link",
  });
  console.log("attribution wrote (discount path):", attributed);

  const { data: payment, error: payErr } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: `in_selfref_${stamp}`,
      amount_paid_cents: 4900,
      currency: "usd",
      stripe_mode: mode,
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (payErr || !payment) throw new Error(payErr?.message || "payment");

  const result = await maybeCreateCommissionForPayment({
    paymentId: payment.id,
    businessId: biz.id,
    amountPaidCents: 4900,
    currency: "usd",
    stripeMode: mode,
    paidAt: new Date().toISOString(),
  });
  console.log("commission create result:", result);

  const { data: ledger, count } = await raw
    .from("partner_commissions")
    .select("id, kind, amount_cents, partner_id, business_id", { count: "exact" })
    .eq("partner_id", partner.id)
    .eq("business_id", biz.id);
  console.log("ledger rows for self-referral:", count, JSON.stringify(ledger));

  // Suspend: no new commission on subsequent payments
  await raw.from("partners").update({ status: "suspended" }).eq("id", partner.id);
  const { data: payment2 } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: `in_susp_${stamp}`,
      amount_paid_cents: 4900,
      currency: "usd",
      stripe_mode: mode,
      paid_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  const susp = await maybeCreateCommissionForPayment({
    paymentId: payment2!.id,
    businessId: biz.id,
    amountPaidCents: 4900,
    currency: "usd",
    stripeMode: mode,
    paidAt: new Date().toISOString(),
  });
  console.log("suspended partner commission:", susp);

  // Cleanup
  await raw.from("partner_commissions").delete().eq("partner_id", partner.id);
  await raw.from("partner_referrals").delete().eq("partner_id", partner.id);
  await raw.from("platform_subscription_payments").delete().eq("id", payment.id);
  if (payment2) await raw.from("platform_subscription_payments").delete().eq("id", payment2.id);
  await raw.from("partners").delete().eq("id", partner.id);
  await raw.from("profiles").delete().eq("id", auth.user.id);
  await raw.from("businesses").delete().eq("id", biz.id);
  await raw.auth.admin.deleteUser(auth.user.id);

  if (result.created || count !== 0) {
    console.error("FAIL: expected zero commissions for self-referral");
    process.exit(1);
  }
  if (!String(result.reason || "").startsWith("self_referral_blocked")) {
    console.error("FAIL: expected self_referral_blocked", result);
    process.exit(1);
  }
  if (susp.reason !== "partner_suspended") {
    console.error("FAIL: expected partner_suspended", susp);
    process.exit(1);
  }
  console.log("\nSelf-referral + suspend verification complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
