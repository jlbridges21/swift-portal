"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Car, ChevronUp, Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { TravelFeesEditor } from "@/components/admin/travel-fees-card";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";
import { ServicesTabBridgeProvider } from "@/components/admin/settings-tabs/services-tab-context";
import { readCleanHash } from "@/lib/url-hash";
import { cn } from "@/lib/utils";

function UnsavedChip() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
      Unsaved
    </span>
  );
}

function OnOffPill({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        on
          ? "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
          : "bg-subtle text-muted"
      )}
    >
      {on ? "On" : "Off"}
    </span>
  );
}

function RowIcon({ children, accent }: { children: ReactNode; accent?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        accent ? "bg-accent-subtle text-accent" : "bg-subtle text-muted"
      )}
      aria-hidden
    >
      {children}
    </span>
  );
}

/** Opens the travel editor when a deep link (#settings-travel-fees or a field inside it) targets it. */
function useHashOpens(sectionId: string, open: () => void) {
  useEffect(() => {
    let timer = 0;
    const sync = () => {
      const hash = readCleanHash();
      if (!hash) return;
      const el = document.getElementById(hash);
      const hit = hash === sectionId || hash.startsWith(`${sectionId}-`) || Boolean(el?.closest(`#${CSS.escape(sectionId)}`));
      if (!hit) return;
      open();
      window.clearTimeout(timer);
      timer = window.setTimeout(() => document.getElementById(sectionId)?.scrollIntoView({ block: "start" }), 200);
    };
    sync();
    window.addEventListener("hashchange", sync);
    window.addEventListener("portal:hash-target", sync);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("hashchange", sync);
      window.removeEventListener("portal:hash-target", sync);
    };
  }, [sectionId, open]);
}

const openTravelKey = "admin-settings-travel-fees";

export function ServicesTab() {
  const { settings, requestFormDirty, travelDirty, patchTravel, patchProposals, services } = useSettingsTab();
  const [addRequest, setAddRequest] = useState(0);
  const bridge = useMemo(() => ({ addRequest }), [addRequest]);
  const [travelOpen, setTravelOpen] = useState(false);
  const travelOn = settings.travel.enabled;

  // Remember an open travel editor for this browser tab session (as the old collapsible did).
  useEffect(() => {
    try {
      if (sessionStorage.getItem(openTravelKey) === "1") setTravelOpen(true);
    } catch {
      /* private mode */
    }
  }, []);
  function setTravel(next: boolean) {
    setTravelOpen(next);
    try {
      sessionStorage.setItem(openTravelKey, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  }
  const openTravel = useMemo(() => () => setTravelOpen(true), []);
  useHashOpens("settings-travel-fees", openTravel);

  return (
    <div id="settings-services" tabIndex={-1} className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <SectionHeading id="services">Services</SectionHeading>
          <p className="mt-1 text-sm text-muted">What you offer and your starting prices.</p>
        </div>
        <Button type="button" variant="accent" className="min-h-11" onClick={() => setAddRequest((n) => n + 1)}>
          <Plus className="h-4 w-4" /> Add service
        </Button>
      </div>

      <section
        id="settings-instant-preliminary"
        tabIndex={-1}
        className="scroll-mt-24 rounded-2xl border border-border bg-card px-5 py-4 outline-none sm:px-6"
      >
        <label htmlFor="autoPreliminaryEstimate" className="flex cursor-pointer items-center gap-3 sm:gap-4">
          <RowIcon accent>
            <Zap className="h-4 w-4" />
          </RowIcon>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-heading">
              Instant estimates on the request form
              {requestFormDirty ? <UnsavedChip /> : null}
            </span>
            <span className="mt-0.5 block text-[13px] text-muted">
              Clients pick a service and see a starting price right away. Off: the form becomes a simple inquiry.
            </span>
          </span>
          <span className="flex min-h-11 items-center">
            <Switch
              id="autoPreliminaryEstimate"
              aria-label="Instant estimates on the request form"
              checked={settings.proposals.autoPreliminaryEstimate}
              onCheckedChange={(v) => patchProposals({ autoPreliminaryEstimate: v })}
            />
          </span>
        </label>
      </section>

      <section id="settings-service-catalog" tabIndex={-1} aria-label="Service catalog" className="scroll-mt-24 outline-none">
        <ServicesTabBridgeProvider value={bridge}>{services}</ServicesTabBridgeProvider>
      </section>

      <section
        id="settings-travel-fees"
        tabIndex={-1}
        className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card outline-none"
      >
        <div className="flex flex-wrap items-center gap-3 px-5 py-4 sm:flex-nowrap sm:gap-4 sm:px-6">
          <RowIcon>
            <Car className="h-4 w-4" />
          </RowIcon>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-heading">
              Travel fees
              {travelDirty ? <UnsavedChip /> : null}
            </p>
            <p className="mt-0.5 text-[13px] text-muted">Charge by distance from your home base.</p>
          </div>
          <div className="ml-auto flex items-center gap-3">
            <OnOffPill on={travelOn} />
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              aria-expanded={travelOpen}
              aria-controls="settings-travel-fees-panel"
              onClick={() => setTravel(!travelOpen)}
            >
              {travelOpen ? (
                <>
                  <ChevronUp className="h-4 w-4" /> Close
                </>
              ) : travelOn ? (
                "Edit"
              ) : (
                "Set up"
              )}
            </Button>
          </div>
        </div>
        {travelOpen ? (
          <div
            id="settings-travel-fees-panel"
            role="region"
            aria-label="Travel fees"
            className="border-t border-border px-5 py-5 sm:px-6"
          >
            <TravelFeesEditor
              travel={settings.travel}
              postalCode={settings.business.postalCode}
              onChange={patchTravel}
              heading=""
              description=""
              showTierDiagram
            />
          </div>
        ) : null}
      </section>
    </div>
  );
}
