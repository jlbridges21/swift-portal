import { formatCurrency } from "@/lib/utils";
import type { MonthlyEarningsBucket } from "@/lib/partner-dashboard";

/** CSS bar chart — no new charting dependency. Green = earned, amber = reversals. */
export function PartnerEarningsChart({ buckets }: { buckets: MonthlyEarningsBucket[] }) {
  const max = Math.max(
    1,
    ...buckets.map((b) => Math.max(b.earnedCents, b.reversedCents, Math.abs(b.netCents)))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-teal-600" /> Earned
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-amber-500" /> Reversed
        </span>
      </div>
      <div className="flex h-48 items-end gap-1.5 sm:gap-2">
        {buckets.map((b) => {
          const earnedH = Math.round((b.earnedCents / max) * 100);
          const revH = Math.round((b.reversedCents / max) * 100);
          return (
            <div key={b.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <div className="flex h-40 w-full items-end justify-center gap-0.5">
                <div
                  className="w-[45%] min-w-[4px] rounded-t-sm bg-teal-600"
                  style={{ height: `${Math.max(b.earnedCents > 0 ? 4 : 0, earnedH)}%` }}
                  title={`Earned ${formatCurrency(b.earnedCents)}`}
                />
                <div
                  className="w-[45%] min-w-[4px] rounded-t-sm bg-amber-500"
                  style={{ height: `${Math.max(b.reversedCents > 0 ? 4 : 0, revH)}%` }}
                  title={`Reversed ${formatCurrency(b.reversedCents)}`}
                />
              </div>
              <span className="max-w-full truncate text-[10px] text-muted sm:text-xs">{b.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
