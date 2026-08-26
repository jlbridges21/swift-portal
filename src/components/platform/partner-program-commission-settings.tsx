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
  const [autoApprove, setAutoApprove] = useState(initial.auto_approve_applications !== false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const changed = useMemo(() => {
    const n = Number(rate);
    const rateChanged =
      Number.isFinite(n) && n !== (settings.default_commission_rate_pct ?? 30);
    const autoChanged = autoApprove !== (settings.auto_approve_applications !== false);
    return rateChanged || autoChanged;
  }, [rate, autoApprove, settings.default_commission_rate_pct, settings.auto_approve_applications]);

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
        body: JSON.stringify({
          default_commission_rate_pct: n,
          auto_approve_applications: autoApprove,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings(data.settings);
      setAutoApprove(data.settings.auto_approve_applications !== false);
      setNotice(
        data.settings.auto_approve_applications !== false
          ? `Saved. Auto-approve is ON — new applications become active partners immediately. Default commission ${n}%.`
          : `Saved. Auto-approve is OFF — new applications wait in the pending queue. Default commission ${n}%.`
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <div>
          <p className="text-sm font-medium text-heading">Application approval</p>
          <p className="mt-1 text-sm text-muted">
            When auto-approve is on, public and in-app applications create an active partner
            immediately (with referral code and welcome email). When off, applications stay
            pending until you approve or decline them below.
          </p>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={autoApprove}
            onChange={(e) => setAutoApprove(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#4F46E5]"
          />
          <span>
            <span className="font-medium text-heading">Auto-approve partner applications</span>
            <span className="mt-0.5 block text-xs text-muted">
              {autoApprove
                ? "Currently ON — applicants join instantly."
                : "Currently OFF — manual review queue."}
            </span>
          </span>
        </label>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <p className="text-sm text-muted">
          Default commission for <strong>newly approved partners</strong> and public partner
          marketing (/partners, in-app pitch). Per-partner overrides are set when approving or
          editing a partner account — separate from the referral signup discount below.
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
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving || !changed} className="min-h-11">
          {saving ? "Saving…" : "Save program defaults"}
        </Button>
        {notice ? <p className="text-sm text-green-700">{notice}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <p className="text-xs text-muted">
        Current default commission: <strong>{settings.default_commission_rate_pct ?? 30}%</strong>.
        Auto-approve:{" "}
        <strong>{settings.auto_approve_applications !== false ? "on" : "off"}</strong>. Existing
        partners keep their rate until you edit them individually.
      </p>
    </div>
  );
}
