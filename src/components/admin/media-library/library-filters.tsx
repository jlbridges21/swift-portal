"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, Filter, Search, SlidersHorizontal, X } from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CheckboxDropdown, type CheckboxOption } from "@/components/ui/checkbox-dropdown";
import {
  ALL_TIME,
  DateRangeFilter,
  describeDateRange,
  isDateRangeActive,
  type DateRangePreset,
  type DateRangeValue,
} from "@/components/ui/date-range-filter";
import { cn } from "@/lib/utils";

export type LibraryFilterState = {
  types: string[];
  services: string[];
  clientIds: string[];
  propertyIds: string[];
  dateRange: DateRangeValue;
};

export const EMPTY_FILTERS: LibraryFilterState = { types: [], services: [], clientIds: [], propertyIds: [], dateRange: ALL_TIME };

export const TYPE_OPTIONS: CheckboxOption[] = [
  { value: "photo", label: "Photos" },
  { value: "video", label: "Videos" },
  { value: "tour", label: "360° Tours" },
  { value: "model", label: "3D Models" },
  { value: "document", label: "Files" },
];

export type FilterOptionSets = {
  services: CheckboxOption[];
  clients: CheckboxOption[];
  properties: CheckboxOption[];
};

export type ActiveFilterChip = { key: string; label: string; values: string[]; clear: () => void };

export function activeFilterChips(
  f: LibraryFilterState,
  sets: FilterOptionSets,
  set: (next: LibraryFilterState) => void
): ActiveFilterChip[] {
  const labels = (values: string[], options: CheckboxOption[]) => values.map((v) => options.find((o) => o.value === v)?.label ?? v);
  const out: ActiveFilterChip[] = [];
  if (f.types.length) out.push({ key: "type", label: "Type", values: labels(f.types, TYPE_OPTIONS), clear: () => set({ ...f, types: [] }) });
  if (f.services.length) out.push({ key: "service", label: "Service", values: f.services, clear: () => set({ ...f, services: [] }) });
  if (f.clientIds.length) out.push({ key: "client", label: "Client", values: labels(f.clientIds, sets.clients), clear: () => set({ ...f, clientIds: [] }) });
  if (f.propertyIds.length)
    out.push({ key: "property", label: "Property", values: labels(f.propertyIds, sets.properties), clear: () => set({ ...f, propertyIds: [] }) });
  if (isDateRangeActive(f.dateRange))
    out.push({ key: "date", label: "Date", values: [describeDateRange(f.dateRange) ?? ""], clear: () => set({ ...f, dateRange: ALL_TIME }) });
  return out;
}

/** Search box used on every breakpoint. */
export function LibrarySearch({ value, onChange, placeholder, className }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-9 text-sm text-heading shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-heading"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}

/** Desktop (lg+) filter row — mockup 1. */
export function DesktopFilterBar({
  filters,
  onChange,
  sets,
  expanded,
  onToggle,
}: {
  filters: LibraryFilterState;
  onChange: (next: LibraryFilterState) => void;
  sets: FilterOptionSets;
  expanded: boolean;
  onToggle: () => void;
}) {
  const active = activeFilterChips(filters, sets, onChange).length;
  return (
    <div className="hidden rounded-2xl border border-border bg-card p-2.5 shadow-sm lg:block">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className={cn(
            "inline-flex h-10 shrink-0 items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition-colors",
            expanded || active ? "border-accent/30 bg-accent-subtle text-accent" : "border-border text-heading hover:bg-subtle"
          )}
        >
          <Filter className="h-4 w-4" aria-hidden />
          Filters
          {active ? <span className="rounded-full bg-accent px-1.5 text-[11px] leading-5 text-accent-foreground">{active}</span> : null}
          <ChevronDown className={cn("h-4 w-4 transition-transform", expanded && "rotate-180")} aria-hidden />
        </button>
        {expanded ? (
          <div className="grid min-w-0 flex-1 grid-cols-5 gap-2.5">
            <CheckboxDropdown label="Media Type" options={TYPE_OPTIONS} selected={filters.types} onChange={(types) => onChange({ ...filters, types })} searchable={false} />
            <CheckboxDropdown label="Services" options={sets.services} selected={filters.services} onChange={(services) => onChange({ ...filters, services })} emptyText="No services yet" />
            <CheckboxDropdown label="Clients" options={sets.clients} selected={filters.clientIds} onChange={(clientIds) => onChange({ ...filters, clientIds })} emptyText="No clients yet" />
            <CheckboxDropdown
              label="Properties"
              options={sets.properties}
              selected={filters.propertyIds}
              onChange={(propertyIds) => onChange({ ...filters, propertyIds })}
              emptyText="No properties yet"
              className="[&>div:last-child]:left-auto [&>div:last-child]:right-0"
            />
            <DateRangeFilter
              label="Date Range"
              value={filters.dateRange}
              onChange={(dateRange) => onChange({ ...filters, dateRange })}
              className="[&>div:last-child]:left-auto [&>div:last-child]:right-0"
            />
          </div>
        ) : (
          <p className="min-w-0 flex-1 truncate text-sm text-muted">Media type, services, clients, properties, and date range</p>
        )}
        <button
          type="button"
          onClick={() => onChange(EMPTY_FILTERS)}
          disabled={!active}
          className="h-10 shrink-0 rounded-lg px-3 text-sm font-medium text-accent hover:bg-accent-subtle disabled:pointer-events-none disabled:opacity-40"
        >
          Clear All
        </button>
      </div>
    </div>
  );
}

/** Phone/tablet trigger that opens the filter sheet. */
export function FilterSheetButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <Button variant="outline" onClick={onClick} className={cn("h-11 shrink-0 rounded-xl px-3.5 lg:hidden", count && "border-accent/40 text-accent")}>
      <SlidersHorizontal className="h-4 w-4" />
      <span>Filters</span>
      {count ? <span className="rounded-full bg-accent px-1.5 text-[11px] leading-5 text-accent-foreground">{count}</span> : null}
    </Button>
  );
}

function SheetChecklist({
  title,
  options,
  selected,
  onChange,
  emptyText,
}: {
  title: string;
  options: CheckboxOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText: string;
}) {
  const [query, setQuery] = useState("");
  const set = new Set(selected);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)) : options;
  }, [options, query]);
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        {selected.length ? (
          <button type="button" onClick={() => onChange([])} className="min-h-9 px-1 text-xs font-medium text-accent">
            Clear
          </button>
        ) : null}
      </div>
      {options.length > 8 ? (
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${title.toLowerCase()}…`}
          aria-label={`Search ${title.toLowerCase()}`}
          className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
        />
      ) : null}
      {options.length === 0 ? (
        <p className="text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-xl border border-border">
          {visible.map((o) => (
            <li key={o.value}>
              <label className="flex min-h-12 cursor-pointer items-center gap-3 px-3 py-2">
                <input
                  type="checkbox"
                  className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
                  checked={set.has(o.value)}
                  onChange={() => onChange(set.has(o.value) ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                />
                <span className="min-w-0">
                  <span className="block truncate text-sm text-heading">{o.label}</span>
                  {o.hint ? <span className="block truncate text-xs text-muted">{o.hint}</span> : null}
                </span>
              </label>
            </li>
          ))}
          {visible.length === 0 ? <li className="px-3 py-3 text-sm text-muted">No matches.</li> : null}
        </ul>
      )}
    </section>
  );
}

const DATE_PRESETS: { value: Exclude<DateRangePreset, "custom">; label: string }[] = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "year", label: "This year" },
];

/** Phone/tablet filters: draft state, applied with "Show results". */
export function FilterSheet({
  open,
  onClose,
  filters,
  onApply,
  sets,
}: {
  open: boolean;
  onClose: () => void;
  filters: LibraryFilterState;
  onApply: (next: LibraryFilterState) => void;
  sets: FilterOptionSets;
}) {
  const [draft, setDraft] = useState(filters);
  useEffect(() => {
    if (open) setDraft(filters);
  }, [open, filters]);
  const custom = draft.dateRange.preset === "custom";
  const start = custom ? draft.dateRange.start ?? "" : "";
  const end = custom ? draft.dateRange.end ?? "" : "";

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Filters"
      description="Media must match every filter you set."
      footer={
        <div className="flex gap-2">
          <Button variant="outline" className="min-h-11 flex-1" onClick={() => setDraft(EMPTY_FILTERS)}>
            Clear all
          </Button>
          <Button
            variant="accent"
            className="min-h-11 flex-1"
            onClick={() => {
              onApply(draft);
              onClose();
            }}
          >
            Show results
          </Button>
        </div>
      }
    >
      <div className="space-y-5 pb-2">
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-heading">Media type</h3>
          <div className="flex flex-wrap gap-2">
            {TYPE_OPTIONS.map((o) => {
              const on = draft.types.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft({ ...draft, types: on ? draft.types.filter((t) => t !== o.value) : [...draft.types, o.value] })}
                  className={cn(
                    "h-10 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-heading"
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </section>
        <SheetChecklist title="Services" options={sets.services} selected={draft.services} onChange={(services) => setDraft({ ...draft, services })} emptyText="No services yet." />
        <SheetChecklist title="Clients" options={sets.clients} selected={draft.clientIds} onChange={(clientIds) => setDraft({ ...draft, clientIds })} emptyText="No clients yet." />
        <SheetChecklist title="Properties" options={sets.properties} selected={draft.propertyIds} onChange={(propertyIds) => setDraft({ ...draft, propertyIds })} emptyText="No properties yet." />
        <section className="space-y-2">
          <h3 className="text-sm font-semibold text-heading">Date range</h3>
          <div className="flex flex-wrap gap-2">
            {DATE_PRESETS.map((p) => {
              const on = draft.dateRange.preset === p.value;
              return (
                <button
                  key={p.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDraft({ ...draft, dateRange: p.value === "all" ? ALL_TIME : { preset: p.value } })}
                  className={cn(
                    "h-10 rounded-full border px-3.5 text-sm font-medium transition-colors",
                    on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-heading"
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted">
              From
              <input
                type="date"
                value={start}
                onChange={(e) => {
                  const s = e.target.value;
                  setDraft({ ...draft, dateRange: s || end ? { preset: "custom", start: s || undefined, end: end || undefined } : ALL_TIME });
                }}
                className="h-11 w-full rounded-lg border border-border bg-card px-2 text-sm text-heading"
              />
            </label>
            <label className="space-y-1 text-xs text-muted">
              To
              <input
                type="date"
                value={end}
                onChange={(e) => {
                  const v = e.target.value;
                  setDraft({ ...draft, dateRange: start || v ? { preset: "custom", start: start || undefined, end: v || undefined } : ALL_TIME });
                }}
                className="h-11 w-full rounded-lg border border-border bg-card px-2 text-sm text-heading"
              />
            </label>
          </div>
        </section>
      </div>
    </BottomSheet>
  );
}

export function ActiveFilterChips({ chips, onClearAll }: { chips: ActiveFilterChip[]; onClearAll: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters">
      {chips.map((f) => (
        <span key={f.key} className="inline-flex max-w-full items-center gap-1 rounded-full border border-accent/30 bg-accent-subtle/60 py-0.5 pl-3 pr-1 text-xs">
          <span className="text-muted">{f.label}:</span>
          <span className="max-w-[14rem] truncate font-medium text-heading" title={f.values.join(", ")}>
            {f.values.join(", ")}
          </span>
          <button
            type="button"
            onClick={f.clear}
            aria-label={`Clear ${f.label} filter`}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-accent/10 hover:text-heading"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="min-h-8 px-1 text-xs font-medium text-accent hover:underline">
        Clear all
      </button>
    </div>
  );
}
