/**
 * Subscribe & Save — the general new-customer introductory offer ($15 off monthly / $25 off annual, first paid
 * subscription). Pure and client-safe: no DB, no Stripe, no device clock assumptions (callers
 * pass server timestamps). Server-side loading + Stripe coupons: intro-offer-server.ts.
 *
 * Rules (docs/SIGNUP-CONVERSION.md → "Subscribe & Save"):
 * - Per-interval terms live in INTRO_OFFER_TERMS. An interval without an entry (e.g. a future
 *   six-month plan) simply has no intro offer — nothing here assumes exactly two intervals.
 * - The eligibility window opens at account creation and closes when the ORIGINAL trial window
 *   ends: min(trial_ends_at, created_at + trial days). Changing paths, reopening checkout or a
 *   deferred "start my trial instead" never moves it later.
 * - Never for comped accounts, partner-referred accounts (the referral offer wins — never
 *   stacked), accounts that ever paid a ShootPortal invoice, or accounts that already redeemed it.
 * - Already-paying subscriptions never qualify. The only "active" state that qualifies is a
 *   pre-existing plan still in its Stripe trial (scheduled to bill at trial end), and only when
 *   the customer explicitly chooses to start paying now.
 */

import { DAY_MS, formatUsd, type PlanPricing } from "@/lib/trial-conversion";

/** Bump when terms change so new coupons / redemption markers don't collide with old ones. */
export const INTRO_OFFER_VERSION = "v1";

/** Subscription / Checkout Session metadata key recording which intro offer was applied. */
export const INTRO_OFFER_META_KEY = "sp_intro_offer";

/** Fallback when the plan row can't be read (matches plans.trial_days today). */
export const INTRO_OFFER_DEFAULT_WINDOW_DAYS = 14;

export type IntroOfferTerms = {
  /** Off each discounted invoice. */
  amountOffCents: number;
  /** "repeating" for N billing months, or "once" (first invoice only). */
  duration: { kind: "repeating"; months: number } | { kind: "once" };
  /** How many invoices get the discount (3 monthly invoices, or 1 annual invoice). */
  discountedInvoices: number;
};

/**
 * Terms per billing interval key (matches plan_stripe_prices.billing_interval). Add an interval
 * here to give it an intro offer; omit it to sell that interval at its normal price.
 */
export const INTRO_OFFER_TERMS: Readonly<Record<string, IntroOfferTerms>> = {
  monthly: { amountOffCents: 500, duration: { kind: "repeating", months: 3 }, discountedInvoices: 3 },
  annual: { amountOffCents: 2500, duration: { kind: "once" }, discountedInvoices: 1 },
};

export function introOfferTerms(interval: string | null | undefined): IntroOfferTerms | null {
  if (!interval) return null;
  return Object.prototype.hasOwnProperty.call(INTRO_OFFER_TERMS, interval) ? INTRO_OFFER_TERMS[interval] : null;
}

/** Total saved over the discounted invoices: monthly $5 × 3 = $15, annual $25 × 1 = $25. */
export function introOfferSavingsCents(terms: IntroOfferTerms): number {
  return terms.amountOffCents * terms.discountedInvoices;
}

/** Largest saving across intervals (annual $25). */
export function introOfferHeadlineSavingsCents(): number {
  return Math.max(0, ...Object.values(INTRO_OFFER_TERMS).map(introOfferSavingsCents));
}

/**
 * Savings for copy. With an interval: that interval's saving ("$15" monthly, "$25" annual).
 * Without: "$X" when every interval saves the same, else "up to $25" — so "save up to $25"
 * never overstates what a monthly subscriber gets.
 */
export function introOfferSavingsLabel(interval?: string): string {
  if (interval) {
    const t = introOfferTerms(interval);
    return t ? formatUsd(introOfferSavingsCents(t)) : formatUsd(0);
  }
  const all = Object.values(INTRO_OFFER_TERMS).map(introOfferSavingsCents);
  const max = introOfferHeadlineSavingsCents();
  return all.every((c) => c === max) ? formatUsd(max) : `up to ${formatUsd(max)}`;
}

/** Stable, mode-agnostic Stripe coupon id for the terms (test and live each hold their own). */
export function introOfferCouponId(interval: string, terms: IntroOfferTerms): string {
  const dur = terms.duration.kind === "once" ? "once" : `${terms.duration.months}mo`;
  return `sp_intro_${interval}_${terms.amountOffCents}_${dur}_${INTRO_OFFER_VERSION}`;
}

export function introOfferMetaValue(interval: string): string {
  return `${interval}_${INTRO_OFFER_VERSION}`;
}

// ---------------------------------------------------------------------------
// Pricing display
// ---------------------------------------------------------------------------

export type IntervalKey = "monthly" | "annual";

export type IntervalQuote = {
  interval: IntervalKey;
  /** Normal recurring charge per billing period. */
  regularCents: number;
  /** Charged today at checkout. */
  firstChargeCents: number;
  /** Per-invoice price during the intro period (= regular when no offer). */
  introChargeCents: number;
  /** Invoices at the intro price (0 = no offer). */
  introInvoices: number;
  savingsCents: number;
  /** "$24/month for your first 3 months, then $29/month" */
  summary: string;
  /** "Then $29/month starting with your 4th month" / "Renews at $288/year" */
  renewal: string;
  periodWord: "month" | "year";
};

function periodWord(interval: IntervalKey): "month" | "year" {
  return interval === "annual" ? "year" : "month";
}

/** A per-invoice discount for N invoices (intro offer, or a partner referral discount). */
export type DiscountTerms = { amountOffCents: number; invoices: number };

/** Quote for one interval with an optional discount. `regularCents` = full period charge. */
export function quoteWithDiscount(
  interval: IntervalKey,
  regularCents: number,
  discount: DiscountTerms | null
): IntervalQuote {
  const word = periodWord(interval);
  if (!discount || discount.amountOffCents <= 0 || discount.invoices <= 0 || regularCents <= 0) {
    return {
      interval,
      regularCents,
      firstChargeCents: regularCents,
      introChargeCents: regularCents,
      introInvoices: 0,
      savingsCents: 0,
      summary: `${formatUsd(regularCents)}/${word}`,
      renewal: interval === "annual" ? `Renews at ${formatUsd(regularCents)}/year` : `${formatUsd(regularCents)} every month`,
      periodWord: word,
    };
  }
  const intro = Math.max(0, regularCents - discount.amountOffCents);
  const n = discount.invoices;
  const summary =
    interval === "annual"
      ? `${formatUsd(intro)} for your first year, then ${formatUsd(regularCents)}/year`
      : n === 1
        ? `${formatUsd(intro)} for your first month, then ${formatUsd(regularCents)}/month`
        : `${formatUsd(intro)}/month for your first ${n} months, then ${formatUsd(regularCents)}/month`;
  const renewal =
    interval === "annual"
      ? `Renews at ${formatUsd(regularCents)}/year`
      : `Then ${formatUsd(regularCents)}/month from month ${n + 1}`;
  return {
    interval,
    regularCents,
    firstChargeCents: intro,
    introChargeCents: intro,
    introInvoices: n,
    savingsCents: (regularCents - intro) * n,
    summary,
    renewal,
    periodWord: word,
  };
}

/** Quote for one interval, with or without the intro offer. */
export function quoteInterval(interval: IntervalKey, regularCents: number, withIntro: boolean): IntervalQuote {
  const terms = withIntro ? introOfferTerms(interval) : null;
  return quoteWithDiscount(
    interval,
    regularCents,
    terms ? { amountOffCents: terms.amountOffCents, invoices: terms.discountedInvoices } : null
  );
}

/** Which offer a price list reflects. Exactly one — offers never stack. */
export type OfferKind = "intro" | "referral" | "none";

export type OfferDisplay = {
  kind: OfferKind;
  quotes: Partial<Record<IntervalKey, IntervalQuote>>;
  /** Intro only: when the offer window closes (server time). */
  endsAt: string | null;
};

/** Both public intervals from the plans row (annual = price_annual_cents × 12). */
export function quotePlan(pricing: PlanPricing, withIntro: boolean): Partial<Record<IntervalKey, IntervalQuote>> {
  const out: Partial<Record<IntervalKey, IntervalQuote>> = {};
  if (pricing.monthlyCents != null) out.monthly = quoteInterval("monthly", pricing.monthlyCents, withIntro);
  if (pricing.annualPerMonthCents != null) out.annual = quoteInterval("annual", pricing.annualPerMonthCents * 12, withIntro);
  return out;
}

// ---------------------------------------------------------------------------
// Eligibility window + decision
// ---------------------------------------------------------------------------

/**
 * End of the intro window: the ORIGINAL trial end. created_at + trial days caps it so a later
 * deferred trial (Subscribe Now → "start my free trial instead") can't move it.
 */
export function introOfferWindowEndsAt(input: {
  created_at: string | null | undefined;
  trial_ends_at: string | null | undefined;
  windowDays?: number;
}): string | null {
  const days = input.windowDays && input.windowDays > 0 ? input.windowDays : INTRO_OFFER_DEFAULT_WINDOW_DAYS;
  const created = input.created_at ? new Date(input.created_at).getTime() : NaN;
  const trialEnd = input.trial_ends_at ? new Date(input.trial_ends_at).getTime() : NaN;
  const fromCreated = Number.isFinite(created) ? created + days * DAY_MS : NaN;
  const candidates = [fromCreated, trialEnd].filter((v) => Number.isFinite(v));
  if (candidates.length === 0) return null;
  return new Date(Math.min(...candidates)).toISOString();
}

export type IntroOfferInput = {
  subscription_status: string | null | undefined;
  trial_ends_at: string | null | undefined;
  created_at: string | null | undefined;
  /** plans.trial_days (window length for accounts that never had a trial). */
  windowDays?: number;
  /** Any partner attribution (partner_referrals row) — referral pricing wins, never stacked. */
  referred: boolean;
  /** Paid ShootPortal invoices on record (amount > 0). -1 / null = unknown ⇒ not eligible. */
  paidInvoiceCount: number | null;
  /** Redemption already recorded (journey / subscription metadata). */
  redeemed: boolean;
  /**
   * The business's live Stripe subscription, if any. A `trialing` one is a pre-existing plan
   * scheduled for trial end (eligible only for voluntary early start); any other live status
   * means they already pay.
   */
  liveSubscription?: { status: string; hasDiscount: boolean } | null;
};

export type IntroOfferKind =
  /** No live subscription: new checkout, charged today. */
  | "checkout"
  /** Pre-existing plan in its Stripe trial: start it now at the intro price. */
  | "start_scheduled_now";

export type IntroOfferDecision =
  | { eligible: true; kind: IntroOfferKind; endsAt: string; msRemaining: number }
  | { eligible: false; reason: IntroOfferIneligibleReason; endsAt: string | null };

export type IntroOfferIneligibleReason =
  | "comped"
  | "referred"
  | "redeemed"
  | "paid_before"
  | "unknown_history"
  | "already_subscribed"
  | "existing_discount"
  | "status"
  | "no_window"
  | "expired";

export function decideIntroOffer(input: IntroOfferInput, now: Date = new Date()): IntroOfferDecision {
  const endsAt = introOfferWindowEndsAt(input);
  const no = (reason: IntroOfferIneligibleReason): IntroOfferDecision => ({ eligible: false, reason, endsAt });
  const status = input.subscription_status ?? "";

  if (status === "comped") return no("comped");
  if (input.referred) return no("referred");
  if (input.redeemed) return no("redeemed");
  if (input.paidInvoiceCount == null || input.paidInvoiceCount < 0) return no("unknown_history");
  if (input.paidInvoiceCount > 0) return no("paid_before");

  const live = input.liveSubscription ?? null;
  let kind: IntroOfferKind;
  if (live) {
    if (live.status !== "trialing") return no("already_subscribed");
    // A scheduled plan that already carries a discount keeps it — offers never stack.
    if (live.hasDiscount) return no("existing_discount");
    kind = "start_scheduled_now";
  } else {
    // Live trial, or a Subscribe Now account that hasn't paid yet. Not canceled / past_due.
    const awaitingFirst = status === "trial_expired" && !input.trial_ends_at;
    if (status !== "trialing" && !awaitingFirst) return no("status");
    kind = "checkout";
  }

  if (!endsAt) return no("no_window");
  const msRemaining = new Date(endsAt).getTime() - now.getTime();
  if (msRemaining <= 0) return no("expired");
  return { eligible: true, kind, endsAt, msRemaining };
}

/** Request-time clock for server components (one reading per render, passed down). */
export function requestNowMs(): number {
  return Date.now();
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

/** "6 days" / "1 day" / "5 hours" — rounded up so "ends in 1 day" never means "already ended". */
export function introCountdownLabel(msRemaining: number): string {
  if (msRemaining <= 0) return "0 hours";
  const hours = msRemaining / (60 * 60 * 1000);
  if (hours < 24) {
    const h = Math.max(1, Math.ceil(hours));
    return `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.ceil(msRemaining / DAY_MS);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** Banner / dashboard line. Urgent from 3 days out. */
export function introOfferPromptCopy(msRemaining: number): { headline: string; urgent: boolean } {
  const save = introOfferSavingsLabel();
  const urgent = msRemaining <= 3 * DAY_MS;
  return urgent
    ? {
        headline: `Your free trial ends in ${introCountdownLabel(msRemaining)}. Subscribe now to save ${save} on your first subscription.`,
        urgent,
      }
    : { headline: `Enjoying ShootPortal? Subscribe before your trial ends and save ${save}!`, urgent };
}
