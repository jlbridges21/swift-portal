"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartnerPayoutAutomationSettings } from "@/lib/partner-payout-automation";
import { formatCurrency } from "@/lib/utils";

type Props = {
  initial: PartnerPayoutAutomationSettings;
  deployMode: "test" | "live";
};

type PreviewPartner = {
  partnerId: string;
  partnerName: string;
  partnerEmail: string | null;
  eligible: boolean;
  skipReason?: string;
  amountCents: number;
  openNetCents: number;
  details: Record<string, unknown>;
};

type RunSummary = {
  id: string;
  period_key: string;
  stripe_mode: string;
  dry_run: boolean;
  execute_transfers: boolean;
  status: string;
  total_paid: number;
  total_skipped: number;
  total_failed: number;
  total_amount_cents: number;
  started_at: string;
  error_summary: string | null;
};

export function PartnerPayoutAutomationPanel({ initial, deployMode }: Props) {
  const [settings, setSettings] = useState(initial);
  const [enabled, setEnabled] = useState(initial.automated_payouts_enabled);
  const [dryRun, setDryRun] = useState(initial.automated_payouts_dry_run);
  const [killSwitch, setKillSwitch] = useState(initial.automated_payouts_kill_switch);
  const [testTransfers, setTestTransfers] = useState(
    initial.automated_payouts_test_transfers_enabled
  );
  const [liveTransfers, setLiveTransfers] = useState(
    initial.automated_payouts_live_transfers_enabled
  );
  const [minimumDollars, setMinimumDollars] = useState(
    String((initial.automated_payouts_minimum_cents / 100).toFixed(0))
  );
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPartner[] | null>(null);
  const [lastRunOutput, setLastRunOutput] = useState<string | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);

  const loadRuns = useCallback(async () => {
    const res = await fetch("/api/platform/partner-payouts/runs?limit=10");
    const data = await res.json();
    if (res.ok) setRuns(data.runs ?? []);
  }, []);

  useEffect(() => {
    loadRuns().catch(() => undefined);
  }, [loadRuns]);

  async function saveSettings() {
    const minCents = Math.round(Number(minimumDollars) * 100);
    if (!Number.isFinite(minCents) || minCents < 0) {
      setError("Minimum payout must be ≥ $0.");
      return;
    }
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        automated_payouts_enabled: enabled,
        automated_payouts_dry_run: dryRun,
        automated_payouts_kill_switch: killSwitch,
        automated_payouts_minimum_cents: minCents,
      };
      if (deployMode === "test") {
        body.automated_payouts_test_transfers_enabled = testTransfers;
      } else {
        body.automated_payouts_live_transfers_enabled = liveTransfers;
      }
      const res = await fetch("/api/platform/partner-payouts/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings(data.settings);
      setNotice("Automation settings saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function loadPreview() {
    setError(null);
    const res = await fetch("/api/platform/partner-payouts/preview");
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Preview failed");
    setPreview(data.partners ?? []);
  }

  async function triggerRun(options: { dryRun: boolean; execute?: boolean }) {
    setRunning(true);
    setNotice(null);
    setError(null);
    setLastRunOutput(null);
    try {
      const res = await fetch("/api/platform/partner-payouts/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dryRun: options.dryRun,
          executeTransfers: options.execute === true,
          skipAutomationGate: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Run failed");
      setLastRunOutput(JSON.stringify(data, null, 2));
      setNotice(
        data.automationDisabled
          ? "Cron would no-op — master switch is OFF."
          : `Run ${data.status}: ${data.totalPaid} paid, ${data.totalSkipped} skipped, ${data.totalFailed} failed.`
      );
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <strong>Money movement is OFF by default.</strong> Dry run computes only. Real transfers
        require a separate {deployMode === "test" ? "test" : "live"}-mode enable — turning on test
        never enables live.
      </div>

      <div className="space-y-4">
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#4F46E5]"
          />
          <span>
            <span className="font-medium text-heading">Enable monthly cron</span>
            <span className="mt-0.5 block text-xs text-muted">
              When off, scheduled cron does nothing. Manual dry runs still work below.
            </span>
          </span>
        </label>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={dryRun}
            onChange={(e) => setDryRun(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#4F46E5]"
          />
          <span>
            <span className="font-medium text-heading">Default to dry run</span>
            <span className="mt-0.5 block text-xs text-muted">
              When on, cron and manual runs compute and audit only — no Stripe transfers unless
              you explicitly execute.
            </span>
          </span>
        </label>

        {deployMode === "test" ? (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={testTransfers}
              onChange={(e) => setTestTransfers(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#4F46E5]"
            />
            <span>
              <span className="font-medium text-heading">Allow test-mode transfers</span>
              <span className="mt-0.5 block text-xs text-muted">
                Explicit enable for sk_test_ deploy only. Does not affect live.
              </span>
            </span>
          </label>
        ) : (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={liveTransfers}
              onChange={(e) => setLiveTransfers(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#4F46E5]"
            />
            <span>
              <span className="font-medium text-heading">Allow live-mode transfers</span>
              <span className="mt-0.5 block text-xs text-muted">
                Explicit enable for sk_live_ deploy only. Separate from test.
              </span>
            </span>
          </label>
        )}

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={killSwitch}
            onChange={(e) => setKillSwitch(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-red-600"
          />
          <span>
            <span className="font-medium text-red-700">Kill switch — halt in-progress run</span>
            <span className="mt-0.5 block text-xs text-muted">
              When on, the next partner iteration aborts the current run. Save to activate.
            </span>
          </span>
        </label>

        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="payout-minimum">Minimum payout threshold ($)</Label>
          <Input
            id="payout-minimum"
            type="number"
            min={0}
            step={1}
            value={minimumDollars}
            onChange={(e) => setMinimumDollars(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={saveSettings} disabled={saving} className="min-h-11">
          {saving ? "Saving…" : "Save automation settings"}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => loadPreview().catch((e) => setError(String(e)))}
          className="min-h-11"
        >
          Preview upcoming run
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => triggerRun({ dryRun: true })}
          disabled={running}
          className="min-h-11"
        >
          {running ? "Running…" : "Run dry run now"}
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => triggerRun({ dryRun: false, execute: true })}
          disabled={running}
          className="min-h-11"
        >
          Execute transfers now
        </Button>
      </div>

      {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {preview ? (
        <div className="overflow-x-auto rounded-md border border-border">
          <table className="w-full min-w-[40rem] text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-xs uppercase text-muted">
                <th className="px-3 py-2">Partner</th>
                <th className="px-3 py-2">Eligible</th>
                <th className="px-3 py-2">Amount</th>
                <th className="px-3 py-2">Reason</th>
              </tr>
            </thead>
            <tbody>
              {preview.map((p) => (
                <tr key={p.partnerId} className="border-b border-border/70">
                  <td className="px-3 py-2">{p.partnerName}</td>
                  <td className="px-3 py-2">{p.eligible ? "Yes" : "No"}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {formatCurrency(p.eligible ? p.amountCents : p.openNetCents)}
                  </td>
                  <td className="px-3 py-2 text-muted">
                    {p.eligible ? "—" : p.skipReason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {lastRunOutput ? (
        <pre className="max-h-96 overflow-auto rounded-md border border-border bg-muted/20 p-3 text-xs">
          {lastRunOutput}
        </pre>
      ) : null}

      {runs.length ? (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-heading">Recent runs</h3>
          <ul className="space-y-2 text-sm">
            {runs.map((r) => (
              <li key={r.id} className="rounded border border-border px-3 py-2">
                <span className="font-medium">{r.period_key}</span> · {r.status} ·{" "}
                {r.dry_run ? "dry" : r.execute_transfers ? "live xfer" : "audit"} · paid{" "}
                {r.total_paid} / skipped {r.total_skipped}
                {r.error_summary ? (
                  <span className="block text-xs text-red-600">{r.error_summary}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="text-xs text-muted">
        Deploy mode: <strong>{deployMode}</strong>. Cron enabled:{" "}
        <strong>{settings.automated_payouts_enabled ? "yes" : "no"}</strong>. Dry run default:{" "}
        <strong>{settings.automated_payouts_dry_run ? "yes" : "no"}</strong>.
      </p>
    </div>
  );
}
