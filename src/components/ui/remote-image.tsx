"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

/** Hostnames allowed for next/image optimization */
const OPTIMIZED_HOSTS = [
  "supabase.co",
  "img.youtube.com",
  "assets.cdn.filesafe.space",
  "i.ytimg.com",
];

function canUseNextImage(src: string): boolean {
  try {
    const host = new URL(src).hostname;
    return OPTIMIZED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

interface RemoteImageProps {
  src: string;
  alt: string;
  fill?: boolean;
  className?: string;
  sizes?: string;
  priority?: boolean;
}

/**
 * Uses next/image for trusted hosts (Supabase, YouTube).
 * Falls back to native <img> for third-party thumbnails (gstatic, Kuula, etc.).
 */
export function RemoteImage({ src, alt, fill, className, sizes, priority }: RemoteImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={cn("flex items-center justify-center bg-slate-100 text-xs text-muted", className, fill && "absolute inset-0")}>
        —
      </div>
    );
  }

  if (canUseNextImage(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        fill={fill}
        className={className}
        sizes={sizes}
        priority={priority}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={cn("absolute inset-0 h-full w-full object-cover", className)}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
