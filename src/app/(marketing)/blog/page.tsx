import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { FeaturedArticleCard } from "@/components/blog/blog-card";
import { BlogIndexBrowser } from "@/components/blog/blog-index-browser";
import { WorkflowDiagram } from "@/components/blog/diagrams";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { marketingPageMetadata } from "@/lib/marketing";
import { getAllArticles, getCategoryCounts, getFeaturedArticle, toCardData } from "@/lib/blog/registry";
import { blogIndexJsonLd, jsonLdString } from "@/lib/blog/structured-data";
import { loadBlogRenderContext } from "@/lib/blog/render-context";

export const revalidate = 300;

export const metadata: Metadata = marketingPageMetadata({
  title: "Blog: Software & Business Guides for Photographers",
  description:
    "Practical guides for drone pilots, real estate photographers, and videographers: software comparisons, client delivery, booking, payments, and running the business.",
  path: "/blog",
});

export default async function BlogIndexPage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();
  const articles = getAllArticles();
  const featured = getFeaturedArticle();
  const cards = articles.map(toCardData);
  const trialNote = ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null;

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={trialNote}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(blogIndexJsonLd(articles)) }} />
        <div className="mk-blog">
          {/* Hero */}
          <section className="relative overflow-hidden border-b border-[#E2E8F0]">
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "radial-gradient(ellipse 80% 55% at 50% -10%, rgba(79,70,229,0.16), transparent 60%), radial-gradient(ellipse 40% 40% at 90% 30%, rgba(124,58,237,0.08), transparent 60%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 80%)",
              }}
              aria-hidden
            />
            <div className="relative mx-auto max-w-6xl px-4 pb-12 pt-14 sm:px-6 sm:pt-20 lg:px-8">
              <div className="mx-auto max-w-3xl text-center">
                <p className="mk-enter text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">The ShootPortal Blog</p>
                <h1 className="mt-4 text-[2.1rem] font-bold leading-[1.1] tracking-tight text-[#0F172A] sm:text-5xl lg:text-[3.4rem]">
                  Run the business behind{" "}
                  <span className="bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] bg-clip-text text-transparent">the shoot.</span>
                </h1>
                <p className="mk-enter mx-auto mt-5 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg" style={{ animationDelay: "120ms" }}>
                  Honest software comparisons and practical workflows for drone pilots, real estate photographers,
                  videographers, and media teams. Written by a working drone business owner.
                </p>
              </div>
              <div className="mx-auto mt-12 max-w-6xl">
                <FeaturedArticleCard post={toCardData(featured)} />
              </div>
            </div>
          </section>

          {/* All articles */}
          <section aria-labelledby="all-articles" className="bg-[#F8FAFC]">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
                <div>
                  <h2 id="all-articles" className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
                    All guides
                  </h2>
                  <p className="mt-2 text-[#475569]">Filter by topic or search for the tool you&apos;re evaluating.</p>
                </div>
              </div>
              <BlogIndexBrowser posts={cards} categories={getCategoryCounts()} />
            </div>
          </section>

          {/* Workflow strip */}
          <section aria-labelledby="workflow-heading" className="border-t border-[#E2E8F0] bg-white">
            <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
              <div className="mx-auto max-w-2xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">What we write about</p>
                <h2 id="workflow-heading" className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                  Every stage of the job, from first request to final delivery.
                </h2>
                <p className="mt-3 text-base leading-relaxed text-[#475569]">
                  Most media businesses lose time in the handoffs between stages, not in the shoot itself. Our guides
                  focus on those handoffs.
                </p>
              </div>
              <div className="mt-10">
                <WorkflowDiagram />
              </div>
            </div>
          </section>

          {/* CTA */}
          <section className="relative overflow-hidden bg-[#0F172A]">
            <div
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(ellipse 60% 60% at 70% 10%, rgba(79,70,229,0.4), transparent 60%)" }}
              aria-hidden
            />
            <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
              <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Stop juggling five different tools.</h2>
              <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
                ShootPortal keeps requests, estimates, scheduling, client messages, media review, payments, and delivery
                on the same project, in a portal branded to your business.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link
                  href="/signup"
                  data-sp-cta="blog:index-cta"
                  className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#4F46E5] px-7 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-[#4338CA]"
                >
                  Start your free trial <ArrowRight className="h-4 w-4" aria-hidden />
                </Link>
                <Link
                  href="/how-it-works"
                  className="inline-flex min-h-12 items-center rounded-lg border border-white/20 px-6 text-base font-medium text-white transition hover:bg-white/10"
                >
                  See how it works
                </Link>
              </div>
              {trialNote ? <p className="mt-4 text-sm text-slate-300">{trialNote}</p> : null}
            </div>
          </section>
        </div>
      </MarketingShell>
    </BrandProvider>
  );
}
