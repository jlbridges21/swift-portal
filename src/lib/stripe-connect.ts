import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";
import { getStripe, type StripeClientContext } from "@/lib/stripe";

export type StripeAccountStatus =
  | "not_connected"
  | "pending"
  | "active"
  | "restricted"
  | "disabled";

export interface BusinessStripeIntegration {
  business_id: string;
  stripe_account_id: string | null;
  stripe_account_status: StripeAccountStatus;
  stripe_charges_enabled: boolean;
  stripe_payouts_enabled: boolean;
  stripe_connected_at: string | null;
}

export const STRIPE_CONNECT_NOT_READY_MESSAGE =
  "Stripe is not connected for this business. An admin must complete Stripe onboarding in Settings before creating a payment link.";

export class StripeConnectNotReadyError extends Error {
  constructor(message = STRIPE_CONNECT_NOT_READY_MESSAGE) {
    super(message);
    this.name = "StripeConnectNotReadyError";
  }
}

export function isPlatformStripeBusiness(businessId: string): boolean {
  return businessId === LEGACY_DEFAULT_BUSINESS_ID;
}

export function portalCheckoutBaseUrl(business?: { custom_domain?: string | null } | null): string {
  const custom = business?.custom_domain?.trim();
  if (custom) {
    const host = custom.replace(/^https?:\/\//i, "").replace(/\/$/, "");
    return `https://${host}`;
  }
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
}

export function stripeDashboardUrl(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_")
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
}

export function mapStripeAccountStatus(account: Stripe.Account): {
  status: StripeAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
} {
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const disabledReason = account.requirements?.disabled_reason ?? null;

  if (disabledReason) {
    return { status: "disabled", chargesEnabled, payoutsEnabled };
  }
  if (chargesEnabled) {
    return { status: "active", chargesEnabled, payoutsEnabled };
  }
  if (account.details_submitted) {
    return { status: "restricted", chargesEnabled, payoutsEnabled };
  }
  return { status: "pending", chargesEnabled, payoutsEnabled };
}

export async function loadBusinessStripeIntegration(
  businessId: string
): Promise<BusinessStripeIntegration | null> {
  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("business_integrations")
    .select(
      "business_id, stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, stripe_connected_at"
    )
    .eq("business_id", businessId)
    .maybeSingle();
  return (data as BusinessStripeIntegration | null) ?? null;
}

export async function loadIntegrationByStripeAccount(
  stripeAccountId: string
): Promise<BusinessStripeIntegration | null> {
  const supabase = await createServiceClient();
  const { data } = await supabase
    .from("business_integrations")
    .select(
      "business_id, stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, stripe_connected_at"
    )
    .eq("stripe_account_id", stripeAccountId)
    .maybeSingle();
  return (data as BusinessStripeIntegration | null) ?? null;
}

/**
 * Stripe client for charging this business.
 * NULL stripe_account_id → no Stripe-Account header (platform / Swift).
 * Non-platform businesses must be `active` with a connected account id.
 */
export async function getStripeForBusiness(businessId: string): Promise<
  StripeClientContext & { stripeAccountId: string | null }
> {
  if (isPlatformStripeBusiness(businessId)) {
    const ctx = getStripe();
    return { ...ctx, stripeAccountId: null };
  }

  const integration = await loadBusinessStripeIntegration(businessId);
  const accountId = integration?.stripe_account_id ?? null;
  if (!accountId || integration?.stripe_account_status !== "active") {
    throw new StripeConnectNotReadyError();
  }

  return { ...getStripe({ stripeAccount: accountId }), stripeAccountId: accountId };
}

export function getStripeForStoredAccount(stripeAccountId: string | null | undefined): StripeClientContext {
  return getStripe({ stripeAccount: stripeAccountId ?? null });
}

export async function upsertPendingConnectedAccount(
  businessId: string,
  stripeAccountId: string
): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("business_integrations").upsert(
    {
      business_id: businessId,
      stripe_account_id: stripeAccountId,
      stripe_account_status: "pending",
    },
    { onConflict: "business_id" }
  );
  if (error) {
    throw new Error(`Failed to save Stripe account: ${error.message}`);
  }
}

export async function applyStripeAccountSnapshot(
  businessId: string,
  account: Stripe.Account
): Promise<BusinessStripeIntegration> {
  const mapped = mapStripeAccountStatus(account);
  const existing = await loadBusinessStripeIntegration(businessId);
  const db = await createTenantServiceClient(businessId);
  const connectedAt =
    mapped.status === "active"
      ? existing?.stripe_connected_at ?? new Date().toISOString()
      : existing?.stripe_connected_at ?? null;

  const { data, error } = await db
    .from("business_integrations")
    .upsert(
      {
        business_id: businessId,
        stripe_account_id: account.id,
        stripe_account_status: mapped.status,
        stripe_charges_enabled: mapped.chargesEnabled,
        stripe_payouts_enabled: mapped.payoutsEnabled,
        stripe_connected_at: connectedAt,
      },
      { onConflict: "business_id" }
    )
    .select(
      "business_id, stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, stripe_connected_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update Stripe connection status");
  }
  return data as BusinessStripeIntegration;
}

export async function markStripeAccountDisabled(businessId: string): Promise<void> {
  const db = await createTenantServiceClient(businessId);
  await db
    .from("business_integrations")
    .update({
      stripe_account_status: "disabled",
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
    })
    .eq("business_id", businessId);
}

export function connectReturnUrls(appUrl: string): { returnUrl: string; refreshUrl: string } {
  const base = appUrl.replace(/\/$/, "");
  return {
    returnUrl: `${base}/api/stripe/connect/callback`,
    refreshUrl: `${base}/api/stripe/connect/refresh`,
  };
}

/** Platform-level Account Links call — never pass Stripe-Account. */
export async function createConnectAccountLink(stripeAccountId: string, appUrl: string): Promise<string> {
  const { stripe } = getStripe();
  const { returnUrl, refreshUrl } = connectReturnUrls(appUrl);
  const link = await stripe.accountLinks.create({
    account: stripeAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Platform-level Accounts.create — never pass Stripe-Account. */
export async function createStandardConnectedAccount(): Promise<Stripe.Account> {
  const { stripe } = getStripe();
  return stripe.accounts.create({ type: "standard" });
}

/** Platform-level Accounts.retrieve — id is in the URL, not the Stripe-Account header. */
export async function retrieveConnectedAccount(stripeAccountId: string): Promise<Stripe.Account> {
  const { stripe } = getStripe();
  return stripe.accounts.retrieve(stripeAccountId);
}

export function connectEventAccountId(event: Stripe.Event): string | undefined {
  const account = (event as Stripe.Event & { account?: unknown }).account;
  return typeof account === "string" && account.startsWith("acct_") ? account : undefined;
}
