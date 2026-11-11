import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { addDays, dayCount, rangeBoundsUtc, type AnalyticsRange } from "@/lib/dashboard-analytics";
import { loadDashboardAnalytics } from "@/lib/dashboard-analytics-server";
import { loadProjectStorageBytes } from "@/lib/project-storage";
import { getPlanLimits } from "@/lib/entitlements";
import type { CommandCenterSummary, BusinessStorageUsage } from "@/lib/command-center";

/** The equally long period immediately before `range` (e.g. the 30 days before the last 30). */
export function previousRange(range: AnalyticsRange): AnalyticsRange {
  const n = dayCount(range.from, range.to);
  return { from: addDays(range.from, -n), to: addDays(range.from, -1) };
}

/**
 * Date-range numbers the Command Center shows next to the analytics: the previous period's
 * revenue and new projects (same aggregation as the chart, so refunds are subtracted the
 * same way), plus client totals. Owner-only callers; tenant from the session.
 */
export async function loadCommandCenterSummary(
  businessId: string,
  range: AnalyticsRange,
  timeZone: string
): Promise<CommandCenterSummary> {
  const prev = previousRange(range);
  const db = await createTenantServiceClient(businessId);
  const cur = rangeBoundsUtc(range, timeZone);
  const before = rangeBoundsUtc(prev, timeZone);

  const clientCount = (bounds?: { start: string; end: string }) => {
    let q = db.from("clients").select("id", { count: "exact", head: true }).is("deleted_at", null);
    if (bounds) q = q.gte("created_at", bounds.start).lt("created_at", bounds.end);
    return q.then(({ count, error }) => {
      if (error) throw new Error(error.message);
      return count ?? 0;
    });
  };

  const [previous, total, newInRange, newInPrevious] = await Promise.all([
    loadDashboardAnalytics(businessId, prev, timeZone)
      .then((a) => ({
        paymentsNetCents: a.summary.paymentsNetCents,
        invoicesCents: a.summary.invoicesCents,
        newProjects: a.summary.newProjects,
      }))
      .catch((err) => {
        console.error("[command-center] previous period failed", err);
        return null;
      }),
    clientCount(),
    clientCount(cur),
    clientCount(before),
  ]);

  return {
    range,
    previousRange: prev,
    previous,
    clients: { total, newInRange, newInPrevious },
  };
}

/**
 * Media storage the business is using now (not date filtered) against its plan allowance.
 * Same measure as the per-project storage chip on project cards: originals + thumbnails
 * (migration v115), or originals only without it. Hidden projects still hold files, so
 * every project row counts. Returns null when it cannot be measured.
 */
export async function loadBusinessStorageUsage(businessId: string): Promise<BusinessStorageUsage | null> {
  try {
    const db = await createTenantServiceClient(businessId);
    const ids: string[] = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from("projects")
        .select("id")
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const row of data ?? []) ids.push(row.id as string);
      if (!data || data.length < PAGE) break;
    }
    const [map, limits] = await Promise.all([loadProjectStorageBytes(businessId, ids), getPlanLimits(businessId)]);
    if (!map) return null;
    const usedBytes = Object.values(map).reduce((sum, b) => sum + (Number(b) || 0), 0);
    // null = unlimited plan; 0 = no active plan (no allowance to compare against).
    const limitGb = limits.storage_gb && limits.storage_gb > 0 ? limits.storage_gb : null;
    return { usedBytes, limitBytes: limitGb ? limitGb * 1024 ** 3 : null };
  } catch (err) {
    console.error("[command-center] storage usage failed", err);
    return null;
  }
}
