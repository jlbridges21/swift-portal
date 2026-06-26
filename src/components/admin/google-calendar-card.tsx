"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Calendar, Link2, Unlink, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface CalendarOption {
  id: string;
  summary: string;
  primary?: boolean;
}

export function GoogleCalendarCard() {
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [connected, setConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [calendarId, setCalendarId] = useState("");
  const [calendars, setCalendars] = useState<CalendarOption[]>([]);
  const [saving, setSaving] = useState(false);

  async function loadStatus() {
    setLoading(true);
    try {
      const res = await fetch("/api/google-calendar", { credentials: "include" });
      const data = await res.json();
      setConfigured(Boolean(data.configured));
      setConnected(Boolean(data.connected));
      setEmail(data.email ?? null);
      setCalendarId(data.calendarId ?? "");
      setCalendars(data.calendars ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const gcal = searchParams.get("gcal");
    if (gcal === "connected") toast.success("Google Calendar connected");
    if (gcal === "error") toast.error("Google Calendar connection failed");
  }, [searchParams]);

  async function saveCalendar() {
    const cal = calendars.find((c) => c.id === calendarId);
    setSaving(true);
    const res = await fetch("/api/google-calendar", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ calendar_id: calendarId, calendar_summary: cal?.summary ?? calendarId }),
    });
    setSaving(false);
    if (res.ok) toast.success("Sync calendar updated");
    else toast.error("Failed to save calendar");
  }

  async function disconnect() {
    if (!confirm("Disconnect Google Calendar? Existing synced events will not be deleted.")) return;
    await fetch("/api/google-calendar", { method: "DELETE", credentials: "include" });
    toast.success("Disconnected");
    loadStatus();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calendar className="h-5 w-5 text-accent" />
          Google Calendar
        </CardTitle>
        <p className="text-sm text-muted">
          Sync confirmed shoots to Google Calendar. Swift Portal remains the source of truth.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : !configured ? (
          <p className="text-sm text-muted">
            Add <code className="text-xs">GOOGLE_CLIENT_ID</code> and{" "}
            <code className="text-xs">GOOGLE_CLIENT_SECRET</code> to your environment to enable sync.
          </p>
        ) : !connected ? (
          <a href="/api/google-calendar/connect">
            <Button variant="accent" size="sm">
              <Link2 className="h-4 w-4" /> Connect Google Calendar
            </Button>
          </a>
        ) : (
          <>
            <p className="text-sm text-muted">
              Connected as <span className="font-medium text-primary">{email}</span>
            </p>
            {calendars.length > 0 && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Select
                    value={calendarId}
                    onChange={(e) => setCalendarId(e.target.value)}
                    options={calendars.map((c) => ({
                      value: c.id,
                      label: c.primary ? `${c.summary} (Primary)` : c.summary,
                    }))}
                  />
                </div>
                <Button variant="outline" size="sm" disabled={saving} onClick={saveCalendar}>
                  {saving ? "Saving…" : "Save Calendar"}
                </Button>
              </div>
            )}
            <Button variant="ghost" size="sm" className="text-red-600" onClick={disconnect}>
              <Unlink className="h-4 w-4" /> Disconnect
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
