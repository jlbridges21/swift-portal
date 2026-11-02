import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverPlaceholderProps {
  className?: string;
  /** "thumb" = icon only, for small project cards. */
  variant?: "card" | "hero" | "thumb";
}

export function CoverPlaceholder({ className, variant = "card" }: CoverPlaceholderProps) {
  if (variant === "thumb") {
    return (
      <div
        className={cn(
          "flex h-full w-full items-center justify-center bg-gradient-to-br from-slate-800 via-primary to-slate-900",
          className
        )}
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
          <Camera className="h-4 w-4 text-white/80" />
        </div>
      </div>
    );
  }
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center bg-gradient-to-br from-slate-800 via-primary to-slate-900 text-white",
        variant === "hero" ? "absolute inset-0 opacity-90" : "h-full w-full",
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
        <Camera className="h-6 w-6 text-white/80" />
      </div>
      <p className="mt-3 text-sm font-medium tracking-wide text-white/90">Coming Soon</p>
      <p className="mt-1 text-xs text-white/50">Media will appear here</p>
    </div>
  );
}
