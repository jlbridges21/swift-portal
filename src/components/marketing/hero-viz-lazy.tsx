"use client";

import dynamic from "next/dynamic";

/**
 * Client-only lazy load so the SSR hero (H1 + CTAs) paints without waiting on the viz bundle.
 * Reserved min-height keeps CLS at 0.
 */
export const HeroProductVizLazy = dynamic(
  () => import("@/components/marketing/hero-product-viz").then((m) => m.HeroProductViz),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl border border-[#E2E8F0] bg-white shadow-lg"
        style={{ minHeight: "22rem" }}
        aria-hidden
      >
        <div className="hidden h-[28rem] lg:block" />
        <div className="h-[22rem] lg:hidden" />
      </div>
    ),
  }
);
