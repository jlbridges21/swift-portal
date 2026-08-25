"use client";

import { useRef } from "react";
import { useInViewOnce, usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

const STACK = ["CRM", "Calendar", "File delivery", "Proofing", "Invoices"] as const;

export function HomeStackCollapse({ priceLabel }: { priceLabel: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewOnce(ref, 0.35);
  const active = reduced || inView;

  return (
    <div ref={ref} className="mx-auto max-w-xl text-center" aria-hidden>
      <div className="relative mx-auto flex h-28 items-center justify-center sm:h-32">
        {STACK.map((label, i) => {
          const offset = (i - (STACK.length - 1) / 2) * (active ? 0 : 18);
          return (
            <span
              key={label}
              className={cn(
                "absolute rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-[#475569] shadow-sm transition-all duration-1000 ease-out",
                active
                  ? "border-[#4F46E5]/20 scale-75 opacity-0"
                  : "border-[#E2E8F0] scale-100 opacity-100"
              )}
              style={{
                transform: `translateX(${offset}px) translateY(${active ? 12 : i % 2 === 0 ? -4 : 4}px)`,
                transitionDelay: reduced ? "0ms" : `${i * 60}ms`,
                zIndex: STACK.length - i,
              }}
            >
              {label}
            </span>
          );
        })}
        <div
          className={cn(
            "absolute rounded-xl border px-5 py-3 shadow-md transition-all duration-1000 ease-out",
            active
              ? "border-[#4F46E5]/30 bg-[#EEF2FF] scale-100 opacity-100"
              : "border-[#E2E8F0] bg-white scale-90 opacity-0"
          )}
          style={{ transitionDelay: reduced ? "0ms" : "400ms" }}
        >
          <p className="text-sm font-semibold text-[#0F172A]">ShootPortal</p>
          <p className="mt-0.5 text-xs text-[#4F46E5]">
            Starting at {priceLabel} / month
          </p>
        </div>
      </div>
      <p
        className={cn(
          "mt-2 text-sm text-[#64748B] transition-opacity duration-700",
          active ? "opacity-100" : "opacity-0"
        )}
      >
        One portal instead of a stack of tools.
      </p>
    </div>
  );
}
