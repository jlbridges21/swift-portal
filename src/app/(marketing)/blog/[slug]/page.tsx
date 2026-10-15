import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { ArticleLayout } from "@/components/blog/article-layout";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { getArticle, getCategoryLabel, getRelatedArticles, toCardData } from "@/lib/blog/registry";
import { getBlogAuthor } from "@/lib/blog/authors";
import { blogArticleMetadata } from "@/lib/blog/metadata";
import { articleJsonLd, jsonLdString } from "@/lib/blog/structured-data";
import { loadBlogRenderContext } from "@/lib/blog/render-context";

export const revalidate = 300;

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) return { title: "Not found", robots: { index: false, follow: false } };
  return blogArticleMetadata(article, getBlogAuthor(article.authorId), getCategoryLabel(article.category));
}

export default async function BlogArticlePage({ params }: PageProps) {
  await requirePlatformMarketingHost();
  const { slug } = await params;
  const article = getArticle(slug);
  if (!article) notFound();

  const author = getBlogAuthor(article.authorId);
  const categoryLabel = getCategoryLabel(article.category);
  const ctx = await loadBlogRenderContext();
  const trialNote = ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null;

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={trialNote}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLdString(articleJsonLd(article, author, categoryLabel)) }}
        />
        <ArticleLayout
          article={article}
          author={author}
          categoryLabel={categoryLabel}
          related={getRelatedArticles(article).map(toCardData)}
          ctx={ctx}
        />
      </MarketingShell>
    </BrandProvider>
  );
}
