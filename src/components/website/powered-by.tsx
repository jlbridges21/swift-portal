import { cn } from "@/lib/utils";

/**
 * Platform credit for websites ShootPortal generates (Business Website, property websites).
 * Brand name as anchor text, new tab, nofollow (automatically inserted link). Inherits the
 * footer's text color so it reads on light and dark templates.
 */
export function PoweredByShootPortal({ className }: { className?: string }) {
  return (
    <p className={cn("text-[11px] leading-5 tracking-[0.02em]", className)}>
      Powered by{" "}
      <a
        href="https://shootportal.app"
        target="_blank"
        rel="noopener nofollow"
        className="font-medium underline-offset-2 hover:underline"
      >
        ShootPortal
      </a>
    </p>
  );
}
