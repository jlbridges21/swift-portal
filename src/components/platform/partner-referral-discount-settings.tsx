"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PartnerProgramSettingsRow } from "@/lib/partner-referral-discount.constants";
import { PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY } from "@/lib/partner-referral-discount.constants";

export function PartnerReferralDiscountSettings({
  initial,
}: {
  initial: PartnerProgramSettingsRow;
}) {
  const [settings, setSettings] = useState(initial);
  const [enabled, setEnabled] = useState(initial.referral_discount_enabled);
  const [amountDollars, setAmountDollars] = useState(
    String(initial.referral_discount_amount_cents / 100)
  );
  const [durationMonths, setDurationMonths] = useState(
    String(initial.referral_discount_duration_months)
  );
  const [annualEnabled, setAnnualEnabled] = useState(
    initial.referral_discount_annual_enabled
  );
  const [annualDollars, setAnnualDollars] = useState(
    String(initial.referral_discount_annual_amount_cents / 100)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/platform/partner-program/discount", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referral_discount_enabled: enabled,
          referral_discount_amount_cents: Math.round(Number(amountDollars) * 100),
          referral_discount_duration_months: Math.round(Number(durationMonths)),
          referral_discount_annual_enabled: annualEnabled,
          referral_discount_annual_amount_cents: Math.round(Number(annualDollars) * 100),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");
      setSettings(data.settings);
      setMessage(data.note ?? "Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Referred businesses receive this discount on signup (monthly billing). Partner commissions
        are calculated on the discounted amount collected — not the list price.
      </p>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 accent-[#4F46E5]"
        />
        Referral discount enabled
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="discount-amount">Monthly discount (USD)</Label>
          <Input
            id="discount-amount"
            type="number"
            min={0}
            step={0.01}
            value={amountDollars}
            onChange={(e) => setAmountDollars(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="discount-duration">Duration (paid months)</Label>
          <Input
            id="discount-duration"
            type="number"
            min={0}
            max={36}
            value={durationMonths}
            onChange={(e) => setDurationMonths(e.target.value)}
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-subtle/40 px-3 py-2 text-xs text-muted">
        {PARTNER_REFERRAL_DISCOUNT_ANNUAL_POLICY}
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={annualEnabled}
          onChange={(e) => setAnnualEnabled(e.target.checked)}
          className="h-4 w-4 accent-[#4F46E5]"
        />
        Enable separate annual discount (off by default)
      </label>

      {annualEnabled ? (
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="annual-discount">Annual discount (USD, once)</Label>
          <Input
            id="annual-discount"
            type="number"
            min={0}
            step={0.01}
            value={annualDollars}
            onChange={(e) => setAnnualDollars(e.target.value)}
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" onClick={save} disabled={saving} className="min-h-11">
          {saving ? "Saving…" : "Save discount settings"}
        </Button>
        {message ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <p className="text-xs text-muted">
        Current:{" "}
        {settings.referral_discount_enabled
          ? `$${(settings.referral_discount_amount_cents / 100).toFixed(2)}/mo × ${settings.referral_discount_duration_months} months`
          : "disabled"}
        . After changing amounts, run{" "}
        <code className="rounded bg-subtle px-1">npx tsx scripts/setup-stripe-partner-referral-discount.ts</code>{" "}
        in TEST/LIVE as appropriate. Existing subscribers keep their current Stripe coupon.
      </p>
    </div>
  );
}
