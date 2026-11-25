"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { CalendarDays, Check, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OutlookCalendarPublicStatus } from "@/lib/outlook-calendar";

const REASONS: Record<string, string> = {
  admin_consent_required:
    "Your Microsoft 365 organization requires an administrator to approve ShootPortal first. Ask your IT admin to approve it, then connect again.",
  access_denied: "Microsoft sign-in was cancelled.",
};

export function OutlookCalendarSettingsCard() {
  const [status, setStatus] = useState<OutlookCalendarPublicStatus | null>(null);
  const [calendarId, setCalendarId] = useState("");
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/integrations/outlook-calendar", { credentials: "include" });
    if (!res.ok) {
      setError("Could not load Outlook Calendar status.");
      return;
    }
    const data = (await res.json()) as OutlookCalendarPublicStatus;
    setStatus(data);
    setCalendarId(data.calendarId || "");
    setBusyIds(data.busyCalendarIds);
  }

  useEffect(() => {
    void load();
    const params = new URLSearchParams(window.location.search);
    const flag = params.get("ocal");
    if (flag === "connected") setMessage("Outlook Calendar connected. Check which calendar shoots go to and which calendars block your availability.");
    if (flag === "error") {
      const reason = params.get("reason") || "";
      setError(REASONS[reason] || "Outlook Calendar connection did not finish. Try connecting again.");
    }
  }, []);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations/outlook-calendar", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId, busyCalendarIds: busyIds }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not save.");
      return;
    }
    setMessage(`Saved. New and updated shoots go to “${data.calendarName || "that calendar"}”.`);
    await load();
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Outlook Calendar? Shoots already on your Outlook calendar stay there.")) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/integrations/outlook-calendar", { method: "DELETE", credentials: "include" });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(data.error || "Could not disconnect.");
      return;
    }
    setMessage(
      "Disconnected. To fully remove ShootPortal's access, remove it at myapps.microsoft.com (work or school) or account.live.com/consent/Manage (personal)."
    );
    await load();
  }

  const broken = status?.status === "needs_reconnect";
  const connected = Boolean(status?.connected);
  const writable = (status?.calendars ?? []).filter((c) => c.canEdit);
  const dirty =
    Boolean(status) &&
    (calendarId !== (status?.calendarId || "") ||
      busyIds.slice().sort().join("|") !== (status?.busyCalendarIds ?? []).slice().sort().join("|"));

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sky-700 text-white">
          <CalendarDays className="h-5 w-5" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-heading">Outlook Calendar</h3>
          <p className="text-[13px] text-muted">Outlook.com or Microsoft 365</p>
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
        <li>Proposed and confirmed shoots are added to the Outlook calendar you pick</li>
        <li>Busy times on the calendars you check keep you from being double-booked</li>
        <li>Works on its own or alongside Google Calendar</li>
      </ul>

      {status && !status.schemaReady ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
          Outlook Calendar is almost ready: apply database migration <strong>v137</strong> to turn it on.
        </p>
      ) : status && !status.configured ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
          Outlook Calendar isn&apos;t configured on this server yet. Set MICROSOFT_CALENDAR_CLIENT_ID and
          MICROSOFT_CALENDAR_CLIENT_SECRET.
        </p>
      ) : null}

      {broken ? (
        <div className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
          This connection is broken{status?.lastError ? `: ${status.lastError.replace(/[.\s]+$/, "")}` : ""}. Microsoft access can expire or be
          removed. Reconnect to resume sync.
        </div>
      ) : null}

      {status?.attentionCount ? (
        <p className="text-sm text-amber-700 surface-dark:text-amber-300">
          {status.attentionCount} shoot{status.attentionCount === 1 ? "" : "s"} could not sync to Outlook and will be retried.
          They are still on the ShootPortal calendar.
        </p>
      ) : null}

      {message ? <p className="text-sm text-muted">{message}</p> : null}
      {error ? <p className="text-sm text-red-600 surface-dark:text-red-400">{error}</p> : null}

      {connected ? (
        <div className="space-y-4 border-t border-border pt-4">
          <p className="text-sm text-foreground">
            Connected{status?.email ? ` as ${status.email}` : ""}.
          </p>
          <div className="space-y-2">
            <Label htmlFor="ocal-calendar">Add shoots to</Label>
            <select
              id="ocal-calendar"
              className="flex h-11 w-full rounded-lg border border-border bg-card px-3 text-sm text-foreground"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
            >
              {!calendarId ? <option value="">Choose a calendar…</option> : null}
              {(writable.length ? writable : status?.calendarId ? [{ id: status.calendarId, name: status.calendarName || "Calendar", isDefault: true }] : []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {c.isDefault ? " (default)" : ""}
                </option>
              ))}
            </select>
          </div>
          {status?.calendars.length ? (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-heading">Block my availability with</legend>
              <p className="text-xs text-muted">Busy times on these calendars hide those times from Instant Booking.</p>
              <div className="space-y-1.5">
                {status.calendars.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 text-sm text-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[var(--accent)]"
                      checked={busyIds.includes(c.id)}
                      onChange={(e) =>
                        setBusyIds((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)))
                      }
                    />
                    {c.color ? <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} aria-hidden /> : null}
                    {c.name}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="accent" className="h-11 sm:h-9" disabled={busy || !calendarId || !dirty} onClick={() => void save()}>
              Save
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
            disabled={busy || !status || !status.configured || !status.schemaReady}
            onClick={() => {
              window.location.href = "/api/integrations/outlook-calendar/start";
            }}
          >
            <Link2 className="h-4 w-4" aria-hidden />
            {broken ? "Reconnect Outlook Calendar" : "Connect Outlook Calendar"}
          </Button>
        </div>
      )}
    </div>
  );
}
