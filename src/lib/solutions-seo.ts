import type { Metadata } from "next";
import { marketingPageMetadata } from "@/lib/marketing";
import { getCanonicalSiteUrl, SITE, SITE_ICONS } from "@/lib/site-metadata";
import type { BlogRenderContext } from "@/lib/blog/types";
import type { SolutionPage } from "@/lib/solutions";

/** Metadata for a Solutions landing page (OG image comes from the page's opengraph-image.tsx). */
export function solutionMetadata(page: SolutionPage): Metadata {
  const base = marketingPageMetadata({ title: page.seoTitle, description: page.description, path: page.path });
  // Drop the generic brand image so Next fills og:image/twitter:image from ./opengraph-image.tsx.
  const { images: _og, ...openGraph } = base.openGraph ?? {};
  const { images: _tw, ...twitter } = base.twitter ?? {};
  return {
    ...base,
    openGraph,
    twitter,
    keywords: [page.primaryKeyword, ...page.secondaryKeywords],
  };
}

/**
 * JSON-LD: WebPage + BreadcrumbList + SoftwareApplication. Only verifiable properties:
 * the live Studio price (when the plan loads) and the trial length. No ratings or reviews.
 */
export function solutionJsonLd(page: SolutionPage, ctx: BlogRenderContext) {
  const base = getCanonicalSiteUrl();
  const url = `${base}${page.path}`;
  const price = ctx.studioMonthly?.replace(/[^0-9.]/g, "");
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${url}#webpage`,
        url,
        name: `${page.seoTitle} | ${SITE.name}`,
        description: page.description,
        inLanguage: "en-US",
        isPartOf: { "@type": "WebSite", "@id": `${base}/#website`, url: base, name: SITE.name },
        about: { "@id": `${base}/#software` },
        breadcrumb: { "@id": `${url}#breadcrumb` },
      },
      {
        "@type": "BreadcrumbList",
        "@id": `${url}#breadcrumb`,
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: base },
          { "@type": "ListItem", position: 2, name: page.navTitle, item: url },
        ],
      },
      {
        "@type": "SoftwareApplication",
        "@id": `${base}/#software`,
        name: SITE.name,
        url: base,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: SITE.description,
        image: `${base}${SITE_ICONS.ogBrand}`,
        ...(price
          ? {
              offers: {
                "@type": "Offer",
                price,
                priceCurrency: "USD",
                url: `${base}/pricing`,
                description:
                  ctx.trialDays > 0 ? `Studio plan, billed monthly. ${ctx.trialDays}-day free trial, no credit card required.` : "Studio plan, billed monthly.",
              },
            }
          : {}),
        publisher: { "@type": "Organization", name: SITE.name, url: base },
      },
    ],
  };
}
