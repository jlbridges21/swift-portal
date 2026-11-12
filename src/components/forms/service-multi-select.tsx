"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { serviceTypeForNames } from "@/lib/project-service-names";

export type ServiceOption = {
  /** business_services.id. Null for the empty-catalog fallback list. */
  id: string | null;
  name: string;
  /** Deactivated: shown only when already selected; cannot be newly picked. */
  inactive?: boolean;
};

const optionKey = (o: Pick<ServiceOption, "id" | "name">) => o.id ?? `name:${o.name}`;

type Props = {
  id: string;
  /**
   * Legacy single-value field name ("service_requested" / "service_type"). Its
   * hidden input carries the selected names joined ("A + B"), so older readers
   * of the form keep working. `service_ids` and `service_names` carry the list.
   */
  name?: string;
  required?: boolean;
  placeholder?: string;
  /** Provided options; otherwise loaded from /api/catalog/services (active only). */
  options?: ServiceOption[];
  /** Controlled selection (option keys = ids, or "name:<name>" for the fallback list). */
  value?: string[];
  onChange?: (keys: string[], selected: ServiceOption[]) => void;
  disabled?: boolean;
  className?: string;
  /** "md" = 40px (admin forms), "lg" = 44px (public / touch forms). */
  size?: "md" | "lg";
  "aria-describedby"?: string;
};

/**
 * Multi-select for project services: checkboxes in a dropdown that stays open
 * while several are picked, removable chips in the field, keyboard support
 * (arrows, Enter/Space, Home/End, Escape, type to search), and a popover
 * portaled to <body> so it is never clipped by a card or scroll container.
 * Uses accent tokens, so public pages show the business's brand color.
 * Never shows prices.
 */
export function ServiceMultiSelect({
  id,
  name = "service_requested",
  required,
  placeholder = "Select services",
  options: providedOptions,
  value,
  onChange,
  disabled,
  className,
  size = "md",
  "aria-describedby": describedBy,
}: Props) {
  const [loaded, setLoaded] = useState<ServiceOption[] | null>(providedOptions ?? null);
  const [internal, setInternal] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [invalid, setInvalid] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number; maxHeight: number; above: boolean } | null>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selectedKeys = value ?? internal;

  useEffect(() => {
    if (providedOptions) {
      setLoaded(providedOptions);
      return;
    }
    let cancelled = false;
    fetch("/api/catalog/services", { credentials: "include" })
      .then((r) => r.json())
      .then((data: { options?: { id?: string | null; value: string; label: string }[] }) => {
        if (cancelled || !Array.isArray(data.options)) return;
        setLoaded(data.options.map((o) => ({ id: o.id ?? null, name: o.label || o.value })));
      })
      .catch(() => {
        if (!cancelled) setLoaded([]);
      });
    return () => {
      cancelled = true;
    };
  }, [providedOptions]);

  const allOptions = useMemo(() => loaded ?? [], [loaded]);
  const byKey = useMemo(() => new Map(allOptions.map((o) => [optionKey(o), o])), [allOptions]);
  const selected = useMemo(
    () => selectedKeys.map((k) => byKey.get(k)).filter((o): o is ServiceOption => Boolean(o)),
    [byKey, selectedKeys]
  );
  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  // Inactive services appear only when already selected (historical links).
  const pickable = useMemo(
    () => allOptions.filter((o) => !o.inactive || selectedSet.has(optionKey(o))),
    [allOptions, selectedSet]
  );
  const showSearch = pickable.length > 8;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? pickable.filter((o) => o.name.toLowerCase().includes(q)) : pickable;
  }, [pickable, query]);

  const commit = useCallback(
    (keys: string[]) => {
      // Keep catalog order so chips, line items and sections read the same way.
      const order = new Map(allOptions.map((o, i) => [optionKey(o), i]));
      const sorted = [...new Set(keys)].sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
      if (value === undefined) setInternal(sorted);
      if (sorted.length) setInvalid(false);
      onChange?.(sorted, sorted.map((k) => byKey.get(k)).filter((o): o is ServiceOption => Boolean(o)));
    },
    [allOptions, byKey, onChange, value]
  );

  function toggle(option: ServiceOption) {
    const key = optionKey(option);
    if (selectedSet.has(key)) {
      commit(selectedKeys.filter((k) => k !== key));
    } else if (!option.inactive) {
      commit([...selectedKeys, key]);
    }
  }

  const close = useCallback((focusTrigger = false) => {
    setOpen(false);
    setQuery("");
    if (focusTrigger) buttonRef.current?.focus();
  }, []);

  function openList() {
    if (disabled) return;
    setOpen(true);
    const firstSelected = visible.findIndex((o) => selectedSet.has(optionKey(o)));
    setActiveIndex(firstSelected >= 0 ? firstSelected : 0);
  }

  const reposition = useCallback(() => {
    const field = fieldRef.current;
    if (!field) return;
    const rect = field.getBoundingClientRect();
    const gap = 6;
    const margin = 12;
    const below = window.innerHeight - rect.bottom - gap - margin;
    const aboveSpace = rect.top - gap - margin;
    const above = below < 220 && aboveSpace > below;
    const maxHeight = Math.max(160, Math.min(340, above ? aboveSpace : below));
    const width = Math.min(Math.max(rect.width, 256), window.innerWidth - margin * 2);
    const left = Math.min(Math.max(margin, rect.left), window.innerWidth - width - margin);
    setPosition({ top: above ? rect.top - gap : rect.bottom + gap, left, width, maxHeight, above });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition, selectedKeys.length]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent | TouchEvent) {
      const target = e.target as Node;
      if (fieldRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
    };
  }, [open, close]);

  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus();
  }, [open, showSearch]);

  useEffect(() => {
    if (!open) return;
    popoverRef.current
      ?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function onKeyDown(e: ReactKeyboardEvent) {
    if (!open) {
      // Chip remove buttons handle their own Enter / Space.
      if (e.target !== buttonRef.current) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openList();
      }
      if (e.key === "Backspace" && selectedKeys.length && e.target === buttonRef.current) {
        e.preventDefault();
        commit(selectedKeys.slice(0, -1));
      }
      return;
    }
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIndex((i) => Math.min(visible.length - 1, i + 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(0, i - 1));
        break;
      case "Home":
        e.preventDefault();
        setActiveIndex(0);
        break;
      case "End":
        e.preventDefault();
        setActiveIndex(Math.max(0, visible.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (visible[activeIndex]) toggle(visible[activeIndex]);
        break;
      case " ":
        // Space types into the search box; elsewhere it toggles.
        if (e.target === searchRef.current) return;
        e.preventDefault();
        if (visible[activeIndex]) toggle(visible[activeIndex]);
        break;
      case "Escape":
        e.preventDefault();
        e.stopPropagation();
        close(true);
        break;
      case "Tab":
        close(false);
        break;
    }
  }

  const names = selected.map((o) => o.name);
  const ids = selected.map((o) => o.id).filter((v): v is string => Boolean(v));
  const activeOptionId = open && visible[activeIndex] ? `${listId}-opt-${activeIndex}` : undefined;
  const summary = names.length ? `${names.length} service${names.length === 1 ? "" : "s"} selected` : placeholder;

  return (
    <div className={cn("relative", className)}>
      <div
        ref={fieldRef}
        onClick={(e) => {
          if (e.target === e.currentTarget) (open ? close(false) : openList());
        }}
        onKeyDown={onKeyDown}
        className={cn(
          "flex w-full cursor-pointer flex-wrap items-center gap-1.5 rounded-lg border bg-white py-1 pl-2 pr-1 text-sm text-foreground transition-colors surface-dark:bg-card",
          size === "lg" ? "min-h-11" : "min-h-10",
          open ? "border-accent ring-2 ring-accent/30" : invalid ? "border-red-400" : "border-border",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        {selected.map((option) => (
          <span
            key={optionKey(option)}
            className="inline-flex max-w-full items-center gap-1 rounded-full bg-accent-subtle py-0.5 pl-2.5 pr-1 text-xs font-medium text-accent"
          >
            <span className="truncate" title={option.inactive ? `${option.name} (no longer offered)` : option.name}>
              {option.name}
              {option.inactive ? <span className="font-normal opacity-75"> · inactive</span> : null}
            </span>
            <button
              type="button"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                commit(selectedKeys.filter((k) => k !== optionKey(option)));
                buttonRef.current?.focus();
              }}
              aria-label={`Remove ${option.name}`}
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ))}
        <button
          ref={buttonRef}
          id={id}
          type="button"
          role="combobox"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-activedescendant={showSearch ? undefined : activeOptionId}
          aria-describedby={[describedBy, invalid ? `${listId}-error` : null].filter(Boolean).join(" ") || undefined}
          aria-invalid={invalid || undefined}
          aria-required={required || undefined}
          onClick={() => (open ? close(false) : openList())}
          className={cn(
            "flex min-w-[7rem] flex-1 items-center justify-between gap-2 self-stretch rounded-md px-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
            names.length ? "text-muted" : "text-muted/90"
          )}
        >
          <span className={cn("truncate", names.length ? "sr-only" : "")}>{summary}</span>
          <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </button>
      </div>

      {/* Form values. The legacy field keeps "A + B" for older readers; the lists drive the server. */}
      <input type="hidden" name={name} value={serviceTypeForNames(names)} />
      <input type="hidden" name="service_ids" value={JSON.stringify(ids)} />
      <input type="hidden" name="service_names" value={JSON.stringify(names)} />
      {required ? (
        <input
          tabIndex={-1}
          aria-hidden
          required
          value={names.length ? "selected" : ""}
          onChange={() => undefined}
          onInvalid={(e) => {
            e.preventDefault();
            setInvalid(true);
            buttonRef.current?.focus();
          }}
          className="pointer-events-none absolute bottom-0 left-4 h-px w-px opacity-0"
        />
      ) : null}

      {invalid ? (
        <p id={`${listId}-error`} role="alert" className="mt-1.5 text-xs font-medium text-red-600">
          Choose at least one service.
        </p>
      ) : null}

      {open && position && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={popoverRef}
              onKeyDown={onKeyDown}
              style={{
                position: "fixed",
                left: position.left,
                width: position.width,
                ...(position.above ? { bottom: window.innerHeight - position.top } : { top: position.top }),
              }}
              className="z-[80] flex flex-col overflow-hidden rounded-xl border border-border bg-white shadow-xl ring-1 ring-black/[0.04] surface-dark:bg-card"
            >
              {showSearch ? (
                <div className="relative border-b border-border p-2">
                  <Search className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => {
                      setQuery(e.target.value);
                      setActiveIndex(0);
                    }}
                    role="searchbox"
                    aria-label="Search services"
                    aria-controls={listId}
                    aria-activedescendant={activeOptionId}
                    placeholder="Search services…"
                    className="h-9 w-full rounded-md border border-border bg-white pl-8 pr-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent surface-dark:bg-card"
                  />
                </div>
              ) : null}
              <ul
                id={listId}
                role="listbox"
                aria-multiselectable="true"
                aria-label="Services"
                className="overflow-y-auto overscroll-contain p-1.5"
                style={{ maxHeight: position.maxHeight - (showSearch ? 100 : 48) }}
              >
                {loaded === null ? (
                  <li className="px-3 py-2 text-sm text-muted">Loading services…</li>
                ) : visible.length === 0 ? (
                  <li className="px-3 py-2 text-sm text-muted">{query ? "No matching services" : "No services available"}</li>
                ) : (
                  visible.map((option, index) => {
                    const checked = selectedSet.has(optionKey(option));
                    return (
                      <li
                        key={optionKey(option)}
                        id={`${listId}-opt-${index}`}
                        data-index={index}
                        role="option"
                        aria-selected={checked}
                        aria-disabled={option.inactive && !checked ? true : undefined}
                        onMouseEnter={() => setActiveIndex(index)}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => toggle(option)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm",
                          index === activeIndex ? "bg-slate-100 surface-dark:bg-subtle" : "",
                          checked ? "font-medium text-heading" : "text-foreground"
                        )}
                      >
                        <span
                          aria-hidden
                          className={cn(
                            "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                            checked ? "border-accent bg-accent text-accent-foreground" : "border-slate-300 bg-white surface-dark:bg-card"
                          )}
                        >
                          {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                        </span>
                        <span className="min-w-0 flex-1 truncate">{option.name}</span>
                        {option.inactive ? <span className="shrink-0 text-xs text-muted">Inactive</span> : null}
                      </li>
                    );
                  })
                )}
              </ul>
              <div className="flex items-center justify-between gap-2 border-t border-border px-3 py-2 text-xs">
                <span className="text-muted" aria-live="polite">
                  {names.length ? `${names.length} selected` : "Choose one or more"}
                </span>
                <div className="flex items-center gap-3">
                  {names.length ? (
                    <button type="button" className="font-medium text-muted hover:text-heading" onClick={() => commit([])}>
                      Clear
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-md bg-accent px-2.5 py-1 font-semibold text-accent-foreground hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1"
                    onClick={() => close(true)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
