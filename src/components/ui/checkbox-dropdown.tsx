"use client";

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CheckboxOption {
  value: string;
  label: string;
  /** Optional secondary line (e.g. company, address). */
  hint?: string;
}

/**
 * Close a popover on outside click or Escape. Shared by the filter dropdowns.
 */
export function useDismiss(
  open: boolean,
  ref: React.RefObject<HTMLElement | null>,
  onClose: () => void
) {
  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, ref, onClose]);
}

/**
 * Filter trigger styled like `<Select>`: shows the label (or the active values)
 * and an inline clear button when something is selected.
 */
export function FilterTrigger({
  label,
  summary,
  active,
  open,
  onToggle,
  onClear,
  controls,
}: {
  label: string;
  summary: string | null;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  onClear: () => void;
  controls: string;
}) {
  return (
    <div
      className={cn(
        "flex h-10 w-full items-center rounded-lg border bg-white surface-dark:bg-card text-sm text-foreground",
        active ? "border-accent/60" : "border-border"
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={controls}
        className="flex h-full min-w-0 flex-1 items-center gap-1.5 rounded-lg px-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className={cn("shrink-0", active ? "text-muted" : "text-foreground")}>
          {label}
          {active ? ":" : ""}
        </span>
        {active && summary ? (
          <span className="truncate font-medium text-heading" title={summary}>
            {summary}
          </span>
        ) : null}
        {!active ? <ChevronDown className="ml-auto h-4 w-4 shrink-0 text-muted" /> : null}
      </button>
      {active ? (
        <button
          type="button"
          onClick={onClear}
          aria-label={`Clear ${label} filter`}
          className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-slate-100 hover:text-heading surface-dark:hover:bg-subtle"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}

export function summarizeSelection(labels: string[], max = 2): string | null {
  if (!labels.length) return null;
  if (labels.length <= max) return labels.join(", ");
  return `${labels.slice(0, max).join(", ")} +${labels.length - max}`;
}

/** Multi-select dropdown with checkboxes. Empty selection = no filter ("All"). */
export function CheckboxDropdown({
  label,
  options,
  selected,
  onChange,
  searchable,
  emptyText = "No options",
  footer,
  className,
}: {
  label: string;
  options: CheckboxOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Show a search box (defaults on for > 8 options). */
  searchable?: boolean;
  emptyText?: string;
  footer?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(open, ref, () => setOpen(false));

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const showSearch = searchable ?? options.length > 8;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) =>
      `${o.label} ${o.hint ?? ""}`.toLowerCase().includes(q)
    );
  }, [options, query]);

  const selectedLabels = useMemo(
    () =>
      selected.map((v) => options.find((o) => o.value === v)?.label ?? v),
    [selected, options]
  );

  function toggle(value: string) {
    onChange(
      selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]
    );
  }

  return (
    <div ref={ref} className={cn("relative", className)}>
      <FilterTrigger
        label={label}
        summary={summarizeSelection(selectedLabels)}
        active={selected.length > 0}
        open={open}
        onToggle={() => setOpen((o) => !o)}
        onClear={() => onChange([])}
        controls={listId}
      />
      {open ? (
        <div
          id={listId}
          className="absolute left-0 z-30 mt-2 w-full min-w-64 rounded-xl border border-border bg-white surface-dark:bg-card p-2 shadow-lg"
        >
          {showSearch ? (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                className="h-9 w-full rounded-md border border-border bg-white surface-dark:bg-card pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              />
            </div>
          ) : null}
          <ul className="max-h-64 space-y-0.5 overflow-y-auto" role="listbox" aria-multiselectable>
            {visible.map((o) => (
              <li key={o.value}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 surface-dark:hover:bg-subtle">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={selectedSet.has(o.value)}
                    onChange={() => toggle(o.value)}
                  />
                  <span className="min-w-0">
                    <span className="block truncate">{o.label}</span>
                    {o.hint ? <span className="block truncate text-xs text-muted">{o.hint}</span> : null}
                  </span>
                </label>
              </li>
            ))}
            {visible.length === 0 ? (
              <li className="px-2 py-2 text-xs text-muted">{query ? "No matches" : emptyText}</li>
            ) : null}
          </ul>
          <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
            <span className="text-muted">
              {selected.length ? `${selected.length} selected` : "All"}
            </span>
            {selected.length ? (
              <button
                type="button"
                className="font-medium text-accent hover:underline"
                onClick={() => onChange([])}
              >
                Clear
              </button>
            ) : null}
          </div>
          {footer}
        </div>
      ) : null}
    </div>
  );
}
