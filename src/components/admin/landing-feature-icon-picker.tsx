"use client";

import { useId, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { LANDING_FEATURE_ICON_IDS, type LandingFeatureIconId } from "@/lib/landing-content";
import {
  LANDING_FEATURE_ICON_LABELS,
  LANDING_FEATURE_ICON_MAP,
} from "@/lib/landing-feature-icons";

export function LandingFeatureIconPicker({
  value,
  onChange,
  id,
}: {
  value: LandingFeatureIconId;
  onChange: (next: LandingFeatureIconId) => void;
  id?: string;
}) {
  const listId = useId();
  const [query, setQuery] = useState("");
  const SelectedIcon = LANDING_FEATURE_ICON_MAP[value] ?? LANDING_FEATURE_ICON_MAP.CheckCircle2;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...LANDING_FEATURE_ICON_IDS];
    return LANDING_FEATURE_ICON_IDS.filter((iconId) => {
      const label = LANDING_FEATURE_ICON_LABELS[iconId].toLowerCase();
      return iconId.toLowerCase().includes(q) || label.includes(q);
    });
  }, [query]);

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3 rounded-lg border border-border bg-slate-50 px-3 py-2">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#3B82F6]/10">
          <SelectedIcon className="h-5 w-5 text-[#3B82F6]" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">
            {LANDING_FEATURE_ICON_LABELS[value]}
          </p>
          <p className="truncate text-xs text-muted">{value}</p>
        </div>
      </div>

      <label htmlFor={id ?? `${listId}-search`} className="sr-only">
        Filter icons
      </label>
      <input
        id={id ?? `${listId}-search`}
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Filter icons…"
        className="w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
      />

      <div
        role="listbox"
        aria-label="Feature icons"
        className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto rounded-lg border border-border p-2 sm:grid-cols-4"
      >
        {filtered.map((iconId) => {
          const Icon = LANDING_FEATURE_ICON_MAP[iconId];
          const selected = iconId === value;
          return (
            <button
              key={iconId}
              type="button"
              role="option"
              aria-selected={selected}
              aria-label={LANDING_FEATURE_ICON_LABELS[iconId]}
              onClick={() => onChange(iconId)}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition",
                selected
                  ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                  : "border-transparent hover:border-border hover:bg-slate-50"
              )}
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B82F6]/10">
                <Icon className="h-5 w-5 text-[#3B82F6]" aria-hidden />
              </span>
              <span className="line-clamp-2 text-[10px] leading-tight text-muted">
                {LANDING_FEATURE_ICON_LABELS[iconId]}
              </span>
            </button>
          );
        })}
        {filtered.length === 0 ? (
          <p className="col-span-full py-4 text-center text-xs text-muted">No icons match.</p>
        ) : null}
      </div>
    </div>
  );
}
