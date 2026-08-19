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

/**
 * Canonical public origin for a business (emails, push, Stripe customer redirects).
 * Prefer `custom_domain`; otherwise `{slug}.{PLATFORM_ROOT_DOMAIN}`.
 */
export function getBusinessPortalOrigin(business: PortalUrlBusiness): string {
  const custom = business.custom_domain?.trim();
  if (custom) {
    return `https://${stripHost(custom)}`;
  }
  const slug = business.slug.trim().toLowerCase();
  return `https://${slug}.${getPlatformRootDomain()}`;
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
    return `https://${getPlatformRootDomain()}`;
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
 */
export function getLoginRedirectOrigin(
  business: PortalUrlBusiness,
  current: { hostname: string; origin: string }
): string {
  const host = current.hostname.toLowerCase().split(":")[0];
  if (host === "localhost" || host === "127.0.0.1") {
    return `${current.origin.replace(/\/$/, "")}/b/${business.slug}`;
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
