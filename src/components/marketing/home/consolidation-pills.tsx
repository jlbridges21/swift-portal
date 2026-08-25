"use client";

import { useRef } from "react";
import { useInViewOnce, usePrefersReducedMotion } from "./motion";
import { cn } from "@/lib/utils";

export function ConsolidationPills({
  items,
}: {
  items: ReadonlyArray<{ label: string; icon: React.ComponentType<{ className?: string }> }>;
}) {
  const ref = useRef<HTMLUListElement>(null);
  const reduced = usePrefersReducedMotion();
  const inView = useInViewOnce(ref, 0.2);

  return (
    <ul ref={ref} className="mt-6 flex flex-wrap items-center justify-center gap-3 sm:gap-4">
      {items.map((item, i) => {
        const Icon = item.icon;
        return (
          <li
            key={item.label}
            className={cn(
              "flex items-center gap-2 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2 text-sm font-medium text-[#0F172A] transition-all duration-500 ease-out",
              inView || reduced
                ? "translate-y-0 opacity-100"
                : "translate-y-2 opacity-0"
            )}
            style={{ transitionDelay: reduced ? "0ms" : `${i * 70}ms` }}
          >
            <Icon className="h-4 w-4 text-[#4F46E5]" aria-hidden />
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}
