/**
 * Verify live pitch numbers track platform settings (no deploy needed).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnvLocal() {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2].trim();
    if (
      (v.startsWith('"') && v.endsWith('"')) ||
      (v.startsWith("'") && v.endsWith("'"))
    ) {
      v = v.slice(1, -1);
    }
    process.env[m[1]] ??= v;
  }
}

async function loadPitchNumbers() {
  const { loadPartnerProgramMarketingData } = await import("../src/lib/partner-program-marketing");
  const data = await loadPartnerProgramMarketingData();
  return {
    commissionRatePct: data.commissionRatePct,
    referralDiscount: data.referralDiscount,
  };
}

async function main() {
  loadEnvLocal();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const before = await loadPitchNumbers();
  console.log("BEFORE:", before);

  await sb
    .from("partner_program_settings")
    .update({ referral_discount_amount_cents: 600 })
    .eq("id", 1);

  const afterDiscount = await loadPitchNumbers();
  console.log("AFTER referral discount → $6:", afterDiscount);

  await sb
    .from("partner_program_settings")
    .update({ referral_discount_amount_cents: 500 })
    .eq("id", 1);

  const restoredDiscount = await loadPitchNumbers();
  console.log("RESTORED referral discount:", restoredDiscount);

  const { data: rateNow } = await sb.rpc("partner_program_default_commission_rate_pct");
  console.log("\nCommission rate via RPC (partners.commission_rate_pct DEFAULT):", rateNow);
  console.log(
    "Change that DEFAULT in /platform (or ALTER TABLE) and reload /partner — pitch uses the same loader as /partners."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
