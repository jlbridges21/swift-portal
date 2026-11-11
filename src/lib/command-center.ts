import type { AnalyticsRange } from "@/lib/dashboard-analytics";

/** Previous-period numbers and client totals for the Command Center summary cards. */
export interface CommandCenterSummary {
  range: AnalyticsRange;
  previousRange: AnalyticsRange;
  /** Same metrics as the analytics summary, for the previous period. null when it failed to load. */
  previous: { paymentsNetCents: number; invoicesCents: number; newProjects: number } | null;
  clients: { total: number; newInRange: number; newInPrevious: number };
}

export interface BusinessStorageUsage {
  usedBytes: number;
  /** Plan allowance; null = unlimited (or no allowance configured). */
  limitBytes: number | null;
}

/**
 * Percentage change from `previous` to `current`, rounded to a whole number.
 * null when there is nothing to compare against (previous is 0 or unknown).
 */
export function percentChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}
