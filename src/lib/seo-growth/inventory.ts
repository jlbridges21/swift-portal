import { getAllArticles } from "@/lib/blog/registry";
import { SOLUTION_PAGES, type SolutionKey } from "@/lib/solutions";
import { TOOLS } from "@/lib/tools/registry";
import { RESOURCES } from "@/lib/resources/registry";

/**
 * The marketing pages the SEO Growth Engine monitors, derived from the same registries
 * that drive routes and the sitemap (blog registry, solutions, tools, resources). Nothing
 * here is measured: it is the page list plus its intended role.
 */

export type PageKind = "home" | "core" | "solution" | "article" | "tool" | "resource" | "hub" | "company" | "legal";

/**
 * Business value of ranking this page, as an internal heuristic:
 * 3 = commercial (vendor intent, closest to a trial), 2 = high-intent tool or decision
 * content, 1 = informational/supporting, 0 = navigational/legal.
 */
export type CommercialValue = 0 | 1 | 2 | 3;

export type InventoryPage = {
  path: string;
  kind: PageKind;
  title: string;
  primaryKeyword: string | null;
  secondaryKeywords: readonly string[];
  /** Topic cluster (docs/SEO-KEYWORD-MAP.md → "Topic clusters"). */
  cluster: string;
  commercialValue: CommercialValue;
  /** Paths this page is expected to link to (registry relationships). */
  expectedLinks: readonly string[];
  /** Article metadata, when kind === "article". */
  article?: {
    slug: string;
    publishedAt: string;
    updatedAt: string | null;
    factsVerifiedAt: string | null;
    category: string;
    comparison: boolean;
  };
  /** Pages Google should index. Legal pages stay indexable but are not monitored for growth. */
  monitor: boolean;
};

const SOLUTION_CLUSTER: Record<SolutionKey, string> = {
  "real-estate-software": "Real estate photography business",
  "drone-software": "Drone business",
  "client-portal": "Client portal",
  crm: "Client management",
  "media-delivery": "Media delivery",
  booking: "Booking and scheduling",
  invoicing: "Invoicing and payments",
  "video-review": "Video review",
  workflow: "Workflow automation",
  "business-management": "Business management",
};

const CATEGORY_CLUSTER: Record<string, string> = {
  "software-comparisons": "Software comparisons",
  "drone-business": "Drone business",
  "real-estate-photography": "Real estate photography business",
  "client-management": "Client management",
  "media-delivery": "Media delivery",
  "pricing-payments": "Pricing",
  "business-automation": "Workflow automation",
};

function solutionPath(key: SolutionKey): string {
  return SOLUTION_PAGES.find((s) => s.key === key)?.path ?? "/";
}

/** Solution page that lists this article as related (first match), if any. */
function solutionForArticle(slug: string) {
  return SOLUTION_PAGES.find((s) => (s.relatedArticles as readonly string[]).includes(slug)) ?? null;
}

export function buildInventory(): InventoryPage[] {
  const tools = TOOLS;
  const resources = RESOURCES;
  const pages: InventoryPage[] = [
    { path: "/", kind: "home", title: "Homepage", primaryKeyword: null, secondaryKeywords: [], cluster: "Brand", commercialValue: 3, expectedLinks: ["/pricing", "/how-it-works"], monitor: true },
    { path: "/how-it-works", kind: "core", title: "How it works", primaryKeyword: null, secondaryKeywords: [], cluster: "Brand", commercialValue: 3, expectedLinks: ["/pricing"], monitor: true },
    { path: "/pricing", kind: "core", title: "Pricing", primaryKeyword: null, secondaryKeywords: [], cluster: "Brand", commercialValue: 3, expectedLinks: [], monitor: true },
  ];

  for (const s of SOLUTION_PAGES) {
    pages.push({
      path: s.path,
      kind: "solution",
      title: s.seoTitle,
      primaryKeyword: s.primaryKeyword,
      secondaryKeywords: s.secondaryKeywords,
      cluster: SOLUTION_CLUSTER[s.key],
      commercialValue: 3,
      expectedLinks: s.relatedArticles.map((a) => `/blog/${a}`),
      monitor: true,
    });
  }

  pages.push({ path: "/tools", kind: "hub", title: "Free tools", primaryKeyword: "free tools for photographers", secondaryKeywords: [], cluster: "Pricing", commercialValue: 1, expectedLinks: tools.map((t) => t.path), monitor: true });
  for (const t of tools) {
    pages.push({
      path: t.path,
      kind: "tool",
      title: t.name,
      primaryKeyword: t.primaryKeyword,
      secondaryKeywords: t.secondaryKeywords,
      cluster: "Pricing",
      commercialValue: 2,
      expectedLinks: [solutionPath(t.solution), ...t.articles.map((a) => `/blog/${a}`)],
      monitor: true,
    });
  }

  pages.push({ path: "/resources", kind: "hub", title: "Free templates", primaryKeyword: "photography business templates", secondaryKeywords: [], cluster: "Templates", commercialValue: 1, expectedLinks: resources.map((r) => r.path), monitor: true });
  for (const r of resources) {
    pages.push({
      path: r.path,
      kind: "resource",
      title: r.name,
      primaryKeyword: r.primaryKeyword,
      secondaryKeywords: [],
      cluster: "Templates",
      commercialValue: 1,
      expectedLinks: [solutionPath(r.solution)],
      monitor: true,
    });
  }

  pages.push({ path: "/blog", kind: "hub", title: "Blog", primaryKeyword: null, secondaryKeywords: [], cluster: "Blog", commercialValue: 1, expectedLinks: [], monitor: true });
  for (const a of getAllArticles()) {
    const solution = solutionForArticle(a.slug);
    const linkedTools = tools.filter((t) => (t.articles as readonly string[]).includes(a.slug)).map((t) => t.path);
    const comparison = a.category === "software-comparisons" || /^best-|-vs-|alternatives/.test(a.slug);
    pages.push({
      path: `/blog/${a.slug}`,
      kind: "article",
      title: a.title,
      primaryKeyword: a.primaryKeyword,
      secondaryKeywords: a.secondaryKeywords,
      cluster: solution ? SOLUTION_CLUSTER[solution.key] : CATEGORY_CLUSTER[a.category] ?? "Blog",
      // "Best X software" / "X alternatives" readers are evaluating vendors right now.
      commercialValue: comparison ? 2 : 1,
      expectedLinks: [...(solution ? [solution.path] : []), ...linkedTools],
      article: {
        slug: a.slug,
        publishedAt: a.publishedAt,
        updatedAt: a.updatedAt ?? null,
        factsVerifiedAt: a.factsVerifiedAt ?? null,
        category: a.category,
        comparison,
      },
      monitor: true,
    });
  }

  pages.push(
    { path: "/partners", kind: "company", title: "Partner program", primaryKeyword: null, secondaryKeywords: [], cluster: "Company", commercialValue: 0, expectedLinks: [], monitor: true },
    { path: "/strategic-partners", kind: "company", title: "Strategic partners", primaryKeyword: null, secondaryKeywords: [], cluster: "Company", commercialValue: 0, expectedLinks: [], monitor: true },
    { path: "/contact", kind: "company", title: "Contact", primaryKeyword: null, secondaryKeywords: [], cluster: "Company", commercialValue: 0, expectedLinks: [], monitor: true },
    { path: "/privacy", kind: "legal", title: "Privacy policy", primaryKeyword: null, secondaryKeywords: [], cluster: "Legal", commercialValue: 0, expectedLinks: [], monitor: false },
    { path: "/terms", kind: "legal", title: "Terms of service", primaryKeyword: null, secondaryKeywords: [], cluster: "Legal", commercialValue: 0, expectedLinks: [], monitor: false }
  );
  return pages;
}

export const KIND_LABELS: Record<PageKind, string> = {
  home: "Homepage",
  core: "Core page",
  solution: "Landing page",
  article: "Article",
  tool: "Calculator / tool",
  resource: "Template",
  hub: "Hub",
  company: "Company",
  legal: "Legal",
};
