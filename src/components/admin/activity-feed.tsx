"use client";

import Link from "next/link";
import type { ActivityLog } from "@/lib/types";
import { getActivityDisplay } from "@/lib/activity-display";

interface ActivityFeedProps {
  logs: (ActivityLog & { projects?: { id: string; project_name: string } | null })[];
  projectLinkPrefix?: string;
}

export function ActivityFeed({ logs, projectLinkPrefix = "/admin/projects" }: ActivityFeedProps) {
  if (!logs.length) {
    return <p className="text-sm text-muted">No recent activity</p>;
  }

  return (
    <div className="space-y-4">
      {logs.map((log) => {
        const { icon, description } = getActivityDisplay(log.activity_type, log.description);
        return (
          <div key={`activity-${log.id}`} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 text-base leading-none">{icon}</span>
            <div>
              <p className="text-foreground leading-snug">
                {description}
                {log.projects?.project_name && log.project_id && (
                  <>
                    {" — "}
                    <Link
                      href={`${projectLinkPrefix}/${log.project_id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {log.projects.project_name}
                    </Link>
                  </>
                )}
              </p>
              <p className="text-xs text-muted mt-0.5">
                {new Date(log.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
