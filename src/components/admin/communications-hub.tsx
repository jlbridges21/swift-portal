"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  buildCommunicationTimeline,
  filterCommunicationActivities,
  formatCommunicationDateTime,
  type CommunicationTimelineItem,
  type ProjectNotificationRow,
} from "@/lib/communications";
import type { EmailCommunicationSummary } from "@/lib/email-analytics";
import type { ActivityLog } from "@/lib/types";
import { getActivityDisplay } from "@/lib/activity-display";
import { EMAIL_EVENT_LABELS } from "@/lib/email-templates";
import { Bell, Loader2, MessageSquare, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CommunicationsHubProps {
  projectId: string;
  initialEmails?: EmailCommunicationSummary[];
  initialNotifications?: ProjectNotificationRow[];
  initialActivities?: ActivityLog[];
}

function StatRow({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <p className="text-sm text-muted">
      <span className="text-foreground/80">{label}:</span> {formatCommunicationDateTime(value)}
    </p>
  );
}

function EmailCommunicationCard({ email }: { email: EmailCommunicationSummary }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div>
          <p className="font-semibold text-primary">{email.emailLabel}</p>
          <p className="text-xs text-muted mt-0.5">To: {email.recipient}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-primary">
          <span>{email.statusIcon}</span>
          {email.statusLabel}
        </span>
      </div>

      <div className="space-y-1 mb-4">
        <StatRow label="Sent" value={email.sentAt} />
        <StatRow label="Delivered" value={email.deliveredAt} />
        <StatRow label="Opened" value={email.openedAt} />
        <StatRow label="Clicked" value={email.clickedAt} />
        {email.bouncedAt ? (
          <StatRow label="Bounced" value={email.bouncedAt} />
        ) : null}
        {email.complainedAt ? (
          <StatRow label="Complaint" value={email.complainedAt} />
        ) : null}
      </div>

      {email.failureDetail ? (
        <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3">
          {email.failureDetail}
        </p>
      ) : null}

      {email.ctaUrl ? (
        <p className="text-xs text-muted truncate">
          CTA: {email.ctaLabel ? `${email.ctaLabel} → ` : ""}
          <span className="text-accent">{email.ctaUrl}</span>
        </p>
      ) : null}

      {email.events.length > 1 ? (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs font-medium uppercase tracking-wide text-muted mb-2">Lifecycle</p>
          <div className="flex flex-wrap gap-2">
            {email.events.map((event, index) => (
              <span
                key={`${email.resendEmailId}-${event.eventType}-${index}`}
                className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-xs text-foreground"
              >
                {event.icon} {EMAIL_EVENT_LABELS[event.eventType] ?? event.eventType}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function NotificationCard({ notification }: { notification: ProjectNotificationRow }) {
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-lg">🔔</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-primary">In-App Notification</p>
          <p className="text-sm text-foreground mt-1">{notification.title}</p>
          {notification.body ? (
            <p className="text-sm text-muted mt-1 line-clamp-2">{notification.body}</p>
          ) : null}
          <p className="text-xs text-muted mt-2">
            To: {notification.recipient_email ?? notification.recipient_name ?? "Client"} ·{" "}
            {formatCommunicationDateTime(notification.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

function ActivityCommunicationCard({ activity }: { activity: ActivityLog }) {
  const { icon, description } = getActivityDisplay(activity.activity_type, activity.description);
  return (
    <div className="rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="text-lg">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground leading-snug">{description}</p>
          <p className="text-xs text-muted mt-1">
            {formatCommunicationDateTime(activity.created_at)}
          </p>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({ item }: { item: CommunicationTimelineItem }) {
  if (item.kind === "email") return <EmailCommunicationCard email={item.email} />;
  if (item.kind === "notification") return <NotificationCard notification={item.notification} />;
  return <ActivityCommunicationCard activity={item.activity} />;
}

export function CommunicationsHub({
  projectId,
  initialEmails = [],
  initialNotifications = [],
  initialActivities = [],
}: CommunicationsHubProps) {
  const [timeline, setTimeline] = useState<CommunicationTimelineItem[]>(() =>
    buildCommunicationTimeline(initialEmails, initialNotifications, initialActivities)
  );
  const [loading, setLoading] = useState(!initialEmails.length && !initialNotifications.length);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/communications`, {
          credentials: "include",
        });
        if (res.ok) {
          const data = await res.json();
          setTimeline(
            data.timeline ??
              buildCommunicationTimeline(
                data.emails ?? [],
                data.notifications ?? [],
                data.activities ?? []
              )
          );
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [projectId]
  );

  useEffect(() => {
    if (!initialEmails.length && !initialNotifications.length) {
      refresh(true);
    }
  }, [initialEmails.length, initialNotifications.length, refresh]);

  useEffect(() => {
    const interval = setInterval(() => refresh(true), 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  const isEmpty = !loading && timeline.length === 0;

  return (
    <Card className="mb-6" id="communications">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="h-5 w-5 text-accent" />
            Communications
          </CardTitle>
          <CardDescription>
            Client emails, delivery stats, in-app notifications, and project communication history.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh(false)}
          disabled={loading || refreshing}
          className="shrink-0"
          aria-label="Refresh communications"
        >
          {refreshing || loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !timeline.length ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading communication history…
          </div>
        ) : isEmpty ? (
          <div className="rounded-xl border border-dashed border-border bg-slate-50/80 px-6 py-10 text-center">
            <Bell className="h-8 w-8 text-muted mx-auto mb-3 opacity-60" />
            <p className="text-sm font-medium text-primary">No communication history yet.</p>
            <p className="text-sm text-muted mt-2 max-w-md mx-auto leading-relaxed">
              Emails, notifications, proposal updates, scheduling messages, and payment
              communication will appear here as the project progresses.
            </p>
          </div>
        ) : (
          <div className={cn("space-y-4", refreshing && "opacity-70 transition-opacity")}>
            {timeline.map((item) => (
              <TimelineItem key={item.id} item={item} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
