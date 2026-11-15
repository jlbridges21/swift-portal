"use client";

import { useState } from "react";
import { LogoSizeSlider } from "@/components/admin/logo-size-slider";
import { PORTAL_LOGO_SIZE } from "@/lib/brand-logo-size";
import { cn } from "@/lib/utils";

/** Preset heights for the desktop portal nav logo, inside PORTAL_LOGO_SIZE min/max. */
const PRESETS = [
  { key: "small", label: "Small", px: 32 },
  { key: "medium", label: "Medium", px: PORTAL_LOGO_SIZE.default },
  { key: "large", label: "Large", px: PORTAL_LOGO_SIZE.max },
] as const;

type SegmentKey = (typeof PRESETS)[number]["key"] | "custom";

export function BrandingLogoSize({ value, onChange }: { value: number; onChange: (px: number) => void }) {
  const preset = PRESETS.find((p) => p.px === value);
  const [customOpen, setCustomOpen] = useState(!preset);
  const active: SegmentKey = customOpen || !preset ? "custom" : preset.key;

  const segments: { key: SegmentKey; label: string }[] = [
    ...PRESETS.map((p) => ({ key: p.key as SegmentKey, label: p.label })),
    { key: "custom", label: "Custom" },
  ];

  return (
    <div id="settings-logo-size" tabIndex={-1} className="scroll-mt-24 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p id="logo-size-label" className="text-sm font-semibold text-heading">
            Logo size in the portal header
          </p>
          <p className="text-[13px] text-muted">Phones use a slightly smaller size automatically.</p>
        </div>
        <div
          role="radiogroup"
          aria-labelledby="logo-size-label"
          className="inline-flex shrink-0 self-start rounded-xl border border-border bg-subtle p-1 sm:self-auto"
        >
          {segments.map((s) => {
            const on = active === s.key;
            return (
              <button
                key={s.key}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (s.key === "custom") {
                    setCustomOpen(true);
                    return;
                  }
                  setCustomOpen(false);
                  const px = PRESETS.find((p) => p.key === s.key)?.px;
                  if (px !== undefined) onChange(px);
                }}
                className={cn(
                  "min-h-9 rounded-lg px-3 text-[13px] font-medium transition-colors",
                  on ? "bg-card text-heading shadow-sm" : "text-muted hover:text-heading"
                )}
              >
                {s.label}
              </button>
            );
          })}
        </div>
      </div>
      {active === "custom" ? (
        <div className="rounded-xl border border-border bg-subtle p-4">
          <LogoSizeSlider
            id="portalLogoSizePx"
            label="Exact height"
            value={value}
            min={PORTAL_LOGO_SIZE.min}
            max={PORTAL_LOGO_SIZE.max}
            help={`Desktop header height (${PORTAL_LOGO_SIZE.min}–${PORTAL_LOGO_SIZE.max}px). Phones use 80% of it; large screens use 115% (up to ${PORTAL_LOGO_SIZE.max}px). The Business Website logo size is set under Business Website → Advanced.`}
            onChange={onChange}
          />
        </div>
      ) : null}
    </div>
  );
}
