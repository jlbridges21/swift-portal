import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { LEGACY_DEFAULT_BUSINESS_ID } from "@/lib/tenant";
import { getStripe, type StripeClientContext } from "@/lib/stripe";
import { getBusinessPortalOrigin } from "@/lib/portal-url";

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
  /** v106: account can take ACH Direct Debit (bank payments). */
  stripe_ach_enabled?: boolean | null;
}

const LEGACY_INTEGRATION_COLUMNS =
  "business_id, stripe_account_id, stripe_account_status, stripe_charges_enabled, stripe_payouts_enabled, stripe_connected_at";
const INTEGRATION_COLUMNS = `${LEGACY_INTEGRATION_COLUMNS}, stripe_ach_enabled`;

/** Before migration v106 runs, stripe_ach_enabled does not exist; card payments must keep working. */
function isMissingAchColumn(error: { message?: string } | null | undefined): boolean {
  return Boolean(error?.message && /stripe_ach_enabled/.test(error.message));
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

export function portalCheckoutBaseUrl(
  business?: {
    slug?: string;
    custom_domain?: string | null;
    custom_domain_status?: string | null;
    custom_domain_vercel_verified?: boolean | null;
    custom_domain_misconfigured?: boolean | null;
  } | null
): string {
  if (business?.slug) {
    return getBusinessPortalOrigin({
      slug: business.slug,
      custom_domain: business.custom_domain ?? null,
      custom_domain_status: business.custom_domain_status,
      custom_domain_vercel_verified: business.custom_domain_vercel_verified,
      custom_domain_misconfigured: business.custom_domain_misconfigured,
    });
  }
  const custom = business?.custom_domain?.trim();
  if (custom) {
    return getBusinessPortalOrigin({
      slug: "unknown",
      custom_domain: custom,
      custom_domain_status: business?.custom_domain_status,
      custom_domain_vercel_verified: business?.custom_domain_vercel_verified,
      custom_domain_misconfigured: business?.custom_domain_misconfigured,
    });
  }
  return `https://${process.env.PLATFORM_ROOT_DOMAIN?.trim() || "shootportal.app"}`;
}

export function stripeDashboardUrl(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_")
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
}

/** ACH Direct Debit is usable on this account (capability active and charges on). */
export function accountAcceptsAch(account: Pick<Stripe.Account, "capabilities" | "charges_enabled">): boolean {
  return Boolean(account.charges_enabled) && account.capabilities?.us_bank_account_ach_payments === "active";
}

/** Where the business owner turns on ACH Direct Debit in their own Stripe Dashboard. */
export function stripeAchSettingsUrl(): string {
  return `${stripeDashboardUrl()}/settings/payment_methods`;
}

export function mapStripeAccountStatus(account: Stripe.Account): {
  status: StripeAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
} {
  const chargesEnabled = Boolean(account.charges_enabled);
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const disabledReason = account.requirements?.disabled_reason ?? null;

  // Charges enabled wins — disabled_reason can linger during verification.
  if (chargesEnabled) {
    return { status: "active", chargesEnabled, payoutsEnabled };
  }
  if (disabledReason) {
    return { status: "restricted", chargesEnabled, payoutsEnabled };
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
  const { data, error } = await db.from("business_integrations").select(INTEGRATION_COLUMNS).eq("business_id", businessId).maybeSingle();
  if (isMissingAchColumn(error)) {
    const legacy = await db.from("business_integrations").select(LEGACY_INTEGRATION_COLUMNS).eq("business_id", businessId).maybeSingle();
    return (legacy.data as BusinessStripeIntegration | null) ?? null;
  }
  return (data as BusinessStripeIntegration | null) ?? null;
}

export async function loadIntegrationByStripeAccount(
  stripeAccountId: string
): Promise<BusinessStripeIntegration | null> {
  const supabase = await createServiceClient();
  const { data, error } = await supabase.from("business_integrations").select(INTEGRATION_COLUMNS).eq("stripe_account_id", stripeAccountId).maybeSingle();
  if (isMissingAchColumn(error)) {
    const legacy = await supabase.from("business_integrations").select(LEGACY_INTEGRATION_COLUMNS).eq("stripe_account_id", stripeAccountId).maybeSingle();
    return (legacy.data as BusinessStripeIntegration | null) ?? null;
  }
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

  const row = {
    business_id: businessId,
    stripe_account_id: account.id,
    stripe_account_status: mapped.status,
    stripe_charges_enabled: mapped.chargesEnabled,
    stripe_payouts_enabled: mapped.payoutsEnabled,
    stripe_connected_at: connectedAt,
  };
  let { data, error } = await db
    .from("business_integrations")
    .upsert({ ...row, stripe_ach_enabled: accountAcceptsAch(account) }, { onConflict: "business_id" })
    .select(INTEGRATION_COLUMNS)
    .single();
  if (isMissingAchColumn(error)) {
    ({ data, error } = await db.from("business_integrations").upsert(row, { onConflict: "business_id" }).select(LEGACY_INTEGRATION_COLUMNS).single());
  }

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

/**
 * Resolve Connect status for API responses.
 * Always refreshes from Stripe when an account id exists — never trust stale DB alone.
 * Settings and onboarding both call GET /api/stripe/connect which uses this.
 */
export async function getLiveConnectStatus(businessId: string): Promise<{
  isPlatform: boolean;
  status: StripeAccountStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  connectedAt: string | null;
  hasAccount: boolean;
  dashboardUrl: string;
  achEnabled: boolean;
  achSettingsUrl: string;
}> {
  if (isPlatformStripeBusiness(businessId)) {
    return {
      isPlatform: true,
      status: "active",
      chargesEnabled: true,
      payoutsEnabled: true,
      connectedAt: null,
      hasAccount: true,
      dashboardUrl: stripeDashboardUrl(),
      achEnabled: (await bankPaymentSchemaReady(businessId)) && (await platformAcceptsAch()),
      achSettingsUrl: stripeAchSettingsUrl(),
    };
  }

  let integration = await loadBusinessStripeIntegration(businessId);
  const accountId = integration?.stripe_account_id ?? null;

  if (accountId) {
    try {
      const account = await retrieveConnectedAccount(accountId);
      integration = await applyStripeAccountSnapshot(businessId, account);
    } catch (err) {
      console.error("[stripe-connect] live status refresh failed", {
        businessId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    isPlatform: false,
    status: integration?.stripe_account_status ?? "not_connected",
    chargesEnabled: Boolean(integration?.stripe_charges_enabled),
    payoutsEnabled: Boolean(integration?.stripe_payouts_enabled),
    connectedAt: integration?.stripe_connected_at ?? null,
    hasAccount: Boolean(accountId),
    dashboardUrl: stripeDashboardUrl(),
    achEnabled: integration?.stripe_account_status === "active" && Boolean(integration?.stripe_ach_enabled),
    achSettingsUrl: stripeAchSettingsUrl(),
  };
}

/** Migration v106 has run (bank payments can be recorded). Remembered once true. */
const SCHEMA_READY = new Map<"v106", true>();
async function bankPaymentSchemaReady(businessId: string): Promise<boolean> {
  if (SCHEMA_READY.has("v106")) return true;
  const db = await createTenantServiceClient(businessId);
  const { error } = await db.from("business_integrations").select("stripe_ach_enabled").limit(1);
  if (error) return false;
  SCHEMA_READY.set("v106", true);
  return true;
}

/** Platform capability rarely changes; avoid a Stripe call on every project page view. */
const PLATFORM_ACH_CACHE = new Map<"platform", { value: boolean; at: number }>();
const PLATFORM_ACH_TTL_MS = 10 * 60 * 1000;

/** The legacy platform business charges on the platform account; read its capability (cached). */
async function platformAcceptsAch(): Promise<boolean> {
  const cached = PLATFORM_ACH_CACHE.get("platform");
  if (cached && Date.now() - cached.at < PLATFORM_ACH_TTL_MS) return cached.value;
  try {
    const { stripe } = getStripe();
    const value = accountAcceptsAch(await stripe.accounts.retrieveCurrent());
    PLATFORM_ACH_CACHE.set("platform", { value, at: Date.now() });
    return value;
  } catch (err) {
    console.warn("[stripe-connect] platform ACH capability lookup failed", err instanceof Error ? err.message : err);
    return false;
  }
}

/**
 * Can this business offer bank (ACH) payments right now? Uses the stored capability, which
 * account.updated webhooks and every Settings visit refresh. Never throws.
 */
export async function isBankPaymentAvailable(businessId: string): Promise<boolean> {
  // The platform business reads ACH from Stripe live; only offer it once v106 can record it.
  if (isPlatformStripeBusiness(businessId)) return (await bankPaymentSchemaReady(businessId)) && platformAcceptsAch();
  try {
    const integration = await loadBusinessStripeIntegration(businessId);
    return Boolean(integration?.stripe_account_id && integration.stripe_account_status === "active" && integration.stripe_ach_enabled);
  } catch {
    return false;
  }
}
