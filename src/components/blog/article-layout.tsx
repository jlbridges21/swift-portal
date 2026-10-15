import Link from "next/link";
import { ArrowRight, CalendarDays, ChevronRight, Clock, Plus, RefreshCw } from "lucide-react";
import { BlogCard, type BlogCardData } from "@/components/blog/blog-card";
import { BlogCoverArt } from "@/components/blog/cover-art";
import { ArticleTocSpy } from "@/components/blog/article-toc-spy";
import type { BlogArticle, BlogAuthor, BlogRenderContext } from "@/lib/blog/types";
import { formatBlogDate } from "@/lib/blog/format";

export function ArticleLayout({
  article,
  author,
  categoryLabel,
  related,
  ctx,
}: {
  article: BlogArticle;
  author: BlogAuthor;
  categoryLabel: string;
  related: BlogCardData[];
  ctx: BlogRenderContext;
}) {
  const toc = [
    ...article.sections.map((s) => ({ id: s.id, label: s.tocLabel ?? s.title })),
    ...(article.faqs.length ? [{ id: "faq", label: "FAQ" }] : []),
  ];

  return (
    <article className="mk-blog">
      {/* Header */}
      <header className="relative overflow-hidden border-b border-[#E2E8F0]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 70% 55% at 50% -15%, rgba(79,70,229,0.14), transparent 60%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 100%)",
          }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-4xl px-4 pb-10 pt-10 sm:px-6 sm:pt-14 lg:px-8">
          <nav aria-label="Breadcrumb" className="mk-enter">
            <ol className="flex flex-wrap items-center gap-1.5 text-sm text-[#64748B]">
              <li>
                <Link href="/blog" className="hover:text-[#0F172A]">
                  Blog
                </Link>
              </li>
              <li aria-hidden>
                <ChevronRight className="h-3.5 w-3.5" />
              </li>
              <li className="font-medium text-[#4F46E5]">{categoryLabel}</li>
            </ol>
          </nav>
          <h1 className="mt-5 text-[2rem] font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-[2.75rem] lg:text-5xl lg:leading-[1.08]">
            {article.title}
          </h1>
          <p className="mk-enter mt-5 max-w-3xl text-lg leading-relaxed text-[#475569]" style={{ animationDelay: "60ms" }}>
            {article.description}
          </p>
          <div className="mk-enter mt-7 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-[#475569]" style={{ animationDelay: "120ms" }}>
            <span className="flex items-center gap-2.5">
              <AuthorAvatar author={author} size={36} />
              <span>
                <span className="block font-semibold text-[#0F172A]">{author.name}</span>
                <span className="block text-xs text-[#64748B]">{author.role}</span>
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="h-4 w-4 text-[#94A3B8]" aria-hidden />
              <time dateTime={article.publishedAt}>{formatBlogDate(article.publishedAt)}</time>
            </span>
            {article.updatedAt && article.updatedAt !== article.publishedAt ? (
              <span className="inline-flex items-center gap-1.5">
                <RefreshCw className="h-4 w-4 text-[#94A3B8]" aria-hidden />
                Updated <time dateTime={article.updatedAt}>{formatBlogDate(article.updatedAt)}</time>
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-[#94A3B8]" aria-hidden />
              {article.readingMinutes} min read
            </span>
          </div>
        </div>
        <div className="relative mx-auto max-w-5xl px-4 pb-12 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-[1.75rem] border border-[#E2E8F0] shadow-[0_40px_80px_-50px_rgba(15,23,42,0.6)]">
            <BlogCoverArt variant={article.cover.variant} tint={article.cover.tint} idPrefix={`hero-${article.slug}`} label={article.cover.label} title={article.cover.alt} />
          </div>
        </div>
      </header>

      {/* Body */}
      <div className="mx-auto grid max-w-6xl gap-12 px-4 py-12 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17rem] lg:px-8 lg:py-16">
        <div className="min-w-0">
          <div className="mk-prose mx-auto max-w-[44rem]">
            {article.disclosure ? (
              <p className="rounded-2xl border border-[#E2E8F0] bg-white px-5 py-4 text-sm leading-relaxed text-[#475569]">
                <strong>Disclosure:</strong> This article is published by ShootPortal, and ShootPortal is one of the
                products discussed. We&apos;ve aimed to describe every platform fairly using its official website.
                {article.factsVerifiedAt ? (
                  <>
                    {" "}
                    Pricing and features last verified{" "}
                    <time dateTime={article.factsVerifiedAt}>{formatBlogDate(article.factsVerifiedAt)}</time>; software
                    changes often, so confirm details on each vendor&apos;s site before you buy.
                  </>
                ) : null}
              </p>
            ) : null}

            {article.intro(ctx)}

            <aside className="!mt-8 rounded-3xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] via-white to-white p-6 sm:p-7" aria-labelledby="quick-answer">
              <p id="quick-answer" className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">
                {article.quickAnswer.heading}
              </p>
              <ul className="mk-plain-list mt-3 space-y-2.5 text-[1rem] leading-relaxed">
                {article.quickAnswer.points.map((p, i) => (
                  <li key={i} className="flex gap-3">
                    <span className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F46E5]" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </aside>

            {/* Mobile TOC */}
            <details className="!mt-8 rounded-2xl border border-[#E2E8F0] bg-white lg:hidden">
              <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold text-[#0F172A]">
                In this article ({toc.length} sections)
              </summary>
              <ol className="mk-plain-list space-y-1 border-t border-[#E2E8F0] px-5 py-4 text-sm">
                {toc.map((t) => (
                  <li key={t.id}>
                    <a href={`#${t.id}`} className="!font-normal !no-underline">
                      {t.label}
                    </a>
                  </li>
                ))}
              </ol>
            </details>

            {article.sections.map((s) => (
              <section key={s.id} aria-labelledby={s.id}>
                <h2 id={s.id}>{s.title}</h2>
                {s.body(ctx)}
              </section>
            ))}

            {article.faqs.length ? (
              <section aria-labelledby="faq" className="mk-faq">
                <h2 id="faq">Frequently asked questions</h2>
                <div className="!mt-6 divide-y divide-[#E2E8F0] rounded-3xl border border-[#E2E8F0] bg-white">
                  {article.faqs.map((f) => (
                    <details key={f.question} className="group px-5 py-1 sm:px-6">
                      <summary className="flex cursor-pointer items-start justify-between gap-4 py-4">
                        <h3 className="!mt-0 text-[1.05rem] font-semibold leading-snug text-[#0F172A]">{f.question}</h3>
                        <Plus className="mk-faq-icon mt-1 h-5 w-5 shrink-0 text-[#4F46E5] transition-transform" aria-hidden />
                      </summary>
                      <div className="pb-5 text-[1rem] leading-relaxed text-[#334155] [&>p+p]:mt-3">{f.answer}</div>
                    </details>
                  ))}
                </div>
              </section>
            ) : null}

            <AuthorBio author={author} />
          </div>
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden lg:block" aria-label="Article navigation">
          <div className="sticky top-24 space-y-6">
            <nav aria-labelledby="toc-heading" className="rounded-2xl border border-[#E2E8F0] bg-white p-5">
              <p id="toc-heading" className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">
                In this article
              </p>
              <ArticleTocSpy items={toc} />
            </nav>
            <div className="relative overflow-hidden rounded-2xl bg-[#0F172A] p-5 text-white">
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: "radial-gradient(ellipse 90% 70% at 100% 0%, rgba(99,102,241,0.5), transparent 60%)" }}
                aria-hidden
              />
              <div className="relative">
                <p className="text-sm font-semibold">Run every shoot from one place.</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-300">
                  Requests, estimates, scheduling, payments, and delivery in one portal.
                </p>
                <Link
                  href="/signup"
                  className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-[#4F46E5] px-4 text-sm font-semibold text-white transition hover:bg-[#4338CA]"
                >
                  {ctx.trialDays > 0 ? `Start ${ctx.trialDays}-day free trial` : "Start free"}
                </Link>
              </div>
            </div>
          </div>
        </aside>
      </div>

      <ArticleFinalCta article={article} ctx={ctx} />

      {related.length ? (
        <section aria-labelledby="related-heading" className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">Keep reading</p>
                <h2 id="related-heading" className="mt-2 text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
                  Related articles
                </h2>
              </div>
              <Link href="/blog" className="inline-flex items-center gap-1 text-sm font-semibold text-[#4F46E5] hover:text-[#4338CA]">
                All articles <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <BlogCard key={p.slug} post={p} />
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </article>
  );
}

export function AuthorAvatar({ author, size }: { author: BlogAuthor; size: number }) {
  const initials = author.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}

function AuthorBio({ author }: { author: BlogAuthor }) {
  return (
    <section aria-label="About the author" className="!mt-14 rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-7">
      <div className="flex items-start gap-4">
        <AuthorAvatar author={author} size={56} />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Written by</p>
          <p className="mt-1 text-lg font-semibold text-[#0F172A]">{author.name}</p>
          <ul className="mk-plain-list mt-2 flex flex-wrap gap-2">
            {author.credentials.map((c) => (
              <li key={c} className="!mt-0 rounded-full bg-[#F1F5F9] px-2.5 py-1 text-xs font-medium text-[#475569]">
                {c}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.98rem] leading-relaxed text-[#475569]">{author.bio}</p>
        </div>
      </div>
    </section>
  );
}

function ArticleFinalCta({ article, ctx }: { article: BlogArticle; ctx: BlogRenderContext }) {
  const pricing =
    ctx.studioMonthly && ctx.studioAnnual
      ? `Then ${ctx.studioMonthly}/month, or ${ctx.studioAnnual}/month billed annually.`
      : ctx.studioMonthly
        ? `Then ${ctx.studioMonthly}/month.`
        : null;
  return (
    <section aria-labelledby="final-cta" className="relative overflow-hidden bg-[#0F172A]">
      <div
        className="pointer-events-none absolute inset-0"
        style={{ background: "radial-gradient(ellipse 60% 60% at 75% 10%, rgba(79,70,229,0.4), transparent 60%), radial-gradient(ellipse 50% 50% at 10% 100%, rgba(124,58,237,0.25), transparent 60%)" }}
        aria-hidden
      />
      <div className="relative mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:py-20">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#A5B4FC]">ShootPortal</p>
        <h2 id="final-cta" className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          {article.cta.title}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300">{article.cta.body}</p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#4F46E5] px-7 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-[#4338CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F172A]"
          >
            {ctx.trialDays > 0 ? `Start your ${ctx.trialDays}-day free trial` : "Start free"} <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <Link
            href={article.cta.secondaryHref ?? "/how-it-works"}
            className="inline-flex min-h-12 items-center rounded-lg border border-white/20 px-6 text-base font-medium text-white transition hover:bg-white/10"
          >
            {article.cta.secondaryLabel ?? "See how it works"}
          </Link>
        </div>
        {ctx.trialDays > 0 ? (
          <p className="mt-4 text-sm text-slate-300">
            {ctx.trialDays} days free. No credit card required. Sign up with Google or a five-field form.
          </p>
        ) : null}
        {pricing ? <p className="mt-1 text-sm text-slate-400">{pricing}</p> : null}
      </div>
    </section>
  );
}
