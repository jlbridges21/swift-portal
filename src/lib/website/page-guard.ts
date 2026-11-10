import { notFound } from "next/navigation";
import { loadPublicSite, type PublicSite } from "@/lib/website/server";

/**
 * Public website pages exist on an active tenant host once the Business Website is live (or on
 * the Business Website domain itself). Businesses still on the classic landing page keep their
 * current public surface until they publish.
 */
export async function requirePublicSite(): Promise<PublicSite> {
  const site = await loadPublicSite();
  if (!site) notFound();
  if (!site.settings.website.launched && !site.onWebsiteDomain) notFound();
  return site;
}

export async function optionalPublicSite(): Promise<PublicSite | null> {
  const site = await loadPublicSite();
  if (!site) return null;
  if (!site.settings.website.launched && !site.onWebsiteDomain) return null;
  return site;
}
