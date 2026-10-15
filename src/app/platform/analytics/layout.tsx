import type { ReactNode } from "react";
import { Suspense } from "react";
import { requireSuperAdminPage } from "@/lib/admin-access";
import { AnalyticsTabs } from "@/components/platform/analytics/controls";
import { reportingTimeZone } from "@/lib/analytics/range";

export const dynamic = "force-dynamic";

export default async function AnalyticsLayout({ children }: { children: ReactNode }) {
  await requireSuperAdminPage();
  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">Marketing analytics</p>
          <h1 className="mt-1 text-2xl font-bold text-heading">Acquisition &amp; conversion</h1>
          <p className="mt-1 text-sm text-muted">
            First-party data from the marketing site and verified account records. Times in {reportingTimeZone()}.
          </p>
        </div>
      </div>
      <Suspense fallback={<div className="h-10" />}>
        <AnalyticsTabs />
      </Suspense>
      <div className="mt-6">{children}</div>
    </main>
  );
}
