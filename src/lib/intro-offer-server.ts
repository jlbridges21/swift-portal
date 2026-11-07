/**
 * Subscribe & Save — server side: eligibility inputs from the DB (+ Stripe when authoritative),
 * the Stripe coupon for each interval, and redemption records. Rules: intro-offer.ts.
 *
 * Fail-safe: anything we cannot read makes the account NOT eligible (normal price), never the
 * other way round. Display paths (banner, modal, billing page) use DB-only inputs; checkout and
 * "start my plan now" re-check against Stripe before any discount is attached.
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode } from "@/lib/stripe";
import {
  customerIdForMode,
  isShootPortalBillingMetadata,
  type BillingBusinessRow,
} from "@/lib/stripe-billing";
import { recordConversionEvent } from "@/lib/billing-journey";
import {
  decideIntroOffer,
  introOfferCouponId,
  introOfferMetaValue,
  introOfferTerms,
  INTRO_OFFER_DEFAULT_WINDOW_DAYS,
  INTRO_OFFER_META_KEY,
  quotePlan,
  quoteWithDiscount,
  type DiscountTerms,
  type IntervalKey,
  type IntroOfferDecision,
  type OfferDisplay,
} from "@/lib/intro-offer";
import type { PlanPricing } from "@/lib/trial-conversion";

function warn(where: string, err: unknown) {
  console.warn(`[intro-offer] ${where}`, err instanceof Error ? err.message : err);
}

/** Any partner attribution on the business (the referral offer always takes priority). */
export async function isBusinessPartnerReferred(businessId: string): Promise<boolean | null> {
  try {
    const db = await createServiceClient();
    const { data, error } = await db
      .from("partner_referrals")
      .select("id")
      .eq("business_id", businessId)
      .limit(1);
    if (error) {
      warn("referral lookup failed", error.message);
      return null;
    }
    return (data ?? []).length > 0;
  } catch (err) {
    warn("referral lookup failed", err);
    return null;
  }
}

/** Paid ShootPortal invoices in the platform ledger. null = unknown. */
async function ledgerPaidInvoiceCount(businessId: string): Promise<number | null> {
  try {
    const db = await createServiceClient();
    const { count, error } = await db
      .from("platform_subscription_payments")
      .select("id", { count: "exact", head: true })
      .eq("business_id", businessId)
      .gt("amount_paid_cents", 0);
    if (error) {
      warn("ledger lookup failed", error.message);
      return null;
    }
    return count ?? 0;
  } catch (err) {
    warn("ledger lookup failed", err);
    return null;
  }
}

/** Paid ShootPortal subscription invoices on the Stripe customer (authoritative). null = unknown. */
async function stripePaidInvoiceCount(business: BillingBusinessRow): Promise<number | null> {
  const customerId = customerIdForMode(business);
  if (!customerId) return 0;
  try {
    const { stripe } = getStripe();
    const invoices = await stripe.invoices.list({ customer: customerId, status: "paid", limit: 100 });
    return invoices.data.filter((inv) => {
      if ((inv.amount_paid ?? 0) <= 0) return false;
      const meta = inv.parent?.subscription_details?.metadata ?? inv.metadata ?? null;
      // Customer objects are per business; count any paid subscription invoice on it.
      return Boolean(inv.parent?.subscription_details?.subscription) || isShootPortalBillingMetadata(meta);
    }).length;
  } catch (err) {
    warn("stripe invoice lookup failed", err);
    return null;
  }
}

/** Redemption marker (migration v111). Missing column / row ⇒ false (other checks still apply). */
async function loadRedemption(businessId: string): Promise<boolean> {
  try {
    const db = await createServiceClient();
    const { data, error } = await db
      .from("business_billing_journey")
      .select("intro_offer_redeemed_at")
      .eq("business_id", businessId)
      .maybeSingle();
    if (error) return false;
    return Boolean((data as { intro_offer_redeemed_at?: string | null } | null)?.intro_offer_redeemed_at);
  } catch {
    return false;
  }
}

async function loadWindowInputs(
  businessId: string
): Promise<{ created_at: string | null; windowDays: number }> {
  try {
    const db = await createServiceClient();
    const { data } = await db.from("businesses").select("created_at, plan").eq("id", businessId).maybeSingle();
    let windowDays = INTRO_OFFER_DEFAULT_WINDOW_DAYS;
    const planKey = (data?.plan as string | undefined) || "studio";
    const { data: plan } = await db.from("plans").select("trial_days").eq("key", planKey).maybeSingle();
    const days = Number(plan?.trial_days);
    if (Number.isFinite(days) && days > 0) windowDays = days;
    return { created_at: (data?.created_at as string | undefined) ?? null, windowDays };
  } catch (err) {
    warn("window inputs failed", err);
    return { created_at: null, windowDays: INTRO_OFFER_DEFAULT_WINDOW_DAYS };
  }
}

export type IntroOfferContext = {
  decision: IntroOfferDecision;
  referred: boolean;
};

/**
 * Decide the offer for a business.
 * - `authoritative`: also count paid invoices on Stripe (checkout / start-now). Display callers
 *   leave it off (DB only, no Stripe round-trip on every admin page).
 * - `liveSubscription`: the business's live Stripe subscription when the caller has it. Display
 *   callers may pass a DB-derived stand-in ({ status: "trialing" } for a scheduled plan).
 */
export async function loadIntroOfferContext(
  business: Pick<BillingBusinessRow, "id" | "subscription_status" | "trial_ends_at"> & Partial<BillingBusinessRow>,
  options: {
    authoritative?: boolean;
    liveSubscription?: { status: string; hasDiscount: boolean } | null;
  } = {}
): Promise<IntroOfferContext> {
  const [referred, ledger, redeemed, windowInputs, stripeCount] = await Promise.all([
    isBusinessPartnerReferred(business.id),
    ledgerPaidInvoiceCount(business.id),
    loadRedemption(business.id),
    loadWindowInputs(business.id),
    options.authoritative && "stripe_customer_id" in business
      ? stripePaidInvoiceCount(business as BillingBusinessRow)
      : Promise.resolve(0),
  ]);
  const paidInvoiceCount =
    ledger == null || stripeCount == null ? null : Math.max(ledger, stripeCount);
  const decision = decideIntroOffer({
    subscription_status: business.subscription_status,
    trial_ends_at: business.trial_ends_at,
    created_at: windowInputs.created_at,
    windowDays: windowInputs.windowDays,
    // Unknown referral state ⇒ treat as referred (never risk stacking).
    referred: referred !== false,
    paidInvoiceCount,
    redeemed,
    liveSubscription: options.liveSubscription ?? null,
  });
  return { decision, referred: referred === true };
}

export function subscriptionHasDiscount(sub: Stripe.Subscription): boolean {
  return (sub.discounts?.length ?? 0) > 0;
}

/**
 * Stripe coupon for the interval's intro terms, created on first use (per Stripe mode).
 * Returns null when the interval has no intro offer or the coupon can't be verified — callers
 * must then NOT promise or apply the discount.
 */
export async function ensureIntroOfferCoupon(interval: string): Promise<string | null> {
  const terms = introOfferTerms(interval);
  if (!terms) return null;
  const id = introOfferCouponId(interval, terms);
  const { stripe } = getStripe();
  const matches = (c: Stripe.Coupon) =>
    c.valid &&
    c.amount_off === terms.amountOffCents &&
    (c.currency ?? "").toLowerCase() === "usd" &&
    c.duration === terms.duration.kind &&
    (terms.duration.kind === "once" || c.duration_in_months === terms.duration.months);
  try {
    const existing = await stripe.coupons.retrieve(id);
    if (matches(existing)) return id;
    console.error("[intro-offer] ALERT coupon exists but does not match terms — offer disabled", {
      id,
      mode: getStripeMode(),
    });
    return null;
  } catch (err) {
    const code = (err as { code?: string }).code;
    if (code !== "resource_missing") {
      warn("coupon retrieve failed", err);
      return null;
    }
  }
  try {
    const created = await stripe.coupons.create(
      {
        id,
        name: "Subscribe & Save",
        amount_off: terms.amountOffCents,
        currency: "usd",
        duration: terms.duration.kind,
        ...(terms.duration.kind === "repeating" ? { duration_in_months: terms.duration.months } : {}),
        metadata: { shootportal_intro_offer: introOfferMetaValue(interval) },
      },
      { idempotencyKey: `sp-intro-coupon-${id}` }
    );
    return matches(created) ? id : null;
  } catch (err) {
    // Created concurrently by another request.
    try {
      const again = await stripe.coupons.retrieve(id);
      return matches(again) ? id : null;
    } catch {
      warn("coupon create failed", err);
      return null;
    }
  }
}

/**
 * After a subscription carrying the intro marker is live: remember the redemption (so it can
 * never be claimed again) and record the conversion event. Idempotent; best-effort.
 */
export async function recordIntroOfferRedemption(sub: Stripe.Subscription, businessId: string): Promise<void> {
  const marker = sub.metadata?.[INTRO_OFFER_META_KEY];
  if (!marker) return;
  if (sub.status !== "active" && sub.status !== "past_due") return;
  try {
    const db = await createServiceClient();
    const { error } = await db
      .from("business_billing_journey")
      .upsert(
        { business_id: businessId, updated_at: new Date().toISOString() },
        { onConflict: "business_id", ignoreDuplicates: true }
      );
    if (error) warn("redemption row", error.message);
    const { error: upErr } = await db
      .from("business_billing_journey")
      .update({
        intro_offer_redeemed_at: new Date().toISOString(),
        intro_offer_subscription_id: sub.id,
        intro_offer_code: marker.slice(0, 40),
      })
      .eq("business_id", businessId)
      .is("intro_offer_redeemed_at", null);
    if (upErr) warn("redemption marker (run migration v111)", upErr.message);
  } catch (err) {
    warn("redemption marker", err);
  }
  await recordConversionEvent({
    businessId,
    type: "intro_offer_redeemed",
    dedupeKey: `intro_offer_redeemed:${businessId}`,
    properties: {
      offer: marker.slice(0, 40),
      subscription_status: sub.status,
      started_early: sub.metadata?.sp_started_early === "true",
    },
  });
}

// ---------------------------------------------------------------------------
// Display: one price list per page, from the same resolvers checkout uses
// ---------------------------------------------------------------------------

type ReferralLike = {
  eligible: boolean;
  config?: { amountOffCents: number; durationMonths: number; annualEnabled: boolean; annualAmountOffCents: number };
};

function referralTerms(interval: IntervalKey, d: ReferralLike | null): DiscountTerms | null {
  if (!d?.eligible || !d.config) return null;
  if (interval === "monthly") {
    return d.config.amountOffCents > 0 && d.config.durationMonths > 0
      ? { amountOffCents: d.config.amountOffCents, invoices: d.config.durationMonths }
      : null;
  }
  return d.config.annualEnabled && d.config.annualAmountOffCents > 0
    ? { amountOffCents: d.config.annualAmountOffCents, invoices: 1 }
    : null;
}

function referralQuotes(
  pricing: PlanPricing,
  monthly: ReferralLike | null,
  annual: ReferralLike | null
): OfferDisplay["quotes"] {
  const quotes: OfferDisplay["quotes"] = {};
  if (pricing.monthlyCents != null) {
    quotes.monthly = quoteWithDiscount("monthly", pricing.monthlyCents, referralTerms("monthly", monthly));
  }
  if (pricing.annualPerMonthCents != null) {
    quotes.annual = quoteWithDiscount("annual", pricing.annualPerMonthCents * 12, referralTerms("annual", annual));
  }
  return quotes;
}

/**
 * Prices for an existing business (billing page, banner, modal). Referral first (any partner
 * attribution ⇒ referral pricing, even when that interval has no referral discount), then the
 * intro offer, else regular prices.
 */
export async function offerDisplayForBusiness(
  business: Pick<BillingBusinessRow, "id" | "subscription_status" | "trial_ends_at"> & Partial<BillingBusinessRow>,
  pricing: PlanPricing,
  options: { liveSubscription?: { status: string; hasDiscount: boolean } | null; intro?: IntroOfferContext } = {}
): Promise<OfferDisplay & { intro: IntroOfferContext }> {
  const intro = options.intro ?? (await loadIntroOfferContext(business, { liveSubscription: options.liveSubscription ?? null }));
  if (intro.referred) {
    let monthly: ReferralLike | null = null;
    let annual: ReferralLike | null = null;
    try {
      const { resolveReferralDiscountForBusiness } = await import("@/lib/partner-referral-discount");
      [monthly, annual] = await Promise.all([
        resolveReferralDiscountForBusiness({ businessId: business.id, interval: "monthly" }),
        resolveReferralDiscountForBusiness({ businessId: business.id, interval: "annual" }),
      ]);
    } catch (err) {
      warn("referral display failed — regular prices", err);
    }
    return { kind: "referral", quotes: referralQuotes(pricing, monthly, annual), endsAt: null, intro };
  }
  const withIntro = intro.decision.eligible;
  return {
    kind: withIntro ? "intro" : "none",
    quotes: quotePlan(pricing, withIntro),
    endsAt: intro.decision.eligible ? intro.decision.endsAt : null,
    intro,
  };
}

/**
 * Prices for /signup (no account yet). A valid partner referral cookie ⇒ that partner's pricing;
 * otherwise the intro offer. The account's eligibility is re-checked at checkout.
 */
export async function offerDisplayForSignup(
  pricing: PlanPricing,
  partnerRefCookie: string | null | undefined,
  options: { ignoreReferral?: boolean } = {}
): Promise<OfferDisplay & { partnerName: string | null }> {
  if (!options.ignoreReferral && partnerRefCookie) {
    try {
      const { verifyPartnerRefCookie, resolveActivePartnerFromRefClaims } = await import("@/lib/partner-referral");
      const partner = await resolveActivePartnerFromRefClaims(verifyPartnerRefCookie(partnerRefCookie));
      if (partner) {
        const { loadPartnerProgramSettings, resolveAppliedReferralDiscount } = await import(
          "@/lib/partner-referral-discount"
        );
        const db = await createServiceClient();
        const [program, { data: row }] = await Promise.all([
          loadPartnerProgramSettings(),
          db
            .from("partners")
            .select("status, brand_name, referral_discount_enabled, referral_discount_amount_cents, referral_discount_duration_months")
            .eq("id", partner.id)
            .maybeSingle(),
        ]);
        const status = (row?.status as "active" | "suspended" | undefined) ?? "active";
        const [monthly, annual] = await Promise.all(
          (["monthly", "annual"] as const).map((interval) =>
            resolveAppliedReferralDiscount({ program, partner: row ?? null, partnerStatus: status, interval })
          )
        );
        return {
          kind: "referral",
          quotes: referralQuotes(pricing, monthly, annual),
          endsAt: null,
          partnerName: (row?.brand_name as string | undefined) ?? null,
        };
      }
    } catch (err) {
      warn("signup referral display failed — showing intro offer", err);
    }
  }
  return { kind: "intro", quotes: quotePlan(pricing, true), endsAt: null, partnerName: null };
}
