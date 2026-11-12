"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  ArrowUpDown,
  CalendarDays,
  ChevronDown,
  Columns3,
  Filter,
  LayoutGrid,
  List,
  Search,
  Users,
  X,
} from "lucide-react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { CheckboxDropdown, useDismiss, type CheckboxOption } from "@/components/ui/checkbox-dropdown";
import {
  PAYMENT_STATUS_OPTIONS,
  PROJECTS_SORT_OPTIONS,
  STATUS_OPTIONS,
  type ProjectsSort,
  type ProjectsWorkspaceView,
} from "@/lib/projects-workspace";
import { cn } from "@/lib/utils";

// ── View selector ───────────────────────────────────────────────────────────

const VIEWS: { value: ProjectsWorkspaceView; label: string; icon: typeof List }[] = [
  { value: "pipeline", label: "Pipeline", icon: Columns3 },
  { value: "client", label: "Client", icon: Users },
  { value: "grid", label: "Grid", icon: LayoutGrid },
  { value: "list", label: "List", icon: List },
  { value: "calendar", label: "Calendar", icon: CalendarDays },
];

export function ProjectsViewSelector({
  value,
  onChange,
  showClient,
  loading,
}: {
  value: ProjectsWorkspaceView;
  onChange: (v: ProjectsWorkspaceView) => void;
  showClient: boolean;
  loading?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Project view" className="flex min-w-0 rounded-xl border border-border bg-subtle p-1">
      {VIEWS.filter((v) => v.value !== "client" || showClient).map(({ value: v, label, icon: Icon }) => {
        const active = value === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={label}
            title={label}
            onClick={() => onChange(v)}
            className={cn(
              "relative inline-flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-lg px-2 text-sm font-semibold transition-colors sm:flex-none sm:px-3",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
              active ? "bg-card text-accent shadow-sm ring-1 ring-border" : "text-muted hover:text-heading",
              active && loading && v === "client" && "animate-pulse"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="hidden md:inline">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ── Date ranges (shoot + created) ───────────────────────────────────────────

export type ProjectDateRange = { preset: string; start?: string; end?: string };
export const ANY_DATE: ProjectDateRange = { preset: "any" };

type DatePreset = { value: string; label: string; range: () => { from?: Date; to?: Date } };

const day = (offset: number, end = false) => {
  const d = new Date();
  d.setHours(end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0);
  d.setDate(d.getDate() + offset);
  return d;
};

export const SHOOT_PRESETS: DatePreset[] = [
  { value: "next7", label: "Next 7 days", range: () => ({ from: day(0), to: day(6, true) }) },
  { value: "next30", label: "Next 30 days", range: () => ({ from: day(0), to: day(29, true) }) },
  { value: "past30", label: "Past 30 days", range: () => ({ from: day(-29), to: day(0, true) }) },
  { value: "upcoming", label: "Any upcoming", range: () => ({ from: day(0) }) },
];

export const CREATED_PRESETS: DatePreset[] = [
  { value: "7d", label: "Last 7 days", range: () => ({ from: day(-6) }) },
  { value: "30d", label: "Last 30 days", range: () => ({ from: day(-29) }) },
  { value: "90d", label: "Last 90 days", range: () => ({ from: day(-89) }) },
  { value: "year", label: "This year", range: () => ({ from: new Date(new Date().getFullYear(), 0, 1) }) },
];

function parseYmd(ymd?: string, end = false): Date | undefined {
  const m = ymd ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd) : null;
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (end) d.setHours(23, 59, 59, 999);
  return d;
}

export function dateRangeIso(value: ProjectDateRange, presets: DatePreset[]): { from?: string; to?: string } {
  if (value.preset === "custom") return { from: parseYmd(value.start)?.toISOString(), to: parseYmd(value.end, true)?.toISOString() };
  const p = presets.find((x) => x.value === value.preset);
  if (!p) return {};
  const r = p.range();
  return { from: r.from?.toISOString(), to: r.to?.toISOString() };
}

export function isDateActive(value: ProjectDateRange): boolean {
  return value.preset === "custom" ? Boolean(value.start || value.end) : value.preset !== "any";
}

const shortYmd = (ymd: string) => parseYmd(ymd)?.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) ?? ymd;

export function describeDate(value: ProjectDateRange, presets: DatePreset[]): string {
  if (value.preset === "custom") {
    if (value.start && value.end) return `${shortYmd(value.start)} – ${shortYmd(value.end)}`;
    return value.start ? `From ${shortYmd(value.start)}` : `Until ${shortYmd(value.end ?? "")}`;
  }
  return presets.find((p) => p.value === value.preset)?.label ?? "Any time";
}

// ── Filter panel (popover body on desktop, sheet body on phones) ────────────

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors",
        on ? "border-accent bg-accent text-accent-foreground" : "border-border bg-card text-heading hover:border-accent/40 hover:bg-accent-subtle/50"
      )}
    >
      {children}
    </button>
  );
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Section({ title, children, onClear, showClear }: { title: string; children: ReactNode; onClear?: () => void; showClear?: boolean }) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
        {showClear && onClear ? (
          <button type="button" onClick={onClear} className="min-h-7 px-1 text-xs font-medium text-accent hover:underline">
            Clear
          </button>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function DateSection({
  title,
  value,
  onChange,
  presets,
}: {
  title: string;
  value: ProjectDateRange;
  onChange: (v: ProjectDateRange) => void;
  presets: DatePreset[];
}) {
  const start = value.preset === "custom" ? value.start ?? "" : "";
  const end = value.preset === "custom" ? value.end ?? "" : "";
  const setCustom = (s: string, e: string) => onChange(s || e ? { preset: "custom", start: s || undefined, end: e || undefined } : ANY_DATE);
  return (
    <Section title={title} showClear={isDateActive(value)} onClear={() => onChange(ANY_DATE)}>
      <div className="flex flex-wrap gap-1.5">
        {presets.map((p) => (
          <Chip key={p.value} on={value.preset === p.value} onClick={() => onChange(value.preset === p.value ? ANY_DATE : { preset: p.value })}>
            {p.label}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="space-y-1 text-xs text-muted">
          From
          <input type="date" value={start} onChange={(e) => setCustom(e.target.value, end)} className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-heading" />
        </label>
        <label className="space-y-1 text-xs text-muted">
          To
          <input type="date" value={end} onChange={(e) => setCustom(start, e.target.value)} className="h-10 w-full rounded-lg border border-border bg-card px-2 text-sm text-heading" />
        </label>
      </div>
    </Section>
  );
}

export type FilterPanelState = {
  statuses: string[];
  services: string[];
  payments: string[];
  shoot: ProjectDateRange;
  created: ProjectDateRange;
  staff: string[];
};

export const EMPTY_PANEL: FilterPanelState = { statuses: [], services: [], payments: [], shoot: ANY_DATE, created: ANY_DATE, staff: [] };

export function FilterPanel({
  value,
  onChange,
  serviceOptions,
  staffOptions,
  includeStaff,
}: {
  value: FilterPanelState;
  onChange: (v: FilterPanelState) => void;
  serviceOptions: string[];
  staffOptions: CheckboxOption[];
  includeStaff: boolean;
}) {
  return (
    <div className="space-y-4">
      <Section title="Project status" showClear={value.statuses.length > 0} onClear={() => onChange({ ...value, statuses: [] })}>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map((o) => (
            <Chip key={o.value} on={value.statuses.includes(o.value)} onClick={() => onChange({ ...value, statuses: toggle(value.statuses, o.value) })}>
              {o.label}
            </Chip>
          ))}
        </div>
      </Section>
      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Service" showClear={value.services.length > 0} onClear={() => onChange({ ...value, services: [] })}>
          {serviceOptions.length ? (
            <div className="flex flex-wrap gap-1.5">
              {serviceOptions.map((s) => (
                <Chip key={s} on={value.services.includes(s)} onClick={() => onChange({ ...value, services: toggle(value.services, s) })}>
                  {s}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">No services on these projects.</p>
          )}
        </Section>
        <Section title="Payment" showClear={value.payments.length > 0} onClear={() => onChange({ ...value, payments: [] })}>
          <div className="flex flex-wrap gap-1.5">
            {PAYMENT_STATUS_OPTIONS.map((o) => (
              <Chip key={o.value} on={value.payments.includes(o.value)} onClick={() => onChange({ ...value, payments: toggle(value.payments, o.value) })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Section>
      </div>
      {includeStaff ? (
        <Section title="Staff" showClear={value.staff.length > 0} onClear={() => onChange({ ...value, staff: [] })}>
          <div className="flex flex-wrap gap-1.5">
            {staffOptions.map((o) => (
              <Chip key={o.value} on={value.staff.includes(o.value)} onClick={() => onChange({ ...value, staff: toggle(value.staff, o.value) })}>
                {o.label}
              </Chip>
            ))}
          </div>
        </Section>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        <DateSection title="Shoot date" value={value.shoot} onChange={(shoot) => onChange({ ...value, shoot })} presets={SHOOT_PRESETS} />
        <DateSection title="Created" value={value.created} onChange={(created) => onChange({ ...value, created })} presets={CREATED_PRESETS} />
      </div>
    </div>
  );
}

/** Desktop popover; on phones the same panel opens in a bottom sheet (Staff included there). */
export function FiltersButton({
  activeCount,
  resultsLabel,
  renderPanel,
  onClearAll,
}: {
  activeCount: number;
  resultsLabel: string;
  renderPanel: (opts: { includeStaff: boolean }) => ReactNode;
  onClearAll: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          if (window.matchMedia("(max-width: 767px)").matches) setSheet(true);
          else setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
          open || activeCount ? "border-accent/30 bg-accent-subtle text-accent" : "border-border bg-card text-heading hover:bg-subtle"
        )}
      >
        <Filter className="h-4 w-4" aria-hidden />
        Filters
        {activeCount ? (
          <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 text-accent-foreground" aria-label={`${activeCount} active`}>
            {activeCount}
          </span>
        ) : null}
        <ChevronDown className={cn("hidden h-4 w-4 transition-transform sm:block", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div role="dialog" aria-label="Filter projects" className="absolute left-0 top-full z-40 mt-2 w-[min(44rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="max-h-[min(70vh,36rem)] overflow-y-auto pr-1">{renderPanel({ includeStaff: false })}</div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
            <button
              type="button"
              onClick={onClearAll}
              disabled={!activeCount}
              className="min-h-9 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-subtle disabled:pointer-events-none disabled:opacity-40"
            >
              Clear all
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted" aria-live="polite">
                {resultsLabel}
              </span>
              <Button variant="accent" size="sm" className="min-h-9" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter projects"
        description="Projects must match every filter you set."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11 flex-1" onClick={onClearAll}>
              Clear all
            </Button>
            <Button variant="accent" className="min-h-11 flex-1" onClick={() => setSheet(false)}>
              Show {resultsLabel}
            </Button>
          </div>
        }
      >
        {renderPanel({ includeStaff: true })}
      </BottomSheet>
    </div>
  );
}

// ── Staff, sort, search ─────────────────────────────────────────────────────

export function StaffDropdown({ options, selected, onChange }: { options: CheckboxOption[]; selected: string[]; onChange: (v: string[]) => void }) {
  return (
    <CheckboxDropdown
      label="Staff"
      options={options}
      selected={selected}
      onChange={onChange}
      emptyText="No staff yet"
      className="hidden w-44 shrink-0 md:block [&>div:first-child]:h-10 [&>div:first-child]:rounded-xl"
    />
  );
}

export function SortSelect({ value, onChange }: { value: ProjectsSort; onChange: (v: ProjectsSort) => void }) {
  const label = PROJECTS_SORT_OPTIONS.find((o) => o.value === value)?.label ?? "Sort";
  return (
    <label className="relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-heading hover:bg-subtle focus-within:ring-2 focus-within:ring-accent/30 lg:min-w-48">
      <ArrowUpDown className="h-4 w-4 text-muted" aria-hidden />
      <span className="hidden flex-1 truncate lg:inline">{label}</span>
      <ChevronDown className="hidden h-4 w-4 text-muted lg:block" aria-hidden />
      <select aria-label="Sort projects" value={value} onChange={(e) => onChange(e.target.value as ProjectsSort)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {PROJECTS_SORT_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ProjectSearch({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  return (
    <label className={cn("relative block min-w-0", className)}>
      <span className="sr-only">Search projects</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search projects…"
        className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-8 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
      />
      {value ? (
        <button type="button" onClick={() => onChange("")} aria-label="Clear search" className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-heading">
          <X className="h-4 w-4" aria-hidden />
        </button>
      ) : null}
    </label>
  );
}

export type ActiveChip = { key: string; label: string; clear: () => void };

export function ActiveChips({ chips, onClearAll }: { chips: ActiveChip[]; onClearAll: () => void }) {
  if (!chips.length) return null;
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Active filters">
      {chips.map((c) => (
        <span key={c.key} className="inline-flex h-8 max-w-[20rem] items-center gap-1 rounded-lg border border-accent/25 bg-accent-subtle/70 pl-2.5 pr-0.5 text-sm font-medium text-accent">
          <span className="truncate" title={c.label}>
            {c.label}
          </span>
          <button type="button" onClick={c.clear} aria-label={`Remove filter: ${c.label}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent/10">
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClearAll} className="h-8 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-accent-subtle">
        Clear All
      </button>
    </div>
  );
}
