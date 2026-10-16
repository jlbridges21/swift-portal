"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Download, Eye, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Shared layout for the free tools: a short form on the left and the finished, branded
 * document on the right, updating as the visitor types. One obvious action: Download PDF.
 * On phones the preview follows the form and a bottom bar keeps Download in reach.
 */
export function ToolStudio({
  id,
  form,
  preview,
  barLabel,
  barValue,
  onDownload,
  busy,
  error,
  onReset,
}: {
  id: string;
  form: ReactNode;
  preview: ReactNode;
  barLabel: string;
  barValue: string;
  onDownload: () => void;
  busy: boolean;
  error: string | null;
  onReset: () => void;
}) {
  const previewRef = useRef<HTMLDivElement>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Hide the phone bar once the preview (with its own Download button) is on screen.
  useEffect(() => {
    const el = previewRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([e]) => setPreviewVisible(Boolean(e?.isIntersecting)), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div className="tool-layout grid gap-8 lg:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)] lg:gap-10">
      <div className="tool-no-print min-w-0 space-y-5">{form}</div>

      <div ref={previewRef} id={`${id}-preview`} className="print-show min-w-0 scroll-mt-28 lg:sticky lg:top-24 lg:max-h-[calc(100dvh-7rem)] lg:self-start lg:overflow-y-auto lg:overscroll-contain lg:rounded-3xl">
        <div className="-mx-2 rounded-3xl bg-[#E9EDF5] p-2 sm:mx-0 sm:p-5">
          <div className="tool-no-print mb-3 flex flex-wrap items-center justify-between gap-3 px-1">
            <p className="flex items-center gap-2 text-sm font-medium text-[#475569]">
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden />
              Live preview
            </p>
            <DownloadButton onClick={onDownload} busy={busy} />
          </div>
          {error ? (
            <p className="tool-no-print mb-3 rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">
              {error}
            </p>
          ) : null}
          {preview}
          <div className="tool-no-print mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-xs text-[#475569]">
            <span>Saved on this device only. Nothing is sent to us.</span>
            <button type="button" onClick={onReset} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 font-medium hover:bg-white/70 hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Start over
            </button>
          </div>
        </div>
      </div>

      {/* Phone bar: the result and the two things you can do with it. */}
      <div
        className={cn(
          "tool-no-print fixed inset-x-0 bottom-0 z-30 border-t border-[#E2E8F0] bg-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_-20px_rgba(15,23,42,0.35)] backdrop-blur transition-transform lg:hidden",
          previewVisible && "translate-y-full"
        )}
        aria-hidden={previewVisible || undefined}
      >
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-[#64748B]">{barLabel}</p>
            <p className="truncate text-lg font-bold tabular-nums text-[#0F172A]">{barValue}</p>
          </div>
          <a
            href={`#${id}-preview`}
            tabIndex={previewVisible ? -1 : undefined}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-[#E2E8F0] px-3 text-sm font-semibold text-[#334155] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
          >
            <Eye className="h-4 w-4" aria-hidden /> Preview
          </a>
          <DownloadButton onClick={onDownload} busy={busy} compact tabIndex={previewVisible ? -1 : undefined} />
        </div>
      </div>
    </div>
  );
}

export function DownloadButton({ onClick, busy, compact, tabIndex }: { onClick: () => void; busy: boolean; compact?: boolean; tabIndex?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      tabIndex={tabIndex}
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#4F46E5] font-semibold text-white shadow-md shadow-indigo-500/25 transition-colors hover:bg-[#4338CA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 disabled:opacity-70",
        compact ? "px-3.5 text-sm" : "px-5 text-[0.95rem]"
      )}
    >
      <Download className="h-4 w-4" aria-hidden />
      {busy ? "Creating…" : compact ? "Download" : "Download PDF"}
    </button>
  );
}

/** One numbered step of the form. The steps are a real sequence, so they're numbered. */
export function Step({ n, title, hint, children, aside }: { n: number; title: string; hint?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <section aria-labelledby={`step-${n}`} className="rounded-3xl border border-[#E2E8F0] bg-white p-5 sm:p-7">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#4F46E5] text-sm font-semibold text-white" aria-hidden>
            {n}
          </span>
          <div>
            <h2 id={`step-${n}`} className="text-lg font-semibold tracking-tight text-[#0F172A]">
              {title}
            </h2>
            {hint ? <p className="mt-0.5 text-sm leading-relaxed text-[#64748B]">{hint}</p> : null}
          </div>
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

/** Closed by default: the extra settings most people never need. */
export function MoreOptions({ label, children, defaultOpen }: { label: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details className="group mt-5 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] open:bg-white" open={defaultOpen}>
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 text-sm font-semibold text-[#334155] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="h-4 w-4 text-[#64748B] transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="grid gap-4 border-t border-[#E2E8F0] px-4 pb-5 pt-4 sm:grid-cols-2">{children}</div>
    </details>
  );
}

/** Large, tappable choice cards (job type, template). */
export function ChoiceGrid<T extends string>({
  label,
  value,
  options,
  onChange,
  columns = 3,
}: {
  label: string;
  value: T;
  options: { value: T; label: string; icon?: ReactNode }[];
  onChange: (v: T) => void;
  columns?: 2 | 3 | 4;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-2 gap-2", columns === 3 && "sm:grid-cols-3", columns === 4 && "sm:grid-cols-4")}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex min-h-14 touch-manipulation items-center gap-2.5 rounded-2xl border px-3 py-2.5 text-left text-sm font-medium transition-[background-color,border-color,color,box-shadow] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]",
              on ? "border-[#4F46E5] bg-[#EEF2FF] text-[#312E81] shadow-[0_0_0_1px_#4F46E5]" : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#C7D2FE]"
            )}
          >
            {o.icon ? <span className={cn("shrink-0", on ? "text-[#4F46E5]" : "text-[#94A3B8]")}>{o.icon}</span> : null}
            <span className="leading-snug">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** Checkbox chips for optional extras. */
export function ChipToggles({ label, options, selected, onToggle }: { label: string; options: { id: string; label: string; note?: string }[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium text-[#334155]">{label}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o.id);
          return (
            <label
              key={o.id}
              className={cn(
                "inline-flex min-h-11 cursor-pointer touch-manipulation items-center gap-2 rounded-full border px-4 text-sm font-medium transition-colors focus-within:ring-2 focus-within:ring-[#4F46E5]",
                on ? "border-[#4F46E5] bg-[#4F46E5] text-white" : "border-[#E2E8F0] bg-white text-[#334155] hover:border-[#C7D2FE]"
              )}
            >
              <input type="checkbox" className="sr-only" checked={on} onChange={() => onToggle(o.id)} />
              <span aria-hidden>{on ? "✓" : "+"}</span>
              {o.label}
              {o.note ? <span className={cn("text-xs", on ? "text-indigo-100" : "text-[#64748B]")}>{o.note}</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/** The photographer's own answer (never printed on the client document). */
export function ResultCard({ label, value, children }: { label: string; value: string; children?: ReactNode }) {
  return (
    <div className="mt-5 rounded-2xl bg-[#0B1124] p-5 text-white" aria-live="polite">
      <p className="text-sm text-slate-300">{label}</p>
      <p className="mt-1 text-4xl font-bold tracking-tight tabular-nums">{value}</p>
      {children ? <div className="mt-2 text-sm leading-relaxed text-slate-300">{children}</div> : null}
    </div>
  );
}
