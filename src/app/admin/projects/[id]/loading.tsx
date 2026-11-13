"use client";

import { Header } from "@/components/layout/header";
import { Skeleton } from "@/components/ui/skeleton";
import { useAdminCapabilities } from "@/components/admin/admin-capabilities-context";

/**
 * Loading boundary for one project. It must live at the [id] level: Next.js only shows a
 * loading fallback when the segment directly under the boundary changes, so the /admin
 * boundary never appears for Projects → project (the `projects` segment stays the same).
 * Because this boundary exists, the router can show it the moment a project link is clicked.
 * Shaped like the project workspace (action bar, cover, tabs, sidebar).
 */
export default function ProjectLoading() {
  const { userRole } = useAdminCapabilities();
  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={userRole === "staff" ? "staff" : "admin"} />
      <main
        className="app-page app-page-table mx-auto w-full max-w-7xl min-w-0 overflow-x-clip px-4 py-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 md:pb-8"
        aria-busy="true"
        aria-live="polite"
      >
        <span className="sr-only">Loading project…</span>
        <div className="space-y-4 pb-6">
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-9 w-40" />
            <div className="flex gap-2">
              <Skeleton className="h-9 w-28" />
              <Skeleton className="h-9 w-9" />
            </div>
          </div>
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_17rem] 2xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0 space-y-4">
              <Skeleton className="h-44 rounded-2xl sm:h-52 xl:h-56" />
              <Skeleton className="h-10 w-full max-w-xl" />
              <div className="flex gap-2 border-b border-border pb-2">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-8 w-24" />
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {Array.from({ length: 8 }, (_, i) => (
                  <Skeleton key={i} className="aspect-[4/3] w-full rounded-xl" />
                ))}
              </div>
            </div>
            <div className="hidden space-y-4 xl:block">
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
