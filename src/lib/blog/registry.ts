import type { BlogCardData } from "@/components/blog/blog-card";
import { BLOG_CATEGORIES, type BlogArticle } from "@/lib/blog/types";
import { BLOG_SLUGS } from "@/lib/blog/slugs";
import { formatBlogDate } from "@/lib/blog/format";
import { article as bestRealEstatePhotographySoftware } from "@/content/blog/best-real-estate-photography-software";
import { article as bestDroneBusinessManagementSoftware } from "@/content/blog/best-drone-business-management-software";
import { article as bestAryeoAlternatives } from "@/content/blog/best-aryeo-alternatives";
import { article as bestRealEstatePhotographyDeliverySoftware } from "@/content/blog/best-real-estate-photography-delivery-software";
import { article as bestPhotographyCrmSoftware } from "@/content/blog/best-photography-crm-software";
import { article as bestHdphotohubAlternatives } from "@/content/blog/best-hdphotohub-alternatives";
import { article as bestPhotographyClientPortals } from "@/content/blog/best-photography-client-portals";
import { article as bestPhotoVideoDeliveryPlatforms } from "@/content/blog/best-photo-video-delivery-platforms";
import { article as bestRealEstatePhotographyBookingSoftware } from "@/content/blog/best-real-estate-photography-booking-software";
import { article as shootportalVsAryeoVsHdphotohub } from "@/content/blog/shootportal-vs-aryeo-vs-hdphotohub";

/**
 * To publish an article: add its module under src/content/blog/, add the slug
 * to BLOG_SLUGS, and list it here. Routes, sitemap, and the index pick it up.
 */
const ARTICLES: readonly BlogArticle[] = [
  bestRealEstatePhotographySoftware,
  bestDroneBusinessManagementSoftware,
  bestAryeoAlternatives,
  bestRealEstatePhotographyDeliverySoftware,
  bestPhotographyCrmSoftware,
  bestHdphotohubAlternatives,
  bestPhotographyClientPortals,
  bestPhotoVideoDeliveryPlatforms,
  bestRealEstatePhotographyBookingSoftware,
  shootportalVsAryeoVsHdphotohub,
];

function validate(list: readonly BlogArticle[]) {
  const seen = new Set<string>();
  const known = new Set<string>(BLOG_SLUGS);
  for (const a of list) {
    if (seen.has(a.slug)) throw new Error(`[blog] duplicate slug: ${a.slug}`);
    if (!known.has(a.slug)) throw new Error(`[blog] slug missing from BLOG_SLUGS: ${a.slug}`);
    seen.add(a.slug);
    const ids = new Set<string>();
    for (const s of a.sections) {
      if (ids.has(s.id) || s.id === "faq") throw new Error(`[blog] duplicate section id "${s.id}" in ${a.slug}`);
      ids.add(s.id);
    }
  }
  for (const a of list) {
    for (const r of a.related) {
      if (!seen.has(r)) throw new Error(`[blog] ${a.slug} lists unknown related article: ${r}`);
    }
  }
  if (list.filter((a) => a.featured).length > 1) throw new Error("[blog] more than one featured article");
}
validate(ARTICLES);

/** Newest first; ties keep registry (priority) order. */
const SORTED = [...ARTICLES].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));

export function getAllArticles(): readonly BlogArticle[] {
  return SORTED;
}

export function getArticle(slug: string): BlogArticle | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getFeaturedArticle(): BlogArticle {
  return ARTICLES.find((a) => a.featured) ?? SORTED[0];
}

export function getCategoryLabel(slug: string): string {
  return BLOG_CATEGORIES.find((c) => c.slug === slug)?.label ?? "Articles";
}

export function getCategoryCounts() {
  return BLOG_CATEGORIES.map((c) => ({
    slug: c.slug,
    label: c.label,
    count: ARTICLES.filter((a) => a.category === c.slug).length,
  })).filter((c) => c.count > 0);
}

export function toCardData(a: BlogArticle): BlogCardData {
  return {
    slug: a.slug,
    title: a.title,
    excerpt: a.excerpt,
    categorySlug: a.category,
    categoryLabel: getCategoryLabel(a.category),
    readingMinutes: a.readingMinutes,
    publishedAt: a.publishedAt,
    publishedLabel: formatBlogDate(a.publishedAt),
    cover: { variant: a.cover.variant, label: a.cover.label },
  };
}

/** Explicit `related` first, then same-category articles, capped at `limit`. */
export function getRelatedArticles(a: BlogArticle, limit = 3): BlogArticle[] {
  const out: BlogArticle[] = [];
  for (const slug of a.related) {
    const r = getArticle(slug);
    if (r && r.slug !== a.slug) out.push(r);
  }
  for (const r of SORTED) {
    if (out.length >= limit) break;
    if (r.slug !== a.slug && r.category === a.category && !out.includes(r)) out.push(r);
  }
  return out.slice(0, limit);
}
