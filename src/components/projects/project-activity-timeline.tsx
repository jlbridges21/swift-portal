"use client";

import type { ActivityLog } from "@/lib/types";
import { getActivityDisplay, getClientActivityDisplay } from "@/lib/activity-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";
import { usePaginatedActivities } from "@/lib/use-paginated-activities";

interface ProjectActivityTimelineProps {
  activities: ActivityLog[];
  className?: string;
  clientMode?: boolean;
  onRevisionClick?: (revisionId: string) => void;
}

export function ProjectActivityTimeline({
  activities,
  className,
  clientMode = false,
  onRevisionClick,
}: ProjectActivityTimelineProps) {
  const { visible, hasMore, allShown, loadMore } = usePaginatedActivities(activities);

  function displayFor(log: ActivityLog) {
    return clientMode
      ? getClientActivityDisplay(log.activity_type, log.description)
      : getActivityDisplay(log.activity_type, log.description);
  }

  return (
    <Card className={className} id="activity">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5 text-accent" />
          Project Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {visible.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">Activity will appear here as your project progresses.</p>
        ) : (
          <>
            <div className="relative">
              <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
              <ul className="space-y-0">
                {visible.map((log, index) => {
                  const { icon, description } = displayFor(log);
                  const isLast = index === visible.length - 1;
                  const revisionId = log.metadata?.revisionId as string | undefined;
                  const isRevision = log.activity_type === "revision_requested" && revisionId && onRevisionClick;

                  return (
                    <li key={`timeline-${log.id}`} className={cn("relative flex gap-4 pl-0", !isLast && "pb-6")}>
                      <div className="relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-border text-sm shadow-sm">
                        {icon}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        {isRevision ? (
                          <button
                            type="button"
                            onClick={() => onRevisionClick(revisionId)}
                            className="text-sm font-medium text-accent hover:underline text-left leading-snug"
                          >
                            {description} — View request →
                          </button>
                        ) : (
                          <p className="text-sm font-medium text-foreground leading-snug">{description}</p>
                        )}
                        <p className="text-xs text-muted mt-1">
                          {new Date(log.created_at).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
            {hasMore && (
              <Button type="button" variant="outline" className="mt-4 w-full min-h-11" onClick={loadMore}>
                Load 10 More
              </Button>
            )}
            {allShown && activities.length > 10 && (
              <p className="mt-4 text-center text-xs text-muted">All activities shown</p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
