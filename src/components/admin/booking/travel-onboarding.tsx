"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Car, Loader2, MapPin } from "lucide-react";
import type { AppSettings } from "@/lib/app-settings";
import { travelTiersError, type BookingSettings, type TravelFeeModel } from "@/lib/booking/settings";
import { travelPricingExample } from "@/lib/booking/travel-pricing";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Modal } from "@/components/ui/modal";
import { AddressAutocomplete } from "@/components/forms/address-autocomplete";
import { MaxTravelFeeField, PerMileFields, TierFields } from "@/components/admin/booking/travel-fee-fields";
import { cn, formatCurrency } from "@/lib/utils";

type AddressDraft = { addressLine1: string; city: string; state: string; postalCode: string; country: string };

async function patchSettings(settings: Partial<AppSettings> | Record<string, unknown>) {
  const res = await fetch("/api/admin/settings", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ settings }),
  });
  const body = (await res.json().catch(() => ({}))) as { settings?: AppSettings; error?: string };
  if (!res.ok || !body.settings) throw new Error(body.error || "Couldn't save.");
  return body.settings;
}

/**
 * Onboarding → Services: pick a travel fee model (Google Routes driving distance).
 * Saves immediately. Per-mile and distance-tier details are edited right here (same editors as
 * Settings → Services → Travel fees) and save a moment after the last change.
 * Travel is measured from the business address, so without one this asks for it in a dialog
 * right here (no trip back to the first step), then applies the fee type they picked.
 */
export function TravelFeesOnboarding({ onAddressSaved }: { onAddressSaved?: () => void } = {}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  /** Fee type chosen before an address existed: applied once the address is saved. */
  const [pendingModel, setPendingModel] = useState<TravelFeeModel | null>(null);
  /** Booking settings waiting to be saved after a detail edit (debounced). */
  const pendingSave = useRef<AppSettings["booking"] | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flushSave = useCallback(async () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = null;
    const booking = pendingSave.current;
    pendingSave.current = null;
    if (!booking) return;
    setSaving(true);
    setError(null);
    try {
      // Keep the local draft (the user may still be typing); the server copy is the same values.
      await patchSettings({ booking });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save travel fees.");
    } finally {
      setSaving(false);
    }
  }, []);

  // Leaving the step (Continue / Back) saves any edit still waiting.
  useEffect(() => () => void flushSave(), [flushSave]);

  function editTravel(patch: Partial<BookingSettings["travel"]>) {
    if (!settings) return;
    const travel = { ...settings.booking.travel, ...patch };
    const booking = { ...settings.booking, travel };
    setSettings({ ...settings, booking });
    if (saveTimer.current) clearTimeout(saveTimer.current);
    // Tiers with a gap or overlap aren't saved until they're fixed (the error shows under them).
    if (travel.model === "tiers" && travelTiersError(travel.tiers)) {
      pendingSave.current = null;
      return;
    }
    pendingSave.current = booking;
    saveTimer.current = setTimeout(() => void flushSave(), 700);
  }

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

  async function applyModel(base: AppSettings, model: TravelFeeModel) {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    pendingSave.current = null;
    const booking = { ...base.booking, travel: { ...base.booking.travel, model } };
    setSettings({ ...base, booking });
    setSaving(true);
    setError(null);
    try {
      setSettings(await patchSettings({ booking }));
    } catch (err) {
      setSettings(base);
      setError(err instanceof Error ? err.message : "Couldn't save travel fees.");
    } finally {
      setSaving(false);
    }
  }

  function choose(model: TravelFeeModel) {
    if (!settings) return;
    if (model !== "none" && !hasAddress(settings)) {
      setPendingModel(model);
      setAddressOpen(true);
      return;
    }
    void applyModel(settings, model);
  }

  if (!settings) {
    return error ? <p className="text-sm text-red-600">{error}</p> : null;
  }
  const travel = settings.booking.travel;
  const missingAddress = !hasAddress(settings);
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
            ["per_mile", "Per mile", `${formatCurrency(travel.perMileCents)}/mi after ${travel.freeMiles} miles.`],
            ["tiers", "Distance tiers", "A flat fee for each distance range."],
          ] as const
        ).map(([value, title, desc]) => (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
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
      {missingAddress ? (
        <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-subtle px-3 py-2 text-sm text-heading">
          <MapPin className="h-4 w-4 shrink-0 text-accent" aria-hidden />
          Add your business address to add travel fees.
          <button
            type="button"
            onClick={() => {
              setPendingModel(null);
              setAddressOpen(true);
            }}
            className="font-medium text-accent underline underline-offset-2"
          >
            Add address
          </button>
        </p>
      ) : (
        <>
          {travel.model === "per_mile" || travel.model === "tiers" ? (
            <div className="mt-3 space-y-4 rounded-xl border border-border p-3">
              {travel.model === "per_mile" ? (
                <PerMileFields travel={travel} onChange={editTravel} idPrefix="ob-travel" />
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-muted">Set where each range ends and its fee. The last range covers everything farther.</p>
                  <TierFields travel={travel} onChange={editTravel} />
                </div>
              )}
              <div className="sm:max-w-[calc(50%-0.375rem)]">
                <MaxTravelFeeField travel={travel} onChange={editTravel} idPrefix="ob-travel" />
              </div>
            </div>
          ) : null}
          <p className="mt-2 text-xs text-muted">{travelPricingExample(travel)} You can change this anytime in Settings → Services.</p>
        </>
      )}
      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      <AddressDialog
        open={addressOpen}
        initial={settings.business}
        onClose={() => {
          setAddressOpen(false);
          setPendingModel(null);
        }}
        onSaved={(next) => {
          setAddressOpen(false);
          setSettings(next);
          onAddressSaved?.();
          if (pendingModel) void applyModel(next, pendingModel);
          setPendingModel(null);
        }}
      />
    </section>
  );
}

function hasAddress(settings: AppSettings): boolean {
  return Boolean(settings.business.addressLine1?.trim() && settings.business.city?.trim());
}

function AddressDialog({
  open,
  initial,
  onClose,
  onSaved,
}: {
  open: boolean;
  initial: AppSettings["business"];
  onClose: () => void;
  onSaved: (settings: AppSettings) => void;
}) {
  const [draft, setDraft] = useState<AddressDraft>(() => ({
    addressLine1: initial.addressLine1 ?? "",
    city: initial.city ?? "",
    state: initial.state ?? "",
    postalCode: initial.postalCode ?? "",
    country: initial.country ?? "",
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready = draft.addressLine1.trim() && draft.city.trim();

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const next = await patchSettings({
        business: {
          addressLine1: draft.addressLine1.trim(),
          city: draft.city.trim(),
          state: draft.state.trim(),
          postalCode: draft.postalCode.trim(),
          ...(draft.country ? { country: draft.country } : {}),
        },
      });
      onSaved(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save your address.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Your business address"
      footer={
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button type="button" variant="accent" disabled={!ready || saving} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save address
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <p className="text-sm text-muted">
          Travel fees are measured by driving distance from here. It also sets your time zone. Clients don&apos;t see it unless you
          show it on your website.
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="travel-address1">Street address</Label>
          <AddressAutocomplete
            id="travel-address1"
            placeholder="Start typing your business address"
            value={draft.addressLine1}
            onChange={(addressLine1) => setDraft((d) => ({ ...d, addressLine1 }))}
            onPick={(a) =>
              setDraft({ addressLine1: a.street || a.formatted, city: a.city, state: a.state, postalCode: a.zip, country: a.country })
            }
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)_minmax(0,1fr)]">
          <div className="space-y-1.5">
            <Label htmlFor="travel-city">City</Label>
            <Input id="travel-city" value={draft.city} onChange={(e) => setDraft((d) => ({ ...d, city: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="travel-state">State</Label>
            <Input id="travel-state" value={draft.state} onChange={(e) => setDraft((d) => ({ ...d, state: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="travel-zip">ZIP</Label>
            <Input id="travel-zip" value={draft.postalCode} onChange={(e) => setDraft((d) => ({ ...d, postalCode: e.target.value }))} />
          </div>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
