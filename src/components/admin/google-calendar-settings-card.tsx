"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CalendarDays, Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
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
  const connected = Boolean(status?.connected);

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-heading">Google Calendar</h3>
          <p className="text-[13px] text-muted">Shoots appear on your calendar</p>
        </div>
        {status ? (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
              broken
                ? "bg-amber-50 text-amber-700 surface-dark:bg-amber-500/15 surface-dark:text-amber-300"
                : connected
                  ? "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300"
                  : "bg-subtle text-muted"
            )}
          >
            {connected && !broken ? <Check className="h-3 w-3" strokeWidth={3} aria-hidden /> : null}
            {broken ? "Needs reconnect" : connected ? "Connected" : "Not connected"}
          </span>
        ) : null}
      </div>

      <ul className="list-disc space-y-1 pl-5 text-[13px] text-foreground">
        <li>Proposed and confirmed shoots are added to the calendar you pick (one-way, one hour)</li>
        <li>Pick which Google calendars show on your Shoot Calendar</li>
        <li>Owner only; Google events are hidden from staff and open in Google</li>
      </ul>

      {status && !status.configured ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
          Google Calendar OAuth is not configured on this server yet. Add a separate OAuth client
          (not the sign-in client) and set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET.
        </p>
      ) : null}

      {broken ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
          This connection is broken{status?.lastError ? `: ${status.lastError}` : ""}. Google access can
          expire or be revoked. Reconnect to resume sync.
        </div>
      ) : null}

      {status?.attentionCount ? (
        <p className="text-sm text-amber-700 surface-dark:text-amber-300">
          {status.attentionCount} shoot{status.attentionCount === 1 ? "" : "s"} could not sync to Google
          and need attention. They are still on the ShootPortal calendar.
        </p>
      ) : null}

      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 surface-dark:text-red-400">{error}</p> : null}

      {status?.connected ? (
        <div className="space-y-3 border-t border-border pt-4">
          <p className="text-sm text-foreground">
            Connected{status.email ? ` as ${status.email}` : ""}. Writing to{" "}
            <strong className="text-heading">{status.calendarSummary || status.calendarId}</strong>.
          </p>
          <div className="space-y-2">
            <Label htmlFor="gcal-calendar">Write shoots to</Label>
            <select
              id="gcal-calendar"
              className="flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
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
              Starts as your primary calendar. Which calendars appear is chosen on the Shoot Calendar.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="accent" className="h-11 sm:h-9" disabled={busy || !calendarId} onClick={() => void saveCalendar()}>
              Save write calendar
            </Button>
            <Button type="button" variant="outline" className="h-11 sm:h-9" disabled={busy} onClick={() => void disconnect()}>
              Disconnect
            </Button>
          </div>
        </div>
      ) : (
        <div>
          <Button
            type="button"
            variant="accent"
            className="h-11"
            disabled={busy || status?.configured === false}
            onClick={() => {
              window.location.href = "/api/integrations/google-calendar/start";
            }}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            {broken ? "Reconnect Google Calendar" : "Connect Google Calendar"}
          </Button>
        </div>
      )}
    </div>
  );
}
