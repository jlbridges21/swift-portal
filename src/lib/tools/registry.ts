import type { BlogSlug } from "@/lib/blog/slugs";
import type { SolutionKey } from "@/lib/solutions";
import type { ResourceId } from "@/lib/resources/registry";

/**
 * Free tools (/tools). One entry drives the page metadata, the /tools hub, the sitemap,
 * nav/footer links, and cross-links from articles, solution pages, and resources.
 * Keyword ownership: docs/SEO-KEYWORD-MAP.md (tools own "calculator"/"generator" intent).
 */

export type ToolKey = "drone-pricing" | "real-estate-pricing" | "quote-builder";

export type ToolEntry = {
  key: ToolKey;
  slug: string;
  path: `/tools/${string}`;
  name: string;
  /** <title> without the " | ShootPortal" suffix. */
  seoTitle: string;
  description: string;
  primaryKeyword: string;
  secondaryKeywords: readonly string[];
  /** One line for cards and menus. */
  summary: string;
  /** Closest commercial page for the next step. */
  solution: SolutionKey;
  articles: readonly BlogSlug[];
  resources: readonly ResourceId[];
};

export const TOOLS: readonly ToolEntry[] = [
  {
    key: "drone-pricing",
    slug: "drone-photography-pricing-calculator",
    path: "/tools/drone-photography-pricing-calculator",
    name: "Drone photography pricing calculator",
    seoTitle: "Drone Photography Pricing Calculator (Free)",
    description:
      "See what to charge for a drone photo or video job in three quick steps, then add your logo and download a branded quote PDF. Free, no signup.",
    primaryKeyword: "drone photography pricing calculator",
    secondaryKeywords: ["how much to charge for drone photography", "drone videography pricing calculator", "drone job quote calculator"],
    summary: "Price a drone job in three steps and download a branded quote.",
    solution: "drone-software",
    articles: ["drone-photography-pricing-guide", "how-to-start-drone-photography-business", "best-drone-business-management-software"],
    resources: ["drone-photography-quote", "drone-photography-business-plan"],
  },
  {
    key: "real-estate-pricing",
    slug: "real-estate-photography-pricing-calculator",
    path: "/tools/real-estate-photography-pricing-calculator",
    name: "Real estate photography pricing calculator",
    seoTitle: "Real Estate Photography Pricing Calculator",
    description:
      "Get real estate photography package prices for every home size, add your logo, and download a branded price list for agents. Free, no signup.",
    primaryKeyword: "real estate photography pricing calculator",
    secondaryKeywords: ["real estate photography price list", "how to price real estate photography", "real estate photography package pricing"],
    summary: "Price every home size and download a branded price list.",
    solution: "real-estate-software",
    articles: ["real-estate-photography-pricing-guide", "how-to-start-real-estate-photography-business", "get-paid-before-delivering-real-estate-photos"],
    resources: ["real-estate-photography-pricing-sheet", "real-estate-photography-shot-list"],
  },
  {
    key: "quote-builder",
    slug: "photography-quote-builder",
    path: "/tools/photography-quote-builder",
    name: "Photography quote builder",
    seoTitle: "Free Photography Quote Generator & Builder",
    description:
      "Build a professional photography or drone quote with your logo, services, optional add-ons, deposit, and terms. Download a PDF. Free, no account needed.",
    primaryKeyword: "photography quote generator",
    secondaryKeywords: ["photography quote template", "photography estimate generator", "photography package builder", "real estate photography quote generator", "drone photography estimate template"],
    summary: "Create a polished client quote and download it as a PDF.",
    solution: "business-management",
    articles: ["best-photography-invoicing-software", "photography-workflow-automation", "best-photography-crm-software"],
    resources: ["drone-photography-quote", "photography-invoice", "photography-client-questionnaire"],
  },
];

export function getTool(key: ToolKey): ToolEntry {
  const t = TOOLS.find((x) => x.key === key);
  if (!t) throw new Error(`Unknown tool: ${key}`);
  return t;
}
