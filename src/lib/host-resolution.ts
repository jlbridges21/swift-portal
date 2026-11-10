import { cache } from "react";
import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { getPlatformRootDomain } from "@/lib/site-metadata";
import {
  BUSINESS_SLUG_RE,
  isReservedPlatformSubdomain,
} from "@/lib/reserved-subdomains";

/** Overwritten on every proxy pass — never trust a client-supplied value. */
export const HOST_KIND_HEADER = "x-sp-host-kind";
export const HOST_BUSINESS_ID_HEADER = "x-sp-business-id";
export const HOST_BUSINESS_SLUG_HEADER = "x-sp-business-slug";
export const HOST_BUSINESS_STATUS_HEADER = "x-sp-business-status";
export const HOST_RESOLVE_SOURCE_HEADER = "x-sp-resolve-source";

export const PATH_TENANT_COOKIE = "sp_path_tenant";

const HOST_CACHE_TTL_MS = 30_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HostKind = "tenant" | "platform" | "unmatched";
export type HostResolveSource =
  | "custom_domain"
  /** businesses.listing_domain — public property websites only (Marketing Kit, v118). */
  | "listing_domain"
  /** businesses.website_domain — the public Business Website (v119). No portal on this host. */
  | "website_domain"
  | "subdomain"
  | "path"
  | "apex"
  | "reserved"
  | "unmatched";

/** Columns middleware + isLiveBusiness need for tenant host lookups. */
export const HOST_BUSINESS_SELECT =
  "id, slug, name, status, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured, deleted_at, subscription_status, trial_ends_at, comped_until, comped_reason, plan, subscription_current_period_end, subscription_cancel_at_period_end, onboarding_completed_at, onboarding_state";

export type HostBusinessRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  custom_domain: string | null;
  custom_domain_status: string | null;
  custom_domain_vercel_verified: boolean;
  custom_domain_misconfigured: boolean | null;
  deleted_at: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  comped_until: string | null;
  comped_reason: string | null;
  plan: string;
  subscription_current_period_end: string | null;
  subscription_cancel_at_period_end: boolean;
  onboarding_completed_at: string | null;
  onboarding_state: unknown;
};

export type HostResolution = {
  kind: HostKind;
  source: HostResolveSource;
  business: HostBusinessRow | null;
  pathPrefix: string;
  rewritePathname: string | null;
  setPathCookie: string | null;
  clearPathCookie: boolean;
  /** source = website_domain: the business's main website host (www.yourstudio.com). */
  websiteDomain?: string;
  /** The request came in on the bare/www alternate that should redirect to websiteDomain. */
  websiteAlternate?: boolean;
};

type CacheEntry = { expiresAt: number; business: HostBusinessRow | null };

const hostLookupCache = new Map<string, CacheEntry>();

function serviceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}

export function normalizeHostname(hostHeader: string | null): string {
  const raw = (hostHeader ?? "").split(",")[0]?.trim() ?? "";
  return raw.replace(/:\d+$/, "").replace(/\.$/, "").toLowerCase();
}

export function parsePathTenantPrefix(pathname: string): {
  slug: string | null;
  remainder: string;
} {
  const match = pathname.match(/^\/b\/([^/]+)(?:\/(.*))?$/);
  if (!match) return { slug: null, remainder: pathname };
  const slug = match[1].toLowerCase();
  if (!BUSINESS_SLUG_RE.test(slug)) return { slug: null, remainder: pathname };
  const rest = match[2] ? `/${match[2]}` : "/";
  return { slug, remainder: rest };
}

function cacheGet(key: string): HostBusinessRow | null | undefined {
  const hit = hostLookupCache.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    hostLookupCache.delete(key);
    return undefined;
  }
  return hit.business;
}

function cacheSet(key: string, business: HostBusinessRow | null) {
  hostLookupCache.set(key, { expiresAt: Date.now() + HOST_CACHE_TTL_MS, business });
}

export function invalidateHostLookupCache() {
  hostLookupCache.clear();
  websiteLookupCache.clear();
  redirectCache.clear();
}

async function lookupByCustomDomain(host: string): Promise<HostBusinessRow | null> {
  const key = `custom:${host}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const supabase = serviceClient();
  const { data } = await supabase
    .from("businesses")
    .select(HOST_BUSINESS_SELECT)
    .eq("custom_domain", host)
    .maybeSingle();
  cacheSet(key, (data as HostBusinessRow | null) ?? null);
  return (data as HostBusinessRow | null) ?? null;
}

/**
 * Property website host (businesses.listing_domain). Only CONNECTED listing domains route:
 * pending/misconfigured ones keep using the ShootPortal fallback URL. Before migration v118
 * the column doesn't exist; the query errors and this returns null (no behavior change).
 */
async function lookupByListingDomain(host: string): Promise<HostBusinessRow | null> {
  const key = `listing:${host}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(HOST_BUSINESS_SELECT)
    .eq("listing_domain", host)
    .eq("listing_domain_status", "connected")
    .is("deleted_at", null)
    .maybeSingle();
  const row = error ? null : ((data as HostBusinessRow | null) ?? null);
  cacheSet(key, row);
  return row;
}

/**
 * On a listing domain every page path maps onto the property-website routes:
 *   /            → /l           (index of published listings)
 *   /{slug}      → /l/{slug}
 * Public listing APIs, Next assets and static files pass through unchanged; anything else
 * becomes a 404 page. The portal (login, dashboard, admin, APIs) never runs on this host.
 */
export function listingHostRewrite(pathname: string): string | null {
  if (pathname.startsWith("/api/public/listing/") || pathname.startsWith("/_next/") || /\.[a-z0-9]{2,5}$/i.test(pathname)) {
    return null;
  }
  if (pathname === "/" || pathname === "") return "/l";
  const m = pathname.match(/^\/([a-z0-9]+(?:-[a-z0-9]+)*)\/?$/);
  if (m) return `/l/${m[1]}`;
  return "/l/__not-found";
}

/**
 * Business Website host (businesses.website_domain, v119), or its bare/www alternate registered as
 * a redirect (website_apex_redirect). Before v119 the columns don't exist; the query errors and
 * this returns null (no behavior change).
 */
async function lookupByWebsiteDomain(
  host: string
): Promise<{ business: HostBusinessRow; websiteDomain: string; isAlternate: boolean } | null> {
  // Hostname goes into a PostgREST filter: only plain DNS characters.
  if (!/^[a-z0-9.-]+$/.test(host)) return null;
  const key = `website:${host}`;
  const hit = websiteLookupCache.get(key);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("businesses")
    .select(`${HOST_BUSINESS_SELECT}, website_domain, website_apex_redirect`)
    .or(`website_domain.eq.${host},website_apex_redirect.eq.${host}`)
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  let value: { business: HostBusinessRow; websiteDomain: string; isAlternate: boolean } | null = null;
  if (!error && data) {
    const row = data as unknown as HostBusinessRow & { website_domain: string | null; website_apex_redirect: string | null };
    if (row.website_domain) {
      value = { business: row, websiteDomain: row.website_domain, isAlternate: row.website_domain !== host };
    }
  }
  websiteLookupCache.set(key, { expiresAt: Date.now() + HOST_CACHE_TTL_MS, value });
  return value;
}

const websiteLookupCache = new Map<
  string,
  { expiresAt: number; value: { business: HostBusinessRow; websiteDomain: string; isAlternate: boolean } | null }
>();

/**
 * Public Business Website pages live under the internal /site route segment. On every tenant
 * host (ShootPortal subdomain, portal domain, Business Website domain, /b/{slug}) the friendly
 * paths map onto it:  /portfolio, /portfolio/{slug}, /services, /contact.
 * "/" and "/request" are served by their existing routes.
 */
export function websitePagePath(pathname: string): string | null {
  const p = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname;
  if (p === "/portfolio" || p === "/services" || p === "/contact") return `/site${p}`;
  const m = p.match(/^\/portfolio\/([a-z0-9]+(?:-[a-z0-9]+)*)$/);
  if (m) return `/site/portfolio/${m[1]}`;
  return null;
}

/** Path segments that belong to the client portal / app — on a Business Website domain they move to the portal host. */
const PORTAL_PATH_PREFIXES = [
  "/app",
  "/login",
  "/auth",
  "/dashboard",
  "/admin",
  "/staff",
  "/billing",
  "/onboarding",
  "/platform",
  "/partner",
  "/signup",
  "/finish-setup",
  "/photo",
  "/folder",
  "/v",
  "/embed",
  "/view",
  "/w9",
  "/l",
  "/b",
  "/request/thank-you",
];

/** APIs the public website needs on its own domain (request form + portfolio media). */
const WEBSITE_DOMAIN_APIS = ["/api/request", "/api/catalog/services", "/api/public/portfolio/", "/api/public/website/"];

export type WebsiteDomainRoute =
  | { kind: "page"; rewrite: string | null }
  | { kind: "portal" }
  | { kind: "api_blocked" }
  | { kind: "unknown" };

/** How a path on a Business Website domain is handled (edge-safe, pure). */
export function classifyWebsiteDomainPath(pathname: string): WebsiteDomainRoute {
  if (pathname.startsWith("/_next/") || /\.[a-z0-9]{2,5}$/i.test(pathname) || pathname === "/robots.txt" || pathname === "/sitemap.xml") {
    return { kind: "page", rewrite: null };
  }
  if (pathname.startsWith("/api/")) {
    if (pathname === "/api/request" || WEBSITE_DOMAIN_APIS.some((a) => a.endsWith("/") ? pathname.startsWith(a) : pathname === a)) {
      return { kind: "page", rewrite: null };
    }
    return { kind: "api_blocked" };
  }
  if (pathname === "/" || pathname === "/request" || pathname === "/request/") return { kind: "page", rewrite: null };
  const site = websitePagePath(pathname);
  if (site) return { kind: "page", rewrite: site };
  if (pathname.startsWith("/site/")) return { kind: "page", rewrite: null };
  if (PORTAL_PATH_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return { kind: "portal" };
  return { kind: "unknown" };
}

const redirectCache = new Map<string, { expiresAt: number; value: { from: string; to: string }[] }>();

/** Business-defined old-website redirects (Settings → Business Website → Advanced). */
export async function lookupWebsiteRedirects(businessId: string): Promise<{ from: string; to: string }[]> {
  const hit = redirectCache.get(businessId);
  if (hit && Date.now() < hit.expiresAt) return hit.value;
  const supabase = serviceClient();
  const { data } = await supabase
    .from("business_settings")
    .select("redirects:settings->website->redirects")
    .eq("business_id", businessId)
    .maybeSingle();
  const raw = (data as { redirects?: unknown } | null)?.redirects;
  const value = Array.isArray(raw)
    ? raw
        .filter((r): r is { from: string; to: string } => Boolean(r) && typeof (r as { from?: unknown }).from === "string" && typeof (r as { to?: unknown }).to === "string")
        .slice(0, 50)
    : [];
  redirectCache.set(businessId, { expiresAt: Date.now() + HOST_CACHE_TTL_MS, value });
  return value;
}

export function lookupBusinessById(id: string): Promise<HostBusinessRow | null> {
  return lookupBusinessByIdCached(id, false);
}

/** Fresh DB read — used when a cached row would trap the user in onboarding. */
export async function lookupBusinessByIdFresh(id: string): Promise<HostBusinessRow | null> {
  return lookupBusinessByIdCached(id, true);
}

async function lookupBusinessByIdCached(
  id: string,
  bypassCache: boolean
): Promise<HostBusinessRow | null> {
  const key = `id:${id}`;
  if (!bypassCache) {
    const cached = cacheGet(key);
    if (cached !== undefined) return cached;
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("businesses")
    .select(HOST_BUSINESS_SELECT)
    .eq("id", id)
    .maybeSingle();
  const row = (data as HostBusinessRow | null) ?? null;
  cacheSet(key, row);
  return row;
}

async function lookupBySlug(slug: string): Promise<HostBusinessRow | null> {
  const key = `slug:${slug}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const supabase = serviceClient();
  const { data } = await supabase
    .from("businesses")
    .select(HOST_BUSINESS_SELECT)
    .eq("slug", slug)
    .maybeSingle();
  cacheSet(key, (data as HostBusinessRow | null) ?? null);
  return (data as HostBusinessRow | null) ?? null;
}

function platformApexHosts(): Set<string> {
  const root = getPlatformRootDomain();
  return new Set([root, `www.${root}`]);
}

function subdomainLabel(host: string, root: string): string | null {
  if (host === root || !host.endsWith(`.${root}`)) return null;
  const rest = host.slice(0, -(root.length + 1));
  if (!rest || rest.includes(".")) return null;
  return rest;
}

function tenantResult(
  business: HostBusinessRow,
  source: HostResolveSource,
  extras: Partial<HostResolution> = {}
): HostResolution {
  return {
    kind: "tenant",
    source,
    business,
    pathPrefix: extras.pathPrefix ?? "",
    rewritePathname: extras.rewritePathname ?? null,
    setPathCookie: extras.setPathCookie ?? null,
    clearPathCookie: extras.clearPathCookie ?? false,
  };
}

/**
 * Resolution order (prompt 18):
 * a) exact `businesses.custom_domain`
 * b) first label under PLATFORM_ROOT_DOMAIN equals `businesses.slug` exactly
 *    (reserved labels never match — they are the platform)
 * c) `/b/{slug}` path (local / unmatched hosts; also allowed on the platform apex).
 *    Reserved labels here are the platform, not a tenant.
 * d) apex shootportal.app → platform
 * e) unmatched
 *
 * Cookie `sp_path_tenant` is set when `/b/{slug}` matches a business. It is consulted **only for `/api/*`** so public signup and catalog calls still attribute correctly after rewrite. Document navigations without `/b/` on an unmatched host (including `/` on localhost) stay platform / unmatched — they must not inherit the last tenant from the cookie.
 */
export async function resolveRequestHost(input: {
  hostname: string;
  pathname: string;
  pathCookie: string | null;
}): Promise<HostResolution> {
  const host = normalizeHostname(input.hostname);
  const { slug: pathSlug, remainder } = parsePathTenantPrefix(input.pathname);
  const root = getPlatformRootDomain();
  const apex = platformApexHosts();

  const custom = host ? await lookupByCustomDomain(host) : null;
  if (custom) {
    return tenantResult(custom, "custom_domain", {
      rewritePathname: websitePagePath(pathSlug ? remainder : input.pathname) ?? (pathSlug ? remainder : null),
    });
  }

  // Listing / website domains are never under the platform root and never localhost.
  const maybeListingHost =
    Boolean(host) && host !== root && !host.endsWith(`.${root}`) && host !== "localhost" && !/^\d+\.\d+\.\d+\.\d+$/.test(host) && !host.endsWith(".vercel.app");
  if (maybeListingHost) {
    const website = await lookupByWebsiteDomain(host);
    if (website) {
      const route = classifyWebsiteDomainPath(input.pathname);
      return {
        ...tenantResult(website.business, "website_domain", {
          rewritePathname: route.kind === "page" ? route.rewrite : null,
        }),
        websiteDomain: website.websiteDomain,
        websiteAlternate: website.isAlternate,
      };
    }
    const listing = await lookupByListingDomain(host);
    if (listing) {
      return tenantResult(listing, "listing_domain", {
        rewritePathname: listingHostRewrite(input.pathname),
      });
    }
  }

  const label = host ? subdomainLabel(host, root) : null;
  const reservedHostLabel = Boolean(label && isReservedPlatformSubdomain(label));
  if (label && !reservedHostLabel && BUSINESS_SLUG_RE.test(label)) {
    const byLabel = await lookupBySlug(label);
    if (byLabel) {
      return tenantResult(byLabel, "subdomain", {
        rewritePathname: websitePagePath(pathSlug ? remainder : input.pathname) ?? (pathSlug ? remainder : null),
      });
    }
  }

  if (pathSlug) {
    if (isReservedPlatformSubdomain(pathSlug)) {
      return {
        kind: "platform",
        source: "reserved",
        business: null,
        pathPrefix: "",
        rewritePathname: remainder,
        setPathCookie: null,
        clearPathCookie: true,
      };
    }
    const byPath = await lookupBySlug(pathSlug);
    if (byPath) {
      return tenantResult(byPath, "path", {
        pathPrefix: `/b/${pathSlug}`,
        rewritePathname: websitePagePath(remainder) ?? remainder,
        setPathCookie: pathSlug,
      });
    }
    return {
      kind: "platform",
      source: "path",
      business: null,
      pathPrefix: "",
      rewritePathname: remainder,
      setPathCookie: null,
      clearPathCookie: true,
    };
  }

  if (host && (apex.has(host) || reservedHostLabel)) {
    return {
      kind: "platform",
      source: reservedHostLabel ? "reserved" : "apex",
      business: null,
      pathPrefix: "",
      rewritePathname: null,
      setPathCookie: null,
      clearPathCookie: false,
    };
  }

  const cookieSlug = input.pathCookie?.trim().toLowerCase() ?? "";
  if (
    cookieSlug &&
    BUSINESS_SLUG_RE.test(cookieSlug) &&
    !isReservedPlatformSubdomain(cookieSlug) &&
    input.pathname.startsWith("/api/")
  ) {
    const byCookie = await lookupBySlug(cookieSlug);
    if (byCookie) {
      return tenantResult(byCookie, "path", { pathPrefix: `/b/${cookieSlug}` });
    }
  }

  return {
    kind: "unmatched",
    source: "unmatched",
    business: null,
    pathPrefix: "",
    rewritePathname: null,
    setPathCookie: null,
    clearPathCookie: false,
  };
}

export function applyHostHeaders(headers: Headers, resolution: HostResolution) {
  headers.delete(HOST_KIND_HEADER);
  headers.delete(HOST_BUSINESS_ID_HEADER);
  headers.delete(HOST_BUSINESS_SLUG_HEADER);
  headers.delete(HOST_BUSINESS_STATUS_HEADER);
  headers.delete(HOST_RESOLVE_SOURCE_HEADER);

  headers.set(HOST_KIND_HEADER, resolution.kind);
  headers.set(HOST_RESOLVE_SOURCE_HEADER, resolution.source);
  if (resolution.business) {
    headers.set(HOST_BUSINESS_ID_HEADER, resolution.business.id);
    headers.set(HOST_BUSINESS_SLUG_HEADER, resolution.business.slug);
    headers.set(HOST_BUSINESS_STATUS_HEADER, resolution.business.deleted_at ? "deleted" : resolution.business.status);
  } else {
    headers.set(HOST_BUSINESS_ID_HEADER, "");
    headers.set(HOST_BUSINESS_SLUG_HEADER, "");
    headers.set(HOST_BUSINESS_STATUS_HEADER, "");
  }
}

export type PublicHostContext = {
  kind: HostKind;
  source: HostResolveSource;
  businessId: string | null;
  slug: string | null;
  status: string | null;
};

async function readPublicHostContext(): Promise<PublicHostContext> {
  const h = await headers();
  const kind = (h.get(HOST_KIND_HEADER) as HostKind | null) ?? "unmatched";
  const businessId = h.get(HOST_BUSINESS_ID_HEADER)?.trim() || null;
  const slug = h.get(HOST_BUSINESS_SLUG_HEADER)?.trim() || null;
  const status = h.get(HOST_BUSINESS_STATUS_HEADER)?.trim() || null;
  const source = (h.get(HOST_RESOLVE_SOURCE_HEADER) as HostResolveSource | null) ?? "unmatched";
  return {
    kind: kind === "tenant" || kind === "platform" || kind === "unmatched" ? kind : "unmatched",
    source,
    businessId: businessId && UUID_RE.test(businessId) ? businessId : null,
    slug,
    status,
  };
}

export const getPublicHostContext: () => Promise<PublicHostContext> = cache(readPublicHostContext);

export function isActivePublicTenant(host: PublicHostContext): host is PublicHostContext & {
  kind: "tenant";
  businessId: string;
} {
  return host.kind === "tenant" && Boolean(host.businessId) && host.status === "active";
}
