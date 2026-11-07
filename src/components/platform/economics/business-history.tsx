"use client";

import { useEffect, useState } from "react";
import type { BusinessEconomicsHistory } from "@/lib/platform-economics";
import { bytesToGb, formatUsd } from "@/lib/economics/assumptions";
import { ColumnChart, TrendChart } from "@/components/platform/analytics/charts";
import { EmptyChart } from "@/components/platform/analytics/ui";

/** Storage / download / payment trends for one business, fetched on open. */
export function BusinessEconomicsHistoryCharts({ businessId }: { businessId: string }) {
  const [data, setData] = useState<BusinessEconomicsHistory | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    fetch(`/api/platform/economics/businesses/${businessId}`, { credentials: "include" })
      .then(async (res) => {
        const body = (await res.json().catch(() => ({}))) as BusinessEconomicsHistory & { error?: string };
        if (!res.ok) throw new Error(body.error || "Could not load history");
        if (alive) setData(body);
      })
      .catch((err) => alive && setError(err instanceof Error ? err.message : "Could not load history"));
    return () => {
      alive = false;
    };
  }, [businessId]);

  if (error) return <p className="text-sm text-rose-700">{error}</p>;
  if (!data) return <div className="h-40 animate-pulse rounded-xl bg-subtle" />;

  return (
    <div className="grid gap-5 lg:grid-cols-3">
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Stored (daily snapshots)</p>
        {data.storage.length > 1 ? (
          <TrendChart
            height={150}
            points={data.storage.map((s) => ({ day: s.day, gb: +bytesToGb(s.bytes).toFixed(2) }))}
            series={[{ key: "gb", label: "GB stored", color: "#4F46E5", type: "decimal" }]}
          />
        ) : data.uploadsByMonth.length ? (
          <>
            <ColumnChart
              xMode="month"
              label="GB uploaded"
              type="decimal"
              color="#14B8A6"
              valueKey="gb"
              points={data.uploadsByMonth.map((m) => ({ day: m.month, gb: +bytesToGb(m.bytes).toFixed(2) }))}
            />
            <p className="mt-1 text-xs text-muted">Uploads by month (media still stored). Daily snapshots start with migration V112.</p>
          </>
        ) : (
          <EmptyChart>No storage history yet.</EmptyChart>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">Delivered per day (metered)</p>
        {data.egress.length ? (
          <ColumnChart
            label="GB delivered"
            type="decimal"
            color="#0EA5E9"
            valueKey="gb"
            points={data.egress.map((e) => ({ day: e.day, gb: +bytesToGb(e.bytes).toFixed(3) }))}
          />
        ) : (
          <EmptyChart>No metered downloads yet.</EmptyChart>
        )}
      </div>
      <div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted">ShootPortal invoices paid</p>
        {data.payments.length ? (
          <ul className="max-h-40 space-y-1 overflow-auto text-sm">
            {data.payments.map((p) => (
              <li key={p.paidAt} className="flex justify-between border-b border-border pb-1 last:border-0">
                <span className="text-muted">{new Date(p.paidAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span>
                <span className="tabular-nums text-heading">{formatUsd(p.amountCents / 100)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyChart>No paid invoices.</EmptyChart>
        )}
      </div>
    </div>
  );
}
