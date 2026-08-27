/**
 * Partner commission ledger (phase 3).
 *
 * APPEND-ONLY: never mutate amount/rate/kind. Reversals are new negative rows.
 * RATE SNAPSHOT on each row. Payability = payable_at <= now() (no cron status).
 *
 * Policy: a SUSPENDED partner earns nothing on NEW payments; existing commission
 * rows are untouched. This is intentional — suspend stops future earnings, not history.
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode } from "@/lib/stripe";
import { getSubscriptionState } from "@/lib/subscription";
import { PARTNER_COMMISSION_HOLD_DAYS } from "@/lib/partner-payout-constants";

export { PARTNER_COMMISSION_HOLD_DAYS };

export type PartnerCommissionKind = "commission" | "reversal" | "adjustment";

export type PartnerCommissionRow = {
  id: string;
  partner_id: string;
  business_id: string | null;
  subscription_payment_id: string | null;
  kind: PartnerCommissionKind;
  commission_rate_pct: number;
  source_amount_cents: number;
  amount_cents: number;
  currency: string;
  stripe_mode: string;
  reverses_commission_id: string | null;
  stripe_event_id: string | null;
  stripe_refund_id: string | null;
  payable_at: string | null;
  payout_id: string | null;
  note: string | null;
  created_by: string | null;
  earned_at: string;
  created_at: string;
};

export type PartnerBalance = {
  partnerId: string;
  lifetimeEarnedCents: number;
  reversedCents: number;
  /** Net of earned + reversals + adjustments (all modes filtered by stripeMode). */
  netCents: number;
  pendingCents: number;
  /**
   * Unpaid open balance past the hold (commissions past payable_at + unpaid
   * reversals/adjustments). May be NEGATIVE when refunds exceed new earnings.
   */
  openNetCents: number;
  /** max(0, openNetCents) — amount available to pay out. */
  payableCents: number;
  paidCents: number;
  /** Sum of commissions on the most recent payment per active referred business. */
  recurringMonthlyEstimateCents: number;
  currency: string;
  stripeMode: "test" | "live";
};

function roundCommissionCents(sourceAmountCents: number, ratePct: number): number {
  return Math.round((sourceAmountCents * ratePct) / 100);
}

function addHoldDays(earnedAt: Date, days = PARTNER_COMMISSION_HOLD_DAYS): Date {
  return new Date(earnedAt.getTime() + days * 24 * 60 * 60 * 1000);
}

/**
 * True when the referred business is owned by the same person as the partner
 * (user_id match or case-insensitive email match against any business admin).
 */
async function isSelfReferralBusiness(args: {
  businessId: string;
  partnerUserId: string | null;
  partnerEmail: string;
}): Promise<"user_id" | "email" | null> {
  const raw = await createServiceClient();
  const partnerEmail = args.partnerEmail.trim().toLowerCase();

  const { data: admins } = await raw
    .from("profiles")
    .select("id, email")
    .eq("business_id", args.businessId)
    .eq("role", "admin");

  for (const admin of admins ?? []) {
    if (args.partnerUserId && admin.id === args.partnerUserId) return "user_id";
    const adminEmail = String(admin.email || "")
      .trim()
      .toLowerCase();
    if (partnerEmail && adminEmail && partnerEmail === adminEmail) return "email";
  }
  return null;
}

/**
 * Create a commission for a newly inserted platform_subscription_payments row.
 * Never throws to callers that must keep the webhook green — catch at call site
 * preferred; this also swallows unique conflicts as success-no-op.
 */
export async function maybeCreateCommissionForPayment(args: {
  paymentId: string;
  businessId: string;
  amountPaidCents: number;
  currency: string;
  stripeMode: "test" | "live";
  paidAt: string;
  stripeEventId?: string | null;
}): Promise<{ created: boolean; reason?: string; commissionId?: string }> {
  if (process.env.PARTNER_COMMISSION_FORCE_FAIL === "1") {
    throw new Error("Forced partner commission failure (verification).");
  }

  // stripe_mode must match the active deploy key — never write live commissions from test webhooks.
  const deployMode = getStripeMode();
  if (args.stripeMode !== deployMode) {
    return {
      created: false,
      reason: `stripe_mode_mismatch:payment=${args.stripeMode},deploy=${deployMode}`,
    };
  }

  const raw = await createServiceClient();

  // Explicit comped guard — recordPlatformSubscriptionPayment already skips, but
  // never allow a future caller to create commissions for comped tenants.
  const { data: biz } = await raw
    .from("businesses")
    .select(
      "id, subscription_status, trial_ends_at, comped_until, comped_reason, subscription_current_period_end, subscription_cancel_at_period_end"
    )
    .eq("id", args.businessId)
    .maybeSingle();
  if (biz && getSubscriptionState(biz).isComped) {
    return { created: false, reason: "business_comped" };
  }
  if (args.amountPaidCents <= 0) {
    return { created: false, reason: "zero_amount" };
  }

  const { data: referral } = await raw
    .from("partner_referrals")
    .select("partner_id")
    .eq("business_id", args.businessId)
    .maybeSingle();
  if (!referral?.partner_id) {
    return { created: false, reason: "no_referral" };
  }

  const { data: partner } = await raw
    .from("partners")
    .select("id, status, commission_rate_pct, user_id, email")
    .eq("id", referral.partner_id)
    .maybeSingle();
  if (!partner) {
    return { created: false, reason: "partner_missing" };
  }
  // Policy: suspended partners earn nothing on NEW payments; existing rows stay.
  if (partner.status !== "active") {
    return { created: false, reason: "partner_suspended" };
  }

  // Self-referral guard (money-critical): never commission a business owned by the partner.
  // Discount may still apply via partner_referrals — we do not punish the customer.
  const selfBlocked = await isSelfReferralBusiness({
    businessId: args.businessId,
    partnerUserId: partner.user_id as string | null,
    partnerEmail: partner.email as string,
  });
  if (selfBlocked) {
    console.warn("[partner-commissions] self-referral blocked", {
      businessId: args.businessId,
      partnerId: partner.id,
      paymentId: args.paymentId,
      match: selfBlocked,
    });
    return { created: false, reason: `self_referral_blocked:${selfBlocked}` };
  }

  const rate = Number(partner.commission_rate_pct);
  if (!Number.isFinite(rate) || rate < 0) {
    return { created: false, reason: "invalid_rate" };
  }

  const amountCents = roundCommissionCents(args.amountPaidCents, rate);
  const earnedAt = new Date(args.paidAt);
  const payableAt = addHoldDays(earnedAt);

  const { data, error } = await raw
    .from("partner_commissions")
    .insert({
      partner_id: partner.id,
      business_id: args.businessId,
      subscription_payment_id: args.paymentId,
      kind: "commission",
      commission_rate_pct: rate,
      source_amount_cents: args.amountPaidCents,
      amount_cents: amountCents,
      currency: (args.currency || "usd").toLowerCase(),
      stripe_mode: args.stripeMode,
      stripe_event_id: args.stripeEventId ?? null,
      payable_at: payableAt.toISOString(),
      earned_at: earnedAt.toISOString(),
    })
    .select("id")
    .maybeSingle();

  if (error) {
    // Unique on subscription_payment_id WHERE kind=commission — retry / race.
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { created: false, reason: "already_commissioned" };
    }
    throw new Error(error.message);
  }
  if (!data?.id) {
    return { created: false, reason: "insert_empty" };
  }
  return { created: true, commissionId: data.id as string };
}

/**
 * Resolve Stripe invoice id from a Charge after Basil (2025-03-31+):
 * charge.invoice is often absent — use PaymentIntent → invoicePayments.list.
 */
export async function resolveInvoiceIdFromCharge(
  charge: Stripe.Charge
): Promise<string | null> {
  // Legacy API versions exposed charge.invoice; Basil+ often omits it — fall through
  // to PaymentIntent → invoicePayments.
  const legacyInvoice = (charge as Stripe.Charge & { invoice?: string | { id?: string } | null })
    .invoice;
  if (typeof legacyInvoice === "string" && legacyInvoice) return legacyInvoice;
  if (
    legacyInvoice &&
    typeof legacyInvoice === "object" &&
    typeof legacyInvoice.id === "string"
  ) {
    return legacyInvoice.id;
  }

  const pi =
    typeof charge.payment_intent === "string"
      ? charge.payment_intent
      : charge.payment_intent && typeof charge.payment_intent === "object"
        ? charge.payment_intent.id
        : null;
  if (!pi) return null;

  const { stripe } = getStripe();
  const listed = await stripe.invoicePayments.list({
    payment: { type: "payment_intent", payment_intent: pi },
    limit: 5,
  });
  const first = listed.data[0];
  if (!first) return null;
  const inv = first.invoice;
  if (typeof inv === "string") return inv;
  if (inv && typeof inv === "object" && "id" in inv) return (inv as { id: string }).id;
  return null;
}

function latestRefundFromCharge(charge: Stripe.Charge): Stripe.Refund | null {
  const list = charge.refunds?.data;
  if (list && list.length > 0) return list[0] ?? null;
  return null;
}

/**
 * Append a proportional reversal for a Stripe refund.
 * Uses the ORIGINAL snapshotted rate. Never mutates the commission row.
 * If already paid out (payout_id set), the negative balance carries to the next
 * payout — no clawback in V1.
 */
export async function maybeReverseCommissionForRefund(args: {
  stripeInvoiceId: string;
  refundId: string;
  refundAmountCents: number;
  stripeEventId?: string | null;
}): Promise<{ created: boolean; reason?: string; reversalId?: string }> {
  if (process.env.PARTNER_COMMISSION_FORCE_FAIL === "1") {
    throw new Error("Forced partner commission failure (verification).");
  }
  if (args.refundAmountCents <= 0) {
    return { created: false, reason: "zero_refund" };
  }

  const raw = await createServiceClient();
  const { data: payment } = await raw
    .from("platform_subscription_payments")
    .select("id, amount_paid_cents, currency, stripe_mode, business_id")
    .eq("stripe_invoice_id", args.stripeInvoiceId)
    .maybeSingle();
  if (!payment) {
    return { created: false, reason: "payment_not_found" };
  }

  const deployMode = getStripeMode();
  if (payment.stripe_mode !== deployMode) {
    return { created: false, reason: "stripe_mode_mismatch" };
  }

  const { data: commission } = await raw
    .from("partner_commissions")
    .select("*")
    .eq("subscription_payment_id", payment.id)
    .eq("kind", "commission")
    .maybeSingle();
  if (!commission) {
    return { created: false, reason: "no_commission" };
  }

  const rate = Number(commission.commission_rate_pct);
  let reverseCents = roundCommissionCents(args.refundAmountCents, rate);

  // Cap so cumulative reversals never exceed the original commission.
  const { data: priorReversals } = await raw
    .from("partner_commissions")
    .select("amount_cents")
    .eq("reverses_commission_id", commission.id)
    .eq("kind", "reversal");
  const alreadyReversed = (priorReversals ?? []).reduce(
    (sum, r) => sum + Math.abs(typeof r.amount_cents === "number" ? r.amount_cents : 0),
    0
  );
  const remaining = Math.max(0, (commission.amount_cents as number) - alreadyReversed);
  reverseCents = Math.min(reverseCents, remaining);
  if (reverseCents <= 0) {
    return { created: false, reason: "fully_reversed" };
  }

  const earnedAt = new Date().toISOString();
  const { data, error } = await raw
    .from("partner_commissions")
    .insert({
      partner_id: commission.partner_id,
      business_id: commission.business_id,
      subscription_payment_id: payment.id,
      kind: "reversal",
      commission_rate_pct: rate,
      source_amount_cents: args.refundAmountCents,
      amount_cents: -reverseCents,
      currency: commission.currency,
      stripe_mode: commission.stripe_mode,
      reverses_commission_id: commission.id,
      stripe_event_id: args.stripeEventId ?? null,
      stripe_refund_id: args.refundId,
      payable_at: null,
      earned_at: earnedAt,
      note:
        commission.payout_id != null
          ? "Reversal after payout — negative balance carries to next payout (no clawback in V1)."
          : null,
    })
    .select("id")
    .maybeSingle();

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { created: false, reason: "already_reversed" };
    }
    throw new Error(error.message);
  }
  return { created: Boolean(data?.id), reversalId: data?.id as string | undefined };
}

/** Full remaining reversal for invoice.voided (no Stripe refund id). */
export async function maybeReverseCommissionForVoid(args: {
  stripeInvoiceId: string;
  stripeEventId?: string | null;
}): Promise<{ created: boolean; reason?: string }> {
  if (process.env.PARTNER_COMMISSION_FORCE_FAIL === "1") {
    throw new Error("Forced partner commission failure (verification).");
  }

  const raw = await createServiceClient();
  const { data: payment } = await raw
    .from("platform_subscription_payments")
    .select("id, amount_paid_cents, stripe_mode")
    .eq("stripe_invoice_id", args.stripeInvoiceId)
    .maybeSingle();
  if (!payment) return { created: false, reason: "payment_not_found" };

  if (payment.stripe_mode !== getStripeMode()) {
    return { created: false, reason: "stripe_mode_mismatch" };
  }

  const { data: commission } = await raw
    .from("partner_commissions")
    .select("*")
    .eq("subscription_payment_id", payment.id)
    .eq("kind", "commission")
    .maybeSingle();
  if (!commission) return { created: false, reason: "no_commission" };

  const { data: priorReversals } = await raw
    .from("partner_commissions")
    .select("amount_cents")
    .eq("reverses_commission_id", commission.id)
    .eq("kind", "reversal");
  const alreadyReversed = (priorReversals ?? []).reduce(
    (sum, r) => sum + Math.abs(typeof r.amount_cents === "number" ? r.amount_cents : 0),
    0
  );
  const remaining = Math.max(0, (commission.amount_cents as number) - alreadyReversed);
  if (remaining <= 0) return { created: false, reason: "fully_reversed" };

  const earnedAt = new Date().toISOString();
  const { error } = await raw.from("partner_commissions").insert({
    partner_id: commission.partner_id,
    business_id: commission.business_id,
    subscription_payment_id: payment.id,
    kind: "reversal",
    commission_rate_pct: commission.commission_rate_pct,
    source_amount_cents: payment.amount_paid_cents,
    amount_cents: -remaining,
    currency: commission.currency,
    stripe_mode: commission.stripe_mode,
    reverses_commission_id: commission.id,
    stripe_event_id: args.stripeEventId ?? null,
    stripe_refund_id: null,
    payable_at: null,
    earned_at: earnedAt,
    note: "invoice.voided — full remaining reversal",
  });

  if (error) {
    if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
      return { created: false, reason: "already_reversed" };
    }
    throw new Error(error.message);
  }
  return { created: true };
}

export async function handleChargeRefundedCommission(
  charge: Stripe.Charge,
  stripeEventId: string
): Promise<{ created: boolean; reason?: string }> {
  const refund = latestRefundFromCharge(charge);
  if (!refund?.id) {
    return { created: false, reason: "no_refund_on_charge" };
  }
  const invoiceId = await resolveInvoiceIdFromCharge(charge);
  if (!invoiceId) {
    return { created: false, reason: "invoice_unresolved" };
  }
  return maybeReverseCommissionForRefund({
    stripeInvoiceId: invoiceId,
    refundId: refund.id,
    refundAmountCents: typeof refund.amount === "number" ? refund.amount : 0,
    stripeEventId,
  });
}

/**
 * Ledger-derived partner balance. Never cached.
 * pending = unpaid commissions with payable_at > now
 * openNet = unpaid commissions past hold + unpaid reversals/adjustments (may be negative)
 * payable = max(0, openNet)
 * paid = sum of all ledger rows stamped with payout_id (matches payout totals)
 */
export async function computePartnerBalance(
  partnerId: string,
  stripeMode: "test" | "live" = getStripeMode()
): Promise<PartnerBalance> {
  const raw = await createServiceClient();
  const { data: rows, error } = await raw
    .from("partner_commissions")
    .select("*")
    .eq("partner_id", partnerId)
    .eq("stripe_mode", stripeMode);
  if (error) throw new Error(error.message);

  const list = (rows ?? []) as PartnerCommissionRow[];
  const now = Date.now();

  let lifetimeEarnedCents = 0;
  let reversedCents = 0;
  let netCents = 0;
  let pendingCents = 0;
  let paidCents = 0;
  let currency = "usd";

  for (const row of list) {
    currency = row.currency || currency;
    netCents += row.amount_cents;
    // Paid = sum of every ledger row stamped onto a payout (matches payout totals).
    if (row.payout_id) paidCents += row.amount_cents;
    if (row.kind === "commission") {
      lifetimeEarnedCents += row.amount_cents;
      if (!row.payout_id) {
        const payableAt = row.payable_at ? new Date(row.payable_at).getTime() : 0;
        if (payableAt > now) pendingCents += row.amount_cents;
      }
    } else if (row.kind === "reversal") {
      reversedCents += Math.abs(row.amount_cents);
    }
  }

  // Recurring estimate: most recent commission per referred business (active partner referrals).
  const { data: referrals } = await raw
    .from("partner_referrals")
    .select("business_id")
    .eq("partner_id", partnerId);
  const businessIds = (referrals ?? []).map((r) => r.business_id as string).filter(Boolean);

  let recurringMonthlyEstimateCents = 0;
  if (businessIds.length) {
    const { data: activeBiz } = await raw
      .from("businesses")
      .select("id, deleted_at, subscription_status")
      .in("id", businessIds);
    const activeIds = new Set(
      (activeBiz ?? [])
        .filter((b) => !b.deleted_at && b.subscription_status === "active")
        .map((b) => b.id as string)
    );
    const byBusiness = new Map<string, PartnerCommissionRow>();
    for (const row of list) {
      if (row.kind !== "commission" || !row.business_id || !activeIds.has(row.business_id)) continue;
      const prev = byBusiness.get(row.business_id);
      if (!prev || new Date(row.earned_at) > new Date(prev.earned_at)) {
        byBusiness.set(row.business_id, row);
      }
    }
    for (const row of byBusiness.values()) {
      recurringMonthlyEstimateCents += row.amount_cents;
    }
  }

  // Net payable after reversals: sum of unpaid commission amounts + unpaid reversals
  // (reversals have payout_id null). This is the true next-payout figure (may be negative).
  let openNetCents = 0;
  for (const row of list) {
    if (row.payout_id) continue;
    if (row.kind === "commission") {
      const payableAt = row.payable_at ? new Date(row.payable_at).getTime() : 0;
      if (payableAt <= now) openNetCents += row.amount_cents;
    } else if (row.kind === "reversal" || row.kind === "adjustment") {
      openNetCents += row.amount_cents;
    }
  }
  const payableCents = Math.max(0, openNetCents);

  return {
    partnerId,
    lifetimeEarnedCents,
    reversedCents,
    netCents,
    pendingCents,
    openNetCents,
    payableCents,
    paidCents,
    recurringMonthlyEstimateCents,
    currency,
    stripeMode,
  };
}
