"use client";

import { useRef } from "react";
import { AFTER_ITEMS, BEFORE_TOOLS } from "./constants";
import { useInView, usePrefersReducedMotion } from "./motion";

export function BeforeAfterConverge() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInView(ref, 0.25);
  const active = reduced || inView;

  return (
    <div ref={ref} className="relative">
      <p className="mb-8 text-center text-xl font-semibold tracking-tight text-[#0F172A] sm:text-2xl">
        The job should live in one place.
      </p>

      <div className="grid gap-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:gap-4">
        <div
          className={`rounded-2xl border border-[#E2E8F0] bg-white p-5 shadow-sm transition-all duration-700 ${
            active ? "opacity-100" : "opacity-60"
          }`}
        >
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            Before ShootPortal
          </p>
          <ul className="mt-4 space-y-2">
            {BEFORE_TOOLS.map((tool, i) => (
              <li
                key={tool}
                className={`rounded-lg border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-3 py-2.5 text-sm text-[#475569] transition-all duration-700 ${
                  active ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-40"
                }`}
                style={{
                  transitionDelay: reduced ? "0ms" : `${i * 70}ms`,
                  transform: active && !reduced ? undefined : undefined,
                }}
              >
                {tool}
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden justify-center lg:flex" aria-hidden>
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-sm font-semibold text-[#4F46E5] shadow-sm transition-transform duration-700 ${
              active ? "scale-100" : "scale-90"
            }`}
          >
            →
          </div>
        </div>

        <div
          className={`relative overflow-hidden rounded-2xl border border-[#4F46E5]/25 bg-white p-5 shadow-[0_20px_50px_-28px_rgba(79,70,229,0.45)] transition-all duration-700 ${
            active ? "opacity-100 translate-y-0" : "opacity-50 translate-y-3"
          }`}
        >
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full opacity-60"
            style={{
              background: "radial-gradient(circle, rgba(79,70,229,0.22), transparent 70%)",
            }}
          />
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
            With ShootPortal
          </p>
          <div className="relative mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[#4F46E5]">
              Project
            </p>
            <p className="mt-1 text-base font-semibold text-[#0F172A]">214 Oak Street</p>
            <p className="text-sm text-[#475569]">Avery Chen · Listing Media</p>
            <ul className="mt-4 space-y-2">
              {AFTER_ITEMS.map((item, i) => (
                <li
                  key={item}
                  className={`flex items-center gap-2 rounded-lg border border-[#E2E8F0] bg-white px-3 py-2 text-sm text-[#0F172A] transition-all duration-700 ${
                    active ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
                  }`}
                  style={{ transitionDelay: reduced ? "0ms" : `${180 + i * 80}ms` }}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5]/10 text-[10px] font-bold text-[#4F46E5]">
                    {i + 1}
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
