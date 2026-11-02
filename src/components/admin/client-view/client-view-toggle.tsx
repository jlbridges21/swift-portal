"use client";

import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { isClientViewNewBadgeActive } from "@/lib/client-view";

/** On/off switch between the Pipeline View (off) and the Client View (on). */
export function ClientViewToggle({
  on,
  onToggle,
  loading = false,
}: {
  on: boolean;
  onToggle: () => void;
  loading?: boolean;
}) {
  // Runtime check every render — the badge disappears on its own after the date.
  const showNew = isClientViewNewBadgeActive();

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={on}
      title={on ? "Switch back to the Pipeline View" : "Switch to the Client View"}
      className={cn(
        "inline-flex h-8 items-center gap-2 rounded-md border px-3 text-xs font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 surface-dark:focus-visible:ring-offset-background",
        on
          ? "border-accent bg-accent-subtle text-accent shadow-sm"
          : "border-border bg-card text-foreground hover:bg-accent-subtle"
      )}
    >
      <LayoutGrid className="h-3.5 w-3.5" />
      Client View
      {showNew ? (
        <span className="rounded-full bg-blue-600 px-1.5 py-px text-[10px] font-semibold uppercase leading-4 tracking-wide text-white">
          New
        </span>
      ) : null}
      <span
        aria-hidden
        className={cn(
          "relative ml-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          on ? "bg-accent" : "bg-slate-300 surface-dark:bg-border",
          loading && "animate-pulse"
        )}
      >
        <span
          className={cn(
            "absolute h-3 w-3 rounded-full bg-white shadow transition-transform",
            on ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
    </button>
  );
}
