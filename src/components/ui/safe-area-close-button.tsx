"use client";

import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface SafeAreaCloseButtonProps {
  onClick: () => void;
  className?: string;
  label?: string;
}

/** Fixed close control that clears the iPhone status bar / Dynamic Island safe area. */
export function SafeAreaCloseButton({ onClick, className, label = "Close" }: SafeAreaCloseButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "fixed z-[300] flex min-h-11 min-w-11 items-center justify-center rounded-full",
        "bg-black/50 text-white shadow-lg backdrop-blur-sm",
        "hover:bg-black/65 active:scale-95 transition",
        className
      )}
      style={{
        top: "calc(env(safe-area-inset-top, 0px) + 16px)",
        right: "16px",
      }}
    >
      <X className="h-6 w-6" />
    </button>
  );
}
