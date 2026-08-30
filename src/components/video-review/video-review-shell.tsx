"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";

/**
 * Viewport-locked video review layout (same pattern as landing-editor-shell).
 *
 * lg+: fixed under the sticky header — height via inset, not vh/vw.
 * Below lg: document flow, stacked panes.
 *
 * HARD RULES: no vw units; every shrinking flex child has min-w-0; page body must not
 * scroll on lg+; only the comment rail scrolls internally.
 */
export function VideoReviewShell({
  header,
  main,
  rail,
  className,
}: {
  header: React.ReactNode;
  main: React.ReactNode;
  rail: React.ReactNode;
  className?: string;
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
        "flex min-w-0 flex-col",
        "lg:fixed lg:inset-x-0 lg:bottom-0 lg:top-16 lg:z-30 lg:overflow-hidden lg:bg-[#F8FAFC]",
        className
      )}
      data-video-review-shell=""
    >
      <div className="min-w-0 shrink-0 px-4 pt-4 sm:px-6">{header}</div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-6 overflow-hidden px-4 pb-4 pt-4 sm:px-6 lg:flex-row lg:gap-0 lg:pb-4">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden lg:min-h-0 lg:pr-4">
          {main}
        </div>
        <aside className="flex min-h-0 w-full min-w-0 shrink-0 flex-col overflow-hidden lg:w-[380px] lg:border-l lg:border-border lg:pl-4">
          {rail}
        </aside>
      </div>
    </div>
  );
}
