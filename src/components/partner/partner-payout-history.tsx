"use client";

import { formatCurrency, formatDate } from "@/lib/utils";
import type { PartnerPayoutRow } from "@/lib/partner-payouts";

export function PartnerPayoutHistory({ payouts }: { payouts: PartnerPayoutRow[] }) {
  if (payouts.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-muted">No payouts recorded yet.</p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3 md:hidden">
        {payouts.map((p) => (
          <div key={p.id} className="rounded-lg border border-border p-4 text-sm">
            <div className="flex items-start justify-between gap-2">
              <p className="font-semibold text-heading">{formatDate(p.paid_at)}</p>
              <p className="font-semibold text-heading">{formatCurrency(p.amount_cents)}</p>
            </div>
            <p className="mt-1 text-muted">
              {p.method || "—"}
              {p.reference ? ` · ${p.reference}` : ""}
            </p>
            {p.note ? <p className="mt-2 text-xs text-muted">{p.note}</p> : null}
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead>
            <tr className="border-b border-border text-muted">
              <th className="py-2 pr-3 font-medium">Paid</th>
              <th className="py-2 pr-3 font-medium">Amount</th>
              <th className="py-2 pr-3 font-medium">Method</th>
              <th className="py-2 pr-3 font-medium">Reference</th>
              <th className="py-2 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {payouts.map((p) => (
              <tr key={p.id} className="border-b border-border/70">
                <td className="py-3 pr-3">{formatDate(p.paid_at)}</td>
                <td className="py-3 pr-3 font-medium">{formatCurrency(p.amount_cents)}</td>
                <td className="py-3 pr-3">{p.method || "—"}</td>
                <td className="py-3 pr-3 font-mono text-xs">{p.reference || "—"}</td>
                <td className="py-3 text-muted">{p.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
