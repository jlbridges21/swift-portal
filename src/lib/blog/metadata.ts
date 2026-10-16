import type { Metadata } from "next";
import type { BlogArticle, BlogAuthor } from "@/lib/blog/types";
import { getCanonicalSiteUrl, SITE } from "@/lib/site-metadata";

export function blogArticleMetadata(article: BlogArticle, author: BlogAuthor, categoryLabel: string): Metadata {
  const url = `${getCanonicalSiteUrl()}/blog/${article.slug}`;
  const ogTitle = `${article.seoTitle} | ${SITE.name}`;
  return {
    // Drop the " | ShootPortal" suffix when it would push the title past ~60 characters,
    // so the keyword-led title isn't truncated in search results. Social titles keep the brand.
    title: article.seoTitle.length + SITE.name.length + 3 > 60 ? { absolute: article.seoTitle } : article.seoTitle,
    description: article.description,
    keywords: [article.primaryKeyword, ...article.secondaryKeywords],
    authors: [{ name: author.name }],
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      locale: "en_US",
      url,
      siteName: SITE.name,
      title: ogTitle,
      description: article.description,
      publishedTime: article.publishedAt,
      modifiedTime: article.updatedAt ?? article.publishedAt,
      authors: [author.name],
      section: categoryLabel,
      tags: [article.primaryKeyword, ...article.secondaryKeywords],
      // images: supplied by ./opengraph-image.tsx (file convention)
    },
    twitter: {
      card: "summary_large_image",
      title: ogTitle,
      description: article.description,
    },
    robots: { index: true, follow: true },
  };
}
