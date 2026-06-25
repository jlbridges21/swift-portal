import Image from "next/image";
import { cn } from "@/lib/utils";

interface AvatarProps {
  name?: string | null;
  src?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

function initials(name?: string | null) {
  if (!name?.trim()) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function Avatar({ name, src, size = "md", className }: AvatarProps) {
  const dim = sizeMap[size];

  if (src) {
    return (
      <div className={cn("relative shrink-0 overflow-hidden rounded-full bg-slate-100", dim, className)}>
        <Image src={src} alt="" fill className="object-cover" sizes="56px" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-accent/90 to-accent font-semibold text-white",
        dim,
        className
      )}
      aria-hidden
    >
      {initials(name)}
    </div>
  );
}
