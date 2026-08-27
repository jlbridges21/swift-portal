"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  formatPartnerPayoutSkipReason,
  PARTNER_PAYOUT_MINIMUM_CENTS,
} from "@/lib/partner-payout-constants";

type PreviewPartner = {
  partnerId: string;
  partnerName: string;
  partnerEmail: string | null;
  eligible: boolean;
  skipReason?: string;
  amountCents: number;
  openNetCents: number;
  payableCents: number;
  details: Record<string, unknown>;
};

type Props = {
  partnerId: string;
  partnerLabel?: string;
  /** When true, show a compact button suitable for table rows. */
  compact?: boolean;
};

/**
 * Dry-run then execute a Stripe transfer for one partner via the shared
 * /api/platform/partner-payouts/runs path (same idempotency + audit as bulk).
 */
export function PartnerPayThisPartnerButton({ partnerId, partnerLabel, compact }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    partner: PreviewPartner;
    minimumCents: number;
    platformBalanceAvailableCents: number;
    periodKey: string;
  } | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  async function dryRun() {
    setBusy(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch(
        `/api/platform/partner-payouts/preview?partnerId=${encodeURIComponent(partnerId)}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      const partner = (data.partners as PreviewPartner[] | undefined)?.[0];
      if (!partner) throw new Error("Partner not found in preview.");
      setPreview({
        partner,
        minimumCents: data.minimumCents ?? PARTNER_PAYOUT_MINIMUM_CENTS,
        platformBalanceAvailableCents: data.platformBalanceAvailableCents ?? 0,
        periodKey: data.periodKey,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setBusy(false);
    }
  }

  async function executeTransfer() {
    if (!preview?.partner.eligible) {
      setError("Partner is not eligible — run dry run again after fixing blockers.");
      return;
    }
    const amountLabel = formatCurrency(preview.partner.amountCents);
    const name = partnerLabel || preview.partner.partnerName;
    const ok = window.confirm(
      `Send a real Stripe transfer of ${amountLabel} to ${name}?\n\nThis uses the same payout run path as bulk execute and cannot be undone from ShootPortal.`
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setLastResult(null);
    try {
      const res = await fetch("/api/platform/partner-payouts/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: false,
          executeTransfers: true,
          partnerId,
          skipAutomationGate: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execute failed");
      setLastResult(JSON.stringify(data, null, 2));
      // Refresh eligibility without clearing the execute result
      const previewRes = await fetch(
        `/api/platform/partner-payouts/preview?partnerId=${encodeURIComponent(partnerId)}`
      );
      const previewData = await previewRes.json();
      if (previewRes.ok) {
        const partner = (previewData.partners as PreviewPartner[] | undefined)?.[0];
        if (partner) {
          setPreview({
            partner,
            minimumCents: previewData.minimumCents ?? PARTNER_PAYOUT_MINIMUM_CENTS,
            platformBalanceAvailableCents: previewData.platformBalanceAvailableCents ?? 0,
            periodKey: previewData.periodKey,
          });
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Execute failed");
    } finally {
      setBusy(false);
    }
  }

  const p = preview?.partner;
  const minCents = preview?.minimumCents ?? PARTNER_PAYOUT_MINIMUM_CENTS;
  const pendingCents = typeof p?.details.pendingCents === "number" ? p.details.pendingCents : null;
  const connectReady = p?.details.connectReady === true;
  const meetsMinimum = p?.details.meetsMinimum === true;

  return (
    <div className={compact ? "space-y-2" : "space-y-3"}>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant={compact ? "outline" : "accent"}
          size={compact ? "sm" : "default"}
          disabled={busy}
          onClick={() => void dryRun()}
          className={compact ? "min-h-9" : "min-h-11"}
        >
          {busy ? "Working…" : compact ? "Dry run" : "Pay this partner — dry run"}
        </Button>
        {p?.eligible ? (
          <Button
            type="button"
            variant="destructive"
            size={compact ? "sm" : "default"}
            disabled={busy}
            onClick={() => void executeTransfer()}
            className={compact ? "min-h-9" : "min-h-11"}
          >
            Execute transfer
          </Button>
        ) : null}
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {preview && p ? (
        <div className="rounded-md border border-border bg-subtle/40 px-3 py-3 text-sm space-y-2">
          <p className="font-medium text-heading">
            Dry run · period {preview.periodKey}
            {p.eligible ? (
              <span className="ml-2 text-teal-800">Eligible · {formatCurrency(p.amountCents)}</span>
            ) : (
              <span className="ml-2 text-amber-900">Not eligible</span>
            )}
          </p>
          <ul className="grid gap-1 text-xs text-muted sm:grid-cols-2">
            <li>
              Payable (past hold):{" "}
              <strong className="text-heading">{formatCurrency(p.openNetCents)}</strong>
            </li>
            <li>
              Still in hold:{" "}
              <strong className="text-heading">
                {pendingCents == null ? "—" : formatCurrency(pendingCents)}
              </strong>
            </li>
            <li>
              Connect ready:{" "}
              <strong className="text-heading">{connectReady ? "Yes" : "No"}</strong>
            </li>
            <li>
              Meets {formatCurrency(minCents)} transfer minimum:{" "}
              <strong className="text-heading">{meetsMinimum ? "Yes" : "No"}</strong>
            </li>
            <li className="sm:col-span-2">
              Platform Stripe available:{" "}
              <strong className="text-heading">
                {formatCurrency(preview.platformBalanceAvailableCents)}
              </strong>
              {p.eligible && preview.platformBalanceAvailableCents < p.amountCents ? (
                <span className="text-amber-800"> — below this payout amount</span>
              ) : null}
            </li>
          </ul>
          {!p.eligible && p.skipReason ? (
            <p className="text-sm text-amber-950">
              {formatPartnerPayoutSkipReason(p.skipReason, {
                minimumCents: minCents,
                requirementsSummary:
                  p.details.requirementsSummary != null
                    ? String(p.details.requirementsSummary)
                    : null,
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      {lastResult ? (
        <pre className="max-h-64 overflow-auto rounded-md border border-border bg-muted/20 p-3 text-xs">
          {lastResult}
        </pre>
      ) : null}
    </div>
  );
}
