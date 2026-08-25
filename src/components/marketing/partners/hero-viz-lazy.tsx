"use client";

import dynamic from "next/dynamic";

export const PartnerHeroVizLazy = dynamic(
  () => import("./hero-viz").then((m) => m.PartnerHeroViz),
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
