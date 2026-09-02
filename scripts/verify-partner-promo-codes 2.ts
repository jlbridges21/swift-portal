/**
 * Partner promo codes — third attribution path verification.
 *
 *   npx tsx scripts/verify-partner-promo-codes.ts
 *
 * Test partners only (@example.test). Never touches live partners.
 * Refuses sk_live_ Stripe keys.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";
import Stripe from "stripe";

function loadEnvLocal() {
  const p = resolve(process.cwd(), ".env.local");
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (!m) continue;
    const key = m[1].trim();
    let val = m[2].trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = val;
  }
}
loadEnvLocal();

function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(msg);
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

async function main() {
  const secret = process.env.STRIPE_SECRET_KEY ?? "";
  if (secret.startsWith("sk_live")) {
    throw new Error("Refusing to run against live Stripe — use test mode only.");
  }

  const raw = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { createPartner, updatePartner } = await import("../src/lib/partners");
  const { validatePromoCode } = await import("../src/lib/reserved-subdomains");
  const {
    applyPromoCodeAtCheckout,
    lookupActivePartnerByPromoCode,
    previewPromoCodeDiscount,
  } = await import("../src/lib/partner-promo");
  const { attributeBusinessToPartner } = await import("../src/lib/partner-referral");
  const {
    resolveReferralDiscountForBusiness,
    loadPartnerProgramSettings,
  } = await import("../src/lib/partner-referral-discount");
  const { createBusinessForPlatform } = await import("../src/lib/platform-onboard");

  const { data: sa } = await raw
    .from("profiles")
    .select("id, email")
    .eq("role", "super_admin")
    .limit(1)
    .maybeSingle();
  assert(sa?.id, "need super_admin");
  const actor = { id: sa.id as string, email: (sa.email as string) ?? null };

  const stamp = Date.now().toString(36);
  const cleanupPartnerIds: string[] = [];
  const cleanupBusinessIds: string[] = [];
  const cleanupPaymentIds: string[] = [];

  process.env.SIGNUP_TEST_NO_EMAIL = "1";

  try {
    section("16. allow_promotion_codes NOT set");
    const grepOut = execSync(
      `rg -n "allow_promotion_codes" --glob '!node_modules/**' --glob '!.git/**' . || true`,
      { encoding: "utf8", cwd: process.cwd() }
    );
    console.log(grepOut.trim() || "(no matches)");
    const assignmentHits = grepOut
      .split("\n")
      .filter((l) => l.trim() && /allow_promotion_codes\s*[:=]/.test(l));
    assert(
      assignmentHits.length === 0,
      `allow_promotion_codes assigned:\n${assignmentHits.join("\n")}`
    );
    console.log("OK — never assigned (comments / error detection only)");

    section("5. Reserved / invalid format");
    const reserved = validatePromoCode("admin");
    assert(!reserved.ok, "admin should be reserved/blocked");
    console.log("reserved admin →", reserved);
    const short = validatePromoCode("AB");
    assert(!short.ok, "too short");
    console.log("too short →", short);
    const okNorm = validatePromoCode("swift5");
    // May fail if SWIFT5 already taken by a live partner — validation only here
    assert(okNorm.ok && okNorm.code === "SWIFT5", "case normalize to SWIFT5");
    console.log("swift5 →", okNorm);

    section("2. Partner sets promo code (create + edit)");
    const codeA0 = `PROA${stamp.slice(-4).toUpperCase()}`;
    const codeB = `PROB${stamp.slice(-4).toUpperCase()}`;
    const codeC = `PROC${stamp.slice(-4).toUpperCase()}`;

    const partnerA = (
      await createPartner(
        {
          name: `Promo A ${stamp}`,
          email: `promo-a-${stamp}@example.test`,
          brandName: `Promo Brand A ${stamp}`,
          referralCode: `promoa${stamp.slice(-6)}`,
          promoCode: codeA0,
          commissionRatePct: 30,
          sendInvite: false,
        },
        actor
      )
    ).partner;
    cleanupPartnerIds.push(partnerA.id);

    const partnerB = (
      await createPartner(
        {
          name: `Promo B ${stamp}`,
          email: `promo-b-${stamp}@example.test`,
          brandName: `Promo Brand B ${stamp}`,
          referralCode: `promob${stamp.slice(-6)}`,
          promoCode: codeB,
          commissionRatePct: 30,
          sendInvite: false,
        },
        actor
      )
    ).partner;
    cleanupPartnerIds.push(partnerB.id);

    const partnerC = (
      await createPartner(
        {
          name: `Promo C ${stamp}`,
          email: `promo-c-${stamp}@example.test`,
          brandName: `Promo Brand C ${stamp}`,
          referralCode: `promoc${stamp.slice(-6)}`,
          promoCode: codeC,
          commissionRatePct: 30,
          sendInvite: false,
        },
        actor
      )
    ).partner;
    cleanupPartnerIds.push(partnerC.id);

    const { data: rows2 } = await raw
      .from("partners")
      .select("id, email, referral_code, promo_code, status")
      .in("id", [partnerA.id, partnerB.id, partnerC.id])
      .order("email");
    console.log("partner rows after create:", JSON.stringify(rows2, null, 2));

    const codeA1 = `PROAX${stamp.slice(-3).toUpperCase()}`;
    const edited = await updatePartner(partnerA.id, { promoCode: codeA1 }, actor);
    console.log("edited partner A promo →", edited.promo_code);
    assert(edited.promo_code === codeA1, "dashboard edit promo");
    partnerA.promo_code = edited.promo_code;

    section("3. Duplicate promo → unique index / app reject");
    const { error: directDup } = await raw
      .from("partners")
      .update({ promo_code: codeB })
      .eq("id", partnerC.id);
    console.log("DB unique index error:", directDup?.message ?? "(unexpected success)");
    assert(directDup?.message, "expected unique violation from idx_partners_promo_code_lower");

    let appDup = "";
    try {
      await updatePartner(partnerC.id, { promoCode: codeB }, actor);
    } catch (e) {
      appDup = e instanceof Error ? e.message : String(e);
    }
    assert(appDup.toLowerCase().includes("already in use"), `app dup: ${appDup}`);
    console.log("app reject:", appDup);

    section("4. Case-insensitive match");
    const lower = await lookupActivePartnerByPromoCode(codeB.toLowerCase());
    assert(lower?.id === partnerB.id, "lowercase match");
    console.log(`"${codeB.toLowerCase()}" → partner ${lower?.id} code=${lower?.promo_code}`);

    const mkBiz = async (label: string) => {
      const created = await createBusinessForPlatform(
        {
          name: `Promo Biz ${label} ${stamp}`,
          slug: `promo-${label}-${stamp}`.slice(0, 48),
          adminEmail: `promo-biz-${label}-${stamp}@example.test`,
          adminName: `Promo ${label}`,
          source: "platform",
        },
        actor
      );
      cleanupBusinessIds.push(created.businessId);
      return created.businessId;
    };

    section("9. Precedence: visit A→B→C then enter B promo");
    const bizPrec = await mkBiz("prec");
    // Simulate last-touch cookie = C (RPC only writes when unset, so seed then overwrite)
    await attributeBusinessToPartner({
      businessId: bizPrec,
      partnerId: partnerA.id,
      referralCodeUsed: partnerA.referral_code,
      source: "link",
    });
    await raw
      .from("partner_referrals")
      .update({
        partner_id: partnerC.id,
        referral_code_used: partnerC.referral_code,
        source: "link",
      })
      .eq("business_id", bizPrec);
    await raw.from("businesses").update({ referred_by_partner_id: partnerC.id }).eq("id", bizPrec);

    const { data: beforePromo } = await raw
      .from("partner_referrals")
      .select("*")
      .eq("business_id", bizPrec)
      .maybeSingle();
    console.log("before promo (cookie=C):", JSON.stringify(beforePromo, null, 2));

    const precResult = await applyPromoCodeAtCheckout({
      businessId: bizPrec,
      promoCode: codeB,
      actorUserId: actor.id!,
      actorEmail: `promo-biz-prec-${stamp}@example.test`,
    });
    console.log("promo apply result:", precResult);

    const { data: afterPromo } = await raw
      .from("partner_referrals")
      .select("*")
      .eq("business_id", bizPrec)
      .maybeSingle();
    console.log("after promo (expect B, source=promo_code):", JSON.stringify(afterPromo, null, 2));
    assert(afterPromo?.partner_id === partnerB.id, "attribution to B");
    assert(afterPromo?.source === "promo_code", "source promo_code");
    assert(precResult.outcome === "reassigned", `outcome=${precResult.outcome}`);

    const { data: events9 } = await raw
      .from("partner_referral_attribution_events")
      .select(
        "outcome, before_partner_id, after_partner_id, before_source, after_source, after_code_used, reason, actor_user_id"
      )
      .eq("business_id", bizPrec)
      .order("created_at", { ascending: false })
      .limit(3);
    console.log("attribution events:", JSON.stringify(events9, null, 2));

    section("10. No promo → cookie attribution unchanged");
    const bizCookie = await mkBiz("cookie");
    await attributeBusinessToPartner({
      businessId: bizCookie,
      partnerId: partnerA.id,
      referralCodeUsed: partnerA.referral_code,
      source: "link",
    });
    const { data: cookieRef } = await raw
      .from("partner_referrals")
      .select("*")
      .eq("business_id", bizCookie)
      .single();
    assert(cookieRef.partner_id === partnerA.id && cookieRef.source === "link", "cookie link intact");
    console.log("cookie-only referral:", JSON.stringify(cookieRef, null, 2));

    section("11. Reassign with NO accrued commission");
    assert(precResult.outcome === "reassigned" && precResult.eventId, "reassigned + event");
    const { data: reEvt } = await raw
      .from("partner_referral_attribution_events")
      .select("*")
      .eq("id", precResult.eventId!)
      .single();
    console.log("reassignment event:", JSON.stringify(reEvt, null, 2));
    assert(reEvt.outcome === "reassigned", "event outcome");
    assert(reEvt.before_partner_id === partnerC.id, "before C");
    assert(reEvt.after_partner_id === partnerB.id, "after B");
    assert(reEvt.actor_user_id === actor.id, "actor recorded");

    section("12. Reassign WITH accrued commission → refuse, discount yes, ledger intact");
    const bizSettled = await mkBiz("settled");
    await attributeBusinessToPartner({
      businessId: bizSettled,
      partnerId: partnerA.id,
      referralCodeUsed: partnerA.referral_code,
      source: "link",
    });

    const earnedAt = new Date().toISOString();
    const { data: payment, error: payErr } = await raw
      .from("platform_subscription_payments")
      .insert({
        business_id: bizSettled,
        stripe_invoice_id: `in_promo_test_${stamp}`,
        amount_paid_cents: 2000,
        currency: "usd",
        paid_at: earnedAt,
        stripe_mode: "test",
      })
      .select("id")
      .single();
    if (payErr || !payment?.id) throw new Error(`payment insert failed: ${payErr?.message}`);
    cleanupPaymentIds.push(payment.id);

    const { data: commissionRow, error: cErr } = await raw
      .from("partner_commissions")
      .insert({
        partner_id: partnerA.id,
        business_id: bizSettled,
        subscription_payment_id: payment.id,
        kind: "commission",
        commission_rate_pct: 30,
        source_amount_cents: 2000,
        amount_cents: 600,
        currency: "usd",
        stripe_mode: "test",
        earned_at: earnedAt,
        payable_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        note: `promo-verify-${stamp}`,
      })
      .select("id, partner_id, business_id, kind, amount_cents, source_amount_cents")
      .single();
    if (cErr) throw new Error(`commission insert failed: ${cErr.message}`);
    console.log("commission row:", JSON.stringify(commissionRow, null, 2));

    const { data: ledgerBefore } = await raw
      .from("partner_commissions")
      .select("id, partner_id, business_id, kind, amount_cents, source_amount_cents")
      .eq("business_id", bizSettled)
      .order("id");
    console.log("ledger BEFORE promo:", JSON.stringify(ledgerBefore, null, 2));

    const settledApply = await applyPromoCodeAtCheckout({
      businessId: bizSettled,
      promoCode: codeB,
      actorUserId: actor.id!,
      actorEmail: `promo-biz-settled-${stamp}@example.test`,
    });
    console.log("settled apply:", settledApply);
    assert(settledApply.outcome === "refused_commission_accrued", "refuse reassignment");
    assert(settledApply.discountPartnerId === partnerB.id, "still discount from B");
    assert(settledApply.partnerId === partnerA.id, "attribution stays A");

    const { data: settledAfter } = await raw
      .from("partner_referrals")
      .select("*")
      .eq("business_id", bizSettled)
      .single();
    assert(settledAfter.partner_id === partnerA.id, "referral partner unchanged");
    assert(settledAfter.source === "link", "source unchanged");

    const { data: ledgerAfter } = await raw
      .from("partner_commissions")
      .select("id, partner_id, business_id, kind, amount_cents, source_amount_cents")
      .eq("business_id", bizSettled)
      .order("id");
    console.log("ledger AFTER promo (must be identical):", JSON.stringify(ledgerAfter, null, 2));
    assert(
      JSON.stringify(ledgerBefore) === JSON.stringify(ledgerAfter),
      "commission ledger must not be rewritten"
    );

    section("13. Self-referral via promo blocked");
    const selfBiz = await mkBiz("self");
    const selfResult = await applyPromoCodeAtCheckout({
      businessId: selfBiz,
      promoCode: codeB,
      actorUserId: "00000000-0000-0000-0000-000000000099",
      actorEmail: `promo-b-${stamp}@example.test`,
    });
    console.log("self-referral:", selfResult);
    assert(selfResult.outcome === "refused_self_referral", "blocked");
    assert(!selfResult.discountPartnerId, "no discount");

    section("8. Suspended partner code");
    await updatePartner(partnerC.id, { status: "suspended" }, actor);
    const suspBiz = await mkBiz("susp");
    const susp = await applyPromoCodeAtCheckout({
      businessId: suspBiz,
      promoCode: codeC,
      actorUserId: actor.id!,
      actorEmail: `promo-biz-susp-${stamp}@example.test`,
    });
    console.log("suspended:", susp);
    assert(susp.outcome === "refused_partner_inactive", "inactive");
    assert(!susp.discountPartnerId, "no discount");
    await updatePartner(partnerC.id, { status: "active" }, actor);

    section("7. Invalid code");
    const invBiz = await mkBiz("inv");
    const inv = await applyPromoCodeAtCheckout({
      businessId: invBiz,
      promoCode: "ZZZZNOPE999",
      actorUserId: actor.id!,
      actorEmail: `promo-biz-inv-${stamp}@example.test`,
    });
    console.log("invalid:", inv);
    assert(inv.outcome === "refused_invalid_code", "invalid");

    section("6/14/15. Discount from settings (monthly + annual) + Stripe charge");
    const program = await loadPartnerProgramSettings();
    console.log("program settings:", {
      enabled: program.referral_discount_enabled,
      monthlyCents: program.referral_discount_amount_cents,
      months: program.referral_discount_duration_months,
      annualEnabled: program.referral_discount_annual_enabled,
      annualCents: program.referral_discount_annual_amount_cents,
    });

    const preview = await previewPromoCodeDiscount({
      promoCode: codeB,
      actorEmail: `promo-biz-prec-${stamp}@example.test`,
      actorUserId: actor.id!,
    });
    assert(preview.ok && preview.partnerId === partnerB.id, "preview ok");
    console.log("preview:", preview);

    const monthlyDisc = await resolveReferralDiscountForBusiness({
      businessId: bizPrec,
      interval: "monthly",
      partnerIdOverride: partnerB.id,
    });
    console.log("monthly discount:", {
      eligible: monthlyDisc.eligible,
      couponId: monthlyDisc.couponId,
      amountOffCents: monthlyDisc.config?.amountOffCents,
      reason: monthlyDisc.reason,
    });
    assert(monthlyDisc.eligible && monthlyDisc.couponId, "monthly coupon");
    assert(
      monthlyDisc.config?.amountOffCents === program.referral_discount_amount_cents,
      "monthly amount from settings (no deploy)"
    );

    const annualDisc = await resolveReferralDiscountForBusiness({
      businessId: bizPrec,
      interval: "annual",
      partnerIdOverride: partnerB.id,
    });
    console.log("annual discount:", {
      eligible: annualDisc.eligible,
      couponId: annualDisc.couponId,
      amountOffCents: annualDisc.config?.amountOffCents,
      reason: annualDisc.reason,
    });
    if (program.referral_discount_annual_enabled) {
      if (!annualDisc.eligible) {
        const { syncReferralDiscountCouponsAfterSettingsChange } = await import(
          "../src/lib/sync-referral-discount-stripe-coupons"
        );
        console.log("annual coupon missing — syncing from settings…");
        const sync = await syncReferralDiscountCouponsAfterSettingsChange(program);
        console.log("sync result:", sync);
        const annualAfter = await resolveReferralDiscountForBusiness({
          businessId: bizPrec,
          interval: "annual",
          partnerIdOverride: partnerB.id,
        });
        console.log("annual discount after sync:", {
          eligible: annualAfter.eligible,
          couponId: annualAfter.couponId,
          annualAmountOffCents: annualAfter.config?.annualAmountOffCents,
          reason: annualAfter.reason,
        });
        assert(annualAfter.eligible && annualAfter.couponId, "annual coupon when enabled");
        assert(
          annualAfter.config?.annualAmountOffCents === program.referral_discount_annual_amount_cents,
          "annual amount from settings"
        );
      } else {
        assert(annualDisc.couponId, "annual coupon id");
        assert(
          annualDisc.config?.annualAmountOffCents === program.referral_discount_annual_amount_cents,
          "annual amount from settings"
        );
      }
    } else {
      console.log("annual offer disabled in settings — eligibility follows settings");
    }

    if (secret.startsWith("sk_test") && monthlyDisc.couponId) {
      const stripe = new Stripe(secret, { apiVersion: "2026-05-27.dahlia" });
      const { listPublicPlansWithModePrices } = await import("../src/lib/stripe-billing");
      const { getStripeMode } = await import("../src/lib/stripe");
      const plans = await listPublicPlansWithModePrices(getStripeMode());
      const plan = plans.find((p) => p.stripe_price_monthly_id) ?? plans[0];
      assert(plan?.stripe_price_monthly_id, "need monthly price");

      const customer = await stripe.customers.create({
        email: `promo-stripe-${stamp}@example.test`,
        metadata: { verify: "partner-promo-codes", stamp },
      });
      try {
        const sub = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: plan.stripe_price_monthly_id! }],
          discounts: [{ coupon: monthlyDisc.couponId }],
          payment_behavior: "default_incomplete",
          expand: ["latest_invoice"],
        });
        const invoice = sub.latest_invoice as Stripe.Invoice;
        console.log("Stripe subscription:", {
          id: sub.id,
          status: sub.status,
          coupon: monthlyDisc.couponId,
        });
        console.log("Stripe first invoice:", {
          id: invoice?.id,
          total: invoice?.total,
          subtotal: invoice?.subtotal,
          amount_due: invoice?.amount_due,
        });
        const list = plan.price_monthly_cents ?? 0;
        const expected = Math.max(0, list - (program.referral_discount_amount_cents ?? 0));
        console.log(
          `expected discounted total ≈ ${expected} (list ${list} - off ${program.referral_discount_amount_cents})`
        );
        if (invoice?.total != null && list > 0) {
          assert(
            invoice.total === expected || invoice.amount_due === expected,
            `invoice total ${invoice.total} / due ${invoice.amount_due} vs expected ${expected}`
          );
        }
        await stripe.subscriptions.cancel(sub.id);
      } finally {
        await stripe.customers.del(customer.id);
      }
    } else {
      console.log("skip Stripe charge paste — no sk_test or coupon");
    }

    section("17. Link + landing attribution still work");
    const bizLink = await mkBiz("link");
    const linkOk = await attributeBusinessToPartner({
      businessId: bizLink,
      partnerId: partnerA.id,
      referralCodeUsed: partnerA.referral_code,
      source: "link",
    });
    assert(linkOk, "link attribute");
    const { data: linkRef } = await raw
      .from("partner_referrals")
      .select("*")
      .eq("business_id", bizLink)
      .single();
    assert(linkRef.source === "link" && linkRef.partner_id === partnerA.id, "link path");
    console.log("link referral:", JSON.stringify(linkRef, null, 2));

    const bizLand = await mkBiz("land");
    const landOk = await attributeBusinessToPartner({
      businessId: bizLand,
      partnerId: partnerB.id,
      referralCodeUsed: partnerB.referral_code,
      source: "landing_page",
    });
    assert(landOk, "landing attribute");
    const { data: landRef } = await raw
      .from("partner_referrals")
      .select("*")
      .eq("business_id", bizLand)
      .single();
    assert(landRef.source === "landing_page", "landing path");
    console.log("landing referral:", JSON.stringify(landRef, null, 2));

    console.log("\nALL PROMO CODE CHECKS PASSED");
  } finally {
    for (const bid of cleanupBusinessIds) {
      await raw.from("partner_referral_attribution_events").delete().eq("business_id", bid);
      await raw.from("partner_commissions").delete().eq("business_id", bid);
      await raw.from("partner_referrals").delete().eq("business_id", bid);
      await raw.from("businesses").update({ referred_by_partner_id: null }).eq("id", bid);
    }
    for (const payId of cleanupPaymentIds) {
      await raw.from("platform_subscription_payments").delete().eq("id", payId);
    }
    for (const pid of cleanupPartnerIds) {
      await raw.from("partners").delete().eq("id", pid);
    }
    console.log(
      `\nCleanup attempted: ${cleanupPartnerIds.length} partners, ${cleanupBusinessIds.length} businesses, ${cleanupPaymentIds.length} payments`
    );
  }
}

main().catch((err) => {
  console.error("\nVERIFY FAILED:", err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
