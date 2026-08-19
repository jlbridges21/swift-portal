"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import {
  SETTINGS_SECTIONS,
  type SettingsSectionId,
} from "@/lib/settings-nav";

export function SettingsTabNav({
  active,
  onChange,
  accentColor,
}: {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
  accentColor: string;
}) {
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  function move(delta: number) {
    const ids = SETTINGS_SECTIONS.map((s) => s.id);
    const i = ids.indexOf(active);
    const next = ids[(i + delta + ids.length) % ids.length];
    onChange(next);
    requestAnimationFrame(() => tabRefs.current[next]?.focus());
  }

  function onKeyDown(e: React.KeyboardEvent, id: SettingsSectionId) {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      move(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      move(-1);
    } else if (e.key === "Home") {
      e.preventDefault();
      onChange(SETTINGS_SECTIONS[0].id);
    } else if (e.key === "End") {
      e.preventDefault();
      onChange(SETTINGS_SECTIONS[SETTINGS_SECTIONS.length - 1].id);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onChange(id);
    }
  }

  return (
    <>
      <div className="md:hidden">
        <label htmlFor="settings-section-select" className="sr-only">
          Settings section
        </label>
        <select
          id="settings-section-select"
          value={active}
          onChange={(e) => onChange(e.target.value as SettingsSectionId)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-medium text-primary"
        >
          {SETTINGS_SECTIONS.map((section) => (
            <option key={section.id} value={section.id}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

      <div
        role="tablist"
        aria-label="Settings sections"
        aria-orientation="vertical"
        className="hidden md:flex md:flex-col md:gap-0.5"
      >
        {SETTINGS_SECTIONS.map((section) => {
          const selected = section.id === active;
          return (
            <button
              key={section.id}
              ref={(el) => {
                tabRefs.current[section.id] = el;
              }}
              type="button"
              role="tab"
              id={`settings-tab-${section.id}`}
              aria-selected={selected}
              aria-controls={`settings-panel-${section.id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(section.id)}
              onKeyDown={(e) => onKeyDown(e, section.id)}
              className={cn(
                "rounded-lg px-3 py-2 text-left text-sm transition-colors",
                selected ? "font-semibold" : "text-muted hover:bg-subtle hover:text-foreground"
              )}
              style={
                selected
                  ? {
                      backgroundColor: "var(--color-accent-subtle)",
                      color: "var(--color-accent)",
                      boxShadow: `inset 3px 0 0 ${accentColor}`,
                    }
                  : undefined
              }
            >
              {section.label}
            </button>
          );
        })}
      </div>
    </>
  );
}
