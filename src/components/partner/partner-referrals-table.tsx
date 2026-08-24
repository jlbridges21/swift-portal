"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PartnerReferralRow } from "@/lib/partner-dashboard";
import { Button } from "@/components/ui/button";

const SORTS = [
  { key: "joinedAt", label: "Joined" },
  { key: "displayName", label: "Name" },
  { key: "revenueGeneratedCents", label: "Revenue" },
  { key: "commissionEarnedCents", label: "Commission" },
] as const;

function statusLabel(status: string): string {
  const map: Record<string, string> = {
    trialing: "Trialing",
    active: "Active",
    past_due: "Past due",
    canceled: "Canceled",
    unpaid: "Unpaid",
    incomplete: "Incomplete",
    trial_expired: "Trial expired",
  };
  return map[status] || status;
}

export function PartnerReferralsTable({
  rows,
  total,
  page,
  pageSize,
  sort,
  dir,
}: {
  rows: PartnerReferralRow[];
  total: number;
  page: number;
  pageSize: number;
  sort: string;
  dir: "asc" | "desc";
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function setParam(updates: Record<string, string>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) next.set(k, v);
    router.push(`${pathname}?${next.toString()}#referrals`);
  }

  function toggleSort(key: string) {
    if (sort === key) {
      setParam({ sort: key, dir: dir === "asc" ? "desc" : "asc", page: "1" });
    } else {
      setParam({ sort: key, dir: "desc", page: "1" });
    }
  }

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        No referred businesses yet. Share your referral link to get started.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {SORTS.map((s) => (
          <Button
            key={s.key}
            type="button"
            size="sm"
            variant={sort === s.key ? "accent" : "outline"}
            className="min-h-9"
            onClick={() => toggleSort(s.key)}
          >
            {s.label}
            {sort === s.key ? (dir === "asc" ? " ↑" : " ↓") : ""}
          </Button>
        ))}
      </div>

      {/* Mobile cards */}
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={r.businessId} className="rounded-lg border border-border p-4 text-sm">
            <p className="font-semibold text-heading">{r.displayName}</p>
            <p className="mt-1 text-muted">
              Joined {formatDate(r.joinedAt)} · {statusLabel(r.status)} · {r.plan}
            </p>
            <p className="mt-2">
              Revenue {formatCurrency(r.revenueGeneratedCents)} · Commission{" "}
              {formatCurrency(r.commissionEarnedCents)}
            </p>
            <p className="mt-1 text-xs text-muted">
              {r.isGeneratingRecurring ? "Generating recurring commission" : "Not currently recurring"}
            </p>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-3 font-medium">Business</th>
              <th className="py-2 pr-3 font-medium">Joined</th>
              <th className="py-2 pr-3 font-medium">Status</th>
              <th className="py-2 pr-3 font-medium">Plan</th>
              <th className="py-2 pr-3 font-medium">Revenue</th>
              <th className="py-2 pr-3 font-medium">Commission</th>
              <th className="py-2 font-medium">Recurring</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.businessId} className="border-b border-border/60">
                <td className="py-2.5 pr-3 font-medium text-heading">{r.displayName}</td>
                <td className="py-2.5 pr-3">{formatDate(r.joinedAt)}</td>
                <td className="py-2.5 pr-3">{statusLabel(r.status)}</td>
                <td className="py-2.5 pr-3">{r.plan}</td>
                <td className="py-2.5 pr-3">{formatCurrency(r.revenueGeneratedCents)}</td>
                <td className="py-2.5 pr-3">{formatCurrency(r.commissionEarnedCents)}</td>
                <td className="py-2.5">{r.isGeneratingRecurring ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <p className="text-muted">
            Page {page} of {totalPages} ({total} total)
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              className="min-h-11"
              onClick={() => setParam({ page: String(page - 1) })}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              className="min-h-11"
              onClick={() => setParam({ page: String(page + 1) })}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
