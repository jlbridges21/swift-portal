import type { BlogArticle, BlogAuthor } from "@/lib/blog/types";
import { getCanonicalSiteUrl, SITE, SITE_ICONS } from "@/lib/site-metadata";

/** JSON-LD builders. Only factual properties; no ratings or review markup. */

function organization(base: string) {
  return {
    "@type": "Organization",
    "@id": `${base}/#organization`,
    name: SITE.name,
    url: base,
    logo: { "@type": "ImageObject", url: `${base}${SITE_ICONS.logoMark}` },
  };
}

export function articleJsonLd(article: BlogArticle, author: BlogAuthor, categoryLabel: string) {
  const base = getCanonicalSiteUrl();
  const url = `${base}/blog/${article.slug}`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "BlogPosting",
        "@id": `${url}#article`,
        headline: article.title,
        description: article.description,
        url,
        mainEntityOfPage: { "@type": "WebPage", "@id": url },
        image: [`${base}${SITE_ICONS.ogBrand}`],
        datePublished: article.publishedAt,
        dateModified: article.updatedAt ?? article.publishedAt,
        author: { "@type": "Person", name: author.name, jobTitle: author.role },
        publisher: { "@id": `${base}/#organization` },
        articleSection: categoryLabel,
        keywords: [article.primaryKeyword, ...article.secondaryKeywords].join(", "),
        inLanguage: "en-US",
        isPartOf: { "@type": "Blog", "@id": `${base}/blog#blog`, name: `${SITE.name} Blog` },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: base },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${base}/blog` },
          { "@type": "ListItem", position: 3, name: article.title, item: url },
        ],
      },
      organization(base),
    ],
  };
}

export function blogIndexJsonLd(articles: readonly BlogArticle[]) {
  const base = getCanonicalSiteUrl();
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        "@id": `${base}/blog#blog`,
        name: `${SITE.name} Blog`,
        url: `${base}/blog`,
        publisher: { "@id": `${base}/#organization` },
        blogPost: articles.map((a) => ({
          "@type": "BlogPosting",
          headline: a.title,
          url: `${base}/blog/${a.slug}`,
          datePublished: a.publishedAt,
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: base },
          { "@type": "ListItem", position: 2, name: "Blog", item: `${base}/blog` },
        ],
      },
      organization(base),
    ],
  };
}

/** Serialize for a <script type="application/ld+json">; escapes `<` so content can't close the tag. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
