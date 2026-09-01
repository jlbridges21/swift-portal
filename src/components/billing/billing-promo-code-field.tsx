"use client";

import { useCallback, useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { formatPlanPrice } from "@/lib/plan-catalog";

export type BillingPromoState = {
  promoCode: string | null;
  appliedLabel: string | null;
  error: string | null;
  /** When promo resolves, override plan price display for monthly. */
  monthlyOverride: {
    listPriceCents: number;
    discountedPriceCents: number;
    headline: string;
  } | null;
  annualOverride: {
    listPriceCents: number;
    discountedPriceCents: number;
    headline: string;
  } | null;
};

type Props = {
  planKey: string;
  listMonthlyCents: number | null;
  listAnnualCents: number | null;
  onChange: (state: BillingPromoState) => void;
};

export function BillingPromoCodeField({
  planKey,
  listMonthlyCents,
  listAnnualCents,
  onChange,
}: Props) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState<string | null>(null);
  const [headline, setHeadline] = useState<string | null>(null);
  const [monthlyOverride, setMonthlyOverride] = useState<BillingPromoState["monthlyOverride"]>(null);
  const [annualOverride, setAnnualOverride] = useState<BillingPromoState["annualOverride"]>(null);

  const emit = useCallback(
    (next: {
      promoCode: string | null;
      appliedLabel: string | null;
      error: string | null;
      monthlyOverride: BillingPromoState["monthlyOverride"];
      annualOverride: BillingPromoState["annualOverride"];
    }) => {
      onChange(next);
    },
    [onChange]
  );

  useEffect(() => {
    emit({
      promoCode: applied,
      appliedLabel: applied,
      error,
      monthlyOverride,
      annualOverride,
    });
  }, [applied, error, monthlyOverride, annualOverride, emit]);

  async function applyCode() {
    const code = input.trim();
    if (!code) {
      setError("Enter a promo code.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const [monthlyRes, annualRes] = await Promise.all([
        fetch("/api/billing/promo-preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ promoCode: code, planKey, interval: "monthly" }),
        }),
        listAnnualCents != null
          ? fetch("/api/billing/promo-preview", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ promoCode: code, planKey, interval: "annual" }),
            })
          : Promise.resolve(null),
      ]);

      const monthly = (await monthlyRes.json()) as {
        ok?: boolean;
        message?: string;
        promoCode?: string;
        brandName?: string;
        discountEligible?: boolean;
        priceDisplay?: {
          listPriceCents: number;
          discountedPriceCents: number;
          headline: string;
        } | null;
      };

      if (!monthlyRes.ok || !monthly.ok) {
        setApplied(null);
        setMonthlyOverride(null);
        setAnnualOverride(null);
        setHeadline(null);
        setError(monthly.message || "That promo code is not recognized.");
        return;
      }

      if (!monthly.discountEligible || !monthly.priceDisplay) {
        setApplied(monthly.promoCode ?? code.toUpperCase());
        setMonthlyOverride(null);
        setAnnualOverride(null);
        setHeadline(null);
        setError("Promo code accepted, but no discount is configured for this offer.");
        return;
      }

      setApplied(monthly.promoCode ?? code.toUpperCase());
      setMonthlyOverride({
        listPriceCents: monthly.priceDisplay.listPriceCents,
        discountedPriceCents: monthly.priceDisplay.discountedPriceCents,
        headline: monthly.priceDisplay.headline,
      });
      setHeadline(
        monthly.brandName
          ? `${monthly.promoCode} · ${monthly.brandName}`
          : monthly.promoCode ?? code.toUpperCase()
      );
      setError(null);

      if (annualRes) {
        const annual = (await annualRes.json()) as {
          ok?: boolean;
          discountEligible?: boolean;
          priceDisplay?: {
            listPriceCents: number;
            discountedPriceCents: number;
            headline: string;
          } | null;
        };
        if (annual.ok && annual.discountEligible && annual.priceDisplay) {
          setAnnualOverride({
            listPriceCents: annual.priceDisplay.listPriceCents,
            discountedPriceCents: annual.priceDisplay.discountedPriceCents,
            headline: annual.priceDisplay.headline,
          });
        } else {
          setAnnualOverride(null);
        }
      }
    } catch {
      setError("Could not validate promo code. Try again.");
      setApplied(null);
      setMonthlyOverride(null);
      setAnnualOverride(null);
    } finally {
      setBusy(false);
    }
  }

  function clearCode() {
    setInput("");
    setApplied(null);
    setError(null);
    setHeadline(null);
    setMonthlyOverride(null);
    setAnnualOverride(null);
  }

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-4 sm:p-5">
      <Label htmlFor="billing-promo" className="text-sm font-medium text-heading">
        Promo code
      </Label>
      <p className="mt-1 text-xs text-muted">
        Have a partner code? Enter it before you subscribe — the price below updates to match what
        you&apos;ll be charged.
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          id="billing-promo"
          value={input}
          onChange={(e) => setInput(e.target.value.toUpperCase())}
          placeholder="e.g. SWIFT5"
          className="sm:max-w-xs"
          autoComplete="off"
          disabled={busy}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              void applyCode();
            }
          }}
        />
        <div className="flex gap-2">
          <Button type="button" variant="outline" disabled={busy} onClick={() => void applyCode()}>
            {busy ? "Checking…" : "Apply"}
          </Button>
          {applied && (
            <Button type="button" variant="ghost" disabled={busy} onClick={clearCode}>
              Clear
            </Button>
          )}
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      {applied && !error && monthlyOverride && (
        <div className="mt-3 rounded-lg bg-subtle/60 px-3 py-2 text-sm">
          <p className="font-medium text-heading">
            Applied: <span className="font-mono">{applied}</span>
            {headline && headline !== applied ? (
              <span className="font-normal text-muted"> · {headline.replace(`${applied} · `, "")}</span>
            ) : null}
          </p>
          <p className="mt-1 text-muted">
            <span className="line-through">
              {formatPlanPrice(monthlyOverride.listPriceCents)}
              {listMonthlyCents != null ? "/mo" : ""}
            </span>{" "}
            →{" "}
            <strong className="text-heading">
              {formatPlanPrice(monthlyOverride.discountedPriceCents)}/mo
            </strong>
          </p>
          <p className="mt-0.5 text-xs text-muted">{monthlyOverride.headline}</p>
        </div>
      )}
      {applied && !error && !monthlyOverride && (
        <p className="mt-2 text-sm text-muted">
          Applied: <span className="font-mono font-medium text-heading">{applied}</span>
        </p>
      )}
    </div>
  );
}
