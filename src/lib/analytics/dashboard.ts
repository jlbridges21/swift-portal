import { buildLifecycles } from "@/lib/analytics/aggregate";
import { parseReportRange, previousRange } from "@/lib/analytics/range";
import { loadReport } from "@/lib/analytics/report-data";

export type DashboardSearchParams = { range?: string; from?: string; to?: string; model?: string; q?: string };

/** Shared server loader for /platform/analytics pages (callers must be super-admin gated). */
export async function loadDashboard(sp: DashboardSearchParams, opts: { withPrevious?: boolean } = {}) {
  const range = parseReportRange(sp);
  const prev = opts.withPrevious ? previousRange(range) : null;
  const loaded = await loadReport(range, prev);
  const lifecycles = buildLifecycles(loaded.current);
  const model: "first" | "last" = sp.model === "last" ? "last" : "first";
  return { range, prev, loaded, lifecycles, model };
}
