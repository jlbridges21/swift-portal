/**
 * One-time setup: dedicated partner payout verification partner (683726a2-…).
 * Activates partner, links Stripe Express (Account Link onboarding — manual in browser),
 * seeds payable balance. No Custom-account fallback.
 *
 * Usage: npx tsx scripts/setup-partner-payout-verification-partner.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  applyPartnerStripeAccountSnapshot,
  createPartnerConnectAccountLink,
  createPartnerExpressAccount,
  retrievePartnerExpressAccount,
} from "../src/lib/partner-stripe-connect";
import { computePartnerBalance } from "../src/lib/partner-commissions";
import { getStripe, getStripeMode } from "../src/lib/stripe";

const VERIFICATION_PARTNER_ID = "683726a2-56e6-4376-93ef-ef06adf0d0c7";
const FIXTURE_NOTE_PREFIX = "phase2-payout-verify";

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

async function findExistingExpressAccountForPartner(partnerId: string): Promise<string | null> {
  const { stripe } = getStripe();
  let startingAfter: string | undefined;
  for (let page = 0; page < 5; page++) {
    const listed = await stripe.accounts.list({ limit: 100, starting_after: startingAfter });
    const hit = listed.data.find(
      (a) =>
        a.type === "express" &&
        a.metadata?.shootportal_partner_id === partnerId &&
        a.metadata?.shootportal_flow === "partner_payouts"
    );
    if (hit) return hit.id;
    if (!listed.has_more) break;
    startingAfter = listed.data.at(-1)?.id;
  }
  return null;
}

async function ensureExpressVerificationAccount(partner: {
  id: string;
  email: string;
  name: string;
  brand_name: string | null;
  referral_code: string;
  commission_rate_pct: number;
  status: string;
  stripe_connect_account_id: string | null;
}): Promise<{ accountId: string; accountLinkUrl: string | null; ready: boolean }> {
  let accountId = partner.stripe_connect_account_id;

  if (accountId) {
    const existing = await retrievePartnerExpressAccount(accountId);
    if (existing.type !== "express") {
      console.warn(
        `Partner linked to ${existing.type} account ${accountId} — switching to Express account for verification.`
      );
      accountId = (await findExistingExpressAccountForPartner(partner.id)) ?? null;
    }
  }

  if (!accountId) {
    accountId = await findExistingExpressAccountForPartner(partner.id);
    if (accountId) {
      console.log("Reusing existing Express account:", accountId);
    }
  }

  if (!accountId) {
    const created = await createPartnerExpressAccount({
      id: partner.id,
      email: partner.email,
      name: partner.name,
      brand_name: partner.brand_name,
      referral_code: partner.referral_code,
      commission_rate_pct: Number(partner.commission_rate_pct),
      status: "active",
    });
    accountId = created.id;
    console.log("Created Express account:", accountId);
  }

  const account = await retrievePartnerExpressAccount(accountId);
  const ready =
    account.type === "express" &&
    account.capabilities?.transfers === "active" &&
    account.payouts_enabled;

  let accountLinkUrl: string | null = null;
  if (!ready) {
    accountLinkUrl = await createPartnerConnectAccountLink(accountId, "http://localhost:3000");
  }

  return { accountId, accountLinkUrl, ready };
}

async function main() {
  const mode = getStripeMode();
  if (mode !== "test") {
    throw new Error("REFUSE: verification partner setup requires sk_test_ deploy mode.");
  }

  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: partner, error } = await raw
    .from("partners")
    .select("*")
    .eq("id", VERIFICATION_PARTNER_ID)
    .single();
  if (error || !partner) throw new Error("Verification partner not found.");

  console.log("Partner before:", {
    id: partner.id,
    email: partner.email,
    status: partner.status,
    stripe_connect_account_id: partner.stripe_connect_account_id,
  });

  await raw
    .from("partners")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", VERIFICATION_PARTNER_ID);

  const { accountId, accountLinkUrl, ready } = await ensureExpressVerificationAccount(partner);

  await raw
    .from("partners")
    .update({
      stripe_connect_account_id: accountId,
      stripe_connect_mode: "test",
      stripe_connect_updated_at: new Date().toISOString(),
    })
    .eq("id", VERIFICATION_PARTNER_ID);

  const refreshed = await retrievePartnerExpressAccount(accountId);
  await applyPartnerStripeAccountSnapshot(VERIFICATION_PARTNER_ID, refreshed);

  console.log("Stripe Express account:", {
    id: refreshed.id,
    type: refreshed.type,
    payouts_enabled: refreshed.payouts_enabled,
    transfers: refreshed.capabilities?.transfers,
    requirements_due: refreshed.requirements?.currently_due,
    ready,
  });

  if (!ready) {
    console.log("\nComplete Express onboarding in the browser (test mode):");
    console.log(accountLinkUrl);
    console.log(
      "\nAfter onboarding: transfers capability active + payouts_enabled true, then re-run this script to seed balance."
    );
    process.exitCode = 1;
    return;
  }

  // Clean prior verification fixtures on THIS partner only
  await raw
    .from("partner_commissions")
    .delete()
    .eq("partner_id", VERIFICATION_PARTNER_ID)
    .like("note", `${FIXTURE_NOTE_PREFIX}%`);
  await raw
    .from("partner_payouts")
    .delete()
    .eq("partner_id", VERIFICATION_PARTNER_ID)
    .like("note", `${FIXTURE_NOTE_PREFIX}%`);

  const stamp = `${FIXTURE_NOTE_PREFIX}-${Date.now().toString(36)}`;
  const earnedAt = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  const payableAt = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const { data: biz } = await raw
    .from("businesses")
    .insert({
      name: `Payout Verify Biz ${stamp}`,
      slug: `payout-verify-${stamp}`,
      plan: "studio",
      status: "active",
      created_via: "platform",
      subscription_status: "active",
    })
    .select("id")
    .single();

  if (!biz?.id) throw new Error("Failed to create verification business.");

  await raw.from("partner_referrals").upsert(
    {
      partner_id: VERIFICATION_PARTNER_ID,
      business_id: biz.id,
      referral_code_used: partner.referral_code,
      source: "manual",
    },
    { onConflict: "business_id" }
  );

  const { data: payment } = await raw
    .from("platform_subscription_payments")
    .insert({
      business_id: biz.id,
      stripe_invoice_id: `in_${stamp}`,
      amount_paid_cents: 24000,
      currency: "usd",
      paid_at: earnedAt,
      stripe_mode: "test",
    })
    .select("id")
    .single();

  if (!payment?.id) throw new Error("Failed to create verification payment.");

  await raw.from("partner_commissions").insert({
    partner_id: VERIFICATION_PARTNER_ID,
    business_id: biz.id,
    subscription_payment_id: payment.id,
    kind: "commission",
    commission_rate_pct: 25,
    source_amount_cents: 24000,
    amount_cents: 6000,
    currency: "usd",
    stripe_mode: "test",
    payable_at: payableAt,
    earned_at: earnedAt,
    note: `${FIXTURE_NOTE_PREFIX} synthetic payable balance`,
  });

  const balance = await computePartnerBalance(VERIFICATION_PARTNER_ID, "test");
  const { data: row } = await raw
    .from("partners")
    .select(
      "id, email, status, stripe_connect_account_id, stripe_connect_payouts_enabled, stripe_connect_requirements_due, stripe_connect_account_status, stripe_connect_mode"
    )
    .eq("id", VERIFICATION_PARTNER_ID)
    .single();

  console.log("\nSetup complete:", {
    partner: row,
    balance,
    businessId: biz.id,
    paymentId: payment.id,
    stripeAccountId: accountId,
    accountType: refreshed.type,
    transfersActive: refreshed.capabilities?.transfers === "active",
    payoutsEnabled: refreshed.payouts_enabled,
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
