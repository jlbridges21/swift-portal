/**
 * ShootPortal SaaS billing on the PLATFORM Stripe account.
 *
 * NEVER pass stripeAccount / Stripe-Account header here.
 * Connect client payments live in stripe-connect.ts / stripe-payments.ts.
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";
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
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  billing_email: string | null;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
};

export type PlanStripeIds = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly_cents: number | null;
  price_annual_cents: number | null;
  stripe_product_id: string | null;
  stripe_price_monthly_id: string | null;
  stripe_price_annual_id: string | null;
  is_active: boolean;
  is_public: boolean;
};

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

/**
 * Multi-signal: ShootPortal SaaS invoice vs tenant→client invoice.
 * Requires (1) a subscription on the invoice AND (2) at least one of:
 * metadata marker, or customer matching businesses.stripe_customer_id
 * (caller supplies customerMatch). Prefer both when available.
 */
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

export async function loadBillingBusiness(
  businessId: string
): Promise<BillingBusinessRow | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(
      "id, name, slug, custom_domain, plan, subscription_status, trial_ends_at, stripe_customer_id, stripe_subscription_id, billing_email, subscription_current_period_end, subscription_cancel_at_period_end"
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
    .eq("stripe_customer_id", customerId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

export async function loadPlanByKeyForBilling(
  key: string
): Promise<PlanStripeIds | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("plans")
    .select(
      "id, key, name, description, price_monthly_cents, price_annual_cents, stripe_product_id, stripe_price_monthly_id, stripe_price_annual_id, is_active, is_public"
    )
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PlanStripeIds | null) ?? null;
}

export async function findPlanKeyByStripePriceId(
  priceId: string
): Promise<string | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase
    .from("plans")
    .select("key")
    .or(`stripe_price_monthly_id.eq.${priceId},stripe_price_annual_id.eq.${priceId}`)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.key ?? null;
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
    if (business.stripe_customer_id && business.stripe_customer_id !== customerId) {
      console.error("[stripe-billing] attribution failed — customer mismatch", {
        source: options.source,
        metadataBusinessId,
        businessCustomerId: business.stripe_customer_id,
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

export async function ensureStripeCustomer(
  business: BillingBusinessRow,
  email?: string | null
): Promise<string> {
  if (business.stripe_customer_id) return business.stripe_customer_id;

  const { stripe } = getStripe();
  const customer = await stripe.customers.create({
    email: email || business.billing_email || undefined,
    name: business.name,
    metadata: billingMetadata(business.id),
  });

  const supabase = await createServiceClient();
  const { error } = await supabase
    .from("businesses")
    .update({
      stripe_customer_id: customer.id,
      ...(email ? { billing_email: email } : {}),
    })
    .eq("id", business.id);

  if (error) {
    console.error("[stripe-billing] failed to persist stripe_customer_id", {
      businessId: business.id,
      customerId: customer.id,
      error: error.message,
    });
    throw new Error("Could not save Stripe customer.");
  }

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

  const patch: Record<string, unknown> = {
    subscription_status: mapped,
    stripe_subscription_id: options.stripeSubscriptionId,
    subscription_cancel_at_period_end: options.cancelAtPeriodEnd,
    subscription_current_period_end: options.currentPeriodEndUnix
      ? new Date(options.currentPeriodEndUnix * 1000).toISOString()
      : null,
  };
  if (options.planKey) patch.plan = options.planKey;
  if (options.customerId) patch.stripe_customer_id = options.customerId;

  const supabase = await createServiceClient();
  const { error } = await supabase.from("businesses").update(patch).eq("id", options.businessId);
  if (error) throw new Error(error.message);

  console.info("[stripe-billing] subscription snapshot applied", {
    source: options.source,
    businessId: options.businessId,
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

/**
 * Platform webhook guard: should this invoice be ignored as ShootPortal SaaS?
 * Uses multiple signals; when unsure, returns false (do not skip payment flow).
 */
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

  // Strengthen: require metadata marker OR (subscription + customer match).
  // Already encoded above. Extra: if only customer match without subscription, do not skip.
  if (!skip) {
    return { skip: false, reason: "not_shootportal_billing" };
  }

  // Prefer requiring the marker when present on subscription invoices; if marker
  // missing but customer is a SaaS customer AND invoice has subscription, still
  // skip to avoid corrupting payments when metadata snapshot is empty.
  return {
    skip: true,
    reason: metadataLooksBilling
      ? "shootportal_billing_metadata"
      : "subscription_invoice_for_saas_customer",
  };
}
