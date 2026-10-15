"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Sidebar table of contents that highlights the section in view. Links work without JS. */
export function ArticleTocSpy({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((el): el is HTMLElement => !!el);
    if (!els.length) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-88px 0px -65% 0px", threshold: 0 }
    );
    els.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [items]);

  return (
    <ol className="mt-3 max-h-[55vh] space-y-0.5 overflow-y-auto border-l border-[#E2E8F0] text-sm">
      {items.map((t) => (
        <li key={t.id}>
          <a
            href={`#${t.id}`}
            aria-current={active === t.id ? "true" : undefined}
            className={cn(
              "-ml-px block border-l-2 py-1.5 pl-3 leading-snug transition-colors",
              active === t.id
                ? "border-[#4F46E5] font-semibold text-[#4F46E5]"
                : "border-transparent text-[#64748B] hover:border-[#CBD5E1] hover:text-[#0F172A]"
            )}
          >
            {t.label}
          </a>
        </li>
      ))}
    </ol>
  );
}
