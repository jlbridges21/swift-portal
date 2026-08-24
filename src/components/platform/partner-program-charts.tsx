import { formatCurrency } from "@/lib/utils";
import type { PartnerProgramChartBucket } from "@/lib/partner-program";

/** CSS bar chart — no new charting dependency. */
export function PartnerProgramCharts({ buckets }: { buckets: PartnerProgramChartBucket[] }) {
  const maxPartners = Math.max(1, ...buckets.map((b) => b.partnersCreated));
  const maxReferrals = Math.max(1, ...buckets.map((b) => b.referrals));
  const maxRevenue = Math.max(1, ...buckets.map((b) => b.revenueGeneratedCents));
  const maxComm = Math.max(1, ...buckets.map((b) => b.commissionsEarnedCents));

  const series: Array<{
    key: keyof PartnerProgramChartBucket;
    label: string;
    max: number;
    color: string;
    format: (n: number) => string;
  }> = [
    {
      key: "partnersCreated",
      label: "Partner growth",
      max: maxPartners,
      color: "bg-teal-600",
      format: (n) => String(n),
    },
    {
      key: "referrals",
      label: "Referrals",
      max: maxReferrals,
      color: "bg-sky-600",
      format: (n) => String(n),
    },
    {
      key: "revenueGeneratedCents",
      label: "Revenue generated",
      max: maxRevenue,
      color: "bg-indigo-600",
      format: (n) => formatCurrency(n),
    },
    {
      key: "commissionsEarnedCents",
      label: "Commissions earned",
      max: maxComm,
      color: "bg-amber-600",
      format: (n) => formatCurrency(n),
    },
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {series.map((s) => (
        <div key={s.key} className="rounded-lg border border-border p-4">
          <p className="text-sm font-medium text-heading">{s.label}</p>
          <div className="mt-4 flex h-40 items-end gap-1.5 sm:gap-2">
            {buckets.map((b) => {
              const raw = b[s.key];
              const value = typeof raw === "number" ? raw : 0;
              const h = Math.round((value / s.max) * 100);
              return (
                <div key={b.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <div className="flex h-32 w-full items-end justify-center">
                    <div
                      className={`w-full max-w-[18px] rounded-t-sm ${s.color}`}
                      style={{ height: `${Math.max(value > 0 ? 4 : 0, h)}%` }}
                      title={`${b.label}: ${s.format(value)}`}
                    />
                  </div>
                  <span className="max-w-full truncate text-[10px] text-muted sm:text-xs">
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
