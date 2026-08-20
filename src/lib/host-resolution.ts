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
  | "subdomain"
  | "path"
  | "apex"
  | "reserved"
  | "unmatched";

/** Columns middleware + isLiveBusiness need for tenant host lookups. */
export const HOST_BUSINESS_SELECT =
  "id, slug, name, status, custom_domain, deleted_at, subscription_status, trial_ends_at, comped_until, comped_reason, plan";

export type HostBusinessRow = {
  id: string;
  slug: string;
  name: string;
  status: string;
  custom_domain: string | null;
  deleted_at: string | null;
  subscription_status: string;
  trial_ends_at: string | null;
  comped_until: string | null;
  comped_reason: string | null;
  plan: string;
};

export type HostResolution = {
  kind: HostKind;
  source: HostResolveSource;
  business: HostBusinessRow | null;
  pathPrefix: string;
  rewritePathname: string | null;
  setPathCookie: string | null;
  clearPathCookie: boolean;
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

export async function lookupBusinessById(id: string): Promise<HostBusinessRow | null> {
  const key = `id:${id}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;
  const supabase = serviceClient();
  const { data } = await supabase
    .from("businesses")
    .select(HOST_BUSINESS_SELECT)
    .eq("id", id)
    .maybeSingle();
  cacheSet(key, (data as HostBusinessRow | null) ?? null);
  return (data as HostBusinessRow | null) ?? null;
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
      rewritePathname: pathSlug ? remainder : null,
    });
  }

  const label = host ? subdomainLabel(host, root) : null;
  const reservedHostLabel = Boolean(label && isReservedPlatformSubdomain(label));
  if (label && !reservedHostLabel && BUSINESS_SLUG_RE.test(label)) {
    const byLabel = await lookupBySlug(label);
    if (byLabel) {
      return tenantResult(byLabel, "subdomain", {
        rewritePathname: pathSlug ? remainder : null,
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
        rewritePathname: remainder,
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
