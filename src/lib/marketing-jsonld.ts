import { getCanonicalSiteUrl, SITE, SITE_ICONS } from "@/lib/site-metadata";
import { organization } from "@/lib/blog/structured-data";
import type { SolutionVideoAsset } from "@/lib/solution-media";

/**
 * JSON-LD for core marketing pages (home, how it works, pricing, tools, resources).
 * Factual properties only: no ratings, reviews, or awards. Prices come from the live plan.
 */

type Crumb = { name: string; path: string };

export function webPageNode(path: string, name: string, description: string, crumbs: Crumb[] = []) {
  const base = getCanonicalSiteUrl();
  const url = `${base}${path === "/" ? "" : path}`;
  const nodes: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name,
      description,
      inLanguage: "en-US",
      isPartOf: { "@id": `${base}/#website` },
      publisher: { "@id": `${base}/#organization` },
      ...(crumbs.length ? { breadcrumb: { "@id": `${url}#breadcrumb` } } : {}),
    },
  ];
  if (crumbs.length) {
    nodes.push({
      "@type": "BreadcrumbList",
      "@id": `${url}#breadcrumb`,
      itemListElement: [{ name: "Home", path: "/" }, ...crumbs].map((c, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: c.name,
        item: `${base}${c.path === "/" ? "" : c.path}`,
      })),
    });
  }
  return nodes;
}

export function websiteNode() {
  const base = getCanonicalSiteUrl();
  return { "@type": "WebSite", "@id": `${base}/#website`, url: base, name: SITE.name, publisher: { "@id": `${base}/#organization` } };
}

export function softwareNode(monthlyPriceLabel: string | null, trialDays: number) {
  const base = getCanonicalSiteUrl();
  const price = monthlyPriceLabel?.replace(/[^0-9.]/g, "");
  return {
    "@type": "SoftwareApplication",
    "@id": `${base}/#software`,
    name: SITE.name,
    url: base,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    description:
      "Business management and media delivery for photographers, videographers, and drone pilots: requests, estimates, scheduling, client portal, video review, payments, and delivery.",
    publisher: { "@id": `${base}/#organization` },
    ...(price
      ? {
          offers: {
            "@type": "Offer",
            price,
            priceCurrency: "USD",
            description: trialDays > 0 ? `Studio plan, billed monthly. ${trialDays}-day free trial.` : "Studio plan, billed monthly.",
          },
        }
      : {}),
  };
}

/** VideoObject for a hosted product demo. uploadDate = when the file was published on the site. */
export function videoNode(video: SolutionVideoAsset, opts: { name: string; description: string; uploadDate: string; duration: string }) {
  const base = getCanonicalSiteUrl();
  return {
    "@type": "VideoObject",
    name: opts.name,
    description: opts.description,
    thumbnailUrl: `${base}${video.poster}`,
    contentUrl: `${base}${video.mp4}`,
    uploadDate: opts.uploadDate,
    duration: opts.duration,
    publisher: { "@id": `${base}/#organization` },
  };
}

export function graph(...nodes: (Record<string, unknown> | Record<string, unknown>[])[]) {
  const base = getCanonicalSiteUrl();
  return { "@context": "https://schema.org", "@graph": [organization(base), ...nodes.flat()] };
}

export const DEMO_VIDEO_UPLOAD_DATE = "2026-10-15";

/** A free browser tool (calculator, generator). Price 0 is factual: no account or payment. */
export function webAppNode(path: string, name: string, description: string) {
  const base = getCanonicalSiteUrl();
  return {
    "@type": "WebApplication",
    "@id": `${base}${path}#app`,
    name,
    url: `${base}${path}`,
    description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web browser",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    publisher: { "@id": `${base}/#organization` },
  };
}

/** FAQPage from the FAQ text visible on the page (same wording, plain text). */
export function faqNode(items: readonly { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })),
  };
}
