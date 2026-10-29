/**
 * Super-admin partner referral management (v108).
 *
 * - Lists a partner's referred businesses with billing / discount / commission detail.
 * - Removes one attribution: DB transaction first (remove_partner_referral RPC — voids UNPAID
 *   commissions with append-only reversals, archives, deletes partner_referrals), then takes the
 *   referral coupon off the business's Stripe subscription. Removing a discount never creates an
 *   invoice or proration: the current paid period is untouched and the next invoice is full price.
 * - Commission eligibility toggle (partners.commission_eligible), audit logged.
 *
 * Callers must already be authorized as super_admin (requireSuperAdminApi / requireSuperAdminPage).
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode } from "@/lib/stripe";
import { writePlatformAudit } from "@/lib/platform-audit";
import { getPartnerById, type PartnerRow } from "@/lib/partners";
import { isPartnerCommissionEligible } from "@/lib/partner-commissions";
import {
  loadBillingBusiness,
  subscriptionCurrentPeriodEndUnix,
  subscriptionIdForMode,
} from "@/lib/stripe-billing";

export const REFERRAL_REMOVAL_MIGRATION_MESSAGE =
  "Referral removal needs database migration v108 (supabase/migration-v108-partner-referral-management.sql). Run it, then try again.";

type Actor = { id: string; email: string | null };

export type PlatformReferralRow = {
  businessId: string;
  businessName: string;
  businessSlug: string | null;
  signedUpAt: string | null;
  attributedAt: string;
  source: string;
  referralCodeUsed: string;
  subscriptionStatus: string;
  deleted: boolean;
  plan: string;
  interval: "monthly" | "annual" | null;
  discountLabel: string | null;
  discountInWindow: boolean;
  revenueCents: number;
  /** Gross commission rows (kind=commission). */
  commissionEarnedCents: number;
  /** Net of ledger rows already stamped onto a payout. */
  commissionPaidCents: number;
  /** Net of ledger rows not yet paid (commissions, reversals). */
  commissionUnpaidCents: number;
};

export type ReferralRemovalRow = {
  id: string;
  businessId: string | null;
  businessName: string | null;
  attributedAt: string;
  removedAt: string;
  removedByEmail: string | null;
  reason: string | null;
  source: string;
  voidedCommissionCount: number;
  voidedCommissionCents: number;
  paidCommissionCents: number;
  stripeDiscountStatus: "pending" | "none" | "removed" | "failed";
  stripeDiscountDetail: string | null;
  stripeDiscountEffectiveAt: string | null;
};

function sumCents(rows: Array<{ amount_cents?: unknown }>): number {
  return rows.reduce((s, r) => s + (typeof r.amount_cents === "number" ? r.amount_cents : 0), 0);
}

export async function loadPlatformPartnerReferralRows(partnerId: string): Promise<PlatformReferralRow[]> {
  const mode = getStripeMode();
  const raw = await createServiceClient();

  const { data: referrals } = await raw
    .from("partner_referrals")
    .select("business_id, attributed_at, source, referral_code_used")
    .eq("partner_id", partnerId)
    .order("attributed_at", { ascending: false });
  const list = referrals ?? [];
  if (!list.length) return [];

  const businessIds = list.map((r) => r.business_id as string);
  const [{ data: businesses }, { data: payments }, { data: commissions }, journey] = await Promise.all([
    raw
      .from("businesses")
      .select("id, name, slug, plan, subscription_status, deleted_at, created_at")
      .in("id", businessIds),
    raw
      .from("platform_subscription_payments")
      .select("business_id, amount_paid_cents")
      .in("business_id", businessIds)
      .eq("stripe_mode", mode),
    raw
      .from("partner_commissions")
      .select("business_id, kind, amount_cents, payout_id")
      .eq("partner_id", partnerId)
      .eq("stripe_mode", mode)
      .in("business_id", businessIds),
    // v107 table — missing before that migration ⇒ no interval shown.
    raw
      .from("business_billing_journey")
      .select("business_id, subscription_interval, preferred_interval")
      .in("business_id", businessIds)
      .then((r) => (r.error ? [] : (r.data ?? []))),
  ]);

  const bizMap = new Map((businesses ?? []).map((b) => [b.id as string, b]));
  const intervalMap = new Map(
    journey.map((j) => [
      j.business_id as string,
      ((j.subscription_interval as string | null) ?? null) as "monthly" | "annual" | null,
    ])
  );

  const { computeReferralDiscountWindow } = await import("@/lib/partner-referral-discount");

  return Promise.all(
    list.map(async (r) => {
      const bid = r.business_id as string;
      const biz = bizMap.get(bid);
      const bizPayments = (payments ?? []).filter((p) => p.business_id === bid);
      const bizCommissions = (commissions ?? []).filter((c) => c.business_id === bid);
      const discount = await computeReferralDiscountWindow({
        businessId: bid,
        partnerId,
        stripeMode: mode,
      });
      return {
        businessId: bid,
        businessName: (biz?.name as string) || "Unknown business",
        businessSlug: (biz?.slug as string) ?? null,
        signedUpAt: (biz?.created_at as string) ?? null,
        attributedAt: r.attributed_at as string,
        source: r.source as string,
        referralCodeUsed: r.referral_code_used as string,
        subscriptionStatus: biz?.deleted_at ? "deleted" : ((biz?.subscription_status as string) ?? "unknown"),
        deleted: Boolean(biz?.deleted_at),
        plan: (biz?.plan as string) || "—",
        interval: intervalMap.get(bid) ?? null,
        discountLabel: discount?.label ?? null,
        discountInWindow: discount?.inWindow ?? false,
        revenueCents: sumCents(bizPayments.map((p) => ({ amount_cents: p.amount_paid_cents }))),
        commissionEarnedCents: sumCents(bizCommissions.filter((c) => c.kind === "commission")),
        commissionPaidCents: sumCents(bizCommissions.filter((c) => c.payout_id != null)),
        commissionUnpaidCents: sumCents(bizCommissions.filter((c) => c.payout_id == null)),
      };
    })
  );
}

/** Removal history for one partner. Missing table (pre-v108) ⇒ empty. */
export async function loadPartnerReferralRemovals(partnerId: string): Promise<ReferralRemovalRow[]> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_referral_removals")
    .select("*")
    .eq("partner_id", partnerId)
    .order("removed_at", { ascending: false })
    .limit(200);
  if (error) return [];
  return (data ?? []).map((r) => ({
    id: r.id as string,
    businessId: (r.business_id as string) ?? null,
    businessName: (r.business_name as string) ?? null,
    attributedAt: r.attributed_at as string,
    removedAt: r.removed_at as string,
    removedByEmail: (r.removed_by_email as string) ?? null,
    reason: (r.reason as string) ?? null,
    source: r.source as string,
    voidedCommissionCount: Number(r.voided_commission_count ?? 0),
    voidedCommissionCents: Number(r.voided_commission_cents ?? 0),
    paidCommissionCents: Number(r.paid_commission_cents ?? 0),
    stripeDiscountStatus: r.stripe_discount_status as ReferralRemovalRow["stripeDiscountStatus"],
    stripeDiscountDetail: (r.stripe_discount_detail as string) ?? null,
    stripeDiscountEffectiveAt: (r.stripe_discount_effective_at as string) ?? null,
  }));
}

// ── Stripe referral coupon ────────────────────────────────────────────────────

export type StripeReferralDiscountState =
  | { kind: "no_subscription" }
  | { kind: "no_referral_discount"; subscriptionId: string }
  | {
      kind: "discount_active";
      subscriptionId: string;
      subscriptionStatus: string;
      couponName: string | null;
      /** When the customer is first billed without the referral discount. */
      effectiveAt: string | null;
    }
  | { kind: "error"; message: string };

function couponOf(discount: Stripe.Discount): Stripe.Coupon | null {
  const c = discount.source?.coupon;
  return c && typeof c === "object" ? c : null;
}

async function knownReferralCouponIds(): Promise<Set<string>> {
  const raw = await createServiceClient();
  const { data } = await raw.from("partner_referral_discount_stripe_coupons").select("stripe_coupon_id");
  return new Set((data ?? []).map((r) => r.stripe_coupon_id as string));
}

function isReferralDiscount(discount: Stripe.Discount, knownIds: Set<string>): boolean {
  const coupon = couponOf(discount);
  const couponId =
    coupon?.id ?? (typeof discount.source?.coupon === "string" ? discount.source.coupon : null);
  if (couponId && knownIds.has(couponId)) return true;
  return coupon?.metadata?.shootportal_referral_discount === "true";
}

async function loadSubscriptionWithDiscounts(businessId: string): Promise<
  | { subscription: Stripe.Subscription; discounts: Stripe.Discount[] }
  | { subscription: null }
> {
  const business = await loadBillingBusiness(businessId);
  const subscriptionId = business ? subscriptionIdForMode(business) : null;
  if (!subscriptionId) return { subscription: null };
  return retrieveSubscriptionWithDiscounts(subscriptionId);
}

async function retrieveSubscriptionWithDiscounts(
  subscriptionId: string
): Promise<{ subscription: Stripe.Subscription; discounts: Stripe.Discount[] }> {
  const { stripe } = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ["discounts.source.coupon"],
  });
  const discounts = (subscription.discounts ?? []).filter(
    (d): d is Stripe.Discount => typeof d === "object" && d !== null
  );
  return { subscription, discounts };
}

function billingBoundary(subscription: Stripe.Subscription): string | null {
  const unix =
    subscription.status === "trialing" && subscription.trial_end
      ? subscription.trial_end
      : subscriptionCurrentPeriodEndUnix(subscription);
  return unix ? new Date(unix * 1000).toISOString() : null;
}

export async function inspectStripeReferralDiscount(
  businessId: string
): Promise<StripeReferralDiscountState> {
  try {
    const loaded = await loadSubscriptionWithDiscounts(businessId);
    if (!loaded.subscription) return { kind: "no_subscription" };
    const { subscription, discounts } = loaded;
    const knownIds = await knownReferralCouponIds();
    const referral = discounts.find((d) => isReferralDiscount(d, knownIds));
    if (!referral) return { kind: "no_referral_discount", subscriptionId: subscription.id };
    return {
      kind: "discount_active",
      subscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      couponName: couponOf(referral)?.name ?? null,
      effectiveAt: billingBoundary(subscription),
    };
  } catch (err) {
    return { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Take the referral coupon (only) off the subscription. Other discounts are kept.
 * No price, item, or billing-cycle change ⇒ Stripe creates no invoice or proration.
 */
type StripeDiscountRemoval = {
  status: "none" | "removed" | "failed";
  detail: string;
  subscriptionId: string | null;
  effectiveAt: string | null;
};

async function removeStripeReferralDiscount(businessId: string): Promise<StripeDiscountRemoval> {
  try {
    const loaded = await loadSubscriptionWithDiscounts(businessId);
    if (!loaded.subscription) {
      return {
        status: "none",
        detail: "No Stripe subscription — they will pay standard pricing when they subscribe.",
        subscriptionId: null,
        effectiveAt: null,
      };
    }
    return await removeReferralDiscountFromLoadedSubscription(loaded);
  } catch (err) {
    return {
      status: "failed",
      detail: `Stripe update failed: ${err instanceof Error ? err.message : String(err)}`,
      subscriptionId: null,
      effectiveAt: null,
    };
  }
}

/** Exported for scripts/verify-partner-referral-management.ts (Stripe test mode only). */
export async function removeReferralDiscountFromSubscriptionId(
  subscriptionId: string
): Promise<StripeDiscountRemoval> {
  return removeReferralDiscountFromLoadedSubscription(
    await retrieveSubscriptionWithDiscounts(subscriptionId)
  );
}

async function removeReferralDiscountFromLoadedSubscription(loaded: {
  subscription: Stripe.Subscription;
  discounts: Stripe.Discount[];
}): Promise<StripeDiscountRemoval> {
  const { subscription, discounts } = loaded;
  const knownIds = await knownReferralCouponIds();
  const referral = discounts.filter((d) => isReferralDiscount(d, knownIds));
  if (!referral.length) {
    return {
      status: "none",
      detail: "Subscription has no referral discount — nothing to change in Stripe.",
      subscriptionId: subscription.id,
      effectiveAt: null,
    };
  }
  const keep = discounts.filter((d) => !referral.includes(d)).map((d) => ({ discount: d.id }));
  const { stripe } = getStripe();
  await stripe.subscriptions.update(subscription.id, {
    discounts: keep,
    metadata: {
      shootportal_referral_discount_pending: "",
      shootportal_referral_discount_applied: "",
      shootportal_referral_removed: "true",
    },
  });
  const effectiveAt = billingBoundary(subscription);
  return {
    status: "removed",
    detail: `Referral coupon removed from ${subscription.id}. Current period is unchanged; standard pricing starts on the next invoice.`,
    subscriptionId: subscription.id,
    effectiveAt,
  };
}

async function recordStripeOutcome(removalId: string, outcome: StripeDiscountRemoval) {
  const raw = await createServiceClient();
  await raw
    .from("partner_referral_removals")
    .update({
      stripe_discount_status: outcome.status,
      stripe_discount_detail: outcome.detail.slice(0, 1000),
      stripe_subscription_id: outcome.subscriptionId,
      stripe_discount_effective_at: outcome.effectiveAt,
      stripe_discount_updated_at: new Date().toISOString(),
    })
    .eq("id", removalId);
}

// ── Preview / remove ──────────────────────────────────────────────────────────

export type ReferralRemovalPreview = {
  businessId: string;
  businessName: string;
  partnerName: string;
  unpaidCommissionCount: number;
  unpaidCommissionCents: number;
  paidCommissionCents: number;
  stripe: StripeReferralDiscountState;
};

export async function previewReferralRemoval(
  partnerId: string,
  businessId: string
): Promise<ReferralRemovalPreview | null> {
  const raw = await createServiceClient();
  const [partner, { data: referral }, { data: biz }, { data: commissions }] = await Promise.all([
    getPartnerById(partnerId),
    raw
      .from("partner_referrals")
      .select("id")
      .eq("business_id", businessId)
      .eq("partner_id", partnerId)
      .maybeSingle(),
    raw.from("businesses").select("name").eq("id", businessId).maybeSingle(),
    raw
      .from("partner_commissions")
      .select("kind, amount_cents, payout_id")
      .eq("partner_id", partnerId)
      .eq("business_id", businessId),
  ]);
  if (!partner || !referral) return null;
  const rows = commissions ?? [];
  const unpaid = rows.filter((c) => c.payout_id == null);
  return {
    businessId,
    businessName: (biz?.name as string) || "this business",
    partnerName: partner.brand_name || partner.name,
    unpaidCommissionCount: unpaid.filter((c) => c.kind === "commission").length,
    unpaidCommissionCents: Math.max(0, sumCents(unpaid)),
    paidCommissionCents: sumCents(rows.filter((c) => c.payout_id != null)),
    stripe: await inspectStripeReferralDiscount(businessId),
  };
}

export type RemoveReferralResult = {
  status: "removed" | "already_removed";
  removalId: string | null;
  voidedCommissionCount: number;
  voidedCommissionCents: number;
  paidCommissionCents: number;
  stripe: { status: "none" | "removed" | "failed" | "skipped"; detail: string; effectiveAt: string | null };
};

function isMissingDbObject(message: string): boolean {
  return /does not exist|could not find the function|schema cache/i.test(message);
}

export async function removePartnerReferral(args: {
  partnerId: string;
  businessId: string;
  reason: string | null;
  actor: Actor;
}): Promise<RemoveReferralResult> {
  const raw = await createServiceClient();
  const reason = args.reason?.trim().slice(0, 500) || null;

  const { data, error } = await raw.rpc("remove_partner_referral", {
    p_business_id: args.businessId,
    p_partner_id: args.partnerId,
    p_actor_user_id: args.actor.id,
    p_actor_email: args.actor.email,
    p_reason: reason,
  });
  if (error) {
    if (isMissingDbObject(error.message)) throw new Error(REFERRAL_REMOVAL_MIGRATION_MESSAGE);
    throw new Error(error.message);
  }

  const result = (data ?? {}) as {
    status?: string;
    removal_id?: string | null;
    voided_commission_count?: number;
    voided_commission_cents?: number;
    paid_commission_cents?: number;
  };
  if (result.status === "not_found") {
    throw new Error("This business is not referred by this partner.");
  }
  const removalId = result.removal_id ?? null;

  // Repeat request: DB already done. Only retry Stripe if the first attempt did not finish.
  if (result.status === "already_removed") {
    let stripe: RemoveReferralResult["stripe"] = {
      status: "skipped",
      detail: "Already removed.",
      effectiveAt: null,
    };
    if (removalId) {
      const { data: row } = await raw
        .from("partner_referral_removals")
        .select("stripe_discount_status, stripe_discount_detail, stripe_discount_effective_at")
        .eq("id", removalId)
        .maybeSingle();
      if (row && (row.stripe_discount_status === "pending" || row.stripe_discount_status === "failed")) {
        const outcome = await removeStripeReferralDiscount(args.businessId);
        await recordStripeOutcome(removalId, outcome);
        await writePlatformAudit({
          actorUserId: args.actor.id,
          actorEmail: args.actor.email,
          action: "partner.referral_remove_stripe_retry",
          targetBusinessId: args.businessId,
          targetType: "partner",
          targetId: args.partnerId,
          metadata: { removal_id: removalId, stripe_status: outcome.status, detail: outcome.detail },
        });
        stripe = { status: outcome.status, detail: outcome.detail, effectiveAt: outcome.effectiveAt };
      } else if (row) {
        stripe = {
          status: (row.stripe_discount_status as "none" | "removed") ?? "skipped",
          detail: (row.stripe_discount_detail as string) ?? "Already removed.",
          effectiveAt: (row.stripe_discount_effective_at as string) ?? null,
        };
      }
    }
    return {
      status: "already_removed",
      removalId,
      voidedCommissionCount: 0,
      voidedCommissionCents: 0,
      paidCommissionCents: 0,
      stripe,
    };
  }

  const outcome = await removeStripeReferralDiscount(args.businessId);
  if (removalId) await recordStripeOutcome(removalId, outcome);

  await writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "partner.referral_remove",
    targetBusinessId: args.businessId,
    targetType: "partner",
    targetId: args.partnerId,
    metadata: {
      removal_id: removalId,
      reason,
      voided_commission_count: result.voided_commission_count ?? 0,
      voided_commission_cents: result.voided_commission_cents ?? 0,
      paid_commission_cents: result.paid_commission_cents ?? 0,
      stripe_status: outcome.status,
      stripe_detail: outcome.detail,
      stripe_effective_at: outcome.effectiveAt,
    },
  });

  return {
    status: "removed",
    removalId,
    voidedCommissionCount: result.voided_commission_count ?? 0,
    voidedCommissionCents: result.voided_commission_cents ?? 0,
    paidCommissionCents: result.paid_commission_cents ?? 0,
    stripe: { status: outcome.status, detail: outcome.detail, effectiveAt: outcome.effectiveAt },
  };
}

// ── Commission eligibility ────────────────────────────────────────────────────

export async function setPartnerCommissionEligibility(args: {
  partnerId: string;
  eligible: boolean;
  note: string | null;
  actor: Actor;
}): Promise<PartnerRow> {
  const before = await getPartnerById(args.partnerId);
  if (!before) throw new Error("Partner not found.");
  if (before.commission_eligible === undefined) {
    throw new Error(
      "Commission eligibility needs database migration v108 (supabase/migration-v108-partner-referral-management.sql)."
    );
  }
  const note = args.note?.trim().slice(0, 500) || null;
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partners")
    .update({
      commission_eligible: args.eligible,
      commission_eligibility_note: note,
      commission_eligibility_updated_at: new Date().toISOString(),
      commission_eligibility_updated_by: args.actor.id,
    })
    .eq("id", args.partnerId)
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "partner.commission_eligibility",
    targetType: "partner",
    targetId: args.partnerId,
    metadata: {
      before: isPartnerCommissionEligible(before),
      after: args.eligible,
      reason: note,
      policy: args.eligible
        ? "Commissions accrue on payments from now on. Payments made while ineligible are not back-filled."
        : "No new commissions accrue and payouts are blocked. Existing ledger rows are kept unchanged for review.",
    },
  });
  return data as PartnerRow;
}
