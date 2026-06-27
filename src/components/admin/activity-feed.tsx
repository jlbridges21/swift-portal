"use client";

import Link from "next/link";
import type { ActivityLog } from "@/lib/types";
import { getActivityDisplay, getClientActivityDisplay } from "@/lib/activity-display";
import { Button } from "@/components/ui/button";
import { usePaginatedActivities } from "@/lib/use-paginated-activities";

interface ActivityFeedProps {
  logs: (ActivityLog & { projects?: { id: string; project_name: string } | null })[];
  projectLinkPrefix?: string;
  clientMode?: boolean;
}

export function ActivityFeed({ logs, projectLinkPrefix = "/admin/projects", clientMode = false }: ActivityFeedProps) {
  const { visible, hasMore, allShown, loadMore } = usePaginatedActivities(logs);

  if (!logs.length) {
    return <p className="text-sm text-muted">No recent activity</p>;
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      {visible.map((log) => {
        const { icon, description } = clientMode
          ? getClientActivityDisplay(log.activity_type, log.description)
          : getActivityDisplay(log.activity_type, log.description);
        return (
          <div key={`activity-${log.id}`} className="flex min-w-0 items-start gap-3 text-sm">
            <span className="mt-0.5 shrink-0 text-base leading-none">{icon}</span>
            <div className="min-w-0 flex-1 overflow-hidden">
              <p className="break-words whitespace-normal leading-snug text-foreground">
                {description}
                {log.projects?.project_name && log.project_id && (
                  <>
                    {" — "}
                    <Link
                      href={`${projectLinkPrefix}/${log.project_id}`}
                      className="font-medium text-accent break-words whitespace-normal hover:underline"
                    >
                      {log.projects.project_name}
                    </Link>
                  </>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted break-words whitespace-normal">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
      {hasMore && (
        <Button type="button" variant="outline" className="w-full min-h-11" onClick={loadMore}>
          Load 10 More
        </Button>
      )}
      {allShown && logs.length > 10 && (
        <p className="text-center text-xs text-muted">All activities shown</p>
      )}
    </div>
  );
}
