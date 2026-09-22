import { cn } from "@/lib/utils";

/**
 * Quiet informational chip for public-link / shared-viewer surfaces.
 * Never use `bg-muted` alone — that token is a mid slate used for body text.
 */
export function ViewOnlyAccessChip({
  className,
  children = "Shared project · view only",
  /** `onDark` for hero overlays; default for light page chrome. */
  tone = "light",
}: {
  className?: string;
  children?: React.ReactNode;
  tone?: "light" | "onDark";
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium tracking-wide shadow-none",
        tone === "onDark"
          ? "border border-white/25 bg-white/10 text-white/85 backdrop-blur-sm"
          : "border border-slate-200/90 bg-white/90 text-slate-600",
        className
      )}
    >
      {children}
    </span>
  );
}
