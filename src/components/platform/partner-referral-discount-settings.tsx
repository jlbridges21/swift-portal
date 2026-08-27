"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import type {
  PartnerProgramSettingsRow,
  ReferralDiscountStripeCouponRow,
} from "@/lib/partner-referral-discount.constants";
import {
  formatPartnerReferralAnnualBillingPolicy,
  PARTNER_REFERRAL_OVERRIDE_COUPON_POLICY,
} from "@/lib/partner-referral-discount.constants";
import { referralDiscountTrialDurationWarning } from "@/lib/partner-referral-discount-trial-guard";

type Props = {
  initial: PartnerProgramSettingsRow;
  initialCoupons: ReferralDiscountStripeCouponRow[];
  deployMode: "test" | "live";
  /** Primary plan trial length used for duration guard (days). */
  planTrialDays: number;
  planTrialName?: string;
};

function couponMatchesSettings(
  row: ReferralDiscountStripeCouponRow,
  settings: PartnerProgramSettingsRow
): boolean {
  if (row.billing_interval === "monthly") {
    return (
      row.amount_off_cents === settings.referral_discount_amount_cents &&
      row.duration_months === settings.referral_discount_duration_months
    );
  }
  if (row.billing_interval === "annual") {
    return (
      settings.referral_discount_annual_enabled &&
      row.amount_off_cents === settings.referral_discount_annual_amount_cents &&
      row.duration_months === 1
    );
  }
  return false;
}

function formatCouponAmount(cents: number, interval: string, durationMonths: number): string {
  if (interval === "annual") return `$${(cents / 100).toFixed(2)} once`;
  return `$${(cents / 100).toFixed(2)}/mo × ${durationMonths} mo`;
}

export function PartnerReferralDiscountSettings({
  initial,
  initialCoupons,
  deployMode,
  planTrialDays,
  planTrialName,
}: Props) {
  const [settings, setSettings] = useState(initial);
  const [coupons, setCoupons] = useState(initialCoupons);
  const [enabled, setEnabled] = useState(initial.referral_discount_enabled);
  const [amountDollars, setAmountDollars] = useState(
    String(initial.referral_discount_amount_cents / 100)
  );
  const [durationMonths, setDurationMonths] = useState(
    String(initial.referral_discount_duration_months)
  );
  const [annualEnabled, setAnnualEnabled] = useState(initial.referral_discount_annual_enabled);
  const [annualDollars, setAnnualDollars] = useState(
    String(initial.referral_discount_annual_amount_cents / 100)
  );
  const [saving, setSaving] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [configChangeAck, setConfigChangeAck] = useState(false);

  const sortedCoupons = useMemo(
    () =>
      [...coupons].sort((a, b) =>
        `${a.mode}${a.billing_interval}${a.amount_off_cents}`.localeCompare(
          `${b.mode}${b.billing_interval}${b.amount_off_cents}`
        )
      ),
    [coupons]
  );

  const programMonthlyMapped = sortedCoupons.some(
    (c) =>
      c.mode === deployMode &&
      c.billing_interval === "monthly" &&
      couponMatchesSettings(c, settings)
  );

  const draftConfigChanged = useMemo(() => {
    const amountCents = Math.round(Number(amountDollars) * 100);
    const duration = Math.round(Number(durationMonths));
    const annualCents = Math.round(Number(annualDollars) * 100);
    return (
      enabled !== settings.referral_discount_enabled ||
      amountCents !== settings.referral_discount_amount_cents ||
      duration !== settings.referral_discount_duration_months ||
      annualEnabled !== settings.referral_discount_annual_enabled ||
      annualCents !== settings.referral_discount_annual_amount_cents
    );
  }, [enabled, amountDollars, durationMonths, annualEnabled, annualDollars, settings]);

  const couponConfigChanged = useMemo(() => {
    const amountCents = Math.round(Number(amountDollars) * 100);
    const duration = Math.round(Number(durationMonths));
    const annualCents = Math.round(Number(annualDollars) * 100);
    return (
      amountCents !== settings.referral_discount_amount_cents ||
      duration !== settings.referral_discount_duration_months ||
      annualEnabled !== settings.referral_discount_annual_enabled ||
      annualCents !== settings.referral_discount_annual_amount_cents
    );
  }, [amountDollars, durationMonths, annualEnabled, annualDollars, settings]);

  const trialDurationWarning = useMemo(() => {
    const duration = Math.round(Number(durationMonths));
    if (!Number.isFinite(duration) || duration <= 0) return null;
    return referralDiscountTrialDurationWarning({
      trialDays: planTrialDays,
      durationMonths: duration,
      planName: planTrialName,
    });
  }, [durationMonths, planTrialDays, planTrialName]);

  async function save() {
    if (couponConfigChanged && !configChangeAck) {
      setError(
        "Acknowledge the discount-change warning before saving. New amounts apply to new referred signups only."
      );
      return;
    }

    setSaving(true);
    setSuccessNotice(null);
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
      setCoupons(data.coupons ?? coupons);
      setConfigChangeAck(false);

      if (data.stripeCouponSyncOk === false) {
        setError(
          data.stripeCouponSyncMessage ||
            "Settings saved, but Stripe Coupon sync failed. Fix before new referred signups rely on this discount."
        );
      } else if (data.stripeCouponSyncMessage) {
        const ids = [
          data.stripeCouponSyncMonthlyCouponId
            ? `monthly ${data.stripeCouponSyncMonthlyCouponId}`
            : null,
          data.stripeCouponSyncAnnualCouponId
            ? `annual ${data.stripeCouponSyncAnnualCouponId}`
            : null,
        ]
          .filter(Boolean)
          .join(" · ");
        setSuccessNotice(`${data.stripeCouponSyncMessage}${ids ? ` (${ids})` : ""}`);
      } else {
        setSuccessNotice("Discount settings saved.");
      }
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

      {settings.stripe_coupon_sync_ok === false ? (
        <div
          role="alert"
          className="rounded-lg border border-red-400 bg-red-50 px-3 py-2 text-sm text-red-950"
        >
          <p className="font-semibold">Stripe Coupon sync failed — billing integrity</p>
          <p className="mt-1">
            {settings.stripe_coupon_sync_message ||
              "Program settings and Stripe coupons disagree. New referred signups may not get the advertised discount until this is fixed."}
          </p>
          {settings.stripe_coupon_sync_at ? (
            <p className="mt-1 text-xs text-red-800">
              Last attempt {new Date(settings.stripe_coupon_sync_at).toLocaleString()}
            </p>
          ) : null}
        </div>
      ) : null}

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

      {trialDurationWarning ? (
        <div
          role="alert"
          className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2 text-sm text-amber-950"
        >
          <p className="font-semibold">Trial / duration mismatch</p>
          <p className="mt-1">{trialDurationWarning}</p>
        </div>
      ) : null}

      {couponConfigChanged ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="font-medium">Changing discount amounts creates new Stripe coupons</p>
          <p className="mt-1 text-xs">
            This applies to <strong>new referred signups only</strong>. Existing subscribers keep the
            coupon already attached to their subscription — Stripe does not retroactively change an
            active discount.
          </p>
          <label className="mt-2 flex items-start gap-2 text-xs">
            <input
              type="checkbox"
              checked={configChangeAck}
              onChange={(e) => setConfigChangeAck(e.target.checked)}
              className="mt-0.5 h-4 w-4 accent-[#4F46E5]"
            />
            I understand new signups get the updated discount; existing subscribers keep their
            current coupon.
          </label>
        </div>
      ) : null}

      <div className="rounded-lg border border-border bg-subtle/40 px-3 py-2 text-xs text-muted">
        {formatPartnerReferralAnnualBillingPolicy({
          annualEnabled,
          annualAmountOffCents: Math.round(Number(annualDollars || 0) * 100) || 0,
        })}
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
        <Button type="button" onClick={save} disabled={saving || !draftConfigChanged} className="min-h-11">
          {saving ? "Saving…" : "Save discount settings"}
        </Button>
        {successNotice ? <p className="text-sm text-green-700">{successNotice}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-heading">Stripe coupon mapping</h3>
        <p className="text-xs text-muted">
          Coupons are keyed by configuration (amount × duration). Partner overrides reuse rows when
          the config matches. Saving with changed amounts syncs coupons for the{" "}
          <strong>{deployMode}</strong> mode this deployment uses.
        </p>
        {!programMonthlyMapped && settings.referral_discount_enabled ? (
          <p className="text-xs font-medium text-amber-800">
            Program default monthly coupon not mapped in {deployMode} — re-save settings or run the
            setup script.
          </p>
        ) : null}
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-subtle/60 text-muted">
              <tr>
                <th className="px-3 py-2 font-medium">Mode</th>
                <th className="px-3 py-2 font-medium">Interval</th>
                <th className="px-3 py-2 font-medium">Coupon ID</th>
                <th className="px-3 py-2 font-medium">Configuration</th>
                <th className="px-3 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedCoupons.length === 0 ? (
                <tr>
                  <td className="px-3 py-2 text-muted" colSpan={5}>
                    No coupons mapped yet
                  </td>
                </tr>
              ) : (
                sortedCoupons.map((row) => {
                  const interval = row.billing_interval;
                  const matches = couponMatchesSettings(row, settings);
                  return (
                    <tr key={`${row.mode}-${interval}-${row.amount_off_cents}-${row.duration_months}`}>
                      <td className="px-3 py-2 font-mono uppercase">
                        {row.mode}
                        {row.mode === deployMode ? (
                          <Badge variant="success" className="ml-1">
                            deploy
                          </Badge>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 capitalize">{interval}</td>
                      <td className="px-3 py-2 font-mono">{row.stripe_coupon_id}</td>
                      <td className="px-3 py-2">
                        {formatCouponAmount(row.amount_off_cents, interval, row.duration_months)}
                      </td>
                      <td className="px-3 py-2">
                        {matches ? (
                          <Badge variant="success">Program default</Badge>
                        ) : (
                          <Badge variant="default">Partner / other config</Badge>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-muted">{PARTNER_REFERRAL_OVERRIDE_COUPON_POLICY}</p>

      <p className="text-xs text-muted">
        Current program:{" "}
        {settings.referral_discount_enabled
          ? `$${(settings.referral_discount_amount_cents / 100).toFixed(2)}/mo × ${settings.referral_discount_duration_months} months`
          : "disabled"}
        . Existing subscribers keep their current Stripe coupon.
      </p>
    </div>
  );
}
