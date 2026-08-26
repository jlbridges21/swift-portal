"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Sticky live-preview chrome shared by partner + client landing editors.
 * Desktop: sticky side pane. Mobile (≤375-friendly): stacked below, or toggleable.
 */
export function LandingEditorPreviewFrame({
  title = "Live preview",
  children,
  className,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className={cn("w-full lg:w-[min(28rem,42%)] lg:shrink-0", className)}>
      <div className="mb-2 flex items-center justify-between gap-2 lg:hidden">
        <p className="text-sm font-medium text-heading">{title}</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="min-h-11"
          onClick={() => setMobileOpen((o) => !o)}
        >
          {mobileOpen ? "Hide preview" : "Show preview"}
        </Button>
      </div>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-border bg-white shadow-sm",
          "lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto",
          !mobileOpen && "hidden lg:block"
        )}
      >
        <div className="border-b border-border bg-subtle px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted">{title}</p>
          <p className="text-[11px] text-muted">Updates as you edit — same components as the live page.</p>
        </div>
        <div className="pointer-events-none origin-top select-none">{children}</div>
      </div>
    </div>
  );
}
