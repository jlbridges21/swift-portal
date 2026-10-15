import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { BlogCoverArt } from "@/components/blog/cover-art";
import type { BlogCoverVariant } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

/** Serializable card data (safe to pass to the client-side index browser). */
export type BlogCardData = {
  slug: string;
  title: string;
  excerpt: string;
  categorySlug: string;
  categoryLabel: string;
  readingMinutes: number;
  publishedAt: string;
  publishedLabel: string;
  cover: { variant: BlogCoverVariant; label: string };
};

export function BlogCard({ post, className, headingLevel = "h3" }: { post: BlogCardData; className?: string; headingLevel?: "h2" | "h3" }) {
  const Heading = headingLevel;
  return (
    <article
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white transition duration-300 hover:-translate-y-1 hover:border-[#C7D2FE] hover:shadow-[0_28px_60px_-36px_rgba(79,70,229,0.55)] focus-within:ring-2 focus-within:ring-[#4F46E5] focus-within:ring-offset-2",
        className
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden">
        <BlogCoverArt
          variant={post.cover.variant}
          idPrefix={`card-${post.slug}`}
          className="transition duration-500 group-hover:scale-[1.03]"
        />
      </div>
      <div className="flex flex-1 flex-col p-6">
        <div className="flex items-center gap-3 text-xs">
          <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 font-semibold text-[#4F46E5]">{post.categoryLabel}</span>
          <span className="inline-flex items-center gap-1 text-[#64748B]">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {post.readingMinutes} min read
          </span>
        </div>
        <Heading className="mt-4 text-lg font-semibold leading-snug tracking-tight text-[#0F172A]">
          <Link href={`/blog/${post.slug}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {post.title}
          </Link>
        </Heading>
        <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-[#475569]">{post.excerpt}</p>
        <div className="mt-auto flex items-center justify-between pt-5 text-xs text-[#64748B]">
          <time dateTime={post.publishedAt}>{post.publishedLabel}</time>
          <span className="inline-flex items-center gap-1 font-semibold text-[#4F46E5]" aria-hidden>
            Read article <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </article>
  );
}

export function FeaturedArticleCard({ post }: { post: BlogCardData }) {
  return (
    <article className="group relative grid overflow-hidden rounded-[2rem] border border-[#E2E8F0] bg-white shadow-[0_30px_80px_-50px_rgba(15,23,42,0.55)] transition hover:border-[#C7D2FE] focus-within:ring-2 focus-within:ring-[#4F46E5] focus-within:ring-offset-2 lg:grid-cols-[1.15fr_1fr]">
      <div className="relative aspect-[16/9] overflow-hidden lg:aspect-auto lg:min-h-[22rem]">
        <BlogCoverArt
          variant={post.cover.variant}
          idPrefix={`featured-${post.slug}`}
          label={post.cover.label}
          anchor="left"
          className="h-full transition duration-700 group-hover:scale-[1.02] lg:absolute lg:inset-0"
        />
      </div>
      <div className="flex flex-col justify-center p-7 sm:p-10">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED] px-3 py-1 font-semibold text-white">Featured</span>
          <span className="rounded-full bg-[#EEF2FF] px-2.5 py-1 font-semibold text-[#4F46E5]">{post.categoryLabel}</span>
          <span className="inline-flex items-center gap-1 text-[#64748B]">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            {post.readingMinutes} min read
          </span>
        </div>
        <h2 className="mt-5 text-2xl font-bold leading-tight tracking-tight text-[#0F172A] sm:text-3xl">
          <Link href={`/blog/${post.slug}`} className="outline-none after:absolute after:inset-0 after:content-['']">
            {post.title}
          </Link>
        </h2>
        <p className="mt-4 text-base leading-relaxed text-[#475569]">{post.excerpt}</p>
        <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[#4F46E5]" aria-hidden>
          Read the guide <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </span>
      </div>
    </article>
  );
}
