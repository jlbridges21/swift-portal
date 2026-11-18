"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { FieldLabel } from "@/components/admin/booking/booking-ui";
import { travelTiersError, type BookingSettings, type TravelFeeTier } from "@/lib/booking/settings";
import { cn } from "@/lib/utils";

/**
 * Travel fee editors shared by Settings → Services and the setup wizard, so both offer the
 * same controls: per-mile rate / free miles / round trip, distance tiers, maximum fee.
 */

type Travel = BookingSettings["travel"];
type PatchTravel = (patch: Partial<Travel>) => void;

export function PerMileFields({ travel, onChange, idPrefix = "travel" }: { travel: Travel; onChange: PatchTravel; idPrefix?: string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div>
        <FieldLabel htmlFor={`${idPrefix}-per-mile-rate`}>Rate per mile</FieldLabel>
        <MoneyInput id={`${idPrefix}-per-mile-rate`} cents={travel.perMileCents} onChange={(c) => onChange({ perMileCents: c })} />
      </div>
      <div>
        <FieldLabel htmlFor={`${idPrefix}-per-mile-free`} hint="One-way miles included before charging.">
          Free miles
        </FieldLabel>
        <input
          id={`${idPrefix}-per-mile-free`}
          type="number"
          min={0}
          value={travel.freeMiles}
          onChange={(e) => onChange({ freeMiles: Math.max(0, Number(e.target.value) || 0) })}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
        />
      </div>
      <label className="flex items-end gap-2 pb-2 text-sm">
        <Switch aria-label="Charge round trip" checked={travel.roundTrip} onCheckedChange={(v) => onChange({ roundTrip: v })} />
        Charge round trip
      </label>
    </div>
  );
}

export function TierFields({ travel, onChange }: { travel: Travel; onChange: PatchTravel }) {
  const tierError = travelTiersError(travel.tiers);

  function setTier(i: number, patch: Partial<TravelFeeTier>) {
    const tiers = travel.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    // Keep tiers connected: a tier's end is the next one's start.
    for (let k = 1; k < tiers.length; k++) if (tiers[k - 1].toMiles !== null) tiers[k] = { ...tiers[k], fromMiles: tiers[k - 1].toMiles as number };
    onChange({ tiers });
  }
  function addTier() {
    const tiers = [...travel.tiers];
    const last = tiers[tiers.length - 1];
    const start = last ? last.fromMiles + 15 : 0;
    if (last) tiers[tiers.length - 1] = { ...last, toMiles: start };
    tiers.push({ fromMiles: start, toMiles: null, feeCents: (last?.feeCents ?? 0) + 2500 });
    onChange({ tiers });
  }
  function removeTier(i: number) {
    if (travel.tiers.length <= 1) return;
    const tiers = travel.tiers.filter((_, idx) => idx !== i);
    tiers[0] = { ...tiers[0], fromMiles: 0 };
    tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], toMiles: null };
    for (let k = 1; k < tiers.length; k++) tiers[k] = { ...tiers[k], fromMiles: tiers[k - 1].toMiles ?? tiers[k].fromMiles };
    onChange({ tiers });
  }

  return (
    <div className="space-y-2">
      {travel.tiers.map((t, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-28 text-muted">
            {t.fromMiles}
            {t.toMiles === null ? "+ miles" : " –"}
          </span>
          {t.toMiles !== null ? (
            <input
              aria-label={`Tier ${i + 1} ends at miles`}
              type="number"
              min={t.fromMiles + 1}
              value={t.toMiles}
              onChange={(e) => setTier(i, { toMiles: Math.max(t.fromMiles + 1, Number(e.target.value) || 0) })}
              className="h-10 w-20 rounded-lg border border-border bg-card px-2 text-sm"
            />
          ) : null}
          {t.toMiles !== null ? <span className="text-muted">miles</span> : null}
          <MoneyInput className="w-32" ariaLabel={`Tier ${i + 1} fee`} cents={t.feeCents} onChange={(c) => setTier(i, { feeCents: c })} />
          <button
            type="button"
            aria-label={`Remove tier ${i + 1}`}
            disabled={travel.tiers.length <= 1}
            onClick={() => removeTier(i)}
            className="rounded-md p-2 text-muted hover:text-red-600 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addTier}
        className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-subtle"
      >
        <Plus className="h-3.5 w-3.5" /> Add tier
      </button>
      {tierError ? <p className="text-xs text-red-600">{tierError}</p> : null}
    </div>
  );
}

export function MaxTravelFeeField({ travel, onChange, idPrefix = "travel" }: { travel: Travel; onChange: PatchTravel; idPrefix?: string }) {
  return (
    <div>
      <FieldLabel htmlFor={`${idPrefix}-cap`} hint="Above this, no fee is added automatically and you quote travel yourself.">
        Maximum travel fee
      </FieldLabel>
      <MoneyInput id={`${idPrefix}-cap`} cents={travel.maxFeeCents} onChange={(c) => onChange({ maxFeeCents: c })} placeholder="No maximum" />
    </div>
  );
}

export function MoneyInput({
  cents,
  onChange,
  id,
  className,
  ariaLabel,
  placeholder,
}: {
  cents: number;
  onChange: (cents: number) => void;
  id?: string;
  className?: string;
  ariaLabel?: string;
  placeholder?: string;
}) {
  const [text, setText] = useState(cents ? (cents / 100).toFixed(2) : "");
  useEffect(() => {
    setText((prev) => (Math.round(Number(prev || 0) * 100) === cents ? prev : cents ? (cents / 100).toFixed(2) : ""));
  }, [cents]);
  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
      <input
        id={id}
        aria-label={ariaLabel}
        inputMode="decimal"
        placeholder={placeholder ?? "0.00"}
        value={text}
        onChange={(e) => {
          const v = e.target.value.replace(/[^\d.]/g, "");
          setText(v);
          const n = Number(v);
          if (Number.isFinite(n)) onChange(Math.max(0, Math.round(n * 100)));
        }}
        className="h-10 w-full rounded-lg border border-border bg-card pl-7 pr-3 text-sm"
      />
    </div>
  );
}
