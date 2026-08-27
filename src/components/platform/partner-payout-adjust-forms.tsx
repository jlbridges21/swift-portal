"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils";
import {
  PARTNER_ADJUST_DEBIT_CONFIRM,
  PARTNER_PAYOUT_DISCREPANCY_ACK,
  PARTNER_COMMISSION_HOLD_DAYS,
} from "@/lib/partner-payout-constants";

type Props = {
  partnerId: string;
  payableCents: number;
  openNetCents: number;
  currency: string;
};

function dollarsFromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function PartnerPayoutAdjustForms({
  partnerId,
  payableCents,
  openNetCents,
}: Props) {
  const router = useRouter();
  const formId = useId();
  const [busy, setBusy] = useState<"payout" | "adjust" | null>(null);

  const [amount, setAmount] = useState(dollarsFromCents(Math.max(0, payableCents)));
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [ackDiscrepancy, setAckDiscrepancy] = useState(false);
  const [idempotencyKey] = useState(() =>
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `payout-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );

  const [adjAmount, setAdjAmount] = useState("");
  const [adjNote, setAdjNote] = useState("");
  const [adjConfirm, setAdjConfirm] = useState("");

  const amountCents = Math.round(Number(amount) * 100);
  const mismatch = Number.isFinite(amountCents) && amountCents !== payableCents && payableCents > 0;
  const blockedNegative = openNetCents < 0;
  const nothingPayable = openNetCents <= 0;

  async function submitPayout() {
    if (blockedNegative) {
      toast.error("Cannot record a payout while the payable balance is negative.");
      return;
    }
    if (nothingPayable) {
      toast.error("Nothing payable right now.");
      return;
    }
    if (mismatch && !ackDiscrepancy) {
      toast.error("Acknowledge the amount discrepancy before saving.");
      return;
    }
    setBusy("payout");
    try {
      const res = await fetch(`/api/platform/partners/${partnerId}/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents,
          paidAt,
          method: method || null,
          reference: reference || null,
          note: note || null,
          idempotencyKey,
          discrepancyAck: ackDiscrepancy ? PARTNER_PAYOUT_DISCREPANCY_ACK : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Payout failed");
      toast.success(
        data.reusedExisting
          ? "Payout already recorded (idempotent replay)."
          : `Payout recorded: ${formatCurrency(data.amountCents)}`
      );
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payout failed");
    } finally {
      setBusy(null);
    }
  }

  async function submitAdjust() {
    const cents = Math.round(Number(adjAmount) * 100);
    if (!Number.isFinite(cents) || cents === 0) {
      toast.error("Enter a non-zero adjustment amount.");
      return;
    }
    if (cents < 0 && adjConfirm !== PARTNER_ADJUST_DEBIT_CONFIRM) {
      toast.error(`Type ${PARTNER_ADJUST_DEBIT_CONFIRM} to confirm a debit.`);
      return;
    }
    setBusy("adjust");
    try {
      const res = await fetch(`/api/platform/partners/${partnerId}/adjustments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amountCents: cents,
          note: adjNote,
          confirm: cents < 0 ? PARTNER_ADJUST_DEBIT_CONFIRM : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Adjustment failed");
      toast.success(`Adjustment recorded: ${formatCurrency(cents)}`);
      setAdjAmount("");
      setAdjNote("");
      setAdjConfirm("");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Adjustment failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Record a payout (bookkeeping only)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Marks the payable ledger balance as paid <strong>without</strong> sending money through
            Stripe. Use this only for payouts you already sent outside the app. To actually move
            money, use <strong>Pay this partner</strong> (Stripe transfer) above — that path
            enforces the transfer minimum. This bookkeeping form does{" "}
            <strong>not</strong> enforce the transfer minimum.
          </p>
          <p className="text-sm text-muted">
            V1 records <strong>all</strong> currently payable commissions for this partner (past
            the {PARTNER_COMMISSION_HOLD_DAYS}-day hold, unpaid). Partial payouts are not supported —
            they make reconciliation ambiguous.
          </p>
          {blockedNegative ? (
            <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              Payable balance is{" "}
              <strong>{formatCurrency(openNetCents)}</strong> (negative). Refunds since the last
              payout exceed new earnings. This carries forward against future commissions — a payout
              cannot be recorded until the balance is positive.
            </div>
          ) : (
            <p className="text-sm text-heading">
              Computed payable: <strong>{formatCurrency(payableCents)}</strong>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor={`${formId}-amount`}>Amount (USD)</Label>
              <Input
                id={`${formId}-amount`}
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setAckDiscrepancy(false);
                }}
                disabled={blockedNegative || nothingPayable}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-paid`}>Paid date</Label>
              <Input
                id={`${formId}-paid`}
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
                disabled={blockedNegative || nothingPayable}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-method`}>Method</Label>
              <Input
                id={`${formId}-method`}
                placeholder="Stripe Connect transfer, bank transfer…"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                disabled={blockedNegative || nothingPayable}
                className="min-h-11"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor={`${formId}-ref`}>Reference</Label>
              <Input
                id={`${formId}-ref`}
                placeholder="Transaction / check #"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                disabled={blockedNegative || nothingPayable}
                className="min-h-11"
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-note`}>Note</Label>
            <Textarea
              id={`${formId}-note`}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              disabled={blockedNegative || nothingPayable}
            />
          </div>
          {mismatch ? (
            <label className="flex items-start gap-2 rounded-md border border-border bg-subtle/40 p-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={ackDiscrepancy}
                onChange={(e) => setAckDiscrepancy(e.target.checked)}
              />
              <span>
                Amount differs from computed payable ({formatCurrency(payableCents)}). I acknowledge
                the discrepancy; it will be recorded in the note and bridged with a ledger
                adjustment so the payout still reconciles.
              </span>
            </label>
          ) : null}
          <Button
            type="button"
            variant="accent"
            className="min-h-11"
            disabled={busy === "payout" || blockedNegative || nothingPayable}
            onClick={() => void submitPayout()}
          >
            {busy === "payout" ? "Saving…" : "Record payout"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual adjustment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted">
            Adds a new ledger row (<code className="text-xs">kind=adjustment</code>). Existing
            commission rows are never edited. Adjustments participate in balances like any other
            row.
          </p>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-adj-amt`}>Amount (USD, negative = debit)</Label>
            <Input
              id={`${formId}-adj-amt`}
              type="number"
              step="0.01"
              value={adjAmount}
              onChange={(e) => setAdjAmount(e.target.value)}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor={`${formId}-adj-note`}>Note (required)</Label>
            <Textarea
              id={`${formId}-adj-note`}
              value={adjNote}
              onChange={(e) => setAdjNote(e.target.value)}
              rows={2}
            />
          </div>
          {Number(adjAmount) < 0 ? (
            <div className="space-y-1">
              <Label htmlFor={`${formId}-adj-confirm`}>
                Type <code className="text-xs">{PARTNER_ADJUST_DEBIT_CONFIRM}</code> to confirm
                debit
              </Label>
              <Input
                id={`${formId}-adj-confirm`}
                value={adjConfirm}
                onChange={(e) => setAdjConfirm(e.target.value)}
                className="min-h-11"
              />
            </div>
          ) : null}
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={busy === "adjust"}
            onClick={() => void submitAdjust()}
          >
            {busy === "adjust" ? "Saving…" : "Add adjustment"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
