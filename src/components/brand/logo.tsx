import Image from "next/image";
import Link from "next/link";
import { usePortalBrand } from "@/components/brand/brand-provider";
import { cn } from "@/lib/utils";

interface LogoProps {
  showText?: boolean;
  compact?: boolean;
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

const sizes = {
  sm: { box: "h-8 w-8 p-1", img: 24, text: "text-sm" },
  md: { box: "h-10 w-10 p-1.5", img: 28, text: "text-lg" },
  lg: { box: "h-12 w-12 p-2", img: 32, text: "text-xl" },
};

export function Logo({ showText = true, compact = false, size = "md", href = "/", className }: LogoProps) {
  const brand = usePortalBrand();
  const s = sizes[compact ? "sm" : size];

  const content = (
    <div className={cn("flex min-w-0 items-center gap-2", compact ? "gap-2" : "gap-2.5", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg shadow-sm",
          s.box
        )}
        style={{ backgroundColor: brand.primaryColor }}
      >
        <Image
          src={brand.logoUrl}
          alt={brand.name}
          width={s.img}
          height={s.img}
          className="h-auto w-full object-contain"
          priority
          unoptimized={brand.logoUrl.startsWith("http")}
        />
      </div>
      {showText && (
        <div className="flex min-w-0 flex-col leading-tight">
          <span className={cn("truncate font-semibold text-primary", compact ? "text-sm" : s.text)}>
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
