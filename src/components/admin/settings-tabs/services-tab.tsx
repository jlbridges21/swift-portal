"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Plus, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  CombinedBookingCard,
  RoutesTravelFeesCard,
  ServiceSchedulingRules,
} from "@/components/admin/booking/services-scheduling";
import { SectionHeading, useSettingsTab } from "@/components/admin/settings-tabs/shared";
import { ServicesTabBridgeProvider } from "@/components/admin/settings-tabs/services-tab-context";
import { cn } from "@/lib/utils";

function UnsavedChip() {
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
      Unsaved
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

export function ServicesTab() {
  const { settings, requestFormDirty, patchProposals, services } = useSettingsTab();
  const [addRequest, setAddRequest] = useState(0);
  const bridge = useMemo(() => ({ addRequest }), [addRequest]);

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

      <ServiceSchedulingRules />

      <div className="grid gap-4 xl:grid-cols-2">
        <CombinedBookingCard />
        <RoutesTravelFeesCard />
      </div>
    </div>
  );
}
