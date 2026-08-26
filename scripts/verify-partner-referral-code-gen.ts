/**
 * Verify referral code generation from brand names (auto-approval path).
 * Usage: npx tsx scripts/verify-partner-referral-code-gen.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  suggestReferralCodeFromBrand,
  slugifyReferralCodeBase,
  validateReferralCode,
  isBlockedReferralCodeLabel,
  isReservedAppRouteSlug,
} from "../src/lib/reserved-subdomains";
import {
  allocateUniqueReferralCodeFromBrand,
  assertUniqueReferralCode,
} from "../src/lib/partners";

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
  const cases: Array<{ label: string; brand: string }> = [
    { label: "normal name", brand: "Drone Ops LLC" },
    { label: "accents", brand: "Café Médias" },
    { label: "punctuation", brand: "A&B Photo!!!" },
    { label: "200-char name", brand: "X".repeat(200) },
    { label: "empty/whitespace", brand: "   " },
    { label: "reserved route slug", brand: "Pricing" },
    { label: "blocked impersonation", brand: "Admin" },
  ];

  console.log("=== Suggest / slugify (no DB) ===");
  for (const c of cases) {
    const slug = slugifyReferralCodeBase(c.brand);
    const suggested = suggestReferralCodeFromBrand(c.brand);
    const validated = validateReferralCode(suggested);
    console.log(
      `${c.label}: brand=${JSON.stringify(c.brand.slice(0, 40))}${c.brand.length > 40 ? "…" : ""} → slug=${slug} suggest=${suggested} valid=${validated.ok} reservedRoute=${isReservedAppRouteSlug(suggested)} blocked=${isBlockedReferralCodeLabel(suggested)}`
    );
  }

  console.log("\n=== Allocate with collision (DB) ===");
  const stamp = Date.now().toString(36);
  const brand = `Collision Brand ${stamp}`;
  const first = await allocateUniqueReferralCodeFromBrand(brand);
  // Insert a partner row? allocateUnique checks partners table — seed a fake collision by
  // asserting the first code is taken via a second allocate that must get -2.
  // Pre-occupy first by inserting a temporary partner.
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const email = `code-gen-${stamp}@example.test`;
  const { data: partner, error } = await sb
    .from("partners")
    .insert({
      name: "Code Gen Probe",
      email,
      brand_name: brand,
      referral_code: first,
      commission_rate_pct: 30,
      status: "active",
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  const second = await allocateUniqueReferralCodeFromBrand(brand);
  console.log(`collision: first=${first} second=${second}`);

  // Confirm partner update uniqueness still works
  try {
    await assertUniqueReferralCode(first);
    console.log("FAIL: assertUniqueReferralCode should reject occupied code");
    process.exitCode = 1;
  } catch {
    console.log(`assertUniqueReferralCode rejects occupied code ${first} (ok)`);
  }

  await sb.from("partners").delete().eq("id", partner.id);
  console.log("\nReferral code gen verification complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
