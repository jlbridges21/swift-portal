"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Accessible tabs for Solutions pages (WAI-ARIA tabs pattern, arrow/Home/End keys).
 * Every panel is server-rendered and stays in the DOM, so all copy is crawlable;
 * only visibility changes on the client.
 */
export function FeatureTabs({
  label,
  tabs,
}: {
  label: string;
  tabs: { key: string; title: string; summary: string; body: ReactNode; visual: ReactNode }[];
}) {
  const id = useId();
  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  function onKeyDown(e: KeyboardEvent<HTMLButtonElement>, i: number) {
    const last = tabs.length - 1;
    const next = e.key === "ArrowRight" || e.key === "ArrowDown" ? (i === last ? 0 : i + 1) : e.key === "ArrowLeft" || e.key === "ArrowUp" ? (i === 0 ? last : i - 1) : e.key === "Home" ? 0 : e.key === "End" ? last : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    refs.current[next]?.focus();
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
      <div role="tablist" aria-label={label} aria-orientation="vertical" className="flex gap-2 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
        {tabs.map((t, i) => (
          <button
            key={t.key}
            ref={(el) => {
              refs.current[i] = el;
            }}
            id={`${id}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={active === i}
            aria-controls={`${id}-panel-${t.key}`}
            tabIndex={active === i ? 0 : -1}
            onClick={() => setActive(i)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className={cn(
              "shrink-0 rounded-2xl border px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] lg:px-5 lg:py-4",
              active === i
                ? "border-[#C7D2FE] bg-white shadow-[0_20px_45px_-30px_rgba(79,70,229,0.7)]"
                : "border-transparent bg-transparent hover:border-[#E2E8F0] hover:bg-white/70"
            )}
          >
            <span className={cn("block text-sm font-semibold", active === i ? "text-[#4F46E5]" : "text-[#0F172A]")}>{t.title}</span>
            <span className="mt-0.5 hidden text-sm leading-relaxed text-[#475569] lg:block">{t.summary}</span>
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.key}
          id={`${id}-panel-${t.key}`}
          role="tabpanel"
          aria-labelledby={`${id}-tab-${t.key}`}
          hidden={active !== i}
          tabIndex={0}
          className="focus-visible:outline-none"
        >
          {t.visual}
          <div className="mt-5 text-[0.98rem] leading-relaxed text-[#475569]">{t.body}</div>
        </div>
      ))}
    </div>
  );
}
