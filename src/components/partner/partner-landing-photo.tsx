"use client";

import { SafeBrandImage } from "@/components/partner/safe-brand-image";
import { PARTNER_DEFAULT_PHOTO_PATH } from "@/lib/partner-landing.constants";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  /** Stored natural width — when set with height, reserves aspect ratio (no CLS). */
  width: number | null;
  height: number | null;
  alt?: string;
  className?: string;
};

/**
 * Personal photo frame for partner landings (settings preview + public page).
 * Never crops: object-contain only. Container follows the image aspect when dims
 * are known; otherwise letterboxes inside a max-height box on a neutral background.
 */
export function PartnerLandingPhoto({
  src,
  width,
  height,
  alt = "",
  className,
}: Props) {
  const hasDims =
    typeof width === "number" &&
    typeof height === "number" &&
    width > 0 &&
    height > 0;

  const fallbackSrc =
    src !== PARTNER_DEFAULT_PHOTO_PATH ? PARTNER_DEFAULT_PHOTO_PATH : undefined;

  return (
    <div
      className={cn(
        "flex w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-subtle",
        className
      )}
    >
      <SafeBrandImage
        src={src}
        fallbackSrc={fallbackSrc}
        alt={alt}
        width={hasDims ? width : undefined}
        height={hasDims ? height : undefined}
        className={cn(
          // Never object-cover — whole image, letterboxed if needed
          "mx-auto block max-h-[min(32rem,70vh)] max-w-full object-contain",
          hasDims ? "h-auto w-auto" : "h-auto w-full"
        )}
        style={hasDims ? { aspectRatio: `${width} / ${height}` } : undefined}
      />
    </div>
  );
}
