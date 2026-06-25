"use client";

import { useState, useEffect } from "react";
import type { ActivityLog } from "@/lib/types";
import { getActivityDisplay } from "@/lib/activity-display";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { History } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProjectActivityTimelineProps {
  activities: ActivityLog[];
  className?: string;
  onRevisionClick?: (revisionId: string) => void;
}

export function ProjectActivityTimeline({
  activities,
  className,
  onRevisionClick,
}: ProjectActivityTimelineProps) {
  const sorted = [...activities].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );

  return (
    <Card className={className} id="activity">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <History className="h-5 w-5 text-accent" />
          Project Activity
        </CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="text-sm text-muted text-center py-6">Activity will appear here as your project progresses.</p>
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
            <ul className="space-y-0">
              {sorted.map((log, index) => {
                const { icon, description } = getActivityDisplay(log.activity_type, log.description);
                const isLast = index === sorted.length - 1;
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
        )}
      </CardContent>
    </Card>
  );
}
