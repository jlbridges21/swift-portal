/**
 * Every published article slug. Internal links (<BlogLink slug>) and
 * `related` lists are typed against this, so a typo fails `tsc` instead of
 * shipping a broken link. Add the slug here when you add an article.
 */
export const BLOG_SLUGS = [
  "best-real-estate-photography-software",
  "best-drone-business-management-software",
  "best-aryeo-alternatives",
  "best-real-estate-photography-delivery-software",
  "best-photography-crm-software",
  "best-hdphotohub-alternatives",
  "best-photography-client-portals",
  "best-photo-video-delivery-platforms",
  "best-real-estate-photography-booking-software",
  "shootportal-vs-aryeo-vs-hdphotohub",
] as const;

export type BlogSlug = (typeof BLOG_SLUGS)[number];

export function blogPath(slug: BlogSlug): `/blog/${BlogSlug}` {
  return `/blog/${slug}`;
}
