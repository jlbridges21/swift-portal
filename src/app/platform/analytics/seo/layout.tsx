import type { ReactNode } from "react";
import { Suspense } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { SeoSubNav } from "@/components/platform/seo-growth/nav";

/** SEO tab: "Search performance" (Search Console report) and "Growth engine". */
export default async function SeoLayout({ children }: { children: ReactNode }) {
  await requireSuperAdminPage();
  return (
    <>
      <Suspense fallback={<div className="mb-5 h-8" />}>
        <SeoSubNav />
      </Suspense>
      {children}
    </>
  );
}
