import type { BlogSlug } from "@/lib/blog/slugs";

/**
 * Commercial SEO landing pages ("Solutions"). One entry drives the page's metadata,
 * the marketing nav/footer menus, the sitemap, and analytics CTA ids. Keyword
 * ownership and intent rules: docs/SEO-KEYWORD-MAP.md.
 *
 * To add a page: add an entry here, create src/app/(marketing)/<slug>/page.tsx,
 * and add the slug to RESERVED_APP_ROUTE_SLUGS.
 */

export type SolutionKey =
  | "real-estate-software"
  | "drone-software"
  | "client-portal"
  | "crm"
  | "media-delivery"
  | "booking"
  | "invoicing"
  | "video-review"
  | "workflow"
  | "business-management";

/** Menu groups (nav dropdown, mobile panel, footer). */
export type SolutionGroup = "business" | "operations" | "experience";

export const SOLUTION_GROUPS: readonly { key: SolutionGroup; label: string }[] = [
  { key: "business", label: "By business" },
  { key: "operations", label: "Run the business" },
  { key: "experience", label: "Client experience" },
];

export type SolutionPage = {
  key: SolutionKey;
  group: SolutionGroup;
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
    group: "business",
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
    group: "business",
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
    group: "experience",
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
    group: "operations",
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
    group: "experience",
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
  {
    key: "booking",
    group: "operations",
    slug: "photography-booking-software",
    path: "/photography-booking-software",
    navTitle: "Booking & scheduling",
    navDescription: "From client request to confirmed shoot.",
    seoTitle: "Photography Booking Software for Client Requests",
    description:
      "Photography booking software that turns client requests into confirmed shoots: your service menu, estimates, proposed shoot times, and replies in one portal.",
    primaryKeyword: "photography booking software",
    secondaryKeywords: [
      "photography scheduling software",
      "photographer scheduling software",
      "photography appointment booking",
      "client booking software for photographers",
    ],
    relatedArticles: [
      "best-real-estate-photography-booking-software",
      "photography-workflow-automation",
      "how-to-get-real-estate-photography-clients",
    ],
  },
  {
    key: "invoicing",
    group: "operations",
    slug: "photography-invoicing-software",
    path: "/photography-invoicing-software",
    navTitle: "Invoicing & payments",
    navDescription: "Estimates, deposits, and card payments per job.",
    seoTitle: "Photography Invoicing & Payment Software",
    description:
      "Photography invoicing software that ties estimates, deposits, payment requests, and receipts to each project, paid by card to your own Stripe account. Try it free.",
    primaryKeyword: "photography invoicing software",
    secondaryKeywords: [
      "photography payment software",
      "invoicing software for photographers",
      "photographer invoice management",
      "real estate photography invoicing",
      "drone photography invoicing software",
    ],
    relatedArticles: [
      "best-photography-invoicing-software",
      "get-paid-before-delivering-real-estate-photos",
      "real-estate-photography-pricing-guide",
    ],
  },
  {
    key: "video-review",
    group: "experience",
    slug: "video-review-approval-software",
    path: "/video-review-approval-software",
    navTitle: "Video review & approval",
    navDescription: "Time-stamped client feedback and versions.",
    seoTitle: "Video Review & Approval Software for Client Work",
    description:
      "Video review software where clients leave time-stamped comments pinned to the frame, you post new versions, and approved videos are delivered. Free trial.",
    primaryKeyword: "video review software",
    secondaryKeywords: [
      "video approval software",
      "client video review platform",
      "video feedback software",
      "time-stamped video comments",
      "video review software for videographers",
    ],
    relatedArticles: [
      "best-video-review-approval-software",
      "how-to-send-large-video-files-to-clients",
      "best-photo-video-delivery-platforms",
    ],
  },
  {
    key: "workflow",
    group: "operations",
    slug: "real-estate-photography-workflow-software",
    path: "/real-estate-photography-workflow-software",
    navTitle: "Workflow automation",
    navDescription: "What runs on its own, and what stays in one place.",
    seoTitle: "Real Estate Photography Workflow Software",
    description:
      "Real estate photography workflow software with automatic estimates, status updates, reminders, and payment-unlocked downloads, and every other step in one place.",
    primaryKeyword: "real estate photography workflow software",
    secondaryKeywords: [
      "real estate photography workflow automation",
      "automated real estate photography workflow",
      "real estate media workflow software",
      "photography business automation",
    ],
    relatedArticles: [
      "real-estate-photography-automation",
      "photography-workflow-automation",
      "best-real-estate-photography-software",
    ],
  },
  {
    key: "business-management",
    group: "business",
    slug: "photography-business-management-software",
    path: "/photography-business-management-software",
    navTitle: "Photography businesses",
    navDescription: "Clients, projects, payments, and delivery in one place.",
    seoTitle: "Photography Business Management Software",
    description:
      "Photography business management software for client-commissioned work: requests, estimates, scheduling, payments, video review, and delivery in one branded portal.",
    primaryKeyword: "photography business management software",
    secondaryKeywords: [
      "all-in-one photography business software",
      "photography studio management software",
      "photographer business software",
      "photography project management software",
      "business management for photographers",
    ],
    relatedArticles: [
      "best-photography-crm-software",
      "how-to-start-real-estate-photography-business",
      "how-to-start-drone-photography-business",
    ],
  },
];

export function solutionsInGroup(group: SolutionGroup): SolutionPage[] {
  return SOLUTION_PAGES.filter((p) => p.group === group);
}

export function getSolutionPage(key: SolutionKey): SolutionPage {
  const page = SOLUTION_PAGES.find((p) => p.key === key);
  if (!page) throw new Error(`Unknown solution page: ${key}`);
  return page;
}

export type CtaPlacement = "hero" | "demo" | "mid" | "pricing" | "final";

/** Analytics CTA id convention: seo:<page-key>:<placement>. */
export function solutionCtaId(key: SolutionKey, placement: CtaPlacement): string {
  return `seo:${key}:${placement}`;
}
