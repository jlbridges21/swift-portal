import Image from "next/image";
import Link from "next/link";
import { BRAND } from "@/lib/brand";
import { cn } from "@/lib/utils";

interface LogoProps {
  showText?: boolean;
  size?: "sm" | "md" | "lg";
  href?: string;
  className?: string;
}

const sizes = {
  sm: { box: "h-8 w-8 p-1", img: 24, text: "text-sm" },
  md: { box: "h-10 w-10 p-1.5", img: 28, text: "text-lg" },
  lg: { box: "h-12 w-12 p-2", img: 32, text: "text-xl" },
};

export function Logo({ showText = true, size = "md", href = "/", className }: LogoProps) {
  const s = sizes[size];

  const content = (
    <div className={cn("flex items-center gap-2.5", className)}>
      <div
        className={cn(
          "flex shrink-0 items-center justify-center rounded-lg bg-primary shadow-sm",
          s.box
        )}
      >
        <Image
          src={BRAND.logoUrl}
          alt={BRAND.name}
          width={s.img}
          height={s.img}
          className="h-auto w-full object-contain"
          priority
        />
      </div>
      {showText && (
        <div className="flex flex-col leading-tight">
          <span className={cn("font-semibold text-primary", s.text)}>{BRAND.portalName}</span>
          {size !== "sm" && (
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
              {BRAND.name}
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
