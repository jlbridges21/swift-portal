/**
 * Partner promo codes — validation lookup, checkout attribution precedence,
 * and append-only reassignment audit.
 *
 * Promo codes are collected in ShootPortal UI and resolve to the SAME referral
 * coupon path used for cookie attribution. Never pass allow_promotion_codes
 * alongside discounts to Stripe Checkout.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { validatePromoCode } from "@/lib/reserved-subdomains";
import type { PartnerReferralSource } from "@/lib/partner-referral";
import { isSelfReferral, type ActivePartnerRef } from "@/lib/partner-referral";

export type PromoPartnerLookup = {
  id: string;
  email: string;
  user_id: string | null;
  referral_code: string;
  promo_code: string;
  status: string;
  brand_name: string;
};

export type AttributionEventOutcome =
  | "created"
  | "reassigned"
  | "refused_commission_accrued"
  | "refused_self_referral"
  | "refused_partner_inactive"
  | "refused_invalid_code"
  | "noop";

export type PromoAttributionResult = {
  ok: boolean;
  outcome: AttributionEventOutcome;
  partnerId: string | null;
  promoCode: string | null;
  /** Partner whose discount coupon should be used (null → fall back to attributed / none). */
  discountPartnerId: string | null;
  message: string | null;
  eventId: string | null;
};

async function insertAttributionEvent(args: {
  businessId: string;
  referralId?: string | null;
  beforePartnerId?: string | null;
  afterPartnerId?: string | null;
  beforeSource?: string | null;
  afterSource?: string | null;
  beforeCodeUsed?: string | null;
  afterCodeUsed?: string | null;
  actorUserId?: string | null;
  actorEmail?: string | null;
  reason: string;
  outcome: AttributionEventOutcome;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_referral_attribution_events")
    .insert({
      business_id: args.businessId,
      referral_id: args.referralId ?? null,
      before_partner_id: args.beforePartnerId ?? null,
      after_partner_id: args.afterPartnerId ?? null,
      before_source: args.beforeSource ?? null,
      after_source: args.afterSource ?? null,
      before_code_used: args.beforeCodeUsed ?? null,
      after_code_used: args.afterCodeUsed ?? null,
      actor_user_id: args.actorUserId ?? null,
      actor_email: args.actorEmail ?? null,
      reason: args.reason,
      outcome: args.outcome,
      metadata: args.metadata ?? {},
    })
    .select("id")
    .single();
  if (error) {
    console.error("[partner-promo] attribution event insert failed", error.message);
    return null;
  }
  return (data?.id as string | undefined) ?? null;
}

/** Case-insensitive active partner lookup by promo code. */
export async function lookupActivePartnerByPromoCode(
  rawCode: string
): Promise<PromoPartnerLookup | null> {
  const validated = validatePromoCode(rawCode);
  if (!validated.ok) return null;
  const raw = await createServiceClient();
  const { data } = await raw
    .from("partners")
    .select("id, email, user_id, referral_code, promo_code, status, brand_name")
    .ilike("promo_code", validated.code)
    .eq("status", "active")
    .maybeSingle();
  if (!data?.promo_code) return null;
  return data as PromoPartnerLookup;
}

/** Any partner (including suspended) by promo code — for clear error messaging. */
export async function lookupPartnerByPromoCode(
  rawCode: string
): Promise<PromoPartnerLookup | null> {
  const validated = validatePromoCode(rawCode);
  if (!validated.ok) return null;
  const raw = await createServiceClient();
  const { data } = await raw
    .from("partners")
    .select("id, email, user_id, referral_code, promo_code, status, brand_name")
    .ilike("promo_code", validated.code)
    .maybeSingle();
  if (!data?.promo_code) return null;
  return data as PromoPartnerLookup;
}

export async function businessHasAccruedCommission(businessId: string): Promise<boolean> {
  const raw = await createServiceClient();
  const { count, error } = await raw
    .from("partner_commissions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("kind", "commission");
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}

/**
 * Apply a promo code at checkout.
 *
 * Precedence: promo OVERRIDES cookie / existing attribution when reassignment is allowed.
 *
 * Settled referral (commission has accrued): refuse reassignment, STILL apply the
 * promo partner's discount (customer price promise), leave attribution unchanged,
 * and log refused_commission_accrued. Commission ledger is never rewritten.
 *
 * Self-referral / suspended / invalid: no discount, no attribution change, logged.
 */
export async function applyPromoCodeAtCheckout(args: {
  businessId: string;
  promoCode: string;
  actorUserId: string;
  actorEmail: string;
}): Promise<PromoAttributionResult> {
  const validated = validatePromoCode(args.promoCode);
  if (!validated.ok) {
    const eventId = await insertAttributionEvent({
      businessId: args.businessId,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
      reason: validated.error,
      outcome: "refused_invalid_code",
      afterCodeUsed: String(args.promoCode).trim(),
    });
    return {
      ok: false,
      outcome: "refused_invalid_code",
      partnerId: null,
      promoCode: null,
      discountPartnerId: null,
      message: validated.error,
      eventId,
    };
  }

  const partner = await lookupPartnerByPromoCode(validated.code);
  if (!partner) {
    const eventId = await insertAttributionEvent({
      businessId: args.businessId,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
      reason: "Unknown promo code",
      outcome: "refused_invalid_code",
      afterCodeUsed: validated.code,
    });
    return {
      ok: false,
      outcome: "refused_invalid_code",
      partnerId: null,
      promoCode: validated.code,
      discountPartnerId: null,
      message: "That promo code is not recognized.",
      eventId,
    };
  }

  if (partner.status !== "active") {
    const eventId = await insertAttributionEvent({
      businessId: args.businessId,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
      reason: "Partner suspended",
      outcome: "refused_partner_inactive",
      afterPartnerId: partner.id,
      afterCodeUsed: partner.promo_code,
    });
    return {
      ok: false,
      outcome: "refused_partner_inactive",
      partnerId: partner.id,
      promoCode: partner.promo_code,
      discountPartnerId: null,
      message: "That promo code is no longer available.",
      eventId,
    };
  }

  const activeRef: ActivePartnerRef = {
    id: partner.id,
    email: partner.email,
    user_id: partner.user_id,
    referral_code: partner.referral_code,
    status: partner.status,
  };
  if (
    isSelfReferral({
      partner: activeRef,
      signupEmail: args.actorEmail,
      signupUserId: args.actorUserId,
    })
  ) {
    const eventId = await insertAttributionEvent({
      businessId: args.businessId,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
      reason: "Self-referral via promo code blocked",
      outcome: "refused_self_referral",
      afterPartnerId: partner.id,
      afterCodeUsed: partner.promo_code,
    });
    return {
      ok: false,
      outcome: "refused_self_referral",
      partnerId: partner.id,
      promoCode: partner.promo_code,
      discountPartnerId: null,
      message: "You can’t use your own partner promo code.",
      eventId,
    };
  }

  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("partner_referrals")
    .select("id, partner_id, source, referral_code_used")
    .eq("business_id", args.businessId)
    .maybeSingle();

  if (!existing) {
    const { data: biz } = await raw
      .from("businesses")
      .select("referred_by_partner_id")
      .eq("id", args.businessId)
      .maybeSingle();

    if (biz && !biz.referred_by_partner_id) {
      await raw
        .from("businesses")
        .update({ referred_by_partner_id: partner.id })
        .eq("id", args.businessId)
        .is("referred_by_partner_id", null);
    }

    const { data: inserted, error: insertErr } = await raw
      .from("partner_referrals")
      .insert({
        partner_id: partner.id,
        business_id: args.businessId,
        referral_code_used: partner.promo_code,
        source: "promo_code" satisfies PartnerReferralSource,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Race: another writer attributed first — re-read and continue as reassignment path.
      const { data: raced } = await raw
        .from("partner_referrals")
        .select("id, partner_id, source, referral_code_used")
        .eq("business_id", args.businessId)
        .maybeSingle();
      if (!raced) {
        console.error("[partner-promo] create attribution failed", insertErr.message);
        return {
          ok: false,
          outcome: "refused_invalid_code",
          partnerId: partner.id,
          promoCode: partner.promo_code,
          discountPartnerId: null,
          message: "Could not apply promo code. Try again.",
          eventId: null,
        };
      }
      return applyPromoAgainstExistingReferral({
        businessId: args.businessId,
        partner,
        existing: raced as {
          id: string;
          partner_id: string;
          source: string;
          referral_code_used: string;
        },
        actorUserId: args.actorUserId,
        actorEmail: args.actorEmail,
      });
    }

    await raw
      .from("businesses")
      .update({ referred_by_partner_id: partner.id })
      .eq("id", args.businessId);

    const eventId = await insertAttributionEvent({
      businessId: args.businessId,
      referralId: inserted?.id as string,
      afterPartnerId: partner.id,
      afterSource: "promo_code",
      afterCodeUsed: partner.promo_code,
      actorUserId: args.actorUserId,
      actorEmail: args.actorEmail,
      reason: "Attribution created from promo code at checkout",
      outcome: "created",
    });

    return {
      ok: true,
      outcome: "created",
      partnerId: partner.id,
      promoCode: partner.promo_code,
      discountPartnerId: partner.id,
      message: null,
      eventId,
    };
  }

  return applyPromoAgainstExistingReferral({
    businessId: args.businessId,
    partner,
    existing: existing as {
      id: string;
      partner_id: string;
      source: string;
      referral_code_used: string;
    },
    actorUserId: args.actorUserId,
    actorEmail: args.actorEmail,
  });
}

async function applyPromoAgainstExistingReferral(args: {
  businessId: string;
  partner: PromoPartnerLookup;
  existing: {
    id: string;
    partner_id: string;
    source: string;
    referral_code_used: string;
  };
  actorUserId: string;
  actorEmail: string;
}): Promise<PromoAttributionResult> {
  const { businessId, partner, existing, actorUserId, actorEmail } = args;

  if (existing.partner_id === partner.id) {
    const eventId = await insertAttributionEvent({
      businessId,
      referralId: existing.id,
      beforePartnerId: existing.partner_id,
      afterPartnerId: partner.id,
      beforeSource: existing.source,
      afterSource: "promo_code",
      beforeCodeUsed: existing.referral_code_used,
      afterCodeUsed: partner.promo_code,
      actorUserId,
      actorEmail,
      reason: "Promo code matches current attribution",
      outcome: "noop",
    });
    return {
      ok: true,
      outcome: "noop",
      partnerId: partner.id,
      promoCode: partner.promo_code,
      discountPartnerId: partner.id,
      message: null,
      eventId,
    };
  }

  const accrued = await businessHasAccruedCommission(businessId);
  if (accrued) {
    // Settled referral: never rewrite attribution or commission history.
    // Still apply the promo discount (customer entered a valid code).
    const eventId = await insertAttributionEvent({
      businessId,
      referralId: existing.id,
      beforePartnerId: existing.partner_id,
      afterPartnerId: partner.id,
      beforeSource: existing.source,
      afterSource: "promo_code",
      beforeCodeUsed: existing.referral_code_used,
      afterCodeUsed: partner.promo_code,
      actorUserId,
      actorEmail,
      reason:
        "Promo reassignment refused — commission already accrued; discount still applied; attribution unchanged",
      outcome: "refused_commission_accrued",
      metadata: { discount_applied: true },
    });
    return {
      ok: true,
      outcome: "refused_commission_accrued",
      partnerId: existing.partner_id,
      promoCode: partner.promo_code,
      discountPartnerId: partner.id,
      message:
        "Promo discount applied. Attribution wasn’t changed because commissions already accrued on this account.",
      eventId,
    };
  }

  const raw = await createServiceClient();
  const { error: updErr } = await raw
    .from("partner_referrals")
    .update({
      partner_id: partner.id,
      referral_code_used: partner.promo_code,
      source: "promo_code",
      attributed_at: new Date().toISOString(),
    })
    .eq("id", existing.id)
    .eq("business_id", businessId);

  if (updErr) {
    console.error("[partner-promo] reassignment failed", updErr.message);
    return {
      ok: false,
      outcome: "refused_invalid_code",
      partnerId: existing.partner_id,
      promoCode: partner.promo_code,
      discountPartnerId: null,
      message: "Could not apply promo code. Try again.",
      eventId: null,
    };
  }

  await raw
    .from("businesses")
    .update({ referred_by_partner_id: partner.id })
    .eq("id", businessId);

  const eventId = await insertAttributionEvent({
    businessId,
    referralId: existing.id,
    beforePartnerId: existing.partner_id,
    afterPartnerId: partner.id,
    beforeSource: existing.source,
    afterSource: "promo_code",
    beforeCodeUsed: existing.referral_code_used,
    afterCodeUsed: partner.promo_code,
    actorUserId,
    actorEmail,
    reason: "Promo code overrode prior attribution at checkout",
    outcome: "reassigned",
  });

  return {
    ok: true,
    outcome: "reassigned",
    partnerId: partner.id,
    promoCode: partner.promo_code,
    discountPartnerId: partner.id,
    message: null,
    eventId,
  };
}

/** Preview-only: validate promo and resolve whether discount would apply (no writes). */
export async function previewPromoCodeDiscount(args: {
  promoCode: string;
  actorEmail: string;
  actorUserId: string;
}): Promise<{
  ok: boolean;
  message: string | null;
  partnerId: string | null;
  promoCode: string | null;
  brandName: string | null;
}> {
  const validated = validatePromoCode(args.promoCode);
  if (!validated.ok) {
    return { ok: false, message: validated.error, partnerId: null, promoCode: null, brandName: null };
  }
  const partner = await lookupPartnerByPromoCode(validated.code);
  if (!partner) {
    return {
      ok: false,
      message: "That promo code is not recognized.",
      partnerId: null,
      promoCode: validated.code,
      brandName: null,
    };
  }
  if (partner.status !== "active") {
    return {
      ok: false,
      message: "That promo code is no longer available.",
      partnerId: partner.id,
      promoCode: partner.promo_code,
      brandName: partner.brand_name,
    };
  }
  if (
    isSelfReferral({
      partner: {
        id: partner.id,
        email: partner.email,
        user_id: partner.user_id,
        referral_code: partner.referral_code,
        status: partner.status,
      },
      signupEmail: args.actorEmail,
      signupUserId: args.actorUserId,
    })
  ) {
    return {
      ok: false,
      message: "You can’t use your own partner promo code.",
      partnerId: partner.id,
      promoCode: partner.promo_code,
      brandName: partner.brand_name,
    };
  }
  return {
    ok: true,
    message: null,
    partnerId: partner.id,
    promoCode: partner.promo_code,
    brandName: partner.brand_name,
  };
}
