/** Skeleton while a shared folder (or subfolder) loads — same layout as the page. */
export default function SharedMediaLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background" aria-busy="true" aria-label="Loading shared folder">
      <div className="border-b border-border bg-card/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="h-8 w-28 animate-pulse rounded-lg bg-subtle" />
          <div className="h-10 w-24 animate-pulse rounded-lg bg-subtle" />
        </div>
      </div>
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-3 py-4 sm:gap-8 sm:px-6 sm:py-6">
        <div className="h-44 animate-pulse rounded-3xl bg-subtle sm:h-56" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card">
              <div className="aspect-[16/10] animate-pulse bg-subtle" />
              <div className="flex items-center gap-3 px-4 py-3.5">
                <div className="h-10 w-10 animate-pulse rounded-xl bg-subtle" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/2 animate-pulse rounded bg-subtle" />
                  <div className="h-3 w-1/3 animate-pulse rounded bg-subtle" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
