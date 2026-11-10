/**
 * robots.txt / sitemap.xml for Business Websites.
 *
 * Those two routes are excluded from the proxy (no host headers), so the host is resolved here
 * directly. Only the canonical website host — the Business Website domain when connected, else
 * the client portal address — gets website robots rules and a sitemap. Other hosts serving the
 * same pages mark them noindex + canonical (see siteMetadata) so the site is never indexed twice.
 */
import { headers } from "next/headers";
import { getAppSettings } from "@/lib/app-settings";
import { normalizeHostname, resolveRequestHost } from "@/lib/host-resolution";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { loadSitePortfolio } from "@/lib/website/portfolio-server";
import { loadWebsiteDomainSummary } from "@/lib/website/server";
import { listBusinessServices } from "@/lib/business-services";

export type TenantSeoHost =
  | { kind: "platform" }
  | { kind: "tenant_private" }
  | { kind: "website"; origin: string; businessId: string };

export async function resolveSeoHost(): Promise<TenantSeoHost> {
  const h = await headers();
  const hostname = normalizeHostname(h.get("x-forwarded-host") || h.get("host"));
  const resolution = await resolveRequestHost({ hostname, pathname: "/", pathCookie: null });
  if (resolution.kind !== "tenant" || !resolution.business) return { kind: "platform" };
  const b = resolution.business;
  // Property website domains keep their existing behavior.
  if (resolution.source === "listing_domain") return { kind: "platform" };
  if (b.status !== "active" || b.deleted_at) return { kind: "tenant_private" };
  const settings = await getAppSettings(b.id);
  const domain = await loadWebsiteDomainSummary(b.id);
  const live = settings.website.launched || resolution.source === "website_domain";
  if (!live) return { kind: "tenant_private" };
  const canonical = domain.connected && domain.domain ? `https://${domain.domain}` : getBusinessPortalOrigin(b);
  let canonicalHost = "";
  try {
    canonicalHost = new URL(canonical).hostname;
  } catch {
    return { kind: "tenant_private" };
  }
  if (canonicalHost !== hostname) return { kind: "tenant_private" };
  return { kind: "website", origin: canonical, businessId: b.id };
}

export async function websiteSitemapUrls(businessId: string, origin: string): Promise<{ url: string; lastModified?: Date; priority: number }[]> {
  const [portfolio, services] = await Promise.all([
    loadSitePortfolio(businessId, "public"),
    listBusinessServices(businessId, { activeOnly: true }),
  ]);
  const urls: { url: string; lastModified?: Date; priority: number }[] = [{ url: `${origin}/`, priority: 1 }];
  if (portfolio.length) urls.push({ url: `${origin}/portfolio`, priority: 0.9 });
  if (services.some((s) => s.is_active)) urls.push({ url: `${origin}/services`, priority: 0.8 });
  const { website } = await getAppSettings(businessId);
  if (website.about.enabled) urls.push({ url: `${origin}/about`, priority: 0.7 });
  urls.push({ url: `${origin}/contact`, priority: 0.7 }, { url: `${origin}/request`, priority: 0.6 });
  for (const p of portfolio) {
    const d = new Date(p.publishedAt);
    urls.push({ url: `${origin}/portfolio/${p.slug}`, priority: 0.7, ...(Number.isFinite(d.getTime()) && d.getTime() > 0 ? { lastModified: d } : {}) });
  }
  return urls;
}
