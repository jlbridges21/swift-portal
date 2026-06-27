"use client";

import { useEffect, useMemo, useState } from "react";
import type { ActivityLog } from "@/lib/types";

export const ACTIVITY_PAGE_SIZE = 10;

export function usePaginatedActivities<T extends ActivityLog>(
  activities: T[],
  pageSize = ACTIVITY_PAGE_SIZE
) {
  const sorted = useMemo(
    () =>
      [...activities].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ),
    [activities]
  );

  const [visibleCount, setVisibleCount] = useState(pageSize);

  useEffect(() => {
    setVisibleCount(pageSize);
  }, [activities, pageSize]);

  const visible = sorted.slice(0, visibleCount);
  const hasMore = visibleCount < sorted.length;
  const allShown = sorted.length > 0 && visibleCount >= sorted.length;

  function loadMore() {
    setVisibleCount((c) => Math.min(c + pageSize, sorted.length));
  }

  return { visible, hasMore, allShown, loadMore, total: sorted.length };
}
