"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { BlogCard, type BlogCardData } from "@/components/blog/blog-card";
import { cn } from "@/lib/utils";

/**
 * Category filter + search over the article list. Server-rendered with every
 * card visible (state starts at "All"), so all article links are present in
 * the initial HTML for crawlers; filtering only hides cards client-side.
 */
export function BlogIndexBrowser({
  posts,
  categories,
}: {
  posts: BlogCardData[];
  categories: { slug: string; label: string; count: number }[];
}) {
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      if (category !== "all" && p.categorySlug !== category) return false;
      if (!q) return true;
      return `${p.title} ${p.excerpt} ${p.categoryLabel}`.toLowerCase().includes(q);
    });
  }, [posts, category, query]);

  const chips = [{ slug: "all", label: "All articles", count: posts.length }, ...categories];

  return (
    <div>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div role="group" aria-label="Filter by category" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {chips.map((c) => {
            const active = category === c.slug;
            return (
              <button
                key={c.slug}
                type="button"
                aria-pressed={active}
                onClick={() => setCategory(c.slug)}
                className={cn(
                  "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2",
                  active
                    ? "border-[#0F172A] bg-[#0F172A] text-white"
                    : "border-[#E2E8F0] bg-white text-[#475569] hover:border-[#C7D2FE] hover:text-[#0F172A]"
                )}
              >
                {c.label}
                <span className={cn("rounded-full px-1.5 text-xs", active ? "bg-white/15" : "bg-[#F1F5F9] text-[#64748B]")}>{c.count}</span>
              </button>
            );
          })}
        </div>
        <label className="relative block w-full lg:w-72">
          <span className="sr-only">Search articles</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#94A3B8]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search articles"
            className="min-h-11 w-full rounded-full border border-[#E2E8F0] bg-white pl-10 pr-10 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:border-[#A5B4FC] focus:outline-none focus:ring-2 focus:ring-[#C7D2FE]"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9]"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" aria-hidden />
            </button>
          ) : null}
        </label>
      </div>

      <p className="sr-only" aria-live="polite">
        {visible.length} {visible.length === 1 ? "article" : "articles"} shown
      </p>

      {visible.length ? (
        <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((p, i) => (
            <BlogCard key={p.slug} post={p} className="mk-enter" headingLevel="h3" />
          ))}
        </div>
      ) : (
        <div className="mt-8 rounded-3xl border border-dashed border-[#CBD5E1] bg-white px-6 py-14 text-center">
          <p className="font-semibold text-[#0F172A]">No articles match that search yet.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setCategory("all");
            }}
            className="mt-3 text-sm font-semibold text-[#4F46E5] hover:underline"
          >
            Show all articles
          </button>
        </div>
      )}
    </div>
  );
}
