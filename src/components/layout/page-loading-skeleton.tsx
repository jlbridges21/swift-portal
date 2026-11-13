import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content placeholder shown by route `loading.tsx` boundaries while a page's server data
 * streams in. Because a loading boundary exists, Next can prefetch every sidebar link up
 * to this point and swap it in the instant a link is clicked (the shell never unmounts).
 */
export function PageLoadingSkeleton({ containerClassName }: { containerClassName?: string }) {
  return (
    <main
      className={containerClassName ?? "app-page mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"}
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2.5">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-64 max-w-[70vw]" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </main>
  );
}
