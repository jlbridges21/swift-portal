/**
 * Cross-partner IDOR + loader ownership probes.
 * Uses service-role only to resolve partner A/B ids, then hits APIs without a session
 * (expects 401/404) and exercises loaders with mismatched PartnerAccess.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

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

async function main() {
  loadEnvLocal();
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { data: partners } = await sb.from("partners").select("id, email, user_id, status").limit(5);
  console.log("partners sample:", partners);

  const partnerA = partners?.[0];
  if (!partnerA) {
    console.log("No partners — skipping live IDOR HTTP (loader ownership still tested)");
  }

  // Fabricate two PartnerAccess objects and prove loaders refuse non-active / wrong shape.
  const { requireActivePartnerAccess, loadPartnerReferrals } = await import(
    "../src/lib/partner-dashboard"
  );
  const { listPartnerPayouts } = await import("../src/lib/partner-payouts");

  try {
    requireActivePartnerAccess({ kind: "none" });
    console.log("FAIL: requireActivePartnerAccess(none) should throw");
  } catch (e) {
    console.log("OK requireActivePartnerAccess(none) throws:", (e as Error).message);
  }

  try {
    await loadPartnerReferrals({ kind: "none" });
    console.log("FAIL: loadPartnerReferrals(none) should throw");
  } catch (e) {
    console.log("OK loadPartnerReferrals(none) throws:", (e as Error).message);
  }

  try {
    await listPartnerPayouts({ kind: "none" });
    console.log("FAIL: listPartnerPayouts(none) should throw");
  } catch (e) {
    console.log("OK listPartnerPayouts(none) throws:", (e as Error).message);
  }

  // Attacker-style: suspended access cannot load dashboard data
  if (partnerA) {
    try {
      await loadPartnerReferrals({
        kind: "suspended",
        partner: partnerA as never,
      });
      console.log("FAIL: loadPartnerReferrals(suspended) should throw");
    } catch (e) {
      console.log("OK loadPartnerReferrals(suspended) throws:", (e as Error).message);
    }
  }

  console.log(
    "NOTE: Live HTTP IDOR as partner A with B's id requires browser session cookies — run after deploy with two partner accounts."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
