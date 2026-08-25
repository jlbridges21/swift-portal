"use client";

import { useEffect, useRef, useState } from "react";
import { Check } from "lucide-react";
import { useInViewLive, usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

const STEPS = [
  "Request received",
  "Shoot scheduled",
  "Media delivered",
  "Invoice paid",
] as const;

export function HomeSocialProgression() {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewLive(ref, 0.3);
  const [doneThrough, setDoneThrough] = useState(reduced ? STEPS.length - 1 : 0);

  useEffect(() => {
    if (reduced || !inView) return;
    setDoneThrough(0);
    const id = window.setInterval(() => {
      setDoneThrough((n) => (n + 1) % STEPS.length);
    }, 1800);
    return () => window.clearInterval(id);
  }, [reduced, inView]);

  return (
    <div ref={ref} className="mx-auto mt-10 max-w-md" aria-hidden>
      <ul className="space-y-2">
        {STEPS.map((label, i) => {
          const done = i <= doneThrough;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 transition-all duration-500",
                done
                  ? "border-white/20 bg-white/10 text-white"
                  : "border-white/5 bg-white/5 text-slate-500"
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
                  done ? "bg-[#4ADE80] text-[#0F172A]" : "bg-white/10 text-transparent"
                )}
              >
                <Check className="h-3 w-3" strokeWidth={3} />
              </span>
              <span className="text-sm font-medium">{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
