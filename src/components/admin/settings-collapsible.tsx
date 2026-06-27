"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsCollapsibleProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SettingsCollapsible({
  title,
  description,
  defaultOpen = false,
  children,
  className,
}: SettingsCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className={cn("rounded-xl border border-border bg-white shadow-sm overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-slate-50/80 transition-colors"
        aria-expanded={open}
      >
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-primary">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        <ChevronDown
          className={cn("mt-1 h-5 w-5 shrink-0 text-muted transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="border-t border-border px-5 py-5">{children}</div>}
    </section>
  );
}
