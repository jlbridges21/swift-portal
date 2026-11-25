"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarCheck2, Check, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NativeSelect, Notice } from "@/components/admin/booking/booking-ui";
import { cn } from "@/lib/utils";

type Connection = {
  userId: string;
  email: string | null;
  status: "active" | "needs_reconnect";
  busyCalendarIds: string[];
  destinationCalendarId: string;
  destinationCalendarSummary: string | null;
};

type MyCalendarState = {
  configured: boolean;
  ready: boolean;
  connection: Connection | null;
  calendars: { id: string; summary: string; primary: boolean; writable: boolean }[];
  calendarsError: string | null;
  strategy: "shared" | "individual";
  connectUrl: string;
};

export function GoogleMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function googleConnectHref(base: string) {
  const here = typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : "/admin/calendar";
  const clean = here.replace(/[?&]mycal=[^&]*/, "").replace(/\?$/, "");
  return `${base}&return=${encodeURIComponent(clean || "/admin/calendar")}`;
}

/** The signed-in team member's own Google Calendar: connect, choose calendars, disconnect. */
export function MyGoogleCalendarPanel({ onChanged }: { onChanged?: () => void }) {
  const [state, setState] = useState<MyCalendarState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/booking/my-calendar", { credentials: "include", cache: "no-store" });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error || "Couldn't load your calendar connection.");
      return;
    }
    const next = body as MyCalendarState;
    setState(next);
    setBusy(next.connection?.busyCalendarIds ?? []);
    setDestination(next.connection?.destinationCalendarId ?? "");
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/booking/my-calendar", {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ busyCalendarIds: busy, destinationCalendarId: destination }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(body.error || "Couldn't save.");
      return;
    }
    toast.success("Calendar choices saved.");
    await load();
    onChanged?.();
  }

  async function disconnect() {
    if (!window.confirm("Disconnect your Google Calendar? Your busy times stop blocking bookings, and upcoming shoots move to the business calendar.")) return;
    setDisconnecting(true);
    const res = await fetch("/api/booking/my-calendar", { method: "DELETE", credentials: "include" });
    const body = await res.json().catch(() => ({}));
    setDisconnecting(false);
    if (!res.ok) {
      toast.error(body.error || "Couldn't disconnect.");
      return;
    }
    toast.success(body.moved ? `Disconnected. ${body.moved} upcoming shoot(s) moved to the business calendar.` : "Disconnected.");
    await load();
    onChanged?.();
  }

  if (error) return <Notice tone="warn">{error}</Notice>;
  if (!state) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your calendar…
      </p>
    );
  }
  if (!state.ready) {
    return <Notice tone="warn">Personal calendar connections need database migration v133. Ask the account owner to apply it.</Notice>;
  }
  if (!state.configured) return <Notice tone="warn">Google Calendar isn&apos;t configured on this server.</Notice>;

  const conn = state.connection;
  if (!conn) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          Connect your own Google account so your personal appointments block your availability, and your confirmed shoots land on
          your calendar. Nobody else at the business sees your event details, only that you&apos;re busy.
        </p>
        <a href={googleConnectHref(state.connectUrl)} className="inline-flex">
          <Button variant="accent" type="button">
            <GoogleMark className="h-4 w-4" /> Connect my Google Calendar
          </Button>
        </a>
      </div>
    );
  }

  if (conn.status === "needs_reconnect") {
    return (
      <div className="space-y-3 text-sm">
        <Notice tone="warn">
          Google stopped accepting the connection for {conn.email ?? "your account"}. Until you reconnect, you won&apos;t be offered for
          bookings (so nothing gets double-booked).
        </Notice>
        <div className="flex flex-wrap gap-2">
          <a href={googleConnectHref(state.connectUrl)}>
            <Button variant="accent" type="button">
              <GoogleMark className="h-4 w-4" /> Reconnect
            </Button>
          </a>
          <Button variant="outline" type="button" onClick={disconnect} disabled={disconnecting}>
            <Unplug className="h-4 w-4" /> Disconnect
          </Button>
        </div>
      </div>
    );
  }

  const writable = state.calendars.filter((c) => c.writable);
  const dirty =
    JSON.stringify([...busy].sort()) !== JSON.stringify([...conn.busyCalendarIds].sort()) || destination !== conn.destinationCalendarId;

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900 surface-dark:border-emerald-900 surface-dark:bg-emerald-950/40 surface-dark:text-emerald-200">
        <span className="flex items-center gap-2 font-medium">
          <Check className="h-4 w-4" /> Connected as {conn.email ?? "your Google account"}
        </span>
        <Button variant="ghost" size="sm" type="button" onClick={disconnect} disabled={disconnecting}>
          {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />} Disconnect
        </Button>
      </div>

      {state.calendarsError ? <Notice tone="warn">{state.calendarsError}</Notice> : null}

      <div>
        <p className="font-medium text-heading">Calendars that block your availability</p>
        <p className="text-xs text-muted">Busy times on these calendars keep clients from booking you then. All-day events don&apos;t block.</p>
        <div className="mt-2 space-y-1.5">
          {state.calendars.map((c) => {
            const on = busy.includes(c.id);
            return (
              <label
                key={c.id}
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2",
                  on ? "border-accent bg-accent-subtle/60" : "border-border"
                )}
              >
                <input
                  type="checkbox"
                  className="h-4 w-4 accent-accent"
                  checked={on}
                  onChange={(e) => setBusy((prev) => (e.target.checked ? [...prev, c.id] : prev.filter((x) => x !== c.id)))}
                />
                <span className="min-w-0 truncate">{c.summary}</span>
                {c.primary ? <span className="text-xs text-muted">(primary)</span> : null}
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <p className="font-medium text-heading">Calendar for your confirmed shoots</p>
        <NativeSelect
          ariaLabel="Calendar for your confirmed shoots"
          className="mt-2"
          value={destination}
          onChange={setDestination}
          options={writable.map((c) => ({ value: c.id, label: `${c.summary}${c.primary ? " (primary)" : ""}` }))}
        />
        {state.strategy !== "individual" ? (
          <p className="mt-1.5 flex items-start gap-1.5 text-xs text-amber-700 surface-dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Right now all shoots go on the business calendar. The owner can switch Settings → Instant Booking → Google Calendar to
            &ldquo;Each photographer&apos;s own calendar&rdquo; to send yours here.
          </p>
        ) : (
          <p className="mt-1.5 text-xs text-muted">New, rescheduled and reassigned shoots are written here with your Google account.</p>
        )}
      </div>

      <div className="flex justify-end">
        <Button variant="accent" type="button" disabled={!dirty || saving || !busy.length} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />} Save
        </Button>
      </div>
    </div>
  );
}

/**
 * Opens the panel. Opens itself after returning from Google (?mycal=connected|error).
 */
export function MyGoogleCalendarButton({
  className,
  label = "My Google Calendar",
  onClosed,
}: {
  className?: string;
  label?: string;
  /** After the panel closes (e.g. reload a status list). */
  onClosed?: () => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("mycal");
    if (!result) return;
    if (result === "connected") toast.success("Your Google Calendar is connected.");
    else toast.error("Google didn't finish connecting your calendar. Try again.");
    params.delete("mycal");
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    setOpen(true);
  }, []);
  return (
    <>
      <Button variant="outline" size="sm" type="button" className={className} onClick={() => setOpen(true)}>
        <GoogleMark className="h-4 w-4" /> {label}
      </Button>
      <Modal
        open={open}
        onClose={() => {
          setOpen(false);
          onClosed?.();
        }}
        title="My Google Calendar"
        className="sm:max-w-lg"
      >
        <MyGoogleCalendarPanel />
      </Modal>
    </>
  );
}
