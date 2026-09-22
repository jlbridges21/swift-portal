import { createClient } from "@supabase/supabase-js";
import { getPlatformRootDomain } from "@/lib/site-metadata";

export type PortalUrlBusiness = {
  slug: string;
  custom_domain: string | null;
  /** When present, custom domain is used only if verified + healthy. */
  custom_domain_status?: string | null;
  custom_domain_vercel_verified?: boolean | null;
  custom_domain_misconfigured?: boolean | null;
};

function stripHost(value: string): string {
  return value.replace(/^https?:\/\//i, "").replace(/\/$/, "").toLowerCase();
}

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

/**
 * True when the custom domain is safe to send users to.
 * Missing health fields (legacy callers) → treat as unhealthy and use subdomain.
 * That is the lockout-safe default: a set-but-unverified domain must never win.
 */
export function isCustomDomainHealthy(
  business: Pick<
    PortalUrlBusiness,
    "custom_domain" | "custom_domain_status" | "custom_domain_vercel_verified" | "custom_domain_misconfigured"
  >
): boolean {
  const custom = business.custom_domain?.trim();
  if (!custom) return false;
  if (business.custom_domain_status !== "connected") return false;
  if (business.custom_domain_vercel_verified !== true) return false;
  if (business.custom_domain_misconfigured === true) return false;
  return true;
}

/** Always-working ShootPortal subdomain for a business slug. */
export function getBusinessSubdomainOrigin(slug: string): string {
  const clean = slug?.trim().toLowerCase() ?? "";
  if (!clean) {
    return assertPublicPortalOrigin(`https://${getPlatformApexHostname()}`, "getBusinessSubdomainOrigin.empty");
  }
  return assertPublicPortalOrigin(
    `https://${clean}.${getPlatformRootDomain()}`,
    "getBusinessSubdomainOrigin"
  );
}

export function isLocalOrRelativeOrigin(origin: string): boolean {
  const trimmed = origin.trim();
  if (!trimmed || trimmed.startsWith("/") || trimmed.startsWith(".")) return true;
  try {
    const url = new URL(trimmed.includes("://") ? trimmed : `https://${trimmed}`);
    const host = url.hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  } catch {
    return true;
  }
}

/**
 * Canonical platform apex hostname (www).
 * Vercel already 308s bare apex → www; we match that so PKCE cookies, Site URL,
 * and OAuth redirectTo never disagree about the host.
 */
export function getPlatformApexHostname(): string {
  return `www.${getPlatformRootDomain()}`;
}

/** True for bare apex or www (platform marketing hosts). */
export function isPlatformApexHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0]?.trim() ?? "";
  const root = getPlatformRootDomain().toLowerCase();
  return host === root || host === `www.${root}`;
}

/** Bare apex (no www) — must redirect to www before starting OAuth. */
export function isBarePlatformApexHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().split(":")[0]?.trim() ?? "";
  return host === getPlatformRootDomain().toLowerCase();
}

/**
 * Never return localhost or a relative URL in production. Callers pass the
 * candidate origin; we log and fall back to the platform apex if it is unsafe.
 */
export function assertPublicPortalOrigin(
  origin: string,
  context: string,
  production = process.env.NODE_ENV === "production"
): string {
  const trimmed = origin.trim().replace(/\/$/, "");
  const local = isLocalOrRelativeOrigin(trimmed);
  const missingHttps = production && !trimmed.toLowerCase().startsWith("https://");

  if (production && (local || missingHttps)) {
    const fallback = `https://${getPlatformApexHostname()}`;
    console.error("[portal-url] refused non-public origin in production", {
      context,
      origin: trimmed || "(empty)",
      fallback,
    });
    return fallback;
  }
  return trimmed;
}

/**
 * Deployment origin for OAuth callback URLs registered with Google/Stripe.
 * Localhost is allowed in development only.
 */
export function getDeploymentOrigin(): string {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (raw) return assertPublicPortalOrigin(raw, "NEXT_PUBLIC_APP_URL");
  if (process.env.NODE_ENV === "production") {
    return `https://${getPlatformApexHostname()}`;
  }
  return "http://localhost:3000";
}

/**
 * Platform marketing apex (Site URL) — https://www.shootportal.app in production.
 * Always www so PKCE verifier cookies and Supabase Site URL stay on one host.
 */
export function getPlatformApexOrigin(): string {
  if (process.env.NODE_ENV === "production") {
    return assertPublicPortalOrigin(`https://${getPlatformApexHostname()}`, "getPlatformApexOrigin");
  }
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (raw) return assertPublicPortalOrigin(raw, "getPlatformApexOrigin.dev");
  return "http://localhost:3000";
}

/**
 * Canonical public origin for a business (emails, push, Stripe customer redirects).
 * Prefer a VERIFIED + HEALTHY custom domain; otherwise `{slug}.{PLATFORM_ROOT_DOMAIN}`.
 * Never send users to a set-but-broken custom domain (login lockout).
 */
export function getBusinessPortalOrigin(business: PortalUrlBusiness): string {
  if (isCustomDomainHealthy(business)) {
    const custom = business.custom_domain!.trim();
    return assertPublicPortalOrigin(
      `https://${stripHost(custom)}`,
      "getBusinessPortalOrigin.custom_domain"
    );
  }

  const slug = business.slug?.trim().toLowerCase() ?? "";
  if (!slug) {
    console.error("[portal-url] getBusinessPortalOrigin: business has no slug", business);
    return assertPublicPortalOrigin(`https://${getPlatformApexHostname()}`, "getBusinessPortalOrigin.unresolved");
  }

  if (business.custom_domain?.trim()) {
    console.warn("[portal-url] custom domain set but not healthy — using subdomain escape hatch", {
      slug,
      custom_domain: business.custom_domain,
      custom_domain_status: business.custom_domain_status ?? null,
      custom_domain_vercel_verified: business.custom_domain_vercel_verified ?? null,
      custom_domain_misconfigured: business.custom_domain_misconfigured ?? null,
    });
  }

  return getBusinessSubdomainOrigin(slug);
}

export async function getBusinessPortalOriginById(businessId: string): Promise<string> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("businesses")
    .select(
      "slug, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured"
    )
    .eq("id", businessId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data?.slug) {
    console.error("[portal-url] getBusinessPortalOriginById: business not resolved", { businessId });
    return assertPublicPortalOrigin(`https://${getPlatformApexHostname()}`, "getBusinessPortalOriginById.unresolved");
  }
  return getBusinessPortalOrigin(data);
}

/** Share access links + host checks — use local `/b/{slug}` origin in dev. */
export async function getShareAccessPortalOrigin(businessId: string): Promise<string> {
  const dep = getDeploymentOrigin();
  try {
    const depHost = new URL(dep).hostname;
    if (depHost === "localhost" || depHost === "127.0.0.1") {
      const supabase = serviceClient();
      const { data } = await supabase
        .from("businesses")
        .select("slug")
        .eq("id", businessId)
        .is("deleted_at", null)
        .maybeSingle();
      if (data?.slug) {
        return `${dep.replace(/\/$/, "")}/b/${data.slug}`;
      }
    }
  } catch {
    /* fall through to canonical portal origin */
  }
  return getBusinessPortalOriginById(businessId);
}

export function joinPortalPath(origin: string, path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  const prefix = origin.replace(/\/$/, "");
  const suffix = path.startsWith("/") ? path : `/${path}`;
  return `${prefix}${suffix}`;
}

export async function businessPortalHref(businessId: string, path: string): Promise<string> {
  const origin = await getBusinessPortalOriginById(businessId);
  return joinPortalPath(origin, path);
}

/**
 * Where to send a logged-in user after auth, given the current request host.
 * Unmatched hosts (Vercel previews, bare localhost) stay on this origin.
 * Local `/b/{slug}` uses the same origin with the path prefix.
 *
 * Platform apex (www or bare): always send the user to their business portal
 * (healthy custom domain or `{slug}.{root}`). Never strand on a dead custom domain.
 *
 * Escape hatch: `{slug}.{PLATFORM_ROOT_DOMAIN}` always works via host resolution
 * even when a custom_domain field is set but unhealthy.
 *
 * `foreignTenantHost`: the Host already resolved to a *different* business
 * (middleware / post-login). Always send the user to their canonical origin.
 */
export function getLoginRedirectOrigin(
  business: PortalUrlBusiness,
  current: { hostname: string; origin: string },
  opts?: { foreignTenantHost?: boolean }
): string {
  const host = current.hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") {
    return `${current.origin.replace(/\/$/, "")}/b/${business.slug}`;
  }
  if (opts?.foreignTenantHost) {
    return getBusinessPortalOrigin(business);
  }
  const vercelPreview = host.endsWith(".vercel.app");
  const root = getPlatformRootDomain();
  const isApex = host === root || host === `www.${root}`;
  const healthyCustom = isCustomDomainHealthy(business) ? stripHost(business.custom_domain!) : "";
  const firstLabel = host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)).split(".")[0] : "";
  const onOwnHealthyCustom = Boolean(healthyCustom && host === healthyCustom);
  const onOwnSubdomain = firstLabel === business.slug && host === `${business.slug}.${root}`;
  if (onOwnHealthyCustom || onOwnSubdomain) {
    return current.origin.replace(/\/$/, "");
  }
  // Apex login must never strand tenants on the marketing host.
  if (isApex) {
    return getBusinessPortalOrigin(business);
  }
  // Already on a set-but-unhealthy custom host that somehow reached the app —
  // bounce to the subdomain escape hatch instead of staying on a dead domain.
  const rawCustom = business.custom_domain ? stripHost(business.custom_domain) : "";
  if (rawCustom && host === rawCustom && !healthyCustom) {
    return getBusinessSubdomainOrigin(business.slug);
  }
  if (vercelPreview || (!healthyCustom && !host.endsWith(`.${root}`))) {
    return current.origin.replace(/\/$/, "");
  }
  return getBusinessPortalOrigin(business);
}
