"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import type { GoogleCalendarPublicStatus } from "@/lib/google-calendar";

export function GoogleCalendarSettingsCard() {
  const [status, setStatus] = useState<GoogleCalendarPublicStatus | null>(null);
  const [calendarId, setCalendarId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/integrations/google-calendar", { credentials: "include" });
    if (!res.ok) {
      setError("Could not load Google Calendar status.");
      return;
    }
    const data = (await res.json()) as GoogleCalendarPublicStatus;
    setStatus(data);
    setCalendarId(data.calendarId || "");
  }

  useEffect(() => {
    void load();
    const flag = new URLSearchParams(window.location.search).get("gcal");
    if (flag === "connected") setMessage("Google Calendar connected. Confirm which calendar ShootPortal writes to.");
    if (flag === "error") setError("Google Calendar connection did not finish. Try connecting again.");
  }, []);

  async function saveCalendar() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations/google-calendar", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save calendar.");
      return;
    }
    setMessage(`ShootPortal will write to ${data.calendarSummary || "that calendar"}. Calendars shown on the calendar page are unchanged.`);
    await load();
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Google Calendar? ShootPortal will revoke access at Google.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations/google-calendar", {
      method: "DELETE",
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not disconnect.");
      return;
    }
    setMessage(
      data.revoked
        ? `Disconnected. Google revoked the token (HTTP ${data.revokeStatus}).`
        : "Disconnected locally. Google did not confirm revocation — remove ShootPortal in your Google Account permissions if it still appears."
    );
    await load();
  }

  const broken = status?.status === "needs_reconnect";

  return (
    <Card className="shadow-sm">
      <CardContent className="space-y-4 pt-6">
        <div>
          <h3 className="text-base font-semibold text-primary">Google Calendar</h3>
          <p className="mt-1 text-sm text-muted">
            Connecting is owner-only. Proposed and confirmed shoots are written to the calendar you
            choose (one hour). Which Google calendars appear is chosen on the Shoot Calendar, saved
            for you, and hidden from staff. Those events open in Google Calendar and cannot be edited here.
          </p>
        </div>

        {status && !status.configured ? (
          <p className="text-sm text-amber-700">
            Google Calendar OAuth is not configured on this server yet. Add a separate OAuth client
            (not the sign-in client) and set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.
          </p>
        ) : null}

        {broken ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            This connection is broken{status?.lastError ? `: ${status.lastError}` : ""}. Google refresh
            tokens can expire or be revoked. Reconnect to resume sync.
          </div>
        ) : null}

        {status?.attentionCount ? (
          <p className="text-sm text-amber-800">
            {status.attentionCount} shoot{status.attentionCount === 1 ? "" : "s"} could not sync to Google
            and need attention. They are still on the ShootPortal calendar.
          </p>
        ) : null}

        {message ? <p className="text-sm text-muted">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        {status?.connected ? (
          <div className="space-y-3">
            <p className="text-sm">
              Connected{status.email ? ` as ${status.email}` : ""}. Writing to{" "}
              <strong>{status.calendarSummary || status.calendarId}</strong>.
            </p>
            <div className="space-y-2">
              <Label htmlFor="gcal-calendar">Write shoots to</Label>
              <select
                id="gcal-calendar"
                className="flex h-11 w-full rounded-md border border-border bg-white px-3 text-sm"
                value={calendarId}
                onChange={(e) => setCalendarId(e.target.value)}
              >
                {(status.calendars.length ? status.calendars : [{ id: status.calendarId || "primary", summary: status.calendarSummary || "Primary", primary: true }]).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.summary}
                    {c.primary ? " (primary)" : ""}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted">
                Defaults to the primary calendar at connect. Which calendars appear is chosen on the Shoot Calendar and saved for each admin.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="accent" size="sm" disabled={busy || !calendarId} onClick={() => void saveCalendar()}>
                Save write calendar
              </Button>
              <Button type="button" variant="outline" size="sm" disabled={busy} onClick={() => void disconnect()}>
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="accent"
              size="sm"
              disabled={busy || status?.configured === false}
              onClick={() => {
                window.location.href = "/api/integrations/google-calendar/start";
              }}
            >
              {broken ? "Reconnect Google Calendar" : "Connect Google Calendar"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
