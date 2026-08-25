"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartnerProgramSettingsRow } from "@/lib/partner-referral-discount.constants";

type Props = {
  initial: PartnerProgramSettingsRow;
};

export function PartnerProgramCommissionSettings({ initial }: Props) {
  const [settings, setSettings] = useState(initial);
  const [rate, setRate] = useState(String(initial.default_commission_rate_pct ?? 30));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changed = useMemo(() => {
    const n = Number(rate);
    return Number.isFinite(n) && n !== (settings.default_commission_rate_pct ?? 30);
  }, [rate, settings.default_commission_rate_pct]);

  async function save() {
    const n = Number(rate);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      setError("Commission rate must be between 0 and 100.");
      return;
    }
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch("/api/platform/partner-program/discount", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ default_commission_rate_pct: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings(data.settings);
      setNotice(`Default commission rate updated to ${n}%. New approvals and public marketing copy use this rate.`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Default commission for <strong>newly approved partners</strong> and public partner marketing
        (/partners, in-app pitch). Per-partner overrides are set when approving or editing a partner
        account — separate from the referral signup discount below.
      </p>

      <div className="space-y-1.5 sm:max-w-xs">
        <Label htmlFor="default-commission">Default commission rate (%)</Label>
        <Input
          id="default-commission"
          type="number"
          min={0}
          max={100}
          step={0.5}
          value={rate}
          onChange={(e) => setRate(e.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !changed} className="min-h-11">
          {saving ? "Saving…" : "Save commission default"}
        </Button>
        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <p className="text-xs text-muted">
        Current default: <strong>{settings.default_commission_rate_pct ?? 30}%</strong>. Existing
        partners keep the rate on their row until you edit them individually.
      </p>
    </div>
  );
}
