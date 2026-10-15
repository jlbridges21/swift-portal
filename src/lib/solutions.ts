import type { BlogSlug } from "@/lib/blog/slugs";

/**
 * Commercial SEO landing pages ("Solutions"). One entry drives the page's metadata,
 * the marketing nav/footer menus, the sitemap, and analytics CTA ids. Keyword
 * ownership and intent rules: docs/SEO-KEYWORD-MAP.md.
 *
 * To add a page: add an entry here, create src/app/(marketing)/<slug>/page.tsx,
 * and add the slug to RESERVED_APP_ROUTE_SLUGS.
 */

export type SolutionKey = "real-estate-software" | "drone-software" | "client-portal" | "crm" | "media-delivery";

export type SolutionPage = {
  key: SolutionKey;
  slug: string;
  path: `/${string}`;
  /** Menu label and one-liner. */
  navTitle: string;
  navDescription: string;
  /** <title> without the site suffix (the root template appends " | ShootPortal"). */
  seoTitle: string;
  description: string;
  primaryKeyword: string;
  secondaryKeywords: readonly string[];
  /** Articles that cover the research/how-to side of this topic. */
  relatedArticles: readonly BlogSlug[];
};

export const SOLUTION_PAGES: readonly SolutionPage[] = [
  {
    key: "real-estate-software",
    slug: "real-estate-photography-software",
    path: "/real-estate-photography-software",
    navTitle: "Real estate photographers",
    navDescription: "Run listings from request to paid and delivered.",
    seoTitle: "Real Estate Photography Software",
    description:
      "Real estate photography software for requests, estimates, scheduling, client messages, payments, and photo and video delivery in one branded portal. Try it free.",
    primaryKeyword: "real estate photography software",
    secondaryKeywords: [
      "real estate photography business software",
      "real estate photography management software",
      "real estate media software",
      "software for real estate photographers",
      "real estate media business management",
    ],
    relatedArticles: [
      "best-real-estate-photography-software",
      "shootportal-vs-aryeo-vs-hdphotohub",
      "real-estate-photography-automation",
    ],
  },
  {
    key: "drone-software",
    slug: "drone-business-management-software",
    path: "/drone-business-management-software",
    navTitle: "Drone pilots",
    navDescription: "The client side of commercial drone work.",
    seoTitle: "Drone Business Management Software",
    description:
      "Drone business management software for the client side of aerial work: quotes with travel fees, scheduling, video review, payments, and delivery. Free trial.",
    primaryKeyword: "drone business management software",
    secondaryKeywords: [
      "drone photography business software",
      "drone client management software",
      "drone photography CRM",
      "software for commercial drone pilots",
      "drone videography business software",
    ],
    relatedArticles: [
      "best-drone-business-management-software",
      "drone-photography-pricing-guide",
      "how-to-start-drone-photography-business",
    ],
  },
  {
    key: "client-portal",
    slug: "photography-client-portal",
    path: "/photography-client-portal",
    navTitle: "Client portal",
    navDescription: "One branded link for every client and job.",
    seoTitle: "Photography Client Portal for Your Brand",
    description:
      "A photography client portal with your logo and domain where clients approve estimates, confirm shoot times, review media, pay, and download. Start free.",
    primaryKeyword: "photography client portal",
    secondaryKeywords: [
      "client portal for photographers",
      "branded photography client portal",
      "client portal for videographers",
      "photography client delivery portal",
    ],
    relatedArticles: [
      "best-photography-client-portals",
      "how-to-create-photography-client-portal",
      "how-to-deliver-real-estate-photos",
    ],
  },
  {
    key: "crm",
    slug: "real-estate-photography-crm",
    path: "/real-estate-photography-crm",
    navTitle: "Client management",
    navDescription: "Agents, properties, and history in one record.",
    seoTitle: "Real Estate Photography CRM & Client Management",
    description:
      "A real estate photography CRM that keeps every agent, property, project, message, and balance on one connected record. Built for repeat listing work. Try it free.",
    primaryKeyword: "real estate photography CRM",
    secondaryKeywords: [
      "CRM for real estate photographers",
      "real estate photography client management",
      "real estate media client management",
      "photographer CRM software",
    ],
    relatedArticles: [
      "best-photography-crm-software",
      "real-estate-photography-client-management",
      "how-to-get-real-estate-photography-clients",
    ],
  },
  {
    key: "media-delivery",
    slug: "photo-video-delivery-software",
    path: "/photo-video-delivery-software",
    navTitle: "Photo & video delivery",
    navDescription: "Galleries, review rounds, and paid downloads.",
    seoTitle: "Photo and Video Delivery Software",
    description:
      "Photo and video delivery software with project galleries, time-stamped video review, full-res or MLS downloads, and optional unlock after payment. Try it free.",
    primaryKeyword: "photo and video delivery software",
    secondaryKeywords: [
      "photo delivery software",
      "video delivery platform",
      "photography client delivery software",
      "professional photo delivery",
      "media delivery platform",
    ],
    relatedArticles: [
      "best-photo-video-delivery-platforms",
      "how-to-send-large-video-files-to-clients",
      "google-drive-vs-dropbox-photo-delivery",
    ],
  },
];

export function getSolutionPage(key: SolutionKey): SolutionPage {
  const page = SOLUTION_PAGES.find((p) => p.key === key);
  if (!page) throw new Error(`Unknown solution page: ${key}`);
  return page;
}

/** Analytics CTA id convention: seo:<page-key>:<placement>. */
export function solutionCtaId(key: SolutionKey, placement: "hero" | "mid" | "final" | "pricing"): string {
  return `seo:${key}:${placement}`;
}
