"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerRow } from "@/lib/partners";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

type Props = {
  partner: PartnerRow;
};

/**
 * Same PATCH fields as PartnersManager inline edit — rate override, status, notes,
 * identity, referral discount override. Preserves existing API + audit behavior.
 */
export function PartnerPlatformSettingsForm({ partner }: Props) {
  const router = useRouter();
  const hasOverride =
    partner.referral_discount_enabled != null ||
    partner.referral_discount_amount_cents != null ||
    partner.referral_discount_duration_months != null;

  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: partner.name,
    email: partner.email,
    brandName: partner.brand_name,
    website: partner.website ?? "",
    referralCode: partner.referral_code,
    commissionRatePct: String(partner.commission_rate_pct),
    status: partner.status,
    notes: partner.notes ?? "",
    useProgramDiscount: !hasOverride,
    referralDiscountEnabled: partner.referral_discount_enabled ?? true,
    referralDiscountAmountDollars: String(
      (partner.referral_discount_amount_cents ?? 500) / 100
    ),
    referralDiscountDurationMonths: String(
      partner.referral_discount_duration_months ?? 3
    ),
  });

  async function save() {
    setBusy(true);
    try {
      const res = await fetch(`/api/platform/partners/${partner.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          brandName: form.brandName,
          website: form.website || null,
          referralCode: form.referralCode,
          commissionRatePct: Number(form.commissionRatePct),
          status: form.status,
          notes: form.notes || null,
          clearReferralDiscountOverride: form.useProgramDiscount,
          ...(form.useProgramDiscount
            ? {}
            : {
                referralDiscountEnabled: form.referralDiscountEnabled,
                referralDiscountAmountCents: Math.round(
                  Number(form.referralDiscountAmountDollars) * 100
                ),
                referralDiscountDurationMonths: Math.round(
                  Number(form.referralDiscountDurationMonths)
                ),
              }),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Update failed");
      if (data.partner?.referralDiscountCouponSyncOk === false) {
        toast.error(
          data.partner.referralDiscountCouponSyncMessage ??
            "Partner saved but Stripe coupon sync failed — discount will not apply until fixed."
        );
      } else {
        toast.success("Partner updated");
      }
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <Label>Name</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label>Email</Label>
            <Input
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label>Brand name</Label>
            <Input
              value={form.brandName}
              onChange={(e) => setForm((f) => ({ ...f, brandName: e.target.value }))}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label>Website</Label>
            <Input
              value={form.website}
              onChange={(e) => setForm((f) => ({ ...f, website: e.target.value }))}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label>Referral code</Label>
            <Input
              value={form.referralCode}
              onChange={(e) => setForm((f) => ({ ...f, referralCode: e.target.value }))}
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label>Commission rate %</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.01}
              value={form.commissionRatePct}
              onChange={(e) =>
                setForm((f) => ({ ...f, commissionRatePct: e.target.value }))
              }
              className="min-h-11"
            />
          </div>
          <div className="space-y-1">
            <Label>Status</Label>
            <Select
              value={form.status}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  status: e.target.value as typeof f.status,
                }))
              }
              options={[
                { value: "active", label: "Active" },
                { value: "suspended", label: "Suspended" },
              ]}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Notes</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </div>
        <div className="space-y-3 rounded-md border border-border p-3">
          <p className="text-sm font-medium text-heading">Referral signup discount</p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.useProgramDiscount}
              onChange={(e) =>
                setForm((f) => ({ ...f, useProgramDiscount: e.target.checked }))
              }
            />
            Use program default discount
          </label>
          {!form.useProgramDiscount ? (
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="flex items-center gap-2 text-sm sm:col-span-3">
                <input
                  type="checkbox"
                  checked={form.referralDiscountEnabled}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      referralDiscountEnabled: e.target.checked,
                    }))
                  }
                />
                Discount enabled for this partner
              </label>
              <div className="space-y-1">
                <Label>Amount (USD/mo)</Label>
                <Input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.referralDiscountAmountDollars}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      referralDiscountAmountDollars: e.target.value,
                    }))
                  }
                  className="min-h-11"
                />
              </div>
              <div className="space-y-1">
                <Label>Duration (paid months)</Label>
                <Input
                  type="number"
                  min={1}
                  max={36}
                  value={form.referralDiscountDurationMonths}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      referralDiscountDurationMonths: e.target.value,
                    }))
                  }
                  className="min-h-11"
                />
              </div>
            </div>
          ) : null}
        </div>
        <Button
          type="button"
          variant="accent"
          className="min-h-11"
          disabled={busy}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save settings"}
        </Button>
      </CardContent>
    </Card>
  );
}
