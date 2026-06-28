import { cn } from "@/lib/utils";

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-slate-200/80", className)}
      aria-hidden
    />
  );
}

export function MediaThumbnailSkeleton({ className }: { className?: string }) {
  return (
    <Skeleton
      className={cn("aspect-[4/3] w-full rounded-xl", className)}
    />
  );
}
