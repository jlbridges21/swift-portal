/**
 * Property website URLs.
 *
 * - Branded:  https://{listing_domain}/{site_slug}         (once the listing domain is connected)
 * - Fallback: https://{business portal origin}/l/{site_slug}  (always works — no DNS needed)
 *
 * The fallback keeps working when a listing domain is pending, changed or removed, so a
 * published website is never left without an address.
 */

/** portal.yourstudio.com → listings.yourstudio.com (suggestion only; never auto-configured). */
export function suggestListingDomain(portalDomain: string | null | undefined): string | null {
  const d = portalDomain?.trim().toLowerCase();
  if (!d) return null;
  const parts = d.split(".");
  if (parts.length < 2) return null;
  const base = parts.length > 2 ? parts.slice(1).join(".") : d;
  return `listings.${base}`;
}

export type ListingDomainInfo = {
  domain: string | null;
  status: string | null;
  connected: boolean;
};

export function listingDomainConnected(row: {
  listing_domain?: string | null;
  listing_domain_status?: string | null;
  listing_domain_vercel_verified?: boolean | null;
  listing_domain_misconfigured?: boolean | null;
}): boolean {
  return Boolean(
    row.listing_domain &&
      row.listing_domain_status === "connected" &&
      row.listing_domain_vercel_verified === true &&
      row.listing_domain_misconfigured !== true
  );
}

export function brandedListingUrl(listingDomain: string, slug: string): string {
  return `https://${listingDomain}/${slug}`;
}

export function fallbackListingPath(slug: string): string {
  return `/l/${slug}`;
}

export const LISTING_SUBDOMAIN_SUGGESTIONS = ["listings", "homes", "properties", "tours"] as const;
