import { cn } from "@/lib/utils";

/**
 * Small count badge pinned to the top-right of an icon button (notification bell, Messages).
 * Colors come from the business brand theme: `--color-accent` is the configured portal accent
 * and `--color-accent-foreground` is the contrast-picked label color for it (brand-color.ts).
 * Renders nothing at 0; shows "9+" above 9.
 */
export function UnreadCountBadge({ count, className }: { count: number; className?: string }) {
  if (!(count > 0)) return null;
  return (
    <span
      className={cn(
        "pointer-events-none absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold leading-none text-accent-foreground",
        className
      )}
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
