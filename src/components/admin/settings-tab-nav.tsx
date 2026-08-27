"use client";

import { useRef } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/lib/settings-nav";

export type SectionNavItem = {
  id: string;
  label: string;
};

type SettingsTabNavProps<T extends string = string> = {
  active: T;
  onChange: (id: T) => void;
  accentColor: string;
  /** Defaults to SETTINGS_SECTIONS so existing admin settings call sites stay unchanged. */
  sections?: readonly SectionNavItem[];
  ariaLabel?: string;
  selectId?: string;
  /** Prefix for tab/panel ids (settings → settings-tab-*, partners → partners-tab-*). */
  idPrefix?: string;
  /**
   * When set, desktop items render as Links (real routes / bookmarkable sections).
   * Mobile select still uses onChange.
   */
  hrefFor?: (id: T) => string;
};

export function SettingsTabNav<T extends string = SettingsSectionId>({
  active,
  onChange,
  accentColor,
  sections = SETTINGS_SECTIONS,
  ariaLabel = "Settings sections",
  selectId = "settings-section-select",
  idPrefix = "settings",
  hrefFor,
}: SettingsTabNavProps<T>) {
  const tabRefs = useRef<Record<string, HTMLElement | null>>({});
  const ids = sections.map((s) => s.id as T);

  function move(delta: number) {
    const i = ids.indexOf(active);
    const next = ids[(i + delta + ids.length) % ids.length];
    onChange(next);
    requestAnimationFrame(() => tabRefs.current[next]?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent, id: T) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(ids[0]);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(ids[ids.length - 1]);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(id);
    }
  }

  function itemClass(selected: boolean) {
    return cn(
      "rounded-lg px-3 py-2 text-left text-sm transition-colors block w-full",
      selected ? "font-semibold" : "text-muted hover:bg-subtle hover:text-foreground"
    );
  }

  function selectedStyle(selected: boolean): React.CSSProperties | undefined {
    return selected
      ? {
          backgroundColor: "var(--color-accent-subtle)",
          color: "var(--color-accent)",
          boxShadow: `inset 3px 0 0 ${accentColor}`,
        }
      : undefined;
  }

  return (
    <>
      <div className="md:hidden">
        <label htmlFor={selectId} className="sr-only">
          {ariaLabel}
        </label>
        <select
          id={selectId}
          value={active}
          onChange={(e) => onChange(e.target.value as T)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-primary"
        >
          {sections.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

      <div
        role="tablist"
        aria-label={ariaLabel}
        aria-orientation="vertical"
        className="hidden md:flex md:flex-col md:gap-0.5"
      >
        {sections.map((section) => {
          const id = section.id as T;
          const selected = id === active;
          const className = itemClass(selected);
          const style = selectedStyle(selected);
          const setRef = (el: HTMLElement | null) => {
            tabRefs.current[section.id] = el;
          };

          if (hrefFor) {
            return (
              <Link
                key={section.id}
                href={hrefFor(id)}
                role="tab"
                id={`${idPrefix}-tab-${section.id}`}
                aria-selected={selected}
                aria-controls={`${idPrefix}-panel-${section.id}`}
                tabIndex={selected ? 0 : -1}
                className={className}
                style={style}
                ref={setRef}
                onKeyDown={(e) => onKeyDown(e, id)}
                onClick={() => onChange(id)}
              >
                {section.label}
              </Link>
            );
          }

          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              id={`${idPrefix}-tab-${section.id}`}
              aria-selected={selected}
              aria-controls={`${idPrefix}-panel-${section.id}`}
              tabIndex={selected ? 0 : -1}
              className={className}
              style={style}
              ref={setRef}
              onClick={() => onChange(id)}
              onKeyDown={(e) => onKeyDown(e, id)}
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
