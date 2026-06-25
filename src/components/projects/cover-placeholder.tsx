import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";

interface CoverPlaceholderProps {
  className?: string;
  variant?: "card" | "hero";
}

export function CoverPlaceholder({ className, variant = "card" }: CoverPlaceholderProps) {
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
