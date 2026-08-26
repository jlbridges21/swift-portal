"use client";

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { LANDING_FEATURE_ICON_IDS, type LandingFeatureIconId } from "@/lib/landing-content";
import {
  LANDING_FEATURE_ICON_LABELS,
  LANDING_FEATURE_ICON_MAP,
} from "@/lib/landing-feature-icons";

/**
 * Compact icon control: closed shows current icon + name; opens a portal popover
 * (avoids clipping in scroll/collapsed sections) with filter + grid.
 */
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
  const triggerId = id ?? `${listId}-trigger`;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const SelectedIcon = LANDING_FEATURE_ICON_MAP[value] ?? LANDING_FEATURE_ICON_MAP.CheckCircle2;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...LANDING_FEATURE_ICON_IDS];
    return LANDING_FEATURE_ICON_IDS.filter((iconId) => {
      const label = LANDING_FEATURE_ICON_LABELS[iconId].toLowerCase();
      return iconId.toLowerCase().includes(q) || label.includes(q);
    });
  }, [query]);

  const placePanel = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const width = Math.min(320, Math.max(260, rect.width));
    let left = rect.left;
    if (left + width > window.innerWidth - 8) left = Math.max(8, window.innerWidth - width - 8);
    const spaceBelow = window.innerHeight - rect.bottom;
    const preferBelow = spaceBelow >= 280 || spaceBelow >= rect.top;
    const top = preferBelow ? rect.bottom + 6 : Math.max(8, rect.top - 286);
    setCoords({ top, left, width });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    placePanel();
    const onReposition = () => placePanel();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, placePanel]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const t = window.setTimeout(() => searchRef.current?.focus(), 20);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: MouseEvent) {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    return () => document.removeEventListener("mousedown", onPointer);
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const option = panelRef.current?.querySelector<HTMLElement>(`[role="option"][tabindex="0"]`);
    option?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  function select(iconId: LandingFeatureIconId) {
    onChange(iconId);
    setOpen(false);
    triggerRef.current?.focus();
  }

  function onTriggerKeyDown(e: KeyboardEvent<HTMLButtonElement>) {
    if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setOpen(true);
    }
  }

  function onPanelKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (!filtered.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const iconId = filtered[activeIndex];
      if (iconId) select(iconId);
    }
  }

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        id={triggerId}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${listId}-panel`}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="flex min-h-11 w-full items-center gap-3 rounded-lg border border-border bg-white px-3 py-2 text-left transition hover:border-accent/40"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#3B82F6]/10">
          <SelectedIcon className="h-4 w-4 text-[#3B82F6]" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-foreground">
            {LANDING_FEATURE_ICON_LABELS[value]}
          </span>
          <span className="block truncate text-xs text-muted">{value}</span>
        </span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>

      {open && coords
        ? createPortal(
            <div
              ref={panelRef}
              id={`${listId}-panel`}
              role="dialog"
              aria-label="Choose feature icon"
              className="fixed z-[120] rounded-xl border border-border bg-white p-3 shadow-2xl"
              style={{ top: coords.top, left: coords.left, width: coords.width }}
              onKeyDown={onPanelKeyDown}
            >
              <label htmlFor={`${listId}-search`} className="sr-only">
                Filter icons
              </label>
              <input
                ref={searchRef}
                id={`${listId}-search`}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Filter icons…"
                className="mb-2 w-full rounded-md border border-border bg-card px-3 py-2 text-sm"
              />
              <div
                role="listbox"
                aria-label="Feature icons"
                className="grid max-h-56 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4"
              >
                {filtered.map((iconId, index) => {
                  const Icon = LANDING_FEATURE_ICON_MAP[iconId];
                  const selected = iconId === value;
                  const active = index === activeIndex;
                  return (
                    <button
                      key={iconId}
                      type="button"
                      role="option"
                      aria-selected={selected}
                      aria-label={LANDING_FEATURE_ICON_LABELS[iconId]}
                      tabIndex={active ? 0 : -1}
                      onMouseEnter={() => setActiveIndex(index)}
                      onClick={() => select(iconId)}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-lg border px-2 py-2.5 text-center transition",
                        selected
                          ? "border-accent bg-accent/10 ring-2 ring-accent/40"
                          : "border-transparent hover:border-border hover:bg-slate-50",
                        active && !selected && "border-border bg-slate-50"
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
            </div>,
            document.body
          )
        : null}
    </div>
  );
}
