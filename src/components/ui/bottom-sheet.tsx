"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Optional line under the title. */
  description?: string;
  children: ReactNode;
  /** Pinned under the scrolling body (e.g. Clear / Apply). Clears the home indicator. */
  footer?: ReactNode;
  /**
   * Element whose `[data-surface]` wrapper the sheet portals into, so dark-surface tokens still
   * apply (same approach as ActionMenu). Falls back to <body>.
   */
  surfaceFrom?: HTMLElement | null;
}

/**
 * Phone bottom sheet: portaled to the surface root, so no ancestor `overflow` (horizontal kanban
 * scrollers, cards) or stacking context can clip it. Sits above the admin tab bar (z-100) like
 * ActionMenu's sheet, scrolls its body, and pads the footer for the home indicator.
 */
export function BottomSheet({ open, onClose, title, description, children, footer, surfaceFrom }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus({ preventScroll: true });
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const target = (surfaceFrom?.closest("[data-surface]") as HTMLElement | null) ?? document.body;

  return createPortal(
    <div className="fixed inset-0 z-[110] flex items-end" role="presentation">
      <button
        type="button"
        aria-label="Close"
        tabIndex={-1}
        className="sp-sheet-backdrop absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "sp-sheet-panel relative z-10 flex w-full flex-col rounded-t-2xl border-t border-border bg-card shadow-xl outline-none",
          "max-h-[calc(var(--app-height)-2.5rem)]"
        )}
        style={{ paddingLeft: "env(safe-area-inset-left)", paddingRight: "env(safe-area-inset-right)" }}
      >
        <div className="shrink-0 px-4 pt-2">
          <div className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden />
          <div className="flex items-start gap-3 pt-2">
            <div className="min-w-0 flex-1 py-1.5">
              <h2 id={titleId} className="truncate text-base font-semibold text-heading">
                {title}
              </h2>
              {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted hover:bg-accent-subtle hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="modal-scroll-body min-h-0 flex-1 px-4 pb-3 pt-1">{children}</div>

        {footer ? (
          <div
            className="shrink-0 border-t border-border bg-card px-4 pt-3"
            style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          >
            {footer}
          </div>
        ) : (
          <div style={{ height: "env(safe-area-inset-bottom)" }} aria-hidden />
        )}
      </div>
    </div>,
    target
  );
}
