import type { MetadataRoute } from "next";
import { getCanonicalSiteUrl } from "@/lib/site-metadata";
import { getAllArticles } from "@/lib/blog/registry";

/**
 * /sitemap.xml for Google Search Console: public, indexable marketing pages and
 * every blog article, at the canonical www host.
 *
 * Deliberately excluded:
 * - The SaaS app (/admin, /dashboard, /platform, /partner, /billing, /onboarding, /api…)
 * - Account flows (/signup, /login, /finish-setup, /auth) — not search landing pages
 * - Partner referral landings (/{slug}) — noindex, canonical → /partners
 * - Tenant portals ({slug}.shootportal.app, custom domains) — robots disallow all
 *
 * lastmod is only set where the date is real (article dates, legal "Last updated").
 * Google ignores lastmod when it's always "now", so undated pages omit it.
 * New blog articles appear automatically via the blog registry.
 */

/** Keep in sync with the "Last updated" line on each legal page. */
const LEGAL_LAST_UPDATED = {
  "/privacy": "2026-10-15",
  "/terms": "2026-09-24",
} as const;

type Entry = MetadataRoute.Sitemap[number];

export default function sitemap(): MetadataRoute.Sitemap {
  const base = getCanonicalSiteUrl();
  const day = (iso: string) => new Date(`${iso}T00:00:00Z`);

  const articles = getAllArticles();
  const newestArticle = articles.reduce<string | null>((max, a) => {
    const d = a.updatedAt ?? a.publishedAt;
    return !max || d > max ? d : max;
  }, null);

  const pages: Entry[] = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/how-it-works`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.9 },
    {
      url: `${base}/blog`,
      ...(newestArticle ? { lastModified: day(newestArticle) } : {}),
      changeFrequency: "weekly",
      priority: 0.8,
    },
    { url: `${base}/partners`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/strategic-partners`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/contact`, changeFrequency: "yearly", priority: 0.5 },
    { url: `${base}/privacy`, lastModified: day(LEGAL_LAST_UPDATED["/privacy"]), changeFrequency: "yearly", priority: 0.2 },
    { url: `${base}/terms`, lastModified: day(LEGAL_LAST_UPDATED["/terms"]), changeFrequency: "yearly", priority: 0.2 },
  ];

  const blog: Entry[] = articles.map((a) => ({
    url: `${base}/blog/${a.slug}`,
    lastModified: day(a.updatedAt ?? a.publishedAt),
    changeFrequency: "monthly",
    priority: a.featured ? 0.8 : 0.7,
  }));

  return [...pages, ...blog];
}
