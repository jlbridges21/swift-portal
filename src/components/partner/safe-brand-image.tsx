"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";

type Props = {
  src: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  width?: number;
  height?: number;
  /** When the primary src fails, try this once (e.g. default partner photo). */
  fallbackSrc?: string;
  /** Called when both src and fallback fail (or src alone with no fallback). */
  onUnavailable?: () => void;
};

/**
 * Image that degrades silently on 404 / broken URLs — no broken-image icon.
 */
export function SafeBrandImage({
  src,
  alt = "",
  className,
  style,
  width,
  height,
  fallbackSrc,
  onUnavailable,
}: Props) {
  const [current, setCurrent] = useState(src);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    setCurrent(src);
    setHidden(false);
  }, [src]);

  if (hidden) return null;

  return (
    // eslint-disable-next-line @next/next/no-img-element -- partner / local brand assets
    <img
      src={current}
      alt={alt}
      width={width}
      height={height}
      className={cn(className)}
      style={style}
      onError={() => {
        if (fallbackSrc && current !== fallbackSrc) {
          setCurrent(fallbackSrc);
          return;
        }
        setHidden(true);
        onUnavailable?.();
      }}
    />
  );
}
