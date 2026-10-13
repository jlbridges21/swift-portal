"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { AppSettings } from "@/lib/app-settings";
import { TravelTierDiagramSlot } from "@/components/admin/travel-tier-diagram";
import {
  travelFeeExample,
  travelTierError,
  type TravelSettings,
  type TravelTier,
} from "@/lib/travel-fee";

function CompactToggle({
  checked,
  onChange,
  id,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  id: string;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? "bg-accent" : "bg-slate-200"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}

function dollarsToCents(value: string): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function TravelFeesEditor({
  travel,
  postalCode,
  onChange,
  postalHref = "#settings-contact",
  heading = "Travel fees",
  description = "Add a fee when a property is outside your service area.",
  showTierDiagram = false,
}: {
  travel: TravelSettings;
  postalCode: string;
  onChange: (next: TravelSettings) => void;
  postalHref?: string;
  heading?: string;
  description?: string;
  showTierDiagram?: boolean;
}) {
  const hasPostal = Boolean(postalCode.trim());
  const tierError = travelTierError(travel.tiers);
  const example = travelFeeExample(travel, 40);

  function patch(partial: Partial<TravelSettings>) {
    onChange({ ...travel, ...partial });
  }

  function updateTier(index: number, partial: Partial<TravelTier>) {
    const tiers = travel.tiers.map((tier, i) => (i === index ? { ...tier, ...partial } : tier));
    patch({ tiers });
  }

  function moveTier(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= travel.tiers.length) return;
    const tiers = [...travel.tiers];
    const [row] = tiers.splice(index, 1);
    tiers.splice(next, 0, row);
    patch({ tiers });
  }

  function addTier() {
    const last = travel.tiers[travel.tiers.length - 1];
    if (!last) {
      patch({ tiers: [{ fromMiles: 0, toMiles: null, feeCents: 0 }] });
      return;
    }
    if (last.toMiles == null) {
      const end = last.fromMiles + 25;
      patch({
        tiers: [
          ...travel.tiers.slice(0, -1),
          { ...last, toMiles: end },
          { fromMiles: end, toMiles: null, feeCents: last.feeCents },
        ],
      });
      return;
    }
    patch({
      tiers: [...travel.tiers, { fromMiles: last.toMiles, toMiles: null, feeCents: last.feeCents }],
    });
  }

  function removeTier(index: number) {
    if (travel.tiers.length <= 1) return;
    patch({ tiers: travel.tiers.filter((_, i) => i !== index) });
  }

  return (
    <div className="space-y-4">
      {(heading || description) && (
        <div>
          {heading ? <p className="text-sm font-medium text-primary">{heading}</p> : null}
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
      )}
      <div className="flex items-center justify-between gap-3">
        <label htmlFor="travel-fees-enabled" className="text-sm text-foreground">
          Charge for travel to distant jobs
        </label>
        <CompactToggle
          id="travel-fees-enabled"
          label="Charge for travel to distant jobs"
          checked={travel.enabled}
          disabled={!hasPostal && !travel.enabled}
          onChange={(enabled) => {
            if (enabled && !hasPostal) return;
            patch({ enabled });
          }}
        />
      </div>
      {!hasPostal && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Travel fees start from your business postal code. Add one in{" "}
          <Link href={postalHref} className="font-medium underline">
            Contact information
          </Link>{" "}
          before turning this on.
        </p>
      )}
      {travel.enabled && (
        <div className="space-y-4">
          <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
            Distance is the straight-line distance between ZIP code centers, not driving distance.
            Real driving distance runs longer, so set your free radius and tier boundaries with that
            in mind. A 25 mile straight-line boundary is closer to about 31 miles by road.
          </p>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">How distance is entered</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="travel-distance-mode"
                checked={travel.distanceMode === "auto"}
                onChange={() => patch({ distanceMode: "auto" })}
              />
              Automatic from the property ZIP code
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="travel-distance-mode"
                checked={travel.distanceMode === "manual"}
                onChange={() => patch({ distanceMode: "manual" })}
              />
              Manual — enter miles on the official proposal
            </label>
            {travel.distanceMode === "manual" && (
              <p className="text-sm text-muted">
                Manual mode does not add a travel fee to preliminary estimates. Enter one-way miles
                when you build the official proposal.
              </p>
            )}
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-primary">How the fee is calculated</legend>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="travel-pricing-model"
                checked={travel.pricingModel === "tiers"}
                onChange={() => patch({ pricingModel: "tiers" })}
              />
              Tiers
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="travel-pricing-model"
                checked={travel.pricingModel === "radius_per_mile"}
                onChange={() => patch({ pricingModel: "radius_per_mile" })}
              />
              Per mile outside a free radius
            </label>
          </fieldset>
          {travel.pricingModel === "tiers" ? (
            <div className="space-y-2 @container">
              <p className="text-sm font-medium text-primary">Tiers</p>
              <p className="text-xs text-muted">
                Ranges must touch, in order, with no overlap and no gap. Leave the last end blank
                for “and beyond”. Fees are for the one-way distance.
              </p>
              <div className="flex flex-col gap-4 @min-[760px]:flex-row @min-[760px]:items-start">
              <div className="min-w-0 flex-1 space-y-2">
              {travel.tiers.map((tier, index) => (
                <div key={`tier-${index}`} className="rounded-lg border border-border p-3">
                  <p className="mb-2 text-sm font-medium text-primary">Tier {index + 1}</p>
                  <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                  <div className="space-y-1">
                    <Label htmlFor={`travel-from-${index}`}>From miles</Label>
                    <Input
                      id={`travel-from-${index}`}
                      type="number"
                      min={0}
                      value={tier.fromMiles}
                      onChange={(e) => updateTier(index, { fromMiles: Number(e.target.value) })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`travel-to-${index}`}>To miles</Label>
                    <Input
                      id={`travel-to-${index}`}
                      type="number"
                      min={0}
                      placeholder="and beyond"
                      value={tier.toMiles ?? ""}
                      onChange={(e) =>
                        updateTier(index, {
                          toMiles: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor={`travel-fee-${index}`}>Fee</Label>
                    <Input
                      id={`travel-fee-${index}`}
                      type="number"
                      min={0}
                      step="0.01"
                      value={tier.feeCents / 100}
                      onChange={(e) => updateTier(index, { feeCents: dollarsToCents(e.target.value) })}
                    />
                  </div>
                  <div className="flex flex-wrap items-end gap-1">
                    <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => moveTier(index, -1)}>
                      Up
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={index === travel.tiers.length - 1}
                      onClick={() => moveTier(index, 1)}
                    >
                      Down
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={travel.tiers.length <= 1}
                      onClick={() => removeTier(index)}
                    >
                      Remove
                    </Button>
                  </div>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={addTier}>
                Add tier
              </Button>
              {tierError && (
                <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  {tierError}
                </p>
              )}
              </div>
              {showTierDiagram ? (
                <div className="w-full shrink-0 @min-[760px]:w-[280px]">
                  <TravelTierDiagramSlot tiers={travel.tiers} />
                </div>
              ) : null}
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="travel-free-radius">Free radius (one-way miles)</Label>
                <Input
                  id="travel-free-radius"
                  type="number"
                  min={0}
                  value={travel.freeRadiusMiles}
                  onChange={(e) => patch({ freeRadiusMiles: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="travel-per-mile">Per mile (round trip)</Label>
                <Input
                  id="travel-per-mile"
                  type="number"
                  min={0}
                  step="0.01"
                  value={travel.perMileCents / 100}
                  onChange={(e) => patch({ perMileCents: dollarsToCents(e.target.value) })}
                />
              </div>
            </div>
          )}
          <div className="space-y-1">
            <Label htmlFor="travel-max-fee">Maximum fee</Label>
            <Input
              id="travel-max-fee"
              type="number"
              min={0}
              step="0.01"
              value={travel.maxFeeCents / 100}
              onChange={(e) => patch({ maxFeeCents: dollarsToCents(e.target.value) })}
            />
            <p className="text-xs text-muted">
              If the calculated fee is over this maximum, the estimate is still created and no travel
              fee is added.
            </p>
          </div>
          <p className="text-sm font-medium text-primary">{example}</p>
        </div>
      )}
    </div>
  );
}

export function TravelFeesOnboarding() {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      const data = (await res.json()) as { settings?: AppSettings; error?: string };
      if (cancelled) return;
      if (!res.ok || !data.settings) {
        setError(data.error || "Travel fees could not be loaded.");
        return;
      }
      setSettings(data.settings);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(nextTravel: TravelSettings) {
    if (!settings) return;
    const previous = settings;
    const next = { ...settings, travel: nextTravel };
    setSettings(next);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ settings: next }),
    });
    const data = (await res.json()) as { settings?: AppSettings; error?: string };
    if (!res.ok || !data.settings) {
      setSettings(previous);
      const message = data.error || "Could not save travel fees.";
      setError(message);
      toast.error(message);
      return;
    }
    setSettings(data.settings);
  }

  if (!settings) {
    return <p className="text-sm text-muted">{error || "Loading travel fees…"}</p>;
  }

  return (
    <div className="rounded-xl border border-border p-4">
      <TravelFeesEditor
        travel={settings.travel}
        postalCode={settings.business.postalCode}
        postalHref="/admin/settings#settings-contact"
        heading="Do you charge for travel to distant jobs?"
        description="Optional. You can skip this and turn it on later in Settings → Services."
        onChange={(next) => void save(next)}
      />
      {error && <p className="mt-2 text-sm text-amber-800">{error}</p>}
    </div>
  );
}

export function TravelFeesSettingsCard({
  travel,
  postalCode,
  onChange,
}: {
  travel: TravelSettings;
  postalCode: string;
  onChange: (next: TravelSettings) => void;
}) {
  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Travel fees</CardTitle>
      </CardHeader>
      <CardContent>
        <TravelFeesEditor
          travel={travel}
          postalCode={postalCode}
          onChange={onChange}
          heading=""
          description=""
          showTierDiagram
        />
      </CardContent>
    </Card>
  );
}
