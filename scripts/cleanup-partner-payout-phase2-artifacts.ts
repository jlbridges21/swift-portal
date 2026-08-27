/**
 * Clean Phase 2 payout verification artifacts (test data only).
 * Usage: npx tsx scripts/cleanup-partner-payout-phase2-artifacts.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { getStripe } from "../src/lib/stripe";

const VERIFY_PARTNER_ID = "683726a2-56e6-4376-93ef-ef06adf0d0c7";
const LIVE_PARTNER_IDS = [
  "140ccbea-1c16-4b76-9412-a95ad4f5311c",
  "b638b018-0124-48b7-afa0-456fcca301e9",
];
const EPHEMERAL_PARTNER_IDS = [
  "4702b467-25d0-4cc1-a8cb-c0807df35ae5",
  "71ccdb3e-1998-426f-83a4-ab75782e44ec",
  "ecd884ec-c1b2-4bda-9d42-443e640c1934",
  "6b28b40c-d9c4-4fc7-8569-6cfcbeb0b2b4",
];
const EPHEMERAL_STRIPE_ACCOUNTS = [
  "acct_1U8sRpCxGHQuxMrk",
  "acct_1U8sRtEOZojKJ5Pf",
  "acct_1U8sRwCYx3G4jQbG",
  "acct_1U8sSCChfhiaNR1R",
];
const EXPLICIT_TEST_BUSINESS_IDS = [
  "cf5aabdd-7ba2-4153-99da-e3eb307d8ab7",
  "46659bca-e3a0-4965-922e-c5e99cd70571",
];
const FIXTURE_NOTE_PREFIX = "phase2-payout-verify";

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
  const { stripe } = getStripe();

  async function snapshot(label: string) {
    const live = await raw
      .from("partners")
      .select("id, email, stripe_connect_account_id, updated_at")
      .in("id", LIVE_PARTNER_IDS);
    const verify = await raw
      .from("partners")
      .select("id, email, stripe_connect_account_id, updated_at")
      .eq("id", VERIFY_PARTNER_ID)
      .single();
    const payouts = await raw
      .from("partner_payouts")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", VERIFY_PARTNER_ID);
    const comms = await raw
      .from("partner_commissions")
      .select("id", { count: "exact", head: true })
      .eq("partner_id", VERIFY_PARTNER_ID);
    const runs = await raw.from("partner_payout_runs").select("id", { count: "exact", head: true });
    const ephemeral = await raw
      .from("partners")
      .select("id")
      .in("id", EPHEMERAL_PARTNER_IDS);
    console.log(`\n=== ${label} ===`);
    console.log(JSON.stringify({ live: live.data, verify: verify.data, verifyPayouts: payouts.count, verifyComms: comms.count, payoutRuns: runs.count, ephemeralPartners: ephemeral.data?.length ?? 0 }, null, 2));
  }

  await snapshot("BEFORE");

  // Stripe ephemeral Connect accounts (DB rows may already be gone)
  for (const acctId of EPHEMERAL_STRIPE_ACCOUNTS) {
    try {
      await stripe.accounts.del(acctId);
      console.log("deleted Stripe account", acctId);
    } catch (err) {
      console.warn("Stripe delete skipped", acctId, err instanceof Error ? err.message : err);
    }
  }

  // Ephemeral partner rows if any remain
  for (const pid of EPHEMERAL_PARTNER_IDS) {
    await raw.from("partner_payout_run_items").delete().eq("partner_id", pid);
    await raw.from("partner_commissions").delete().eq("partner_id", pid);
    await raw.from("partner_payouts").delete().eq("partner_id", pid);
    await raw.from("partners").delete().eq("id", pid);
  }
  await raw.from("partners").delete().like("email", "auto-payout-%@example.test");

  // Verification partner synthetic ledger + payouts (keep partner + Express account)
  const { data: verifyPayouts } = await raw
    .from("partner_payouts")
    .select("id")
    .eq("partner_id", VERIFY_PARTNER_ID);
  for (const row of verifyPayouts ?? []) {
    await raw
      .from("partner_commissions")
      .update({ payout_id: null })
      .eq("partner_id", VERIFY_PARTNER_ID)
      .eq("payout_id", row.id);
  }
  await raw.from("partner_payouts").delete().eq("partner_id", VERIFY_PARTNER_ID);
  await raw
    .from("partner_commissions")
    .delete()
    .eq("partner_id", VERIFY_PARTNER_ID)
    .or(`note.like.${FIXTURE_NOTE_PREFIX}%,note.like.phase2-verify%`);
  await raw.from("partner_payout_run_items").delete().eq("partner_id", VERIFY_PARTNER_ID);
  await raw.from("partner_payout_runs").delete().gte("started_at", "2020-01-01");

  const bizIds = new Set<string>(EXPLICIT_TEST_BUSINESS_IDS);
  const { data: slugBiz } = await raw
    .from("businesses")
    .select("id")
    .or("slug.like.payout-verify-%,slug.like.auto-biz-%");
  for (const row of slugBiz ?? []) bizIds.add(row.id as string);
  for (const bizId of bizIds) {
    await raw.from("platform_subscription_payments").delete().eq("business_id", bizId);
    await raw.from("partner_referrals").delete().eq("business_id", bizId);
    await raw.from("partner_commissions").delete().eq("business_id", bizId);
    await raw.from("businesses").delete().eq("id", bizId);
  }

  await snapshot("AFTER");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
