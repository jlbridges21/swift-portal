import type { ReactNode } from "react";

/**
 * Blog content model. One article = one module in src/content/blog/ that
 * exports a `BlogArticle`. Routing, metadata, JSON-LD, sitemap entries, TOC,
 * related links, and CTAs are all derived from this object, so adding an
 * article never touches the route files.
 */

export const BLOG_CATEGORIES = [
  {
    slug: "software-comparisons",
    label: "Software Comparisons",
    description: "Side-by-side looks at the platforms media businesses actually evaluate.",
  },
  {
    slug: "drone-business",
    label: "Drone Business",
    description: "Running the business behind the footage: pricing, clients, and operations.",
  },
  {
    slug: "real-estate-photography",
    label: "Real Estate Photography",
    description: "Workflows for shooting, booking, and delivering listing media.",
  },
  {
    slug: "client-management",
    label: "Client Management",
    description: "CRMs, client portals, and keeping every client relationship organized.",
  },
  {
    slug: "media-delivery",
    label: "Media Delivery",
    description: "Galleries, video handoff, downloads, and revisions done professionally.",
  },
  {
    slug: "business-automation",
    label: "Business Automation",
    description: "Booking, scheduling, reminders, and the admin work you can stop doing by hand.",
  },
] as const;

export type BlogCategorySlug = (typeof BLOG_CATEGORIES)[number]["slug"];

export type BlogAuthor = {
  id: string;
  name: string;
  role: string;
  bio: string;
  credentials: readonly string[];
  /** Optional approved headshot under /public. Falls back to initials. */
  image?: string;
  url?: string;
};

/** Visual theme for the generated cover art. */
export type BlogCoverVariant =
  | "ranking"
  | "drone"
  | "swap"
  | "delivery"
  | "crm"
  | "portal"
  | "media"
  | "calendar"
  | "versus"
  | "layers";

export type BlogCtaConfig = {
  /** Headline of the end-of-article CTA band. */
  title: string;
  body: string;
  /** Marketing route the secondary button points at. */
  secondaryHref?: "/how-it-works" | "/pricing" | "/#product-demo" | "/contact";
  secondaryLabel?: string;
};

/** Values resolved at request time so offers in copy never drift from billing. */
export type BlogRenderContext = {
  trialDays: number;
  /** e.g. "$29" — null when plans could not be loaded. */
  studioMonthly: string | null;
  studioAnnual: string | null;
};

export type BlogSection = {
  /** Anchor id; also used by the table of contents. */
  id: string;
  /** Rendered as the section's H2. */
  title: string;
  /** Short TOC label when the H2 is long. */
  tocLabel?: string;
  body: (ctx: BlogRenderContext) => ReactNode;
};

export type BlogFaq = { question: string; answer: ReactNode; answerText: string };

export type BlogArticle = {
  slug: string;
  /** H1 on the page. */
  title: string;
  /** <title> tag (site name appended by the layout template). */
  seoTitle: string;
  /** Meta + OG description. */
  description: string;
  /** One-paragraph card teaser for the index. */
  excerpt: string;
  category: BlogCategorySlug;
  authorId: string;
  /** ISO date (YYYY-MM-DD). */
  publishedAt: string;
  /** ISO date; only set when the article is materially revised. */
  updatedAt?: string;
  /** Date competitor pricing/features were last checked, when relevant. */
  factsVerifiedAt?: string;
  primaryKeyword: string;
  secondaryKeywords: readonly string[];
  readingMinutes: number;
  cover: { variant: BlogCoverVariant; alt: string; label: string };
  /** Shown on the index as the hero article. Only one article should set this. */
  featured?: boolean;
  /** Disclosure shown at the top of comparison articles. */
  disclosure?: boolean;
  /** Bulleted quick answer rendered near the top. */
  quickAnswer: { heading: string; points: readonly ReactNode[] };
  intro: (ctx: BlogRenderContext) => ReactNode;
  sections: readonly BlogSection[];
  faqs: readonly BlogFaq[];
  related: readonly string[];
  cta: BlogCtaConfig;
};
