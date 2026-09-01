"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  initialPromoCode: string | null;
};

export function PartnerPromoCodeEditor({ initialPromoCode }: Props) {
  const [value, setValue] = useState(initialPromoCode ?? "");
  const [saved, setSaved] = useState(initialPromoCode);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    setWarning(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/partner/promo-code", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          promoCode: value.trim() ? value.trim() : null,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        promoCode?: string | null;
        warning?: string | null;
      };
      if (!res.ok) {
        setError(data.error || "Could not update promo code.");
        return;
      }
      setSaved(data.promoCode ?? null);
      setValue(data.promoCode ?? "");
      setWarning(data.warning ?? null);
      setSuccess(data.promoCode ? `Promo code set to ${data.promoCode}.` : "Promo code cleared.");
    } catch {
      setError("Could not update promo code.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <Label htmlFor="partner-promo-code" className="text-xs font-semibold uppercase tracking-wide text-muted">
          Checkout promo code
        </Label>
        <p className="mt-1 text-sm text-muted">
          A short code customers enter on the billing page (e.g. <strong>SWIFT5</strong>). Optional —
          your referral link and landing page still work without one. Changing it{" "}
          <strong>immediately invalidates</strong> the previous code.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id="partner-promo-code"
          value={value}
          onChange={(e) => setValue(e.target.value.toUpperCase())}
          placeholder="e.g. SWIFT5"
          className="sm:max-w-xs font-mono"
          maxLength={16}
          disabled={busy}
        />
        <Button
          type="button"
          variant="outline"
          disabled={busy || value.trim() === (saved ?? "")}
          onClick={() => void save()}
        >
          {busy ? "Saving…" : "Save promo code"}
        </Button>
      </div>
      {saved && (
        <p className="text-sm text-heading">
          Current code: <span className="font-mono font-semibold">{saved}</span>
        </p>
      )}
      {warning && <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && !error && <p className="text-sm text-accent">{success}</p>}
    </div>
  );
}
