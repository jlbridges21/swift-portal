import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";
import { getAllArticles } from "@/lib/blog/registry";

/**
 * Platform apex marketing sitemap only.
 * Tenant portals ({slug}.shootportal.app / custom domains) are never listed —
 * they must not be indexed as ShootPortal marketing pages.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = getCanonicalSiteUrl();
  const lastModified = new Date();

  const paths = [
    "",
    "/how-it-works",
    "/pricing",
    "/partners",
    "/strategic-partners",
    "/contact",
    "/blog",
    "/privacy",
    "/terms",
    "/signup",
  ];

  const pages: MetadataRoute.Sitemap = paths.map((path) => ({
    url: `${base}${path || "/"}`,
    lastModified,
    changeFrequency: path === "/pricing" ? "daily" : "weekly",
    priority: path === "" ? 1 : path === "/pricing" || path === "/signup" ? 0.9 : 0.7,
  }));

  const articles: MetadataRoute.Sitemap = getAllArticles().map((a) => ({
    url: `${base}/blog/${a.slug}`,
    lastModified: new Date(`${a.updatedAt ?? a.publishedAt}T00:00:00Z`),
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...pages, ...articles];
}
