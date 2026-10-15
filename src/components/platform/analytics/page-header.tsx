import type { ReactNode } from "react";
import { Suspense } from "react";
import { RangePicker } from "@/components/platform/analytics/controls";
import { Notice } from "@/components/platform/analytics/ui";
import type { ReportRange } from "@/lib/analytics/range";
import type { LoadedReport } from "@/lib/analytics/report-data";

export function AnalyticsPageHeader({
  title,
  range,
  loaded,
  children,
}: {
  title: string;
  range: ReportRange;
  loaded?: Pick<LoadedReport, "tablesReady" | "truncated" | "loadError">;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-heading">{title}</h2>
          <p className="text-xs text-muted">
            {range.label} · {range.startDay} to {range.endDay}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <Suspense fallback={null}>
            <RangePicker preset={range.preset} startDay={range.startDay} endDay={range.endDay} />
          </Suspense>
        </div>
      </div>
      {loaded && !loaded.tablesReady ? (
        <Notice tone="warn">
          Analytics tables are not installed yet. Apply <code className="text-xs">supabase/migration-v103-marketing-analytics.sql</code>{" "}
          to start collecting. Account, trial, activation, and revenue figures below still come from existing records.
        </Notice>
      ) : null}
      {loaded?.loadError ? <Notice tone="warn">Some data could not be loaded: {loaded.loadError}</Notice> : null}
      {loaded?.truncated ? (
        <Notice tone="warn">This range exceeded the row limit, so traffic figures are incomplete. Choose a shorter range.</Notice>
      ) : null}
    </div>
  );
}
