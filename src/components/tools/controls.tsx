"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Form controls for the free tools. Follows Vercel's Web Interface Guidelines: labelled
 * inputs, decimal inputmode, paste allowed, inline error text, visible focus, 44px targets.
 */

const FIELD =
  "w-full min-w-0 rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5 text-[0.95rem] tabular-nums text-[#0F172A] shadow-[0_1px_0_rgba(15,23,42,0.02)] outline-none transition-[border-color,box-shadow] placeholder:text-[#94A3B8] focus-visible:border-[#818CF8] focus-visible:ring-4 focus-visible:ring-[#4F46E5]/12";

export function Fieldset({ legend, hint, children, className }: { legend: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <fieldset className={cn("min-w-0 border-t border-[#E2E8F0] pt-6 first:border-t-0 first:pt-0", className)}>
      <legend className="float-left w-full text-base font-semibold text-[#0F172A]">{legend}</legend>
      {hint ? <p className="clear-both pt-1 text-sm leading-relaxed text-[#64748B]">{hint}</p> : null}
      <div className="clear-both grid gap-4 pt-4 sm:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/**
 * Numeric input that keeps the user's in-progress text (e.g. "1." or "") while typing and
 * only commits a clamped number. Shows inline guidance instead of silently rejecting input.
 */
export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  min = 0,
  max = 1_000_000,
  step = "any",
  hint,
  wide,
  name,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  prefix?: string;
  suffix?: string;
  min?: number;
  max?: number;
  step?: number | "any";
  hint?: ReactNode;
  wide?: boolean;
  name?: string;
}) {
  const id = useId();
  const [text, setText] = useState(String(value));
  const [error, setError] = useState<string | null>(null);

  // Sync when the value changes from outside (reset, preset, shared link).
  useEffect(() => {
    setText((t) => (Number(t) === value ? t : String(value)));
  }, [value]);

  function commit(raw: string) {
    setText(raw);
    if (raw.trim() === "") {
      setError(null);
      onChange(0);
      return;
    }
    const n = Number(raw.replace(/[$,\s]/g, ""));
    if (!Number.isFinite(n)) {
      setError("Enter a number, like 2 or 2.5.");
      return;
    }
    if (n < min) {
      setError(`Use ${min} or more.`);
      onChange(min);
      return;
    }
    if (n > max) {
      setError(`Use ${max.toLocaleString("en-US")} or less.`);
      onChange(max);
      return;
    }
    setError(null);
    onChange(n);
  }

  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={id} className="block text-sm font-medium text-[#334155]">
        {label}
      </label>
      <div className="relative mt-1.5">
        {prefix ? <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#64748B]">{prefix}</span> : null}
        <input
          id={id}
          name={name ?? id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={text}
          step={step}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => {
            if (text.trim() === "" || !Number.isFinite(Number(text.replace(/[$,\s]/g, "")))) setText(String(value));
            setError(null);
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || hint ? `${id}-desc` : undefined}
          className={cn(FIELD, prefix && "pl-7", suffix && "pr-14", error && "border-rose-300 focus-visible:border-rose-400 focus-visible:ring-rose-500/15")}
        />
        {suffix ? <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-[#64748B]">{suffix}</span> : null}
      </div>
      {error || hint ? (
        <p id={`${id}-desc`} className={cn("mt-1.5 text-xs leading-relaxed", error ? "text-rose-600" : "text-[#64748B]")} aria-live={error ? "polite" : undefined}>
          {error ?? hint}
        </p>
      ) : null}
    </div>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  autoComplete = "off",
  wide,
  multiline,
  maxLength = 200,
}: {
  label: string;
  value: string;
  onChange: (s: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "tel" | "url" | "date";
  autoComplete?: string;
  wide?: boolean;
  multiline?: boolean;
  maxLength?: number;
}) {
  const id = useId();
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")}>
      <label htmlFor={id} className="block text-sm font-medium text-[#334155]">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className={cn(FIELD, "mt-1.5 resize-y leading-relaxed")}
        />
      ) : (
        <input
          id={id}
          type={type}
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={type === "email" || type === "url" ? false : undefined}
          onChange={(e) => onChange(e.target.value)}
          className={cn(FIELD, "mt-1.5")}
        />
      )}
    </div>
  );
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  wide,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  wide?: boolean;
}) {
  const id = useId();
  return (
    <div className={cn("min-w-0", wide && "sm:col-span-2")} role="radiogroup" aria-labelledby={id}>
      <p id={id} className="text-sm font-medium text-[#334155]">
        {label}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-1">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            onClick={() => onChange(o.value)}
            className={cn(
              "min-h-10 flex-1 touch-manipulation whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-[background-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]",
              value === o.value ? "bg-white text-[#0F172A] shadow-sm ring-1 ring-[#E2E8F0]" : "text-[#64748B] hover:text-[#0F172A]"
            )}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: ReactNode }) {
  const id = useId();
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-start gap-3">
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
        <span className="h-6 w-10 rounded-full bg-[#CBD5E1] transition-colors peer-checked:bg-[#4F46E5] peer-focus-visible:ring-2 peer-focus-visible:ring-[#4F46E5] peer-focus-visible:ring-offset-2" />
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-[#0F172A]">{label}</span>
        {description ? <span className="mt-0.5 block text-xs leading-relaxed text-[#64748B]">{description}</span> : null}
      </span>
    </label>
  );
}
