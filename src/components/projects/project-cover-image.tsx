"use client";

import { RemoteImage } from "@/components/ui/remote-image";
import { CoverPlaceholder } from "@/components/projects/cover-placeholder";
import { cn } from "@/lib/utils";

/**
 * A project's hero image (the photo chosen with "Set as cover" on the project
 * page) as a card thumbnail. Parent sets the size; this fills it. Falls back to
 * the same branded placeholder used on client project cards.
 */
export function ProjectCoverImage({
  src,
  alt = "",
  sizes = "320px",
  className,
}: {
  src: string | null | undefined;
  alt?: string;
  sizes?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative overflow-hidden bg-slate-100 surface-dark:bg-subtle", className)}>
      {src ? (
        <RemoteImage src={src} alt={alt} fill sizes={sizes} className="object-cover" />
      ) : (
        <CoverPlaceholder variant="thumb" />
      )}
    </div>
  );
}
