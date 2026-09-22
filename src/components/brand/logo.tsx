"use client";

import Image from "next/image";
import Link from "next/link";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { resolvePortalLogoHeightPx, type LogoSizeVariant } from "@/lib/brand-logo-size";
import { cn } from "@/lib/utils";

interface LogoProps {
  showText?: boolean;
  compact?: boolean;
  size?: LogoSizeVariant;
  href?: string;
  className?: string;
}

export function Logo({ showText = true, compact = false, size = "md", href = "/", className }: LogoProps) {
  const brand = usePortalBrand();
  const heightPx = resolvePortalLogoHeightPx(brand.logoSizePx, size, compact);
  const textClass =
    compact || size === "sm" ? "text-sm" : size === "lg" ? "text-xl" : "text-lg";

  const content = (
    <div className={cn("flex min-w-0 items-center gap-2", compact ? "gap-2" : "gap-2.5", className)}>
      {/*
        No brand-color tile: transparent PNGs sit on the nav bar.
        Opaque logo files keep their own background — that is the uploaded asset.
      */}
      <div
        className="relative flex shrink-0 items-center justify-center"
        style={{ height: heightPx, width: "auto", maxWidth: Math.round(heightPx * 3.2) }}
      >
        <Image
          src={brand.logoUrl}
          alt={brand.name}
          width={Math.round(heightPx * 3)}
          height={heightPx}
          className="h-full w-auto max-w-full object-contain object-left"
          style={{ height: heightPx, width: "auto" }}
          priority
          unoptimized={brand.logoUrl.startsWith("http")}
        />
      </div>
      {showText && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className={cn("truncate font-semibold text-primary", compact ? "text-sm" : textClass)}>
            {brand.portalName}
          </span>
          {!compact && size !== "sm" && (
            <span className="hidden text-[10px] font-medium uppercase tracking-wider text-muted sm:block">
              {brand.name}
            </span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="transition-opacity hover:opacity-90">
        {content}
      </Link>
    );
  }

  return content;
}
