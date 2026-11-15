import Image from "next/image";
import { Check, Play } from "lucide-react";
import { academyThumb, formatDuration, type AcademyLesson } from "@/lib/academy/catalog";
import type { LessonStatus } from "@/components/academy/academy-progress";
import { cn } from "@/lib/utils";

/** Lesson thumbnail with its length, a green check when watched, and a red watched bar. */
export function LessonThumb({
  lesson,
  status = "new",
  percent = 0,
  upNext = false,
  size = "md",
  className,
  durationLabel,
}: {
  lesson: AcademyLesson;
  status?: LessonStatus;
  percent?: number;
  upNext?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** Overrides the length badge, e.g. "1:47 left". */
  durationLabel?: string;
}) {
  const done = status === "done";
  return (
    <div className={cn("relative aspect-video w-full overflow-hidden rounded-lg bg-slate-900", className)}>
      <Image
        src={academyThumb(lesson)}
        alt=""
        fill
        sizes={size === "sm" ? "160px" : "(max-width: 768px) 100vw, 320px"}
        className={cn("object-cover", done && "brightness-[.92] saturate-[.85]")}
      />
      {done ? (
        <span
          className={cn(
            "absolute left-2 top-2 inline-flex items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-white shadow",
            size === "sm" ? "h-5 w-5" : "h-7 w-7"
          )}
          aria-label="Watched"
        >
          <Check className={size === "sm" ? "h-3 w-3" : "h-4 w-4"} strokeWidth={3.2} aria-hidden />
        </span>
      ) : upNext && size === "md" ? (
        <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground shadow">
          <Play className="h-3 w-3" aria-hidden /> Up next
        </span>
      ) : null}
      {size === "md" || durationLabel ? (
        <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[11px] font-bold text-white tabular-nums">
          {durationLabel ?? formatDuration(lesson.durationSeconds)}
        </span>
      ) : null}
      {status === "progress" && percent > 0 ? (
        <span className="absolute inset-x-0 bottom-0 h-1 bg-white/35" aria-hidden>
          <span className="block h-full bg-red-500" style={{ width: `${Math.min(100, percent)}%` }} />
        </span>
      ) : null}
    </div>
  );
}
