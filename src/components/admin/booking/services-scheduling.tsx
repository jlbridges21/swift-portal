"use client";

import { useEffect, useState } from "react";
import { CalendarClock, Car, Check, Layers, Loader2, Plus, Route, Trash2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { useSettingsTab } from "@/components/admin/settings-tabs/shared";
import { BookingCard, FieldLabel, MinutesSelect, Notice } from "@/components/admin/booking/booking-ui";
import { useBookingOverview, type OverviewService } from "@/components/admin/booking/use-booking-overview";
import { combinedDuration, formatDuration, travelTiersError, type BookingSettings, type TravelFeeTier } from "@/lib/booking/settings";
import { travelPricingExample } from "@/lib/booking/travel-pricing";
import { cn, formatCurrency } from "@/lib/utils";

const DURATIONS = [15, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];
const SERVICE_BUFFERS = [0, 5, 10, 15, 20, 30, 45, 60];

/** Per-service scheduling rules. Each change saves on its own (like the catalog above). */
export function ServiceSchedulingRules() {
  const { data, error, loading, setData } = useBookingOverview();
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);

  async function update(service: OverviewService, patch: Partial<OverviewService>) {
    if (!data) return;
    const next = { ...service, ...patch };
    setData({ ...data, services: data.services.map((s) => (s.id === service.id ? next : s)) });
    setSaving(service.id);
    setRowError(null);
    try {
      const res = await fetch(`/api/admin/services/${service.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_minutes: next.durationMinutes,
          buffer_minutes: next.bufferMinutes,
          instant_booking_allowed: next.instantBookingAllowed,
          outside_radius_requires_quote: next.outsideRadiusRequiresQuote,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || "Couldn't save.");
      setSaved(service.id);
      window.setTimeout(() => setSaved((s) => (s === service.id ? null : s)), 1500);
    } catch (err) {
      setRowError(err instanceof Error ? err.message : "Couldn't save.");
      setData({ ...data, services: data.services.map((s) => (s.id === service.id ? service : s)) });
    } finally {
      setSaving(null);
    }
  }

  const services = (data?.services ?? []).filter((s) => s.isActive);

  return (
    <BookingCard
      icon={CalendarClock}
      title="Scheduling rules"
      description="On-site time, buffers and booking rules for each service. Changes save automatically."
      id="settings-service-scheduling"
    >
      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading services…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600">{error}</p>
      ) : !services.length ? (
        <p className="text-sm text-muted">Add a service above to set its duration.</p>
      ) : (
        <div className="space-y-3">
          {data && !data.schemaReady ? (
            <Notice tone="warn">Apply database migration v132 to save durations and booking rules.</Notice>
          ) : null}
          {rowError ? <p className="text-sm text-red-600">{rowError}</p> : null}
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted">
                  <th className="px-4 py-2 font-medium sm:pl-0">Service</th>
                  <th className="px-2 py-2 font-medium">Price</th>
                  <th className="px-2 py-2 font-medium" title="Time on site, excluding travel">Est. on-site duration</th>
                  <th className="px-2 py-2 font-medium" title="Extra time added before this service when it's booked">Buffer</th>
                  <th className="px-2 py-2 font-medium" title="Clients may book this service instantly">Instant booking</th>
                  <th className="px-2 py-2 font-medium" title="Outside your service radius, this service always needs a custom quote">
                    Custom quote outside radius
                  </th>
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id} className="border-b border-border/70 last:border-0">
                    <td className="px-4 py-2.5 font-medium text-heading sm:pl-0">
                      <span className="flex items-center gap-2">
                        {s.name}
                        {saving === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" /> : null}
                        {saved === s.id ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-label="Saved" /> : null}
                      </span>
                    </td>
                    <td className="px-2 py-2.5 text-muted">
                      {s.hidePricing ? "Custom" : s.priceCents != null ? formatCurrency(s.priceCents) : "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <MinutesSelect
                        ariaLabel={`${s.name} duration`}
                        className="w-32"
                        value={s.durationMinutes}
                        values={DURATIONS}
                        onChange={(v) => update(s, { durationMinutes: v })}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <MinutesSelect
                        ariaLabel={`${s.name} buffer`}
                        className="w-28"
                        value={s.bufferMinutes}
                        values={SERVICE_BUFFERS}
                        onChange={(v) => update(s, { bufferMinutes: v })}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Switch
                          aria-label={`${s.name}: allow instant booking`}
                          checked={s.instantBookingAllowed}
                          onCheckedChange={(v) => update(s, { instantBookingAllowed: v })}
                        />
                        {s.instantBookingAllowed ? "Allowed" : "Request only"}
                      </span>
                    </td>
                    <td className="px-2 py-2.5">
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <Switch
                          aria-label={`${s.name}: require custom quote outside service radius`}
                          checked={s.outsideRadiusRequiresQuote}
                          onCheckedChange={(v) => update(s, { outsideRadiusRequiresQuote: v })}
                        />
                        {s.outsideRadiusRequiresQuote ? "Required" : "No"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </BookingCard>
  );
}

/** How durations combine when a client books several services. Saved with Settings. */
export function CombinedBookingCard() {
  const { settings, setSettings } = useSettingsTab();
  const b = settings.booking;
  const patch = (p: Partial<BookingSettings>) => setSettings((prev) => ({ ...prev, booking: { ...prev.booking, ...p } }));
  const example = combinedDuration(
    [
      { durationMinutes: 90, bufferMinutes: 0 },
      { durationMinutes: 30, bufferMinutes: 0 },
    ],
    b
  );

  return (
    <BookingCard icon={Layers} title="Combined booking behavior" description="How duration is calculated when clients book several services.">
      <div className="space-y-4">
        <div className="space-y-2">
          {(
            [
              ["sum", "Total duration = sum of services", "Example: 1 hr 30 min + 30 min = 2 hr"],
              ["longest", "Use the longest service only", "Example: 1 hr 30 min and 30 min = 1 hr 30 min"],
            ] as const
          ).map(([value, title, desc]) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3",
                b.combineDurations === value ? "border-accent bg-accent-subtle/60" : "border-border hover:bg-subtle"
              )}
            >
              <input
                type="radio"
                name="combine-durations"
                className="mt-1 h-4 w-4 accent-accent"
                checked={b.combineDurations === value}
                onChange={() => patch({ combineDurations: value })}
              />
              <span>
                <span className="block text-sm font-medium text-heading">{title}</span>
                <span className="block text-xs text-muted">{desc}</span>
              </span>
            </label>
          ))}
        </div>
        <div>
          <p className="text-sm font-semibold text-heading">Adjustments (optional)</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-3">
            <div>
              <FieldLabel htmlFor="combine-setup" hint="Added once per booking.">
                Setup / teardown
              </FieldLabel>
              <MinutesSelect id="combine-setup" value={b.setupMinutes} values={[0, 5, 10, 15, 20, 30]} onChange={(v) => patch({ setupMinutes: v })} />
            </div>
            <div>
              <FieldLabel htmlFor="combine-between" hint="Added between each pair of services (sum mode).">
                Between services
              </FieldLabel>
              <MinutesSelect
                id="combine-between"
                value={b.interServiceBufferMinutes}
                values={[0, 5, 10, 15, 20, 30]}
                onChange={(v) => patch({ interServiceBufferMinutes: v })}
              />
            </div>
            <div>
              <FieldLabel htmlFor="combine-percent">Add a percentage</FieldLabel>
              <select
                id="combine-percent"
                value={b.durationPercentAdd}
                onChange={(e) => patch({ durationPercentAdd: Number(e.target.value) })}
                className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
              >
                {[0, 5, 10, 15, 20, 25].map((p) => (
                  <option key={p} value={p}>
                    {p ? `+${p}%` : "None"}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="mt-2 text-xs text-muted">With these settings, a 1 hr 30 min + 30 min booking blocks {formatDuration(example.durationMinutes)} on site.</p>
        </div>
      </div>
    </BookingCard>
  );
}

/** Travel fees from Google Routes driving distance. Saved with Settings. */
export function RoutesTravelFeesCard() {
  const { settings, setSettings, travelDirty } = useSettingsTab();
  const { data } = useBookingOverview();
  const travel = settings.booking.travel;
  const patchTravel = (p: Partial<BookingSettings["travel"]>) =>
    setSettings((prev) => ({ ...prev, booking: { ...prev.booking, travel: { ...prev.booking.travel, ...p } } }));
  const tierError = travel.model === "tiers" ? travelTiersError(travel.tiers) : null;
  // Legacy ZIP travel settings stay in storage for old data but are no longer used.
  void travelDirty;

  function setTier(i: number, patch: Partial<TravelFeeTier>) {
    const tiers = travel.tiers.map((t, idx) => (idx === i ? { ...t, ...patch } : t));
    // Keep tiers connected: a tier's end is the next one's start.
    for (let k = 1; k < tiers.length; k++) if (tiers[k - 1].toMiles !== null) tiers[k] = { ...tiers[k], fromMiles: tiers[k - 1].toMiles as number };
    patchTravel({ tiers });
  }
  function addTier() {
    const tiers = [...travel.tiers];
    const last = tiers[tiers.length - 1];
    const start = last ? last.fromMiles + 15 : 0;
    if (last) tiers[tiers.length - 1] = { ...last, toMiles: start };
    tiers.push({ fromMiles: start, toMiles: null, feeCents: (last?.feeCents ?? 0) + 2500 });
    patchTravel({ tiers });
  }
  function removeTier(i: number) {
    if (travel.tiers.length <= 1) return;
    const tiers = travel.tiers.filter((_, idx) => idx !== i);
    tiers[0] = { ...tiers[0], fromMiles: 0 };
    tiers[tiers.length - 1] = { ...tiers[tiers.length - 1], toMiles: null };
    for (let k = 1; k < tiers.length; k++) tiers[k] = { ...tiers[k], fromMiles: tiers[k - 1].toMiles ?? tiers[k].fromMiles };
    patchTravel({ tiers });
  }

  return (
    <BookingCard icon={Car} title="Travel fees" description="How travel is charged for properties away from your business address." id="settings-travel-fees">
      <div className="space-y-4">
        <Notice>
          <span className="font-medium">Travel pricing now uses Google Routes and replaces ZIP-based travel fees.</span>{" "}
          Real driving distance is measured once per request and saved with the estimate. Existing estimates keep their travel fees.
          {data && !data.routesConfigured ? " (Add GOOGLE_MAPS_API_KEY on the server to turn it on.)" : ""}
        </Notice>
        <div className="space-y-2">
          {(
            [
              ["per_mile", "Per-mile", "Charge a set amount per mile beyond the miles you include."],
              ["tiers", "Distance tiers", "Flat fees by distance (e.g. 0–15 mi: $0, 15–30 mi: $25, 30+ mi: $50)."],
              ["none", "No fee", "Never add a travel fee."],
            ] as const
          ).map(([value, title, desc]) => (
            <div key={value} className={cn("rounded-xl border", travel.model === value ? "border-accent" : "border-border")}>
              <label className="flex cursor-pointer items-start gap-3 p-3">
                <input type="radio" name="travel-model" className="mt-1 h-4 w-4 accent-accent" checked={travel.model === value} onChange={() => patchTravel({ model: value })} />
                <span>
                  <span className="block text-sm font-semibold text-heading">{title}</span>
                  <span className="block text-xs text-muted">{desc}</span>
                </span>
              </label>
              {travel.model === "per_mile" && value === "per_mile" ? (
                <div className="grid gap-3 border-t border-border p-3 sm:grid-cols-3">
                  <div>
                    <FieldLabel htmlFor="per-mile-rate">Rate per mile</FieldLabel>
                    <MoneyInput id="per-mile-rate" cents={travel.perMileCents} onChange={(c) => patchTravel({ perMileCents: c })} />
                  </div>
                  <div>
                    <FieldLabel htmlFor="per-mile-free" hint="One-way miles included before charging.">
                      Free miles
                    </FieldLabel>
                    <input
                      id="per-mile-free"
                      type="number"
                      min={0}
                      value={travel.freeMiles}
                      onChange={(e) => patchTravel({ freeMiles: Math.max(0, Number(e.target.value) || 0) })}
                      className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                    />
                  </div>
                  <label className="flex items-end gap-2 pb-2 text-sm">
                    <Switch aria-label="Charge round trip" checked={travel.roundTrip} onCheckedChange={(v) => patchTravel({ roundTrip: v })} />
                    Charge round trip
                  </label>
                </div>
              ) : null}
              {travel.model === "tiers" && value === "tiers" ? (
                <div className="space-y-2 border-t border-border p-3">
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
                  <button type="button" onClick={addTier} className="inline-flex items-center gap-1.5 rounded-lg border border-accent/40 px-3 py-1.5 text-xs font-medium text-accent hover:bg-accent-subtle">
                    <Plus className="h-3.5 w-3.5" /> Add tier
                  </button>
                  {tierError ? <p className="text-xs text-red-600">{tierError}</p> : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
        {travel.model !== "none" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor="travel-cap" hint="Above this, no fee is added automatically and you quote travel yourself.">
                Maximum travel fee
              </FieldLabel>
              <MoneyInput id="travel-cap" cents={travel.maxFeeCents} onChange={(c) => patchTravel({ maxFeeCents: c })} placeholder="No maximum" />
            </div>
            <p className="flex items-end gap-1.5 pb-2 text-xs text-muted">
              <Route className="h-3.5 w-3.5 shrink-0" aria-hidden /> {travelPricingExample(travel)}
            </p>
          </div>
        ) : null}
      </div>
    </BookingCard>
  );
}

function MoneyInput({
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
