"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Viewport-locked three-pane landing editor (Webflow/Framer style).
 *
 * lg+: fixed under the sticky header (h-14 / sm:h-16) — height via inset, not vh/vw.
 * Below lg: same DOM in document flow (form → canvas); nav shown as a compact strip.
 *
 * HARD RULES: no vw units; every shrinking flex child has min-w-0; page body must not
 * scroll horizontally; only panes scroll (overflow locked on html/body while active on lg).
 */
export function LandingEditorShell({
  nav,
  form,
  canvas,
  formFooter,
  className,
  /** When true, nav rail is desktop-only (e.g. partner dashboard already shows section nav). */
  hideNavBelowLg = false,
}: {
  nav: React.ReactNode;
  form: React.ReactNode;
  canvas: React.ReactNode;
  formFooter?: React.ReactNode;
  className?: string;
  hideNavBelowLg?: boolean;
}) {
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => {
      if (mq.matches) {
        document.documentElement.style.overflow = "hidden";
        document.body.style.overflow = "hidden";
      } else {
        document.documentElement.style.overflow = "";
        document.body.style.overflow = "";
      }
    };
    sync();
    mq.addEventListener("change", sync);
    return () => {
      mq.removeEventListener("change", sync);
      document.documentElement.style.overflow = "";
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className={cn(
        "flex min-w-0 flex-col gap-4",
        // Desktop shell: lock to the viewport below the header — no vw, no page scroll.
        "lg:fixed lg:inset-x-0 lg:bottom-0 lg:top-16 lg:z-40 lg:flex-row lg:gap-0 lg:overflow-hidden lg:bg-background",
        className
      )}
      data-landing-editor-shell=""
    >
      {/* Nav: desktop left rail; mobile uses SettingsTabNav’s built-in select when provided */}
      <aside
        className={cn(
          "min-w-0 shrink-0",
          hideNavBelowLg && "hidden",
          "lg:flex lg:w-56 lg:flex-col lg:overflow-y-auto lg:border-r lg:border-border lg:bg-card lg:px-3 lg:py-4"
        )}
      >
        <div className="min-w-0">{nav}</div>
      </aside>

      <div
        className={cn(
          "flex min-w-0 flex-col",
          "lg:w-[28rem] lg:shrink-0 lg:overflow-hidden lg:border-r lg:border-border"
        )}
      >
        <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto lg:px-4 lg:py-4">
          {form}
        </div>
        {formFooter ? (
          <div className="shrink-0 border-t border-border bg-card/95 px-1 py-3 backdrop-blur-md lg:px-4">
            {formFooter}
          </div>
        ) : null}
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{canvas}</div>
    </div>
  );
}
