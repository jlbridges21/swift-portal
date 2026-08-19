"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsCollapsibleProps {
  title: string;
  description?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
  id?: string;
}

function hashTargetsThisSection(hash: string, sectionId?: string): boolean {
  if (!hash || !sectionId) return false;
  if (hash === sectionId) return true;
  const el = document.getElementById(hash);
  if (!el) return hash.startsWith(`${sectionId}-`);
  return Boolean(el.closest(`#${CSS.escape(sectionId)}`));
}

export function SettingsCollapsible({
  title,
  description,
  defaultOpen = false,
  children,
  className,
  id,
}: SettingsCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const syncFromHash = () => {
      const hash = window.location.hash.replace("#", "");
      if (hashTargetsThisSection(hash, id)) setOpen(true);
    };
    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
    window.addEventListener("portal:hash-target", syncFromHash);
    return () => {
      window.removeEventListener("hashchange", syncFromHash);
      window.removeEventListener("portal:hash-target", syncFromHash);
    };
  }, [id]);

  return (
    <section
      id={id}
      tabIndex={-1}
      className={cn(
        "rounded-xl border border-border bg-white shadow-sm overflow-hidden scroll-mt-24 outline-none",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left hover:bg-accent-subtle/60 transition-colors"
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
