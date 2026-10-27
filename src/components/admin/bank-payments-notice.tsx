"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { cn } from "@/lib/utils";

type MethodsState = { bankAvailable: boolean; passCardFee: boolean; canManage: boolean };

/**
 * Tells the business, where it requests payment, whether clients can pay by bank (ACH).
 * Off: explains the benefit and links straight to Settings → Payments to turn it on.
 * On: a one-line confirmation.
 */
export function BankPaymentsNotice({ className }: { className?: string }) {
  const [state, setState] = useState<MethodsState | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/payments/methods", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: MethodsState | null) => {
        if (!cancelled && data) setState(data);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  if (!state) return null;

  if (state.bankAvailable) {
    return (
      <p className={cn("flex items-start gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800 surface-dark:bg-emerald-950/30 surface-dark:text-emerald-200", className)}>
        <Landmark className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>
          Clients can pay by card or by bank transfer (ACH). Bank payments show as processing for a few business days, then as paid.
        </span>
      </p>
    );
  }

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between surface-dark:border-amber-900 surface-dark:bg-amber-950/30", className)}>
      <div className="flex items-start gap-3">
        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 surface-dark:text-amber-300" aria-hidden />
        <div>
          <p className="text-sm font-semibold text-heading">Accept bank transfers (ACH)</p>
          <p className="text-xs leading-relaxed text-muted">
            Let clients pay straight from their bank account. Stripe charges 0.8% (max $5) instead of about 3% for cards.
            {state.canManage ? " Turn it on in Settings, then clients see a Bank account option when they pay." : " Ask the account owner to turn it on in Settings → Payments."}
          </p>
        </div>
      </div>
      {state.canManage ? (
        <Link
          href="/admin/settings#settings-payments"
          className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Turn on bank payments
        </Link>
      ) : null}
    </div>
  );
}
