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
  "how-to-deliver-real-estate-photos",
  "real-estate-photography-automation",
  "how-to-send-large-video-files-to-clients",
  "how-to-create-photography-client-portal",
  "google-drive-vs-dropbox-photo-delivery",
  "get-paid-before-delivering-real-estate-photos",
  "best-photography-invoicing-software",
  "real-estate-photography-client-management",
  "best-video-review-approval-software",
  "photography-workflow-automation",
  "drone-photography-pricing-guide",
  "real-estate-photography-pricing-guide",
  "how-to-start-drone-photography-business",
  "how-to-get-real-estate-photography-clients",
  "how-to-start-real-estate-photography-business",
] as const;

export type BlogSlug = (typeof BLOG_SLUGS)[number];

export function blogPath(slug: BlogSlug): `/blog/${BlogSlug}` {
  return `/blog/${slug}`;
}
