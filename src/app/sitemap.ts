import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";

/**
 * Platform apex marketing sitemap only.
 * Tenant portals ({slug}.shootportal.app / custom domains) are never listed —
 * they must not be indexed as ShootPortal marketing pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getCanonicalSiteUrl();
  const lastModified = new Date();

  const paths = ["", "/how-it-works", "/pricing", "/contact", "/privacy", "/terms", "/signup"];

  return paths.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified,
    changeFrequency: path === "/pricing" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/pricing" || path === "/signup" ? 0.9 : 0.7,
  }));
}
