/**
 * Phase 6 landing slug validation + reserved path smoke.
 * Usage: npx tsx scripts/verify-partner-landing-phase6.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { validateLandingSlug } from "../src/lib/reserved-subdomains";
import { upsertPartnerLandingPage } from "../src/lib/partner-landing";
import { createPartner } from "../src/lib/partners";
import { getStripeMode } from "../src/lib/stripe";
import {
  buildPartnerRefCookieValue,
  verifyPartnerRefCookie,
} from "../src/lib/partner-referral";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

async function main() {
  const mode = getStripeMode();
  assert(mode === "test", "REFUSE: phase6 verify requires sk_test_");

  for (const bad of ["pricing", "signup", "partners", "admin"]) {
    const r = validateLandingSlug(bad);
    assert(!r.ok, `expected reject ${bad}`);
    console.log(`ok — reserved slug rejected: ${bad}`);
  }

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
  const p1 = (
    await createPartner(
      {
        name: `Land A ${stamp}`,
        email: `landa-${stamp}@example.test`,
        brandName: `Land A ${stamp}`,
        referralCode: `landa-${stamp}`,
        commissionRatePct: 30,
        sendInvite: false,
      },
      actor
    )
  ).partner;
  const p2 = (
    await createPartner(
      {
        name: `Land B ${stamp}`,
        email: `landb-${stamp}@example.test`,
        brandName: `Land B ${stamp}`,
        referralCode: `landb-${stamp}`,
        commissionRatePct: 30,
        sendInvite: false,
      },
      actor
    )
  ).partner;

  const slug = `land-${stamp}`;
  await upsertPartnerLandingPage(
    p1.id,
    {
      slug,
      headline: "Try ShootPortal",
      description: "Plain text only",
      isActive: true,
    },
    actor
  );
  console.log("ok — created landing", slug);

  try {
    await upsertPartnerLandingPage(
      p2.id,
      { slug, headline: "Dup", description: "x", isActive: true },
      actor
    );
    throw new Error("duplicate slug should fail");
  } catch (err) {
    assert(err instanceof Error && /already in use/i.test(err.message), String(err));
    console.log("ok — duplicate slug rejected");
  }

  for (const bad of ["pricing", "signup", "partners", "admin"]) {
    try {
      await upsertPartnerLandingPage(
        p1.id,
        { slug: bad, headline: "Nope", description: "x", isActive: true },
        actor
      );
      throw new Error(`should reject ${bad}`);
    } catch (err) {
      assert(err instanceof Error && /reserved/i.test(err.message), String(err));
      console.log(`ok — upsert rejected reserved: ${bad}`);
    }
  }

  const cookie = await buildPartnerRefCookieValue(p1.referral_code, "landing_page");
  assert(cookie, "cookie");
  const claims = verifyPartnerRefCookie(cookie);
  assert(claims?.source === "landing_page", `source=${claims?.source}`);
  console.log("ok — cookie source landing_page");

  await raw.from("partner_landing_pages").delete().eq("partner_id", p1.id);
  await raw.from("partners").delete().eq("id", p1.id);
  await raw.from("partners").delete().eq("id", p2.id);

  console.log("\nPhase 6 landing verification passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
