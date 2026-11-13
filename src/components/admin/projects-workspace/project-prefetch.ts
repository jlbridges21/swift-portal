"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { PrefetchKind } from "next/dist/client/components/router-reducer/router-reducer-types";

/**
 * Hover-intent data prefetch for project pages.
 *
 * A full prefetch (page data included) is issued when the user shows intent on a project link,
 * so the click renders from the client cache with no server round trip. Next keeps a full
 * prefetch for `staleTimes.static` (5 min), so we remember when each one was issued and the
 * project page refreshes itself in the background if what it rendered is older than
 * FRESH_FOR_MS — the user sees the page instantly and current data a moment later.
 *
 * Only timestamps keyed by project id live here (per browser tab, no data). Entries are dropped
 * when Next invalidates the prefetch; an entry that outlives the cached data can only cause an
 * extra background refresh, never a missed one.
 */
const FRESH_FOR_MS = 15_000;
const prefetchedAt = new Map<string, number>();

export function prefetchProject(router: AppRouterInstance, href: string, projectId: string) {
  if (prefetchedAt.has(projectId)) return; // already warm (or in flight) — Next dedupes too
  prefetchedAt.set(projectId, Date.now());
  router.prefetch(href, {
    kind: PrefetchKind.FULL,
    onInvalidate: () => prefetchedAt.delete(projectId),
  });
}

/** Rendered by the project page: refresh in the background if it was served from an old prefetch. */
export function ProjectPrefetchFreshness({ projectId }: { projectId: string }) {
  const router = useRouter();
  useEffect(() => {
    const at = prefetchedAt.get(projectId);
    if (at === undefined) return;
    if (Date.now() - at > FRESH_FOR_MS) {
      prefetchedAt.delete(projectId);
      router.refresh();
    }
  }, [projectId, router]);
  return null;
}
