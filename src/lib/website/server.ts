/**
 * Business Website — per-request loading for the public pages (server only).
 */
import { cache } from "react";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getAppSettings, type AppSettings } from "@/lib/app-settings";
import { listBusinessServices } from "@/lib/business-services";
import { getPublicHostContext, isActivePublicTenant, normalizeHostname, type PublicHostContext } from "@/lib/host-resolution";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { loadSitePortfolio } from "@/lib/website/portfolio-server";
import { buildSiteView, type SiteBusinessInput, type SiteServiceInput, type SiteView } from "@/lib/website/view";
import type { BusinessServiceRow } from "@/lib/types";

export function siteBusinessFromSettings(settings: AppSettings): SiteBusinessInput {
  const b = settings.business;
  return {
    name: b.businessName || b.portalName,
    tagline: b.tagline,
    logoUrl: b.logoUrl,
    primaryColor: b.brandPrimaryColor,
    accentColor: b.brandAccentColor,
    email: b.primaryContactEmail || b.supportEmail,
    phone: b.phoneNumber,
    websiteUrl: b.websiteUrl,
    addressLine1: b.addressLine1,
    addressLine2: b.addressLine2,
    city: b.city,
    state: b.state,
    postalCode: b.postalCode,
    legalName: b.legalName,
    termsUrl: b.termsUrl,
    privacyUrl: b.privacyUrl,
  };
}

export function siteServicesFromRows(rows: BusinessServiceRow[]): SiteServiceInput[] {
  return rows
    .filter((s) => s.is_active)
    .map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      startingLabel: s.starting_label,
      priceCents: s.preliminary_estimate_cents,
      hidePricing: s.hide_pricing,
      includes: s.includes ?? [],
    }));
}

export type WebsiteDomainSummary = { domain: string | null; status: string | null; connected: boolean; setupRequired: boolean };

/** Business Website Address (v119). Tolerates the migration not being applied yet. */
export async function loadWebsiteDomainSummary(businessId: string): Promise<WebsiteDomainSummary> {
  const db = await createTenantServiceClient(businessId);
  const { data, error } = await db.raw
    .from("businesses")
    .select("website_domain, website_domain_status")
    .eq("id", businessId)
    .maybeSingle();
  if (error) return { domain: null, status: null, connected: false, setupRequired: true };
  const r = (data ?? {}) as { website_domain?: string | null; website_domain_status?: string | null };
  const domain = r.website_domain?.trim().toLowerCase() || null;
  return { domain, status: r.website_domain_status ?? null, connected: Boolean(domain) && r.website_domain_status === "connected", setupRequired: false };
}

export type PublicSite = {
  businessId: string;
  host: PublicHostContext;
  settings: AppSettings;
  view: SiteView;
  /** Origin search engines should index (Business Website domain when connected). */
  canonicalOrigin: string;
  /** False on the ShootPortal fallback / portal hosts once a Business Website domain is live. */
  isCanonicalHost: boolean;
  portalOrigin: string;
  /** Business Website domain host — no portal session/auth runs here. */
  onWebsiteDomain: boolean;
};

async function currentHostname(): Promise<string> {
  const h = await headers();
  return normalizeHostname(h.get("x-forwarded-host") || h.get("host"));
}

async function loadPublicSiteUncached(): Promise<PublicSite | null> {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return null;
  const businessId = host.businessId;
  const [settings, serviceRows, portalOrigin, domain, hostname] = await Promise.all([
    getAppSettings(businessId),
    listBusinessServices(businessId, { activeOnly: true }),
    getBusinessPortalOriginById(businessId),
    loadWebsiteDomainSummary(businessId),
    currentHostname(),
  ]);
  const portfolio = await loadSitePortfolio(businessId, "public", settings.portfolio);
  const onWebsiteDomain = host.source === "website_domain";
  const view = buildSiteView({
    website: settings.website,
    business: siteBusinessFromSettings(settings),
    services: siteServicesFromRows(serviceRows),
    portfolio,
    links: {
      clientLogin: onWebsiteDomain ? `${portalOrigin}/login` : "/login",
      request: "/request",
    },
  });
  const canonicalOrigin = domain.connected && domain.domain ? `https://${domain.domain}` : portalOrigin;
  let canonicalHost = "";
  try {
    canonicalHost = new URL(canonicalOrigin).hostname;
  } catch {
    canonicalHost = "";
  }
  return {
    businessId,
    host,
    settings,
    view,
    canonicalOrigin,
    isCanonicalHost: hostname === canonicalHost,
    portalOrigin,
    onWebsiteDomain,
  };
}

/** One load per request (layout, metadata and page share it). */
export const loadPublicSite: () => Promise<PublicSite | null> = cache(loadPublicSiteUncached);

/** Page metadata: titles, description, canonical URL and social previews. */
export function siteMetadata(
  site: PublicSite,
  page: { path: string; title?: string; description?: string; image?: string | null }
): Metadata {
  const v = site.view;
  const name = v.business.name;
  const homeTitle = site.settings.website.seoTitle || `${name}${v.business.tagline ? ` | ${v.business.tagline}` : ` | ${v.hero.headline}`}`;
  const title = page.title ? `${page.title} | ${name}` : homeTitle;
  const description = (page.description || site.settings.website.seoDescription || v.hero.intro).slice(0, 170);
  const canonical = `${site.canonicalOrigin}${page.path === "/" ? "/" : page.path}`;
  const image = page.image ?? v.featured[0]?.cover?.mediumUrl ?? (v.hero.media.kind === "image" ? v.hero.media.url : null);
  const absImage = image ? (image.startsWith("http") ? image : `${site.canonicalOrigin}${image}`) : undefined;
  return {
    title: { absolute: title.slice(0, 120) },
    description,
    alternates: { canonical },
    // Only the canonical host is indexable — the ShootPortal fallback and portal addresses stay
    // reachable but never compete with the business's own domain in search results.
    robots: site.isCanonicalHost ? { index: true, follow: true } : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: name,
      title,
      description,
      url: canonical,
      images: absImage ? [{ url: absImage, width: 1600 }] : undefined,
    },
    twitter: { card: absImage ? "summary_large_image" : "summary", title, description, images: absImage ? [absImage] : undefined },
    icons: site.settings.business.faviconUrl ? { icon: site.settings.business.faviconUrl } : undefined,
  };
}
