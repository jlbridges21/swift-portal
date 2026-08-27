/**
 * FLOW C — ShootPortal pays partners via Connect Express TRANSFERS.
 *
 * NEVER import business Connect helpers for account resolution here.
 * NEVER read business_integrations.stripe_account_id.
 * NEVER write partners.stripe_connect_account_id from business onboarding code.
 *
 * Flow B (business → client charges) lives in src/lib/stripe-connect.ts.
 * Mixing the two account ids is a security / money bug — tenant-lint enforces it.
 */

import type Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/server";
import { getStripe, getStripeMode } from "@/lib/stripe";
import {
  normalizeHostname,
  resolveRequestHost,
} from "@/lib/host-resolution";
import {
  assertPublicPortalOrigin,
  getBusinessPortalOrigin,
  getPlatformApexOrigin,
  isLocalOrRelativeOrigin,
  isPlatformApexHostname,
} from "@/lib/portal-url";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import type { PartnerRow } from "@/lib/partners";

/** Planned Phase 2 automated payout floor (cents). Phase 1 surfaces this in copy only. */
export const PARTNER_PAYOUT_MINIMUM_CENTS = 5000;

/** Planned Phase 2 cadence — describe in UI; do not run transfers yet. */
export const PARTNER_PAYOUT_SCHEDULE_LABEL = "monthly (after the hold clears)";

export type PartnerConnectAccountStatus =
  | "not_connected"
  | "pending"
  | "action_required"
  | "restricted"
  | "ready"
  | "disabled";

export type PartnerConnectSnapshot = {
  partnerId: string;
  stripeConnectAccountId: string | null;
  status: PartnerConnectAccountStatus;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: boolean;
  requirementsSummary: string | null;
  stripeMode: "test" | "live" | null;
  connectedAt: string | null;
  updatedAt: string | null;
};

function stripeDashboardUrl(): string {
  const key = process.env.STRIPE_SECRET_KEY ?? "";
  return key.startsWith("sk_live_")
    ? "https://dashboard.stripe.com"
    : "https://dashboard.stripe.com/test";
}

/**
 * Map a Stripe Express account to our partner Connect status.
 * Ready = payouts_enabled (transfers can land). Charges are irrelevant for partners.
 */
export function mapPartnerExpressAccountStatus(account: Stripe.Account): {
  status: PartnerConnectAccountStatus;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: boolean;
  requirementsSummary: string | null;
} {
  const payoutsEnabled = Boolean(account.payouts_enabled);
  const detailsSubmitted = Boolean(account.details_submitted);
  const currentlyDue = account.requirements?.currently_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;
  const due = [...new Set([...currentlyDue, ...pastDue])];
  const requirementsDue = due.length > 0 || Boolean(disabledReason);
  const requirementsSummary =
    due.length > 0
      ? due.slice(0, 8).join(", ")
      : disabledReason
        ? String(disabledReason)
        : null;

  if (disabledReason && !payoutsEnabled) {
    return {
      status: "disabled",
      payoutsEnabled,
      detailsSubmitted,
      requirementsDue: true,
      requirementsSummary: requirementsSummary ?? String(disabledReason),
    };
  }
  if (payoutsEnabled && !requirementsDue) {
    return {
      status: "ready",
      payoutsEnabled,
      detailsSubmitted,
      requirementsDue: false,
      requirementsSummary: null,
    };
  }
  if (requirementsDue && detailsSubmitted) {
    return {
      status: "action_required",
      payoutsEnabled,
      detailsSubmitted,
      requirementsDue: true,
      requirementsSummary,
    };
  }
  if (detailsSubmitted && !payoutsEnabled) {
    return {
      status: "restricted",
      payoutsEnabled,
      detailsSubmitted,
      requirementsDue,
      requirementsSummary,
    };
  }
  if (account.id) {
    return {
      status: "pending",
      payoutsEnabled,
      detailsSubmitted,
      requirementsDue,
      requirementsSummary,
    };
  }
  return {
    status: "not_connected",
    payoutsEnabled: false,
    detailsSubmitted: false,
    requirementsDue: false,
    requirementsSummary: null,
  };
}

/** FLOW C resolver — partners.stripe_connect_account_id only. */
export async function loadPartnerConnectByPartnerId(
  partnerId: string
): Promise<PartnerConnectSnapshot | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("partners")
    .select(
      "id, stripe_connect_account_id, stripe_connect_account_status, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_requirements_due, stripe_connect_requirements_summary, stripe_connect_mode, stripe_connect_connected_at, stripe_connect_updated_at"
    )
    .eq("id", partnerId)
    .maybeSingle();
  if (!data) return null;
  return rowToSnapshot(data as Record<string, unknown>);
}

/** FLOW C lookup by Express account id — never touches business_integrations. */
export async function loadPartnerByStripeConnectAccountId(
  stripeConnectAccountId: string
): Promise<{ partnerId: string; snapshot: PartnerConnectSnapshot } | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("partners")
    .select(
      "id, stripe_connect_account_id, stripe_connect_account_status, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_requirements_due, stripe_connect_requirements_summary, stripe_connect_mode, stripe_connect_connected_at, stripe_connect_updated_at"
    )
    .eq("stripe_connect_account_id", stripeConnectAccountId)
    .maybeSingle();
  if (!data) return null;
  const snapshot = rowToSnapshot(data as Record<string, unknown>);
  return { partnerId: snapshot.partnerId, snapshot };
}

function rowToSnapshot(data: Record<string, unknown>): PartnerConnectSnapshot {
  const statusRaw = data.stripe_connect_account_status;
  const status: PartnerConnectAccountStatus =
    statusRaw === "pending" ||
    statusRaw === "action_required" ||
    statusRaw === "restricted" ||
    statusRaw === "ready" ||
    statusRaw === "disabled"
      ? statusRaw
      : data.stripe_connect_account_id
        ? "pending"
        : "not_connected";
  const mode = data.stripe_connect_mode;
  return {
    partnerId: data.id as string,
    stripeConnectAccountId: (data.stripe_connect_account_id as string | null) ?? null,
    status,
    payoutsEnabled: Boolean(data.stripe_connect_payouts_enabled),
    detailsSubmitted: Boolean(data.stripe_connect_details_submitted),
    requirementsDue: Boolean(data.stripe_connect_requirements_due),
    requirementsSummary: (data.stripe_connect_requirements_summary as string | null) ?? null,
    stripeMode: mode === "test" || mode === "live" ? mode : null,
    connectedAt: (data.stripe_connect_connected_at as string | null) ?? null,
    updatedAt: (data.stripe_connect_updated_at as string | null) ?? null,
  };
}

export async function createPartnerExpressAccount(partner: PartnerRow): Promise<Stripe.Account> {
  const { stripe } = getStripe();
  const mode = getStripeMode();
  // Stripe Express docs request card_payments + transfers together. Transfers-only
  // (no card_payments) requires separate Stripe platform approval. FLOW C never
  // creates charges on this account — card_payments is requested only so Express
  // onboarding works; getStripeForBusiness / business charging stay on FLOW B.
  return stripe.accounts.create({
    type: "express",
    email: partner.email,
    capabilities: {
      transfers: { requested: true },
      card_payments: { requested: true },
    },
    business_profile: {
      name: partner.brand_name || partner.name,
      product_description: "ShootPortal partner referral commissions",
    },
    metadata: {
      shootportal_flow: "partner_payouts",
      shootportal_partner_id: partner.id,
      shootportal_stripe_mode: mode,
    },
  });
}

export function partnerConnectReturnUrls(returnOrigin?: string): {
  returnUrl: string;
  refreshUrl: string;
} {
  const base = (returnOrigin ?? getPlatformApexOrigin()).replace(/\/$/, "");
  return {
    returnUrl: `${base}/api/partner/stripe/connect/callback`,
    refreshUrl: `${base}/api/partner/stripe/connect/refresh`,
  };
}

/** Stripe Connect redirect URIs operators must allowlist when adding tenant hosts. */
export function partnerConnectRedirectUriPatterns(): string[] {
  const root = getPlatformRootDomain();
  return [
    `https://www.${root}/api/partner/stripe/connect/callback`,
    `https://www.${root}/api/partner/stripe/connect/refresh`,
    `https://{slug}.${root}/api/partner/stripe/connect/callback`,
    `https://{slug}.${root}/api/partner/stripe/connect/refresh`,
    "https://{custom_domain}/api/partner/stripe/connect/callback",
    "https://{custom_domain}/api/partner/stripe/connect/refresh",
  ];
}

export type PartnerConnectOriginResolution = {
  origin: string;
  /** Initiating request host was validated and used (tenant or dev localhost). */
  usedRequestHost: boolean;
  /** Hostname rejected because it did not resolve to a known app host. */
  rejectedHostname: string | null;
};

function requestProtocol(hostname: string, forwardedProto: string | null): string {
  const proto = forwardedProto?.split(",")[0]?.trim();
  if (proto === "http" || proto === "https") return proto;
  if (hostname === "localhost" || hostname.startsWith("127.0.0.1")) return "http";
  return "https";
}

function originFromHost(hostname: string, protocol: string): string {
  return assertPublicPortalOrigin(`${protocol}://${hostname}`, "partnerConnectOrigin").replace(
    /\/$/,
    ""
  );
}

/**
 * Resolve the origin Stripe Account Links must return to.
 * Partner-only users (no business on profile) always use the platform apex.
 * Tenant-host partners return to their validated tenant origin.
 * Unmatched / forged hosts fall back to apex — never an open redirect.
 */
export async function resolvePartnerConnectOrigin(input: {
  hostname: string;
  pathname: string;
  pathCookie: string | null;
  profileBusinessId: string | null;
  forwardedProto?: string | null;
}): Promise<PartnerConnectOriginResolution> {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const host = normalizeHostname(input.hostname);

  if (!input.profileBusinessId) {
    return { origin: apex, usedRequestHost: false, rejectedHostname: null };
  }

  const resolution = await resolveRequestHost({
    hostname: host,
    pathname: input.pathname,
    pathCookie: input.pathCookie,
  });

  if (resolution.kind === "platform" && isPlatformApexHostname(host)) {
    return { origin: apex, usedRequestHost: false, rejectedHostname: null };
  }

  if (
    resolution.kind === "tenant" &&
    resolution.business?.id === input.profileBusinessId
  ) {
    const tenantOrigin = getBusinessPortalOrigin({
      slug: resolution.business.slug,
      custom_domain: resolution.business.custom_domain,
    }).replace(/\/$/, "");
    return { origin: tenantOrigin, usedRequestHost: true, rejectedHostname: null };
  }

  const protocol = requestProtocol(host, input.forwardedProto ?? null);
  if (isLocalOrRelativeOrigin(originFromHost(host, protocol))) {
    if (
      resolution.kind === "tenant" &&
      resolution.business?.id === input.profileBusinessId
    ) {
      return {
        origin: originFromHost(host, protocol),
        usedRequestHost: true,
        rejectedHostname: null,
      };
    }
    if (resolution.kind === "platform") {
      return {
        origin: originFromHost(host, protocol),
        usedRequestHost: false,
        rejectedHostname: null,
      };
    }
  }

  console.warn("[partner-stripe-connect] rejected Connect return origin", {
    hostname: host,
    profileBusinessId: input.profileBusinessId,
    resolutionKind: resolution.kind,
    resolvedBusinessId: resolution.business?.id ?? null,
  });
  return { origin: apex, usedRequestHost: false, rejectedHostname: host || null };
}

/**
 * Origin for callback/refresh handlers — derived from the inbound request host
 * (where Stripe redirected the user), validated against host resolution.
 */
export async function resolvePartnerConnectCallbackOrigin(input: {
  hostname: string;
  pathname: string;
  pathCookie: string | null;
  forwardedProto?: string | null;
}): Promise<string> {
  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const host = normalizeHostname(input.hostname);
  const resolution = await resolveRequestHost({
    hostname: host,
    pathname: input.pathname,
    pathCookie: input.pathCookie,
  });

  if (resolution.kind === "tenant" && resolution.business) {
    return getBusinessPortalOrigin({
      slug: resolution.business.slug,
      custom_domain: resolution.business.custom_domain,
    }).replace(/\/$/, "");
  }

  if (resolution.kind === "platform" && isPlatformApexHostname(host)) {
    return apex;
  }

  const protocol = requestProtocol(host, input.forwardedProto ?? null);
  const localOrigin = originFromHost(host, protocol);
  if (isLocalOrRelativeOrigin(localOrigin)) {
    return localOrigin;
  }

  console.warn("[partner-stripe-connect] callback origin unmatched — using apex", {
    hostname: host,
    resolutionKind: resolution.kind,
  });
  return apex;
}

export function partnerConnectPathOnOrigin(origin: string, path: string): string {
  const base = origin.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${base}${suffix}`;
}

/** Platform-level Account Links — never pass Stripe-Account header. */
export async function createPartnerConnectAccountLink(
  stripeConnectAccountId: string,
  returnOrigin?: string
): Promise<string> {
  const { stripe } = getStripe();
  const { returnUrl, refreshUrl } = partnerConnectReturnUrls(returnOrigin);
  const link = await stripe.accountLinks.create({
    account: stripeConnectAccountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return link.url;
}

/** Platform-level Accounts.retrieve for partner Express accounts. */
export async function retrievePartnerExpressAccount(
  stripeConnectAccountId: string
): Promise<Stripe.Account> {
  const { stripe } = getStripe();
  return stripe.accounts.retrieve(stripeConnectAccountId);
}

export async function upsertPendingPartnerConnectAccount(
  partnerId: string,
  stripeConnectAccountId: string
): Promise<void> {
  const mode = getStripeMode();
  const raw = await createServiceClient();
  const { error } = await raw
    .from("partners")
    .update({
      stripe_connect_account_id: stripeConnectAccountId,
      stripe_connect_account_status: "pending",
      stripe_connect_payouts_enabled: false,
      stripe_connect_details_submitted: false,
      stripe_connect_requirements_due: false,
      stripe_connect_requirements_summary: null,
      stripe_connect_mode: mode,
      stripe_connect_updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);
  if (error) throw new Error(`Failed to save partner Connect account: ${error.message}`);
}

export async function applyPartnerStripeAccountSnapshot(
  partnerId: string,
  account: Stripe.Account
): Promise<PartnerConnectSnapshot> {
  const mapped = mapPartnerExpressAccountStatus(account);
  const existing = await loadPartnerConnectByPartnerId(partnerId);
  const mode = getStripeMode();
  const connectedAt =
    mapped.status === "ready"
      ? existing?.connectedAt ?? new Date().toISOString()
      : existing?.connectedAt ?? null;

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partners")
    .update({
      stripe_connect_account_id: account.id,
      stripe_connect_account_status: mapped.status,
      stripe_connect_payouts_enabled: mapped.payoutsEnabled,
      stripe_connect_details_submitted: mapped.detailsSubmitted,
      stripe_connect_requirements_due: mapped.requirementsDue,
      stripe_connect_requirements_summary: mapped.requirementsSummary,
      stripe_connect_mode: mode,
      stripe_connect_connected_at: connectedAt,
      stripe_connect_updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId)
    .select(
      "id, stripe_connect_account_id, stripe_connect_account_status, stripe_connect_payouts_enabled, stripe_connect_details_submitted, stripe_connect_requirements_due, stripe_connect_requirements_summary, stripe_connect_mode, stripe_connect_connected_at, stripe_connect_updated_at"
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message || "Failed to update partner Connect status");
  }
  return rowToSnapshot(data as Record<string, unknown>);
}

export async function markPartnerConnectDisabled(partnerId: string): Promise<void> {
  const raw = await createServiceClient();
  await raw
    .from("partners")
    .update({
      stripe_connect_account_status: "disabled",
      stripe_connect_payouts_enabled: false,
      stripe_connect_requirements_due: true,
      stripe_connect_updated_at: new Date().toISOString(),
    })
    .eq("id", partnerId);
}

/**
 * Live status for the partner dashboard. Refreshes from Stripe when an account
 * exists — never trust stale DB alone. Mode mismatch → treat as not connected
 * for the current deploy mode (test/live accounts are not interchangeable).
 */
export async function getLivePartnerConnectStatus(partnerId: string): Promise<{
  status: PartnerConnectAccountStatus;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  requirementsDue: boolean;
  requirementsSummary: string | null;
  hasAccount: boolean;
  stripeMode: "test" | "live" | null;
  connectedAt: string | null;
  dashboardUrl: string;
  modeMismatch: boolean;
  taxDocumentStatus: "complete" | "action_required" | "pending" | "unavailable";
  taxDocumentSummary: string | null;
}> {
  const deployMode = getStripeMode();
  let snapshot = await loadPartnerConnectByPartnerId(partnerId);
  const accountId = snapshot?.stripeConnectAccountId ?? null;
  const modeMismatch = Boolean(
    accountId && snapshot?.stripeMode && snapshot.stripeMode !== deployMode
  );
  let taxDocumentStatus: "complete" | "action_required" | "pending" | "unavailable" =
    "unavailable";
  let taxDocumentSummary: string | null = null;

  if (accountId && !modeMismatch) {
    try {
      const account = await retrievePartnerExpressAccount(accountId);
      snapshot = await applyPartnerStripeAccountSnapshot(partnerId, account);
      const tax = partnerTaxDocumentStatusFromAccount(account);
      taxDocumentStatus = tax.status;
      taxDocumentSummary = tax.summary;
    } catch (err) {
      console.error("[partner-stripe-connect] live status refresh failed", {
        partnerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (modeMismatch) {
    return {
      status: "not_connected",
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirementsDue: false,
      requirementsSummary: null,
      hasAccount: false,
      stripeMode: snapshot?.stripeMode ?? null,
      connectedAt: null,
      dashboardUrl: stripeDashboardUrl(),
      modeMismatch: true,
      taxDocumentStatus: "unavailable",
      taxDocumentSummary: null,
    };
  }

  return {
    status: snapshot?.status ?? "not_connected",
    payoutsEnabled: Boolean(snapshot?.payoutsEnabled),
    detailsSubmitted: Boolean(snapshot?.detailsSubmitted),
    requirementsDue: Boolean(snapshot?.requirementsDue),
    requirementsSummary: snapshot?.requirementsSummary ?? null,
    hasAccount: Boolean(accountId),
    stripeMode: snapshot?.stripeMode ?? null,
    connectedAt: snapshot?.connectedAt ?? null,
    dashboardUrl: stripeDashboardUrl(),
    modeMismatch: false,
    taxDocumentStatus,
    taxDocumentSummary,
  };
}

export function partnerConnectStatusLabel(status: PartnerConnectAccountStatus): string {
  switch (status) {
    case "not_connected":
      return "Not connected";
    case "pending":
      return "Pending verification";
    case "action_required":
      return "Action required";
    case "restricted":
      return "Restricted";
    case "ready":
      return "Ready for payouts";
    case "disabled":
      return "Disabled";
    default:
      return "Unknown";
  }
}

export function partnerConnectNextStep(status: PartnerConnectAccountStatus): string {
  switch (status) {
    case "not_connected":
      return "Connect with Stripe to receive commission payouts. Bank details stay with Stripe — never in ShootPortal.";
    case "pending":
      return "Finish Stripe onboarding, then return here. We refresh status from Stripe automatically.";
    case "action_required":
      return "Stripe needs more information. Continue onboarding to clear outstanding requirements.";
    case "restricted":
      return "Your payout account is restricted until Stripe finishes verification.";
    case "ready":
      return "Your payout account is ready. ShootPortal records payouts when your payable balance is sent.";
    case "disabled":
      return "This payout account is disabled. Contact support or reconnect with Stripe.";
    default:
      return "";
  }
}

/**
 * Tax identity / form status as Stripe exposes it on the Account object.
 * W-9 / W-8 collection happens inside Express onboarding (and Stripe tax products) —
 * we never collect TINs in-app. This only surfaces requirement keys Stripe already returns.
 */
export function partnerTaxDocumentStatusFromAccount(account: Stripe.Account): {
  status: "complete" | "action_required" | "pending" | "unavailable";
  summary: string | null;
} {
  const due = [
    ...(account.requirements?.currently_due ?? []),
    ...(account.requirements?.past_due ?? []),
  ];
  const taxRelated = due.filter((r) =>
    /tax|ssn|tin|id_number|ein|individual\.verification/i.test(r)
  );
  if (taxRelated.length > 0) {
    return {
      status: "action_required",
      summary: taxRelated.slice(0, 8).join(", "),
    };
  }
  if (account.payouts_enabled && account.details_submitted) {
    return { status: "complete", summary: null };
  }
  if (account.id) {
    return { status: "pending", summary: null };
  }
  return { status: "unavailable", summary: null };
}

export function partnerTaxDocumentStatusLabel(
  status: "complete" | "action_required" | "pending" | "unavailable"
): string {
  switch (status) {
    case "complete":
      return "Tax identity on file with Stripe";
    case "action_required":
      return "Tax information needed in Stripe";
    case "pending":
      return "Tax information pending in Stripe";
    default:
      return "Tax document status unavailable";
  }
}
