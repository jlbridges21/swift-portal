"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
  /** Sticky footer for primary actions — stays visible above mobile PWA bottom nav */
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, className, footer }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 safe-area-x">
      <button type="button" className="absolute inset-0 bg-black/40" onClick={onClose} aria-label="Close" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={cn(
          "relative z-10 flex w-full max-w-lg flex-col",
          "max-h-[calc(100dvh-120px)] sm:max-h-[min(90dvh,calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)))]",
          "rounded-t-2xl sm:rounded-xl border border-border bg-white shadow-xl",
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border px-5 py-4 safe-area-top bg-white rounded-t-2xl sm:rounded-t-xl">
          <h2 id="modal-title" className="text-lg font-semibold text-primary pr-2">
            {title}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-11 min-w-11 shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div className={cn("modal-scroll-body flex-1 px-5 pt-5", footer ? "pb-5" : "modal-scroll-body-pad")}>
          {children}
        </div>

        {footer ? (
          <div className="modal-footer-pad shrink-0 border-t border-border bg-white px-5 py-4 safe-area-bottom sm:safe-area-bottom">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
