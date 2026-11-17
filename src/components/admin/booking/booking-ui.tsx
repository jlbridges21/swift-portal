"use client";

import type { ReactNode } from "react";
import { ChevronDown, Info } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { formatDuration, type DayHours, type WeeklyHours } from "@/lib/booking/settings";

/** One settings card: icon tile, title, helper line, content. Matches Settings cards. */
export function BookingCard({
  icon: Icon,
  title,
  description,
  children,
  action,
  className,
  id,
}: {
  icon: LucideIcon;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={cn("scroll-mt-24 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5", className)}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent" aria-hidden>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-heading">{title}</h3>
          {description ? <p className="mt-0.5 text-[13px] leading-snug text-muted">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </section>
  );
}

export function FieldLabel({ children, hint, htmlFor }: { children: ReactNode; hint?: string; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 flex items-center gap-1 text-xs font-medium text-foreground">
      {children}
      {hint ? (
        <span title={hint} className="inline-flex text-muted" aria-label={hint}>
          <Info className="h-3.5 w-3.5" aria-hidden />
        </span>
      ) : null}
    </label>
  );
}

export function NativeSelect({
  value,
  onChange,
  options,
  id,
  className,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  id?: string;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <select
        id={id}
        aria-label={ariaLabel}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full appearance-none rounded-lg border border-border bg-card px-3 pr-8 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
    </div>
  );
}

export function minuteOptions(values: number[], zeroLabel = "None") {
  return values.map((v) => ({ value: String(v), label: v === 0 ? zeroLabel : formatDuration(v).replace("hr", v >= 120 ? "hrs" : "hr") }));
}

export function MinutesSelect(props: {
  value: number;
  onChange: (value: number) => void;
  values: number[];
  zeroLabel?: string;
  id?: string;
  ariaLabel?: string;
  className?: string;
}) {
  const values = props.values.includes(props.value) ? props.values : [...props.values, props.value].sort((a, b) => a - b);
  return (
    <NativeSelect
      id={props.id}
      ariaLabel={props.ariaLabel}
      className={props.className}
      value={String(props.value)}
      onChange={(v) => props.onChange(Number(v))}
      options={minuteOptions(values, props.zeroLabel)}
    />
  );
}

/** Radio card used for modes and models. */
export function OptionCard({
  selected,
  onSelect,
  title,
  description,
  icon: Icon,
  name,
}: {
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  icon?: LucideIcon;
  name: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors",
        selected ? "border-accent bg-accent-subtle/60 ring-1 ring-accent" : "border-border bg-card hover:bg-subtle"
      )}
    >
      <input type="radio" name={name} checked={selected} onChange={onSelect} className="mt-1 h-4 w-4 shrink-0 accent-accent" />
      {Icon ? <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-accent" : "text-muted")} aria-hidden /> : null}
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-heading">{title}</span>
        <span className="mt-0.5 block text-[13px] leading-snug text-muted">{description}</span>
      </span>
    </label>
  );
}

export function ToggleRow({
  checked,
  onChange,
  label,
  description,
  id,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  id: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} className="mt-0.5" />
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-sm font-medium text-heading">{label}</span>
        {description ? <span className="block text-xs leading-snug text-muted">{description}</span> : null}
      </label>
    </div>
  );
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function timeOptions() {
  const out: { value: string; label: string }[] = [];
  for (let m = 5 * 60; m <= 22 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const value = `${String(h).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const label = `${((h + 11) % 12) + 1}:${String(mm).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
    out.push({ value, label });
  }
  return out;
}
const TIME_OPTIONS = timeOptions();

/**
 * Working hours. Simple by default: pick days + one From/To for all of them. "Different hours
 * per day" reveals a row per day (progressive disclosure).
 */
export function WeeklyHoursEditor({
  value,
  onChange,
  idPrefix,
  perDay,
  onPerDayChange,
}: {
  value: WeeklyHours;
  onChange: (next: WeeklyHours) => void;
  idPrefix: string;
  perDay: boolean;
  onPerDayChange: (next: boolean) => void;
}) {
  const firstOn = value.find((d) => d.enabled) ?? value[1];
  const uniform = value.every((d) => !d.enabled || (d.start === firstOn.start && d.end === firstOn.end));
  const setDay = (i: number, patch: Partial<DayHours>) => onChange(value.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  const setAll = (patch: Partial<DayHours>) => onChange(value.map((d) => ({ ...d, ...patch })));
  const timeOpts = (current: string) =>
    TIME_OPTIONS.some((o) => o.value === current) ? TIME_OPTIONS : [...TIME_OPTIONS, { value: current, label: current }];

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Working days">
        {WEEK_ORDER.map((i) => (
          <button
            key={i}
            type="button"
            aria-pressed={value[i].enabled}
            onClick={() => setDay(i, { enabled: !value[i].enabled })}
            className={cn(
              "h-9 min-w-[48px] rounded-lg px-3 text-sm font-semibold transition-colors",
              value[i].enabled ? "bg-accent text-accent-foreground" : "bg-subtle text-muted hover:text-heading"
            )}
          >
            {DAY_SHORT[i]}
          </button>
        ))}
      </div>
      {!perDay ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">From</span>
          <NativeSelect
            ariaLabel="Start time"
            id={`${idPrefix}-from`}
            className="w-32"
            value={firstOn.start}
            onChange={(v) => setAll({ start: v })}
            options={timeOpts(firstOn.start)}
          />
          <span className="text-muted">to</span>
          <NativeSelect
            ariaLabel="End time"
            id={`${idPrefix}-to`}
            className="w-32"
            value={firstOn.end}
            onChange={(v) => setAll({ end: v })}
            options={timeOpts(firstOn.end)}
          />
          {!uniform ? <span className="text-xs text-amber-700">Days currently have different hours.</span> : null}
        </div>
      ) : (
        <div className="space-y-1.5">
          {WEEK_ORDER.filter((i) => value[i].enabled).map((i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
              <span className="w-10 font-medium text-heading">{DAY_SHORT[i]}</span>
              <NativeSelect ariaLabel={`${DAY_SHORT[i]} start`} className="w-32" value={value[i].start} onChange={(v) => setDay(i, { start: v })} options={timeOpts(value[i].start)} />
              <span className="text-muted">to</span>
              <NativeSelect ariaLabel={`${DAY_SHORT[i]} end`} className="w-32" value={value[i].end} onChange={(v) => setDay(i, { end: v })} options={timeOpts(value[i].end)} />
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => onPerDayChange(!perDay)} className="text-xs font-medium text-accent hover:underline">
        {perDay ? "Use the same hours every day" : "Set different hours per day"}
      </button>
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn"; children: ReactNode }) {
  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-xl border px-3.5 py-2.5 text-[13px]",
        tone === "warn"
          ? "border-amber-300 bg-amber-50 text-amber-950 surface-dark:border-amber-500/40 surface-dark:bg-amber-500/10 surface-dark:text-amber-200"
          : "border-accent/20 bg-accent-subtle text-heading"
      )}
    >
      <Info className={cn("mt-0.5 h-4 w-4 shrink-0", tone === "warn" ? "text-amber-600" : "text-accent")} aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function PersonAvatar({ name, url, size = 40, className }: { name: string; url: string | null; size?: number; className?: string }) {
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" width={size} height={size} className={cn("shrink-0 rounded-full object-cover", className)} style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-accent-subtle font-semibold text-accent", className)}
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {initialsOf(name)}
    </span>
  );
}
