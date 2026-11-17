"use client";

import { useEffect, useState } from "react";
import { Car, Loader2 } from "lucide-react";
import type { AppSettings } from "@/lib/app-settings";
import type { TravelFeeModel } from "@/lib/booking/settings";
import { travelPricingExample } from "@/lib/booking/travel-pricing";
import { cn } from "@/lib/utils";

/**
 * Onboarding → Services: pick a travel fee model (Google Routes driving distance).
 * Saves immediately; details are refined later in Settings → Services → Travel fees.
 */
export function TravelFeesOnboarding({ onAddAddress }: { onAddAddress?: () => void } = {}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/admin/settings", { credentials: "include" });
      const data = (await res.json().catch(() => ({}))) as { settings?: AppSettings; error?: string };
      if (cancelled) return;
      if (!res.ok || !data.settings) setError(data.error || "Travel fees could not be loaded.");
      else setSettings(data.settings);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function choose(model: TravelFeeModel) {
    if (!settings) return;
    const booking = { ...settings.booking, travel: { ...settings.booking.travel, model } };
    const previous = settings;
    setSettings({ ...settings, booking });
    setSaving(true);
    setError(null);
    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ booking }),
    });
    setSaving(false);
    if (!res.ok) {
      setSettings(previous);
      setError(((await res.json().catch(() => ({}))) as { error?: string }).error || "Couldn't save travel fees.");
    }
  }

  if (!settings) {
    return error ? <p className="text-sm text-red-600">{error}</p> : null;
  }
  const hasAddress = Boolean(settings.business.addressLine1?.trim() || settings.business.city?.trim());
  const travel = settings.booking.travel;
  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-accent-subtle text-accent">
          <Car className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-heading">
            Travel fees {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" /> : null}
          </p>
          <p className="text-[13px] text-muted">Charged from real driving distance (Google Routes) to the property.</p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        {(
          [
            ["none", "No fee", "Never add travel."],
            ["per_mile", "Per mile", "$0.75/mi after 15 miles."],
            ["tiers", "Distance tiers", "$0 · $25 · $50 by distance."],
          ] as const
        ).map(([value, title, desc]) => (
          <button
            key={value}
            type="button"
            onClick={() => void choose(value)}
            aria-pressed={travel.model === value}
            className={cn(
              "rounded-xl border p-3 text-left",
              travel.model === value ? "border-accent bg-accent-subtle/60 ring-1 ring-accent" : "border-border hover:bg-subtle"
            )}
          >
            <span className="block text-sm font-semibold text-heading">{title}</span>
            <span className="block text-xs text-muted">{desc}</span>
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        {travelPricingExample(travel)} Fine-tune it anytime in Settings → Services.
        {travel.model !== "none" && !hasAddress && onAddAddress ? (
          <>
            {" "}
            <button type="button" onClick={onAddAddress} className="font-medium text-accent hover:underline">
              Add your business address
            </button>{" "}
            so distance can be measured.
          </>
        ) : null}
      </p>
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </section>
  );
}
