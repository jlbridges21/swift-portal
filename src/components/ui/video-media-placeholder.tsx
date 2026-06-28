import { Play, Video } from "lucide-react";
import { cn } from "@/lib/utils";

interface VideoMediaPlaceholderProps {
  fileName?: string | null;
  label?: string;
  className?: string;
  compact?: boolean;
  showPlayIcon?: boolean;
}

/** Static placeholder for video items — never loads video bytes for thumbnails. */
export function VideoMediaPlaceholder({
  fileName,
  label = "Video",
  className,
  compact,
  showPlayIcon = true,
}: VideoMediaPlaceholderProps) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-slate-800 to-slate-950 text-white",
        className
      )}
    >
      {showPlayIcon && (
        <div
          className={cn(
            "mb-2 flex items-center justify-center rounded-full bg-white/90 text-slate-900 shadow",
            compact ? "h-9 w-9" : "h-12 w-12"
          )}
        >
          <Play className={cn("ml-0.5", compact ? "h-4 w-4" : "h-6 w-6")} fill="currentColor" />
        </div>
      )}
      <div className="flex items-center gap-1.5 px-3 text-center">
        <Video className={cn("shrink-0 opacity-80", compact ? "h-3.5 w-3.5" : "h-4 w-4")} />
        <span className={cn("font-medium uppercase tracking-wide opacity-90", compact ? "text-[10px]" : "text-xs")}>
          {label}
        </span>
      </div>
      {fileName && (
        <p className={cn("mt-1 max-w-full truncate px-3 text-center opacity-70", compact ? "text-[10px]" : "text-xs")}>
          {fileName}
        </p>
      )}
    </div>
  );
}
