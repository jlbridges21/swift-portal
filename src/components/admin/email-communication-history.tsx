"use client";

import { useCallback, useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EMAIL_EVENT_LABELS, EMAIL_TYPE_LABELS } from "@/lib/email-templates";
import type { EmailCommunicationGroup } from "@/lib/email-analytics";
import { Loader2, Mail, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface EmailCommunicationHistoryProps {
  projectId: string;
  initialGroups?: EmailCommunicationGroup[];
}

function formatEventTime(iso: string) {
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const time = date.toLocaleString("en-US", { hour: "numeric", minute: "2-digit" });
  if (isToday) return `Today ${time}`;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventLabel(eventType: string, customLabel?: string) {
  if (eventType === "clicked" && customLabel) return customLabel;
  return EMAIL_EVENT_LABELS[eventType] ?? eventType;
}

export function EmailCommunicationHistory({
  projectId,
  initialGroups = [],
}: EmailCommunicationHistoryProps) {
  const [groups, setGroups] = useState<EmailCommunicationGroup[]>(initialGroups);
  const [loading, setLoading] = useState(!initialGroups.length);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/email-events`, {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setGroups(data.groups ?? []);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!initialGroups.length) refresh(true);
  }, [initialGroups.length, refresh]);

  useEffect(() => {
    const interval = setInterval(() => refresh(true), 30000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <Card className="mb-6" id="communication">
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Mail className="h-5 w-5 text-accent" />
            Communication History
          </CardTitle>
          <CardDescription>
            Email delivery, opens, and clicks update automatically from Resend.
          </CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => refresh(false)}
          disabled={loading || refreshing}
          className="shrink-0"
        >
          {refreshing || loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
        </Button>
      </CardHeader>
      <CardContent>
        {loading && !groups.length ? (
          <div className="flex items-center gap-2 text-sm text-muted py-6 justify-center">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading email activity…
          </div>
        ) : !groups.length ? (
          <p className="text-sm text-muted text-center py-6">
            Client emails will appear here once notifications are sent.
          </p>
        ) : (
          <div className="space-y-5">
            {groups.map((group) => (
              <div
                key={group.resendEmailId}
                className="rounded-xl border border-border bg-white/80 p-4 shadow-sm"
              >
                <div className="mb-3">
                  <p className="font-semibold text-primary">
                    {EMAIL_TYPE_LABELS[group.emailType] ?? group.emailLabel}
                  </p>
                  <p className="text-xs text-muted mt-0.5">
                    To {group.recipient}
                    {group.subject ? ` · ${group.subject}` : ""}
                  </p>
                </div>
                <div className="space-y-2">
                  {group.events.map((event, index) => (
                    <div
                      key={`${group.resendEmailId}-${event.eventType}-${index}`}
                      className="flex items-start gap-3 text-sm"
                    >
                      <span className="text-base leading-none mt-0.5">{event.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            "font-medium",
                            event.eventType === "bounced" || event.eventType === "complained"
                              ? "text-amber-800"
                              : "text-foreground"
                          )}
                        >
                          {eventLabel(event.eventType, event.label)}
                        </p>
                        <p className="text-xs text-muted mt-0.5">
                          {formatEventTime(event.occurredAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
