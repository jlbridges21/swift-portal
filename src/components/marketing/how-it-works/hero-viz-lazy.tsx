"use client";

import dynamic from "next/dynamic";

export const HowItWorksHeroVizLazy = dynamic(
  () => import("./hero-viz").then((m) => m.HowItWorksHeroViz),
  {
    ssr: false,
    loading: () => (
      <div
        className="w-full rounded-2xl border border-[#E2E8F0] bg-white shadow-lg"
        style={{ minHeight: "22rem" }}
        aria-hidden
      />
    ),
  }
);
