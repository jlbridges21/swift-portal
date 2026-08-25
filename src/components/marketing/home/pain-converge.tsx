"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useInViewOnce, usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

const TOOLS = [
  "Text messages",
  "Email",
  "Calendar",
  "Dropbox or Drive",
  "Invoice",
  "Payment link",
  "Spreadsheet",
] as const;

const PROJECT_BITS = [
  "Client",
  "Project",
  "Shoot date",
  "Messages",
  "Media",
  "Invoice",
  "Payment status",
] as const;

export function HomePainConverge() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewOnce(ref, 0.25);
  const active = reduced || inView;

  return (
    <div ref={ref} className="relative" aria-hidden>
      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-[#F8FAFC] to-white p-5 shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)] sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_auto_1.05fr] lg:items-center">
          <ul className="relative min-h-[14rem]">
            {TOOLS.map((tool, i) => {
              const positions = [
                "left-0 top-0",
                "right-2 top-2 sm:right-6",
                "left-4 top-[4.5rem]",
                "right-0 top-[5rem]",
                "left-1 top-[9rem]",
                "right-4 top-[9.5rem]",
                "left-[20%] top-[13rem] sm:left-[30%]",
              ];
              return (
                <li
                  key={tool}
                  className={cn(
                    "absolute rounded-lg border border-dashed border-[#CBD5E1] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#475569] shadow-sm transition-all duration-1000 ease-out sm:text-xs",
                    positions[i],
                    active
                      ? "opacity-40 scale-90 translate-x-4 sm:translate-x-8"
                      : "opacity-100 scale-100"
                  )}
                  style={{
                    transitionDelay: reduced ? "0ms" : `${i * 80}ms`,
                  }}
                >
                  {tool}
                </li>
              );
            })}
          </ul>

          <div className="hidden items-center justify-center lg:flex">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-full border border-[#E2E8F0] bg-white text-sm font-semibold text-[#4F46E5] shadow-sm transition-transform duration-700",
                active ? "scale-100" : "scale-90"
              )}
            >
              →
            </div>
          </div>

          <div
            className={cn(
              "relative rounded-xl border bg-white p-4 shadow-md transition-all duration-1000 ease-out",
              active
                ? "border-[#4F46E5]/30 opacity-100 translate-y-0"
                : "border-[#E2E8F0] opacity-50 translate-y-3"
            )}
          >
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-70"
              style={{
                background: "radial-gradient(circle, rgba(79,70,229,0.2), transparent 70%)",
              }}
            />
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
              ShootPortal project
            </p>
            <p className="mt-1 text-base font-semibold text-[#0F172A]">214 Oak Street</p>
            <p className="text-xs text-[#64748B]">Avery Chen · Listing Media</p>
            <ul className="mt-3 grid grid-cols-2 gap-1.5">
              {PROJECT_BITS.map((bit, i) => (
                <li
                  key={bit}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border border-[#E2E8F0] bg-[#F8FAFC] px-2 py-1.5 text-[11px] text-[#0F172A] transition-all duration-700",
                    active ? "opacity-100" : "opacity-0"
                  )}
                  style={{ transitionDelay: reduced ? "0ms" : `${350 + i * 70}ms` }}
                >
                  <Check className="h-3 w-3 shrink-0 text-[#16A34A]" strokeWidth={3} />
                  {bit}
                </li>
              ))}
            </ul>
            <p
              className={cn(
                "mt-4 text-center text-sm font-semibold text-[#0F172A] transition-opacity duration-700",
                active ? "opacity-100" : "opacity-0"
              )}
              style={{ transitionDelay: reduced ? "0ms" : "900ms" }}
            >
              One job. One place.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
