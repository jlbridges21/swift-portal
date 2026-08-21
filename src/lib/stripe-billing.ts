/**
 * ShootPortal SaaS billing on the PLATFORM Stripe account.
 *
 * NEVER pass stripeAccount / Stripe-Account header here.
 * Connect client payments live in stripe-connect.ts / stripe-payments.ts.
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode, type StripeMode } from "@/lib/stripe";
import {
  shouldApplyStripeSubscriptionUpdate,
  type SubscriptionStatus,
} from "@/lib/subscription";

export const SHOOTPORTAL_BILLING_META_KEY = "shootportal_billing";
export const SHOOTPORTAL_BILLING_META_VALUE = "true";

export type BillingInterval = "monthly" | "annual";

export type BillingBusinessRow = {
  id: string;
  name: string;
  slug: string;
  custom_domain: string | null;
  plan: string;
  subscription_status: string;
  trial_ends_at: string | null;
  comped_until: string | null;
  comped_reason: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_customer_id_test: string | null;
  stripe_customer_id_live: string | null;
  stripe_subscription_id_test: string | null;
  stripe_subscription_id_live: string | null;
  billing_email: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
};

export type PlanBillingRow = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
  is_active: boolean;
  is_public: boolean;
};

export type PlanPriceForMode = {
  plan: PlanBillingRow;
  stripe_product_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_annual_id: string | null;
};

export class BillingConfigError extends Error {
  constructor(
    message: string,
    public readonly details: Record<string, unknown>
  ) {
    super(message);
    this.name = "BillingConfigError";
  }
}

export function isShootPortalBillingMetadata(
  metadata: Stripe.Metadata | null | undefined
): boolean {
  if (!metadata) return false;
  return metadata[SHOOTPORTAL_BILLING_META_KEY] === SHOOTPORTAL_BILLING_META_VALUE;
}

export function billingMetadata(businessId: string): Record<string, string> {
  return {
    business_id: businessId,
    [SHOOTPORTAL_BILLING_META_KEY]: SHOOTPORTAL_BILLING_META_VALUE,
  };
}

function customerColumn(mode: StripeMode): "stripe_customer_id_test" | "stripe_customer_id_live" {
  return mode === "live" ? "stripe_customer_id_live" : "stripe_customer_id_test";
}

function subscriptionColumn(
  mode: StripeMode
): "stripe_subscription_id_test" | "stripe_subscription_id_live" {
  return mode === "live" ? "stripe_subscription_id_live" : "stripe_subscription_id_test";
}

/** Prefer mode-specific id; fall back to legacy mirror column. */
export function customerIdForMode(
  business: BillingBusinessRow,
  mode: StripeMode = getStripeMode()
): string | null {
  const modeSpecific =
    mode === "live" ? business.stripe_customer_id_live : business.stripe_customer_id_test;
  return modeSpecific || business.stripe_customer_id || null;
}

export function subscriptionIdForMode(
  business: BillingBusinessRow,
  mode: StripeMode = getStripeMode()
): string | null {
  const modeSpecific =
    mode === "live"
      ? business.stripe_subscription_id_live
      : business.stripe_subscription_id_test;
  return modeSpecific || business.stripe_subscription_id || null;
}

/** Invoice subscription id — API 2026 uses parent.subscription_details. */
export function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const parent = invoice.parent;
  if (parent?.type === "subscription_details" && parent.subscription_details) {
    const sub = parent.subscription_details.subscription;
    if (typeof sub === "string") return sub;
    if (sub && typeof sub === "object" && "id" in sub) return sub.id;
  }
  const legacy = (invoice as { subscription?: string | Stripe.Subscription | null }).subscription;
  if (typeof legacy === "string") return legacy;
  if (legacy && typeof legacy === "object" && "id" in legacy) return legacy.id;
  return null;
}

export function invoiceSubscriptionMetadata(
  invoice: Stripe.Invoice
): Stripe.Metadata | null {
  const details = invoice.parent?.subscription_details;
  if (details?.metadata) return details.metadata;
  return invoice.metadata ?? null;
}

export function isShootPortalBillingInvoiceSignals(options: {
  hasSubscription: boolean;
  metadataLooksBilling: boolean;
  customerMatchesBusinessBillingCustomer: boolean;
}): boolean {
  if (!options.hasSubscription) return false;
  return options.metadataLooksBilling || options.customerMatchesBusinessBillingCustomer;
}

export function subscriptionCurrentPeriodEndUnix(
  subscription: Stripe.Subscription
): number | null {
  const items = subscription.items?.data ?? [];
  let max = 0;
  for (const item of items) {
    const end = item.current_period_end;
    if (typeof end === "number" && end > max) max = end;
  }
  const legacy = (subscription as { current_period_end?: number }).current_period_end;
  if (typeof legacy === "number" && legacy > max) max = legacy;
  return max > 0 ? max : null;
}

export function mapStripeSubscriptionStatus(
  status: Stripe.Subscription.Status
): SubscriptionStatus | null {
  switch (status) {
    case "active":
    case "trialing":
      return "active";
    case "past_due":
    case "unpaid":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
    case "paused":
      return null;
    default:
      return null;
  }
}

function isStripeModeMismatchError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    /similar object exists in (test|live) mode/i.test(message) ||
    /No such customer/i.test(message)
  );
}

export async function loadBillingBusiness(
  businessId: string
): Promise<BillingBusinessRow | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, custom_domain, plan, subscription_status, trial_ends_at, comped_until, comped_reason, stripe_customer_id, stripe_subscription_id, stripe_customer_id_test, stripe_customer_id_live, stripe_subscription_id_test, stripe_subscription_id_live, billing_email, subscription_current_period_end, subscription_cancel_at_period_end"
    )
    .eq("id", businessId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BillingBusinessRow | null) ?? null;
}

export async function findBusinessIdByStripeCustomerId(
  customerId: string
): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select("id")
    .or(
      `stripe_customer_id.eq.${customerId},stripe_customer_id_test.eq.${customerId},stripe_customer_id_live.eq.${customerId}`
    )
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

async function loadModePriceRows(
  planId: string,
  mode: StripeMode
): Promise<{ monthly: string | null; annual: string | null; product: string | null }> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("plan_stripe_prices")
    .select("billing_interval, stripe_product_id, stripe_price_id")
    .eq("plan_id", planId)
    .eq("mode", mode);
  if (error) throw new Error(error.message);

  let monthly: string | null = null;
  let annual: string | null = null;
  let product: string | null = null;
  for (const row of data ?? []) {
    product = row.stripe_product_id ?? product;
    if (row.billing_interval === "monthly") monthly = row.stripe_price_id;
    if (row.billing_interval === "annual") annual = row.stripe_price_id;
  }
  return { monthly, annual, product };
}

export async function loadPlanPriceForMode(
  planKey: string,
  mode: StripeMode = getStripeMode()
): Promise<PlanPriceForMode | null> {
  const supabase = await createServiceClient();
  const { data: plan, error } = await supabase
    .from("plans")
    .select(
      "id, key, name, description, price_monthly_cents, price_annual_cents, is_active, is_public"
    )
    .eq("key", planKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!plan) return null;

  const prices = await loadModePriceRows(plan.id, mode);
  return {
    plan: plan as PlanBillingRow,
    stripe_product_id: prices.product,
    stripe_price_monthly_id: prices.monthly,
    stripe_price_annual_id: prices.annual,
  };
}

export async function listPublicPlansWithModePrices(
  mode: StripeMode = getStripeMode()
): Promise<
  Array<
    PlanBillingRow & {
      stripe_price_monthly_id: string | null;
      stripe_price_annual_id: string | null;
      display_order: number;
    }
  >
> {
  const supabase = await createServiceClient();
  const { data: plans, error } = await supabase
    .from("plans")
    .select(
      "id, key, name, description, price_monthly_cents, price_annual_cents, is_active, is_public, display_order"
    )
    .eq("is_active", true)
    .eq("is_public", true)
    .order("display_order", { ascending: true });
  if (error) throw new Error(error.message);

  const rows = [];
  for (const plan of plans ?? []) {
    if (plan.key === "founding") continue;
    const prices = await loadModePriceRows(plan.id, mode);
    rows.push({
      ...(plan as PlanBillingRow & { display_order: number }),
      stripe_price_monthly_id: prices.monthly,
      stripe_price_annual_id: prices.annual,
    });
  }
  return rows;
}

export async function resolvePriceIdForCheckout(options: {
  planKey: string;
  interval: BillingInterval;
  mode?: StripeMode;
}): Promise<{ priceId: string; planName: string; mode: StripeMode }> {
  const mode = options.mode ?? getStripeMode();
  const loaded = await loadPlanPriceForMode(options.planKey, mode);
  if (!loaded || !loaded.plan.is_active || !loaded.plan.is_public) {
    throw new BillingConfigError("Plan is not available.", {
      mode,
      planKey: options.planKey,
      interval: options.interval,
      missing: "plan",
    });
  }

  const priceId =
    options.interval === "annual"
      ? loaded.stripe_price_annual_id
      : loaded.stripe_price_monthly_id;

  if (!priceId) {
    const envLabel = mode === "live" ? "live" : "test";
    throw new BillingConfigError(
      `Billing is not configured for this environment (no ${envLabel} price for the ${loaded.plan.name} plan). Run the setup script with ${envLabel} keys.`,
      {
        mode,
        planKey: options.planKey,
        planName: loaded.plan.name,
        interval: options.interval,
        missing: options.interval === "annual" ? "stripe_price_annual_id" : "stripe_price_monthly_id",
      }
    );
  }

  return { priceId, planName: loaded.plan.name, mode };
}

export async function findPlanKeyByStripePriceId(
  priceId: string
): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("plan_stripe_prices")
    .select("plan_id")
    .eq("stripe_price_id", priceId)
    .maybeSingle();

  if (!error && data?.plan_id) {
    const { data: plan, error: planErr } = await supabase
      .from("plans")
      .select("key")
      .eq("id", data.plan_id)
      .maybeSingle();
    if (planErr) throw new Error(planErr.message);
    if (plan?.key) return plan.key;
  }

  // Fallback to legacy columns while both paths exist.
  const legacy = await supabase
    .from("plans")
    .select("key")
    .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_annual_id.eq.${priceId}`)
    .maybeSingle();
  if (legacy.error) throw new Error(legacy.error.message);
  return legacy.data?.key ?? null;
}

/**
 * Resolve business from metadata.business_id, cross-check stripe_customer_id.
 * On mismatch: log both and write nothing (mirrors resolvePaymentAttribution).
 */
export async function resolveBillingBusinessAttribution(options: {
  metadata?: Stripe.Metadata | null;
  customerId?: string | null;
  source: string;
}): Promise<
  | { ok: true; business: BillingBusinessRow }
  | {
      ok: false;
      reason: string;
      metadataBusinessId: string | null;
      customerId: string | null;
      customerBusinessId: string | null;
    }
> {
  const metadataBusinessId = options.metadata?.business_id?.trim() || null;
  const customerId =
    typeof options.customerId === "string" && options.customerId
      ? options.customerId
      : null;

  if (!metadataBusinessId) {
    console.error("[stripe-billing] attribution failed — missing metadata.business_id", {
      source: options.source,
      customerId,
    });
    return {
      ok: false,
      reason: "missing_metadata_business_id",
      metadataBusinessId: null,
      customerId,
      customerBusinessId: null,
    };
  }

  if (!isShootPortalBillingMetadata(options.metadata)) {
    console.error("[stripe-billing] attribution failed — missing shootportal_billing marker", {
      source: options.source,
      metadataBusinessId,
      customerId,
    });
    return {
      ok: false,
      reason: "missing_billing_marker",
      metadataBusinessId,
      customerId,
      customerBusinessId: null,
    };
  }

  const business = await loadBillingBusiness(metadataBusinessId);
  if (!business) {
    console.error("[stripe-billing] attribution failed — business not found", {
      source: options.source,
      metadataBusinessId,
      customerId,
    });
    return {
      ok: false,
      reason: "business_not_found",
      metadataBusinessId,
      customerId,
      customerBusinessId: null,
    };
  }

  let customerBusinessId: string | null = null;
  if (customerId) {
    customerBusinessId = await findBusinessIdByStripeCustomerId(customerId);
    const expected = customerIdForMode(business);
    if (expected && expected !== customerId) {
      console.error("[stripe-billing] attribution failed — customer mismatch", {
        source: options.source,
        metadataBusinessId,
        businessCustomerId: expected,
        eventCustomerId: customerId,
        customerBusinessId,
      });
      return {
        ok: false,
        reason: "customer_mismatch",
        metadataBusinessId,
        customerId,
        customerBusinessId,
      };
    }
    if (customerBusinessId && customerBusinessId !== metadataBusinessId) {
      console.error("[stripe-billing] attribution failed — customer owned by other business", {
        source: options.source,
        metadataBusinessId,
        customerId,
        customerBusinessId,
      });
      return {
        ok: false,
        reason: "customer_owned_by_other",
        metadataBusinessId,
        customerId,
        customerBusinessId,
      };
    }
  }

  return { ok: true, business };
}

async function persistCustomerIds(
  businessId: string,
  customerId: string,
  mode: StripeMode,
  email?: string | null
) {
  const supabase = await createServiceClient();
  const patch: Record<string, unknown> = {
    stripe_customer_id: customerId,
    [customerColumn(mode)]: customerId,
  };
  if (email) patch.billing_email = email;
  const { error } = await supabase.from("businesses").update(patch).eq("id", businessId);
  if (error) {
    console.error("[stripe-billing] failed to persist stripe_customer_id", {
      businessId,
      customerId,
      mode,
      error: error.message,
    });
    throw new Error("Could not save Stripe customer.");
  }
}

/**
 * Return a customer id valid for the current Stripe mode. If a stored id belongs
 * to the other mode (or is missing), create a new customer and persist it.
 */
export async function ensureStripeCustomer(
  business: BillingBusinessRow,
  email?: string | null
): Promise<string> {
  const mode = getStripeMode();
  const { stripe } = getStripe();
  const existing = customerIdForMode(business, mode);

  if (existing) {
    try {
      const retrieved = await stripe.customers.retrieve(existing);
      if (!("deleted" in retrieved && retrieved.deleted)) {
        // Keep legacy mirror in sync for this mode.
        if (business.stripe_customer_id !== existing) {
          await persistCustomerIds(business.id, existing, mode, email);
        }
        return existing;
      }
    } catch (err) {
      console.warn("[stripe-billing] stored customer unusable for current mode — recreating", {
        businessId: business.id,
        mode,
        customerId: existing,
        error: err instanceof Error ? err.message : "unknown",
        modeMismatch: isStripeModeMismatchError(err),
      });
    }
  }

  const customer = await stripe.customers.create({
    email: email || business.billing_email || undefined,
    name: business.name,
    metadata: billingMetadata(business.id),
  });

  await persistCustomerIds(business.id, customer.id, mode, email);
  return customer.id;
}

export async function applySubscriptionSnapshot(options: {
  businessId: string;
  currentStatus: string;
  stripeStatus: Stripe.Subscription.Status;
  stripeSubscriptionId: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEndUnix: number | null;
  planKey?: string | null;
  customerId?: string | null;
  source: string;
}): Promise<{ applied: boolean; reason?: string }> {
  if (!shouldApplyStripeSubscriptionUpdate(options.currentStatus)) {
    console.info("[stripe-billing] skipped — comped business protected", {
      source: options.source,
      businessId: options.businessId,
      currentStatus: options.currentStatus,
      stripeStatus: options.stripeStatus,
    });
    return { applied: false, reason: "comped" };
  }

  const mapped = mapStripeSubscriptionStatus(options.stripeStatus);
  if (!mapped) {
    console.info("[stripe-billing] skipped — unmapped stripe status", {
      source: options.source,
      businessId: options.businessId,
      stripeStatus: options.stripeStatus,
    });
    return { applied: false, reason: "unmapped_status" };
  }

  const mode = getStripeMode();
  const patch: Record<string, unknown> = {
    subscription_status: mapped,
    stripe_subscription_id: options.stripeSubscriptionId,
    [subscriptionColumn(mode)]: options.stripeSubscriptionId,
    subscription_cancel_at_period_end: options.cancelAtPeriodEnd,
    subscription_current_period_end: options.currentPeriodEndUnix
      ? new Date(options.currentPeriodEndUnix * 1000).toISOString()
      : null,
  };
  if (options.planKey) patch.plan = options.planKey;
  if (options.customerId) {
    patch.stripe_customer_id = options.customerId;
    patch[customerColumn(mode)] = options.customerId;
  }

  const supabase = await createServiceClient();
  const { error } = await supabase.from("businesses").update(patch).eq("id", options.businessId);
  if (error) throw new Error(error.message);

  console.info("[stripe-billing] subscription snapshot applied", {
    source: options.source,
    businessId: options.businessId,
    mode,
    subscription_status: mapped,
    stripe_subscription_id: options.stripeSubscriptionId,
    plan: options.planKey ?? undefined,
    cancel_at_period_end: options.cancelAtPeriodEnd,
  });

  return { applied: true };
}

export async function syncFromStripeSubscription(
  subscription: Stripe.Subscription,
  source: string
): Promise<{ applied: boolean; reason?: string }> {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;

  const attribution = await resolveBillingBusinessAttribution({
    metadata: subscription.metadata,
    customerId,
    source,
  });
  if (!attribution.ok) return { applied: false, reason: attribution.reason };

  const priceId = subscription.items?.data?.[0]?.price?.id ?? null;
  const planKey = priceId ? await findPlanKeyByStripePriceId(priceId) : null;

  return applySubscriptionSnapshot({
    businessId: attribution.business.id,
    currentStatus: attribution.business.subscription_status,
    stripeStatus: subscription.status,
    stripeSubscriptionId: subscription.id,
    cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
    currentPeriodEndUnix: subscriptionCurrentPeriodEndUnix(subscription),
    planKey,
    customerId,
    source,
  });
}

export async function shouldSkipInvoiceAsShootPortalBilling(
  invoice: Stripe.Invoice
): Promise<{ skip: boolean; reason: string }> {
  const subId = invoiceSubscriptionId(invoice);
  const hasSubscription = Boolean(subId);
  const meta = invoiceSubscriptionMetadata(invoice);
  const metadataLooksBilling = isShootPortalBillingMetadata(meta);

  const customerId =
    typeof invoice.customer === "string"
      ? invoice.customer
      : invoice.customer && !("deleted" in invoice.customer && invoice.customer.deleted)
        ? invoice.customer.id
        : null;

  let customerMatches = false;
  if (customerId) {
    customerMatches = Boolean(await findBusinessIdByStripeCustomerId(customerId));
  }

  const skip = isShootPortalBillingInvoiceSignals({
    hasSubscription,
    metadataLooksBilling,
    customerMatchesBusinessBillingCustomer: customerMatches,
  });

  if (!skip) {
    return { skip: false, reason: "not_shootportal_billing" };
  }

  return {
    skip: true,
    reason: metadataLooksBilling
      ? "shootportal_billing_metadata"
      : "subscription_invoice_for_saas_customer",
  };
}
