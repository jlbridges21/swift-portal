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
  /** sessionStorage key — remembers open/closed for this browser tab session. */
  storageKey?: string;
  /** When true, show an “Unsaved” cue on the header (collapsed sections can hide edits). */
  dirty?: boolean;
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
  storageKey,
  dirty = false,
}: SettingsCollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [storageReady, setStorageReady] = useState(!storageKey);

  useEffect(() => {
    if (!storageKey) return;
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored === "1") setOpen(true);
      else if (stored === "0") setOpen(false);
    } catch {
      /* private mode */
    }
    setStorageReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey || !storageReady) return;
    try {
      sessionStorage.setItem(storageKey, open ? "1" : "0");
    } catch {
      /* ignore */
    }
  }, [storageKey, open, storageReady]);

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
        className="flex w-full items-start justify-between gap-3 px-5 py-4 text-left transition-colors hover:bg-accent-subtle/60"
        aria-expanded={open}
        aria-controls={id ? `${id}-panel` : undefined}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-primary">{title}</h2>
            {dirty ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                Unsaved
              </span>
            ) : null}
          </div>
          {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
        </div>
        <ChevronDown
          className={cn(
            "mt-1 h-5 w-5 shrink-0 text-muted transition-transform",
            open && "rotate-180"
          )}
          aria-hidden
        />
      </button>
      {open ? (
        <div id={id ? `${id}-panel` : undefined} className="border-t border-border px-5 py-5" role="region" aria-label={title}>
          {children}
        </div>
      ) : null}
    </section>
  );
}
