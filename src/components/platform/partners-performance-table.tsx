"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import type { PartnerTableRow } from "@/lib/partner-program";

type SortKey =
  | "brandName"
  | "commissionRatePct"
  | "referralCode"
  | "referredCustomers"
  | "activeCustomers"
  | "revenueGeneratedCents"
  | "commissionEarnedCents"
  | "amountPaidCents"
  | "currentRecurringCommissionCents";

type Props = {
  rows: PartnerTableRow[];
};

export function PartnersPerformanceTable({ rows }: Props) {
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState<SortKey>("revenueGeneratedCents");
  const [dir, setDir] = useState<"asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const list = status === "all" ? rows : rows.filter((r) => r.status === status);
    const sorted = [...list].sort((a, b) => {
      const av = a[sort];
      const bv = b[sort];
      if (typeof av === "string" && typeof bv === "string") {
        return dir === "asc" ? av.localeCompare(bv) : bv.localeCompare(av);
      }
      const an = Number(av);
      const bn = Number(bv);
      return dir === "asc" ? an - bn : bn - an;
    });
    return sorted;
  }, [rows, status, sort, dir]);

  function toggleSort(key: SortKey) {
    if (sort === key) setDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSort(key);
      setDir(key === "brandName" || key === "referralCode" ? "asc" : "desc");
    }
  }

  function SortBtn({ k, label }: { k: SortKey; label: string }) {
    const active = sort === k;
    return (
      <button
        type="button"
        className="inline-flex min-h-11 items-center gap-1 font-medium text-muted hover:text-heading"
        onClick={() => toggleSort(k)}
      >
        {label}
        {active ? <span className="text-xs">{dir === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">{filtered.length} partners</p>
        <Select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          options={[
            { value: "all", label: "All statuses" },
            { value: "active", label: "Active" },
            { value: "suspended", label: "Suspended" },
          ]}
        />
      </div>

      <div className="space-y-3 md:hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted">No partners in this filter.</p>
        ) : (
          filtered.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-4 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-heading">{r.brandName}</p>
                  <p className="text-muted">
                    {r.name} · {r.status}
                  </p>
                </div>
                <Link href={`/platform/partners/${r.id}`}>
                  <Button type="button" size="sm" variant="outline" className="min-h-11">
                    Open
                  </Button>
                </Link>
              </div>
              <p className="mt-2 font-mono text-xs">
                {r.referralCode} · {r.commissionRatePct}%
              </p>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <dt className="text-muted">Referred</dt>
                  <dd className="font-medium text-heading">{r.referredCustomers}</dd>
                </div>
                <div>
                  <dt className="text-muted">Active</dt>
                  <dd className="font-medium text-heading">{r.activeCustomers}</dd>
                </div>
                <div>
                  <dt className="text-muted">Revenue</dt>
                  <dd className="font-medium text-heading">
                    {formatCurrency(r.revenueGeneratedCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Earned</dt>
                  <dd className="font-medium text-heading">
                    {formatCurrency(r.commissionEarnedCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">Paid</dt>
                  <dd className="font-medium text-heading">{formatCurrency(r.amountPaidCents)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Recurring</dt>
                  <dd className="font-medium text-heading">
                    {formatCurrency(r.currentRecurringCommissionCents)}
                  </dd>
                </div>
              </dl>
            </div>
          ))
        )}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-3">
                <SortBtn k="brandName" label="Partner" />
              </th>
              <th className="py-2 pr-3">
                <SortBtn k="commissionRatePct" label="Commission %" />
              </th>
              <th className="py-2 pr-3">
                <SortBtn k="referralCode" label="Code" />
              </th>
              <th className="py-2 pr-3">
                <SortBtn k="referredCustomers" label="Referred" />
              </th>
              <th className="py-2 pr-3">
                <SortBtn k="activeCustomers" label="Active" />
              </th>
              <th className="py-2 pr-3">
                <SortBtn k="revenueGeneratedCents" label="Revenue" />
              </th>
              <th className="py-2 pr-3">
                <SortBtn k="commissionEarnedCents" label="Earned" />
              </th>
              <th className="py-2 pr-3">
                <SortBtn k="amountPaidCents" label="Paid" />
              </th>
              <th className="py-2">
                <SortBtn k="currentRecurringCommissionCents" label="Recurring" />
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-border/70">
                <td className="py-3 pr-3">
                  <Link
                    href={`/platform/partners/${r.id}`}
                    className="font-medium text-heading underline-offset-2 hover:underline"
                  >
                    {r.brandName}
                  </Link>
                  <p className="text-xs text-muted">
                    {r.name} · {r.status}
                  </p>
                </td>
                <td className="py-3 pr-3">{r.commissionRatePct}%</td>
                <td className="py-3 pr-3 font-mono text-xs">{r.referralCode}</td>
                <td className="py-3 pr-3">{r.referredCustomers}</td>
                <td className="py-3 pr-3">{r.activeCustomers}</td>
                <td className="py-3 pr-3">{formatCurrency(r.revenueGeneratedCents)}</td>
                <td className="py-3 pr-3">{formatCurrency(r.commissionEarnedCents)}</td>
                <td className="py-3 pr-3">{formatCurrency(r.amountPaidCents)}</td>
                <td className="py-3">{formatCurrency(r.currentRecurringCommissionCents)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
