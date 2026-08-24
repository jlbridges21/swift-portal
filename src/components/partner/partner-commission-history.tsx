"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { PartnerCommissionHistoryRow } from "@/lib/partner-dashboard";
import { Button } from "@/components/ui/button";

function statusLabel(status: PartnerCommissionHistoryRow["status"]): string {
  switch (status) {
    case "pending":
      return "Pending hold";
    case "payable":
      return "Payable";
    case "paid":
      return "Paid";
    case "reversal":
      return "Reversal";
    case "adjustment":
      return "Adjustment";
    default:
      return status;
  }
}

export function PartnerCommissionHistory({
  rows,
  total,
  page,
  pageSize,
}: {
  rows: PartnerCommissionHistoryRow[];
  total: number;
  page: number;
  pageSize: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  function setPage(p: number) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("cpage", String(p));
    router.push(`${pathname}?${next.toString()}#history`);
  }

  if (total === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted">
        No commission rows yet. Earnings appear here when a referred business pays ShootPortal.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:hidden">
        {rows.map((r) => (
          <div key={r.id} className="rounded-lg border border-border p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-heading">{r.businessName ?? "—"}</p>
              <span
                className={
                  r.amountCents < 0 ? "font-semibold text-amber-700" : "font-semibold text-heading"
                }
              >
                {formatCurrency(r.amountCents)}
              </span>
            </div>
            <p className="mt-1 text-muted">{formatDate(r.earnedAt)}</p>
            <p className="mt-2">
              Payment {formatCurrency(r.sourceAmountCents)} ×{" "}
              <span className="font-mono">{r.commissionRatePct}%</span> (snapshot)
            </p>
            <p className="mt-1 text-xs text-muted">
              {statusLabel(r.status)}
              {r.kind === "reversal" && r.reversesCommissionId
                ? ` · reverses ${r.reversesCommissionId.slice(0, 8)}…`
                : ""}
              {r.status === "pending" && r.payableAt
                ? ` · available ${formatDate(r.payableAt)}`
                : ""}
            </p>
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[800px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-3 font-medium">Date</th>
              <th className="py-2 pr-3 font-medium">Business</th>
              <th className="py-2 pr-3 font-medium">Payment</th>
              <th className="py-2 pr-3 font-medium">Rate</th>
              <th className="py-2 pr-3 font-medium">Commission</th>
              <th className="py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/60">
                <td className="py-2.5 pr-3">{formatDate(r.earnedAt)}</td>
                <td className="py-2.5 pr-3">
                  {r.businessName ?? "—"}
                  {r.kind === "reversal" ? (
                    <span className="mt-0.5 block text-xs text-amber-700">
                      Reversal
                      {r.reversesCommissionId
                        ? ` of ${r.reversesCommissionId.slice(0, 8)}…`
                        : ""}
                    </span>
                  ) : null}
                </td>
                <td className="py-2.5 pr-3">{formatCurrency(r.sourceAmountCents)}</td>
                <td className="py-2.5 pr-3 font-mono">{r.commissionRatePct}%</td>
                <td
                  className={
                    r.amountCents < 0
                      ? "py-2.5 pr-3 font-medium text-amber-700"
                      : "py-2.5 pr-3 font-medium"
                  }
                >
                  {formatCurrency(r.amountCents)}
                </td>
                <td className="py-2.5">
                  {statusLabel(r.status)}
                  {r.status === "pending" && r.payableAt ? (
                    <span className="mt-0.5 block text-xs text-muted">
                      Available {formatDate(r.payableAt)}
                    </span>
                  ) : null}
                </td>
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
              onClick={() => setPage(page - 1)}
            >
              Previous
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              className="min-h-11"
              onClick={() => setPage(page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
