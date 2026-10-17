import type { ReactNode } from "react";
import { Suspense } from "react";
import { SeoSubNav } from "@/components/platform/seo-growth/nav";

/** SEO tab: "Search performance" (Search Console report) and "Growth engine". Access is enforced by the analytics layout. */
export default function SeoLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <Suspense fallback={<div className="mb-5 h-8" />}>
        <SeoSubNav />
      </Suspense>
      {children}
    </>
  );
}
