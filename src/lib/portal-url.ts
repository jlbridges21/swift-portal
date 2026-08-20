import { createClient } from "@supabase/supabase-js";
import { getPlatformRootDomain } from "@/lib/site-metadata";

export type PortalUrlBusiness = {
  slug: string;
  custom_domain: string | null;
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
    const fallback = `https://${getPlatformRootDomain()}`;
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
    return `https://${getPlatformRootDomain()}`;
  }
  return "http://localhost:3000";
}

/** Platform marketing apex (Site URL) — e.g. https://shootportal.app */
export function getPlatformApexOrigin(): string {
  if (process.env.NODE_ENV === "production") {
    return assertPublicPortalOrigin(`https://${getPlatformRootDomain()}`, "getPlatformApexOrigin");
  }
  const raw = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");
  if (raw) return assertPublicPortalOrigin(raw, "getPlatformApexOrigin.dev");
  return "http://localhost:3000";
}

/**
 * Canonical public origin for a business (emails, push, Stripe customer redirects).
 * Prefer `custom_domain`; otherwise `{slug}.{PLATFORM_ROOT_DOMAIN}`.
 */
export function getBusinessPortalOrigin(business: PortalUrlBusiness): string {
  const custom = business.custom_domain?.trim();
  if (custom) {
    return assertPublicPortalOrigin(`https://${stripHost(custom)}`, "getBusinessPortalOrigin.custom_domain");
  }
  const slug = business.slug?.trim().toLowerCase() ?? "";
  if (!slug) {
    console.error("[portal-url] getBusinessPortalOrigin: business has no slug or custom_domain", business);
    return assertPublicPortalOrigin(`https://${getPlatformRootDomain()}`, "getBusinessPortalOrigin.unresolved");
  }
  return assertPublicPortalOrigin(
    `https://${slug}.${getPlatformRootDomain()}`,
    "getBusinessPortalOrigin.subdomain"
  );
}

export async function getBusinessPortalOriginById(businessId: string): Promise<string> {
  const supabase = serviceClient();
  const { data } = await supabase
    .from("businesses")
    .select("slug, custom_domain")
    .eq("id", businessId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data?.slug) {
    console.error("[portal-url] getBusinessPortalOriginById: business not resolved", { businessId });
    return assertPublicPortalOrigin(`https://${getPlatformRootDomain()}`, "getBusinessPortalOriginById.unresolved");
  }
  return getBusinessPortalOrigin(data);
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
 * `foreignTenantHost`: the Host already resolved to a *different* business
 * (middleware / post-login). Always send the user to their canonical origin.
 * Without this flag, a business that has no custom_domain used to "stay" on
 * any host that is not `*.{PLATFORM_ROOT_DOMAIN}` — including another
 * tenant's custom domain (e.g. Test Pilot admin on portal.swiftaerialmedia.com).
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
  const custom = business.custom_domain ? stripHost(business.custom_domain) : "";
  const firstLabel = host.endsWith(`.${root}`) ? host.slice(0, -(root.length + 1)).split(".")[0] : "";
  const onOwnCustom = Boolean(custom && host === custom);
  const onOwnSubdomain = firstLabel === business.slug && host === `${business.slug}.${root}`;
  if (onOwnCustom || onOwnSubdomain) {
    return current.origin.replace(/\/$/, "");
  }
  if (vercelPreview || isApex || (!custom && !host.endsWith(`.${root}`))) {
    return current.origin.replace(/\/$/, "");
  }
  return getBusinessPortalOrigin(business);
}
