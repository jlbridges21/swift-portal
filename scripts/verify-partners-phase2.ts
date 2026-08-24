/**
 * Verify Partner Program phase 2 — referral attribution.
 * Usage: npx tsx scripts/verify-partners-phase2.ts
 *
 * Requires migration-v59 applied and PLATFORM_SESSION_SECRET (or CRON_SECRET).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import {
  attributeBusinessToPartner,
  buildPartnerRefCookieValue,
  isSelfReferral,
  signPartnerRefCookie,
  verifyPartnerRefCookie,
  PARTNER_REF_TTL_SECONDS,
} from "../src/lib/partner-referral";
import { createPartner, updatePartner } from "../src/lib/partners";
import { createBusinessForPlatform, SYSTEM_SIGNUP_ACTOR } from "../src/lib/platform-onboard";

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
  process.env.SIGNUP_TEST_NO_EMAIL = "1";

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
  assert(sa?.id, "need a super_admin profile");

  const stamp = Date.now().toString(36);
  const partnerAResult = await createPartner(
    {
      name: `Verify Ref A ${stamp}`,
      email: `ref-a-${stamp}@example.test`,
      brandName: `Ref Brand A ${stamp}`,
      referralCode: `ref-a-${stamp}`,
      commissionRatePct: 30,
      sendInvite: false,
    },
    { id: sa.id, email: sa.email }
  );
  const partnerBResult = await createPartner(
    {
      name: `Verify Ref B ${stamp}`,
      email: `ref-b-${stamp}@example.test`,
      brandName: `Ref Brand B ${stamp}`,
      referralCode: `ref-b-${stamp}`,
      commissionRatePct: 25,
      sendInvite: false,
    },
    { id: sa.id, email: sa.email }
  );
  const partnerA = partnerAResult.partner;
  const partnerB = partnerBResult.partner;
  console.log("ok created partners", partnerA.referral_code, partnerB.referral_code);

  // Cookie crypto: valid sign/verify, tampered rejected
  const now = Math.floor(Date.now() / 1000);
  const signed = signPartnerRefCookie({
    code: partnerA.referral_code,
    ts: now,
    exp: now + PARTNER_REF_TTL_SECONDS,
  });
  assert(signed, "signPartnerRefCookie returned null — set PLATFORM_SESSION_SECRET");
  assert(verifyPartnerRefCookie(signed)?.code === partnerA.referral_code, "verify failed");
  assert(verifyPartnerRefCookie(signed.slice(0, -4) + "dead") === null, "tampered cookie accepted");
  assert(verifyPartnerRefCookie("not-a-cookie") === null, "garbage cookie accepted");
  console.log("ok cookie sign/verify + tamper reject");

  // Unknown / suspended → no cookie value
  assert((await buildPartnerRefCookieValue("totally-unknown-code-xyz")) === null, "unknown code set cookie");
  assert((await buildPartnerRefCookieValue("!!!bad!!!")) === null, "malformed set cookie");
  await updatePartner(
    partnerB.id,
    { status: "suspended" },
    { id: sa.id, email: sa.email }
  );
  assert((await buildPartnerRefCookieValue(partnerB.referral_code)) === null, "suspended set cookie");
  await updatePartner(
    partnerB.id,
    { status: "active" },
    { id: sa.id, email: sa.email }
  );
  assert(await buildPartnerRefCookieValue(partnerB.referral_code), "active partner should set cookie");
  console.log("ok unknown/suspended/malformed → no cookie");

  // Self-referral helper
  assert(
    isSelfReferral({
      partner: {
        id: partnerA.id,
        email: partnerA.email,
        user_id: partnerA.user_id,
        referral_code: partnerA.referral_code,
        status: partnerA.status,
      },
      signupEmail: partnerA.email,
    }),
    "self-referral email not detected"
  );
  console.log("ok self-referral detection");

  // Attribution via RPC — signup-shaped business
  const slug = `ref-biz-${stamp}`;
  const email = `ref-signup-${stamp}@example.test`;
  const created = await createBusinessForPlatform(
    {
      name: `Ref Biz ${stamp}`,
      slug,
      adminEmail: email,
      adminName: "Ref Admin",
      source: "signup",
      password: "test-password-ok",
    },
    SYSTEM_SIGNUP_ACTOR
  );
  assert(created.businessId, "business not created");

  // No cookie in Node createBusinessForPlatform path → no attribution yet
  const { data: before } = await raw
    .from("businesses")
    .select("referred_by_partner_id")
    .eq("id", created.businessId)
    .single();
  assert(before?.referred_by_partner_id == null, "unexpected attribution without cookie");

  const wrote = await attributeBusinessToPartner({
    businessId: created.businessId,
    partnerId: partnerA.id,
    referralCodeUsed: partnerA.referral_code,
    source: "link",
  });
  assert(wrote, "attributeBusinessToPartner failed");

  const { data: after } = await raw
    .from("businesses")
    .select("referred_by_partner_id")
    .eq("id", created.businessId)
    .single();
  assert(after?.referred_by_partner_id === partnerA.id, "referred_by_partner_id not set");

  const { data: refRow } = await raw
    .from("partner_referrals")
    .select("*")
    .eq("business_id", created.businessId)
    .maybeSingle();
  assert(refRow?.partner_id === partnerA.id, "partner_referrals missing");
  assert(refRow?.referral_code_used === partnerA.referral_code, "code snapshot wrong");
  assert(refRow?.source === "link", "source wrong");
  console.log("ok attribution write (partner_referrals + referred_by_partner_id)");

  // Re-attribute must fail closed (UNIQUE / already set)
  const wrote2 = await attributeBusinessToPartner({
    businessId: created.businessId,
    partnerId: partnerB.id,
    referralCodeUsed: partnerB.referral_code,
    source: "link",
  });
  assert(!wrote2, "re-attribution should return false");
  const { data: still } = await raw
    .from("businesses")
    .select("referred_by_partner_id")
    .eq("id", created.businessId)
    .single();
  assert(still?.referred_by_partner_id === partnerA.id, "partner stolen on re-attribute");
  console.log("ok re-attribution blocked");

  // Manual attribution on platform create
  const manualSlug = `ref-manual-${stamp}`;
  const manual = await createBusinessForPlatform(
    {
      name: `Manual Ref ${stamp}`,
      slug: manualSlug,
      adminEmail: `manual-${stamp}@example.test`,
      source: "platform",
      referredByPartnerId: partnerB.id,
    },
    { id: sa.id, email: sa.email }
  );
  const { data: manualBiz } = await raw
    .from("businesses")
    .select("referred_by_partner_id")
    .eq("id", manual.businessId)
    .single();
  assert(manualBiz?.referred_by_partner_id === partnerB.id, "manual attribution missing");
  const { data: manualRef } = await raw
    .from("partner_referrals")
    .select("source")
    .eq("business_id", manual.businessId)
    .maybeSingle();
  assert(manualRef?.source === "manual", "manual source wrong");
  console.log("ok manual platform attribution");

  // Attribution failure must not block business create (platform path with partner id)
  process.env.PARTNER_ATTRIBUTION_FORCE_FAIL = "1";
  const failSlug = `ref-fail-${stamp}`;
  const failBiz = await createBusinessForPlatform(
    {
      name: `Fail Attr ${stamp}`,
      slug: failSlug,
      adminEmail: `fail-attr-${stamp}@example.test`,
      adminName: "Fail",
      source: "platform",
      referredByPartnerId: partnerA.id,
    },
    { id: sa.id, email: sa.email }
  );
  assert(failBiz.businessId, "create blocked when attribution forced to fail");
  delete process.env.PARTNER_ATTRIBUTION_FORCE_FAIL;
  const { data: failAttr } = await raw
    .from("businesses")
    .select("referred_by_partner_id")
    .eq("id", failBiz.businessId)
    .single();
  assert(failAttr?.referred_by_partner_id == null, "forced-fail still wrote attribution");
  console.log("ok attribution force-fail still allows create (no attribution written)");

  // Existing protected tenants: no attribution
  for (const slugCheck of ["swift-aerial-media", "test-pilot-drones", "acton"]) {
    const { data: b } = await raw
      .from("businesses")
      .select("id, slug, referred_by_partner_id")
      .eq("slug", slugCheck)
      .maybeSingle();
    if (!b) {
      console.log(`skip existing tenant check: ${slugCheck} not found`);
      continue;
    }
    assert(b.referred_by_partner_id == null, `${slugCheck} has unexpected attribution`);
    const { count } = await raw
      .from("partner_referrals")
      .select("id", { count: "exact", head: true })
      .eq("business_id", b.id);
    assert((count ?? 0) === 0, `${slugCheck} has partner_referrals row`);
    console.log(`ok ${slugCheck} unaffected`);
  }

  // Cleanup verify businesses + partners (partner delete blocked if referrals remain)
  for (const id of [created.businessId, manual.businessId, failBiz.businessId]) {
    await raw.from("partner_referrals").delete().eq("business_id", id);
    await raw.from("businesses").update({ referred_by_partner_id: null }).eq("id", id);
    // Soft cleanup: leave businesses if hard delete is protected — try delete dependents via onboard patterns
    await raw.from("business_services").delete().eq("business_id", id);
    await raw.from("business_integrations").delete().eq("business_id", id);
    await raw.from("business_settings").delete().eq("business_id", id);
    const { data: profiles } = await raw.from("profiles").select("id").eq("business_id", id);
    for (const p of profiles ?? []) {
      await raw.from("profiles").update({ business_id: null }).eq("id", p.id);
      await raw.auth.admin.deleteUser(p.id);
    }
    await raw.from("businesses").delete().eq("id", id);
  }
  await raw.from("partners").delete().eq("id", partnerA.id);
  await raw.from("partners").delete().eq("id", partnerB.id);
  console.log("ok cleanup");

  console.log("\nPhase 2 verification passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
