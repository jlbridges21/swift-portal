/**
 * Partner referral management + commission exclusion (v108).
 *
 * Database: READ-ONLY. Stripe: TEST MODE ONLY (creates a throwaway customer/subscription on a
 * trial — never charged — and deletes them). Skips the Stripe section unless the key is sk_test_.
 *
 * Usage: npx tsx scripts/verify-partner-referral-management.ts
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

const LEGACY_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const SWIFT_PARTNER_ID = "140ccbea-1c16-4b76-9412-a95ad4f5311c";
const OWNER_TEST_PARTNER_ID = "683726a2-56e6-4376-93ef-ef06adf0d0c7";

let failures = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  if (!ok) failures += 1;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail)}` : ""}`);
}

function src(path: string): string {
  return readFileSync(path, "utf8");
}

async function main() {
  const {
    signAdminDemoCookie,
    verifyAdminDemoCookie,
    resolveAdminDemoAuthorization,
    ADMIN_DEMO_TTL_SECONDS,
  } = await import("../src/lib/admin-demo-signup");
  const { isPartnerCommissionEligible, maybeCreateCommissionForPayment } = await import(
    "../src/lib/partner-commissions"
  );
  const { signPartnerRefCookie, verifyPartnerRefCookie } = await import("../src/lib/partner-referral");

  console.log("\n— Demo signup bypass (tests 11, 16)");
  const uid = "11111111-2222-3333-4444-555555555555";
  const cookie = signAdminDemoCookie(uid);
  check("signed demo cookie verifies", verifyAdminDemoCookie(cookie)?.uid === uid);
  check(
    "tampered demo cookie rejected",
    verifyAdminDemoCookie(cookie!.replace(/.$/, (c) => (c === "a" ? "b" : "a"))) === null
  );
  const forged = `ad1.${Buffer.from(JSON.stringify({ purpose: "admin_demo", uid, exp: 9e9 })).toString("base64url")}.deadbeef`;
  check("forged (unsigned) demo cookie rejected", verifyAdminDemoCookie(forged) === null);
  check(
    "expired demo cookie rejected",
    verifyAdminDemoCookie(cookie, Date.now() + (ADMIN_DEMO_TTL_SECONDS + 60) * 1000) === null
  );
  const refCookie = signPartnerRefCookie({ code: "swift-aerial-media", ts: 1, exp: 9e9, source: "link" });
  check("partner ref cookie is not accepted as a demo cookie", verifyAdminDemoCookie(refCookie) === null);
  check("no cookie, no session ⇒ bypass refused", (await resolveAdminDemoAuthorization()).ok === false);

  const signupRoute = src("src/app/api/signup/route.ts");
  check(
    "/api/signup honors skipPartnerReferral only after server-side authorization",
    /skipPartnerReferral === true \? await resolveAdminDemoAuthorization\(\)/.test(signupRoute) &&
      /skipPartnerAttribution: demo\?\.ok \?/.test(signupRoute)
  );
  const finish = src("src/app/api/auth/finish-setup/route.ts");
  check(
    "Google finish-setup honors admin-demo only after server-side authorization",
    /resolveAdminDemoAuthorization\(\)/.test(finish) && /skipPartnerAttribution: demo\?\.ok \?/.test(finish)
  );
  const mw = src("src/lib/supabase/middleware.ts");
  check(
    "middleware lets only super_admin + source=admin-demo stay on /signup",
    /profile\?\.role === "super_admin" &&\s+path === "\/signup" &&\s+request\.nextUrl\.searchParams\.get\("source"\) === "admin-demo"/.test(
      mw
    )
  );
  check(
    "90-day referral cookie untouched (TTL + middleware set paths unchanged)",
    /PARTNER_REF_TTL_SECONDS = 90 \* 24 \* 60 \* 60/.test(src("src/lib/partner-referral.ts")) &&
      (mw.match(/PARTNER_REF_COOKIE/g)?.length ?? 0) >= 3
  );
  const now = Math.floor(Date.now() / 1000);
  const legit = signPartnerRefCookie({ code: "air4future", ts: now, exp: now + 90 * 86400, source: "link" });
  check("legit partner ref cookie still verifies (test 10, 13)", verifyPartnerRefCookie(legit)?.code === "air4future");

  console.log("\n— Commission eligibility (tests 3, 4)");
  check("missing column ⇒ eligible (pre-migration default)", isPartnerCommissionEligible({}) === true);
  check("commission_eligible=true ⇒ eligible", isPartnerCommissionEligible({ commission_eligible: true }));
  check("commission_eligible=false ⇒ ineligible", !isPartnerCommissionEligible({ commission_eligible: false }));
  check(
    "payout run skips ineligible partners before any Stripe transfer",
    /isPartnerCommissionEligible\(partner\)\) \{\s+return \{ \.\.\.base, eligible: false, skipReason: "commission_ineligible" \}/.test(
      src("src/lib/partner-payout-run.ts")
    )
  );
  check(
    "manual payout refuses ineligible partners",
    /isPartnerCommissionEligible\(partner\)/.test(src("src/lib/partner-payouts.ts"))
  );

  const mig = src("supabase/migration-v108-partner-referral-management.sql");
  check("migration: commission insert trigger guards eligibility + active referral (tests 7, 14)",
    /RAISE EXCEPTION 'partner_commission_ineligible'/.test(mig) &&
      /RAISE EXCEPTION 'partner_commission_no_active_referral'/.test(mig));
  check("migration: record_partner_payout refuses ineligible partners",
    /IF v_eligible = false THEN\s+RAISE EXCEPTION 'partner_commission_ineligible'/.test(mig));
  check("migration: removal is locked + idempotent (test 17)",
    /FOR UPDATE;/.test(mig) && /'already_removed'/.test(mig));
  check("migration: paid commissions never reversed (payout_id IS NULL only)",
    /AND kind = 'commission'\s+AND payout_id IS NULL/.test(mig));
  check("migration: attribute_partner_referral blocks re-attribution to the removed partner",
    /p_source <> 'manual' AND EXISTS \(\s+SELECT 1 FROM partner_referral_removals/.test(mig));
  check("migration: only the two owner partner ids are made ineligible",
    (mig.match(/'140ccbea-1c16-4b76-9412-a95ad4f5311c'/g)?.length ?? 0) === 2 &&
      (mig.match(/'683726a2-56e6-4376-93ef-ef06adf0d0c7'/g)?.length ?? 0) === 2);
  check("promo checkout refuses the removed partner's code only",
    /wasReferralRemovedByAdmin\(args\.businessId, partner\.id\)/.test(src("src/lib/partner-promo.ts")));

  console.log("\n— Database (read-only)");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data: legacy } = await db.from("businesses").select("owner_user_id").eq("id", LEGACY_BUSINESS_ID).single();
  const { data: partners } = await db.from("partners").select("*");
  const swift = partners?.find((p) => p.id === SWIFT_PARTNER_ID);
  check("Swift Aerial Media partner found by id (test 1)", Boolean(swift));
  check(
    "Swift partner user_id = owner of legacy business (verified by id, not name)",
    swift?.user_id === legacy?.owner_user_id,
    { partnerUser: swift?.user_id, owner: legacy?.owner_user_id }
  );
  check("Swift partner still active in the program (tests 1, 2)", swift?.status === "active");
  const migrated = swift ? "commission_eligible" in swift : false;
  console.log(`      migration v108 applied: ${migrated ? "yes" : "NO — run it"}`);
  if (migrated) {
    const ineligible = (partners ?? []).filter((p) => p.commission_eligible === false).map((p) => p.id).sort();
    check(
      "only the owner's two partner records are commission-ineligible (test 5 of Phase 5)",
      JSON.stringify(ineligible) === JSON.stringify([SWIFT_PARTNER_ID, OWNER_TEST_PARTNER_ID].sort()),
      ineligible
    );
    check(
      "all other partners keep 30% and stay eligible",
      (partners ?? [])
        .filter((p) => ![SWIFT_PARTNER_ID, OWNER_TEST_PARTNER_ID].includes(p.id))
        .every((p) => p.commission_eligible === true && Number(p.commission_rate_pct) === 30)
    );
    const { data: oneRef } = await db
      .from("partner_referrals")
      .select("business_id")
      .eq("partner_id", SWIFT_PARTNER_ID)
      .limit(1)
      .maybeSingle();
    if (oneRef?.business_id) {
      // Returns before any insert for an ineligible partner — no write happens.
      const res = await maybeCreateCommissionForPayment({
        paymentId: "00000000-0000-0000-0000-00000000dead",
        businessId: oneRef.business_id as string,
        amountPaidCents: 2900,
        currency: "usd",
        stripeMode: (process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_live_") ? "live" : "test",
        paidAt: new Date().toISOString(),
      });
      check(
        "Swift referral payment produces no commission (test 3)",
        res.created === false && res.reason === "partner_commission_ineligible",
        res
      );
    }
  }

  console.log("\n— Swift Aerial Media referrals (Phase 7 report)");
  const { data: refs } = await db.from("partner_referrals").select("*").eq("partner_id", SWIFT_PARTNER_ID);
  for (const r of refs ?? []) {
    const { data: b } = await db
      .from("businesses")
      .select("name, created_at, subscription_status, stripe_subscription_id_test, stripe_subscription_id_live")
      .eq("id", r.business_id)
      .single();
    const { data: pays } = await db.from("platform_subscription_payments").select("amount_paid_cents").eq("business_id", r.business_id);
    const { data: comms } = await db.from("partner_commissions").select("kind, amount_cents, payout_id").eq("business_id", r.business_id);
    console.log(
      `      ${b?.name} (${r.business_id}) signed up ${b?.created_at?.slice(0, 10)}, referred ${String(r.attributed_at).slice(0, 10)} via ${r.source}; ` +
        `status ${b?.subscription_status}; Stripe sub ${b?.stripe_subscription_id_live || b?.stripe_subscription_id_test || "none"}; ` +
        `payments ${pays?.length ?? 0}; commissions ${comms?.length ?? 0} (paid ${comms?.filter((c) => c.payout_id).length ?? 0}); referral active: yes`
    );
  }
  if (!refs?.length) console.log("      (none)");
  const { data: commsSwift } = await db.from("partner_commissions").select("id").in("partner_id", [SWIFT_PARTNER_ID, OWNER_TEST_PARTNER_ID]);
  check("no existing commission rows for the owner's partner records (nothing to flag)", (commsSwift?.length ?? 0) === 0, commsSwift?.length);

  if (!(process.env.STRIPE_SECRET_KEY ?? "").startsWith("sk_test_")) {
    console.log("\n— Stripe section skipped (not a test key)");
  } else {
    await stripeSection(db);
  }

  console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`}`);
  process.exit(failures === 0 ? 0 : 1);
}

async function stripeSection(db: ReturnType<typeof createClient>) {
  console.log("\n— Stripe test mode: removing the referral coupon (test 8, 15)");
  const { getStripe } = await import("../src/lib/stripe");
  const { loadPlanPriceForMode } = await import("../src/lib/stripe-billing");
  const { removeReferralDiscountFromSubscriptionId } = await import("../src/lib/partner-referral-admin");
  const { stripe } = getStripe();

  const price = await loadPlanPriceForMode("studio", "test");
  const { data: couponRow } = await db
    .from("partner_referral_discount_stripe_coupons")
    .select("stripe_coupon_id")
    .eq("mode", "test")
    .eq("billing_interval", "monthly")
    .limit(1)
    .maybeSingle();
  if (!price?.stripe_price_monthly_id || !couponRow?.stripe_coupon_id) {
    console.log("      skipped — no test monthly price or referral coupon configured");
    return;
  }

  const other = await stripe.coupons.create({ percent_off: 1, duration: "forever", name: "verify-v108-other" });
  const customer = await stripe.customers.create({
    email: "verify-v108@example.com",
    metadata: { shootportal_verify: "v108" },
  });
  try {
    const sub = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: price.stripe_price_monthly_id }],
      trial_period_days: 14,
      discounts: [{ coupon: couponRow.stripe_coupon_id as string }, { coupon: other.id }],
      metadata: { shootportal_referral_discount_applied: "true" },
    });
    const invoicesBefore = (await stripe.invoices.list({ customer: customer.id, limit: 100 })).data.length;

    const first = await removeReferralDiscountFromSubscriptionId(sub.id);
    check("referral coupon removed", first.status === "removed", first);
    check("effective date is the trial end / next bill", first.effectiveAt === new Date(sub.trial_end! * 1000).toISOString(), first.effectiveAt);

    const after = await stripe.subscriptions.retrieve(sub.id, { expand: ["discounts.source.coupon"] });
    const couponIds = (after.discounts ?? []).map((d) =>
      typeof d === "object" && d && typeof d.source?.coupon === "object" ? d.source.coupon?.id : null
    );
    check("other (non-referral) discount kept", couponIds.length === 1 && couponIds[0] === other.id, couponIds);
    check("subscription not canceled or replaced", after.id === sub.id && after.status === "trialing");
    const invoicesAfter = (await stripe.invoices.list({ customer: customer.id, limit: 100 })).data.length;
    check("no new invoice / immediate charge created", invoicesAfter === invoicesBefore, { invoicesBefore, invoicesAfter });

    const preview = await stripe.invoices.createPreview({ customer: customer.id, subscription: sub.id });
    const unit = price.plan.price_monthly_cents ?? 0;
    check(
      "next invoice is standard price (minus only the kept 1% test coupon)",
      preview.subtotal === unit && preview.total === Math.round(unit * 0.99),
      { subtotal: preview.subtotal, total: preview.total, unit }
    );

    const second = await removeReferralDiscountFromSubscriptionId(sub.id);
    check("repeat removal is a no-op (idempotent)", second.status === "none", second);
  } finally {
    await stripe.customers.del(customer.id).catch(() => undefined);
    await stripe.coupons.del(other.id).catch(() => undefined);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
