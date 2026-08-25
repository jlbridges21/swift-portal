"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useInViewLive, usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

const STEPS = [
  { label: "Estimate approved", detail: "Listing Media Package · $450" },
  { label: "Shoot confirmed", detail: "Sat · 10:00 AM · 214 Oak Street" },
  { label: "Media ready for review", detail: "16 photos · 1 video walkthrough" },
  { label: "Invoice paid", detail: "Payment received" },
  { label: "Final files ready", detail: "Download in your portal" },
] as const;

export function InteractiveClientMockup() {
  const rootRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewLive(rootRef, 0.25);
  const [doneThrough, setDoneThrough] = useState(reduced ? STEPS.length - 1 : 1);

  useEffect(() => {
    if (reduced || !inView) return;
    const id = window.setInterval(() => {
      setDoneThrough((n) => (n + 1) % STEPS.length);
    }, 2400);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  return (
    <div ref={rootRef} aria-hidden>
      <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_20px_50px_-28px_rgba(15,23,42,0.35)]">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#4F46E5]">
            Client portal
          </p>
          <p className="mt-1 text-base font-semibold text-[#0F172A]">Your project</p>
          <p className="mt-0.5 text-sm text-[#475569]">214 Oak Street · Northside Realty</p>
        </div>
        <div className="space-y-2.5 p-5">
          {STEPS.map((row, i) => {
            const done = i <= doneThrough;
            const current = i === doneThrough;
            return (
              <div
                key={row.label}
                className={cn(
                  "flex items-start gap-3 rounded-xl border px-3 py-3 transition-all duration-500",
                  done
                    ? current
                      ? "border-[#4F46E5] bg-[#EEF2FF]"
                      : "border-[#16A34A]/25 bg-[#F0FDF4]"
                    : "border-[#E2E8F0] bg-white"
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors",
                    done ? "bg-[#16A34A] text-white" : "bg-slate-200 text-transparent"
                  )}
                >
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-[#0F172A]">{row.label}</p>
                  <p className="text-xs text-[#64748B]">{row.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
