"use client";

import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, CalendarDays, Check, ChevronLeft, ChevronRight, Link2, Loader2, Unplug } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NativeSelect, Notice } from "@/components/admin/booking/booking-ui";
import { GoogleMark, MyGoogleCalendarPanel, googleConnectHref } from "@/components/admin/booking/my-google-calendar";
import { cn } from "@/lib/utils";
import type { OutlookCalendarPublicStatus } from "@/lib/outlook-calendar";

type OutlookState = OutlookCalendarPublicStatus & { canManage?: boolean };

type GoogleSummary = {
  configured: boolean;
  ready: boolean;
  connection: { email: string | null; status: "active" | "needs_reconnect" } | null;
  connectUrl: string;
};

type View = "list" | "google" | "outlook";

const OUTLOOK_REASONS: Record<string, string> = {
  admin_consent_required:
    "Your Microsoft 365 organization requires an administrator to approve ShootPortal first. Ask your IT admin to approve it, then connect again.",
  access_denied: "Microsoft sign-in was cancelled.",
};

export function OutlookMark({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center justify-center rounded-[5px] bg-[#0078D4] text-white", className)} aria-hidden>
      <CalendarDays className="h-[70%] w-[70%]" strokeWidth={2.25} />
    </span>
  );
}

function outlookConnectHref() {
  const path = typeof window !== "undefined" ? window.location.pathname : "/admin/calendar";
  return `/api/integrations/outlook-calendar/start?return=${encodeURIComponent(path)}`;
}

async function fetchOutlook(): Promise<OutlookState | null> {
  const res = await fetch("/api/integrations/outlook-calendar", { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as OutlookState;
}

async function fetchGoogle(): Promise<GoogleSummary | null> {
  const res = await fetch("/api/booking/my-calendar", { credentials: "include", cache: "no-store" });
  if (!res.ok) return null;
  return (await res.json()) as GoogleSummary;
}

/** The business's Outlook calendar: which calendar gets shoots, which block availability, disconnect. */
export function OutlookCalendarPanel({ onChanged }: { onChanged?: () => void }) {
  const [state, setState] = useState<OutlookState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string[]>([]);
  const [destination, setDestination] = useState("");
  const [saving, setSaving] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const load = useCallback(async () => {
    const next = await fetchOutlook();
    if (!next) {
      setError("Couldn't load your Outlook connection.");
      return;
    }
    setState(next);
    setBusy(next.busyCalendarIds);
    setDestination(next.calendarId || "");
    setError(null);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    const res = await fetch("/api/integrations/outlook-calendar", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ calendarId: destination, busyCalendarIds: busy }),
    });
    const body = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(body.error || "Couldn't save.");
      return;
    }
    toast.success("Outlook calendar choices saved.");
    await load();
    onChanged?.();
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Outlook Calendar? Shoots already on your Outlook calendar stay there.")) return;
    setDisconnecting(true);
    const res = await fetch("/api/integrations/outlook-calendar", { method: "DELETE", credentials: "include" });
    const body = await res.json().catch(() => ({}));
    setDisconnecting(false);
    if (!res.ok) {
      toast.error(body.error || "Couldn't disconnect.");
      return;
    }
    toast.success("Outlook Calendar disconnected.");
    await load();
    onChanged?.();
  }

  if (error) return <Notice tone="warn">{error}</Notice>;
  if (!state) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your Outlook calendar…
      </p>
    );
  }
  if (!state.schemaReady) return <Notice tone="warn">Outlook Calendar needs database migration v137.</Notice>;
  if (!state.configured) return <Notice tone="warn">Outlook Calendar isn&apos;t configured on this server.</Notice>;
  if (!state.canManage) {
    return (
      <Notice>
        {state.connected
          ? "The account owner connected an Outlook calendar for the business. Only they can change it."
          : "Only the account owner can connect Outlook Calendar."}
      </Notice>
    );
  }

  if (!state.connected) {
    return (
      <div className="space-y-3 text-sm">
        <p className="text-muted">
          Connect Outlook.com or Microsoft 365. Shoots are added to the Outlook calendar you pick, and busy times on the calendars you
          check keep clients from booking you then.
        </p>
        <a href={outlookConnectHref()} className="inline-flex">
          <Button variant="accent" type="button">
            <Link2 className="h-4 w-4" /> Connect Outlook Calendar
          </Button>
        </a>
      </div>
    );
  }

  if (state.status === "needs_reconnect") {
    return (
      <div className="space-y-3 text-sm">
        <Notice tone="warn">
          Microsoft stopped accepting the connection for {state.email ?? "your account"}
          {state.lastError ? ` (${state.lastError.replace(/[.\s]+$/, "")})` : ""}. Until you reconnect, you won&apos;t be offered for
          bookings (so nothing gets double-booked).
        </Notice>
        <div className="flex flex-wrap gap-2">
          <a href={outlookConnectHref()}>
            <Button variant="accent" type="button">
              <Link2 className="h-4 w-4" /> Reconnect
            </Button>
          </a>
          <Button variant="outline" type="button" onClick={disconnect} disabled={disconnecting}>
            <Unplug className="h-4 w-4" /> Disconnect
          </Button>
        </div>
      </div>
    );
  }

  const writable = state.calendars.filter((c) => c.canEdit);
  const destinationOptions = (writable.length
    ? writable
    : state.calendarId
      ? [{ id: state.calendarId, name: state.calendarName || "Calendar", isDefault: true }]
      : []
  ).map((c) => ({ value: c.id, label: `${c.name}${c.isDefault ? " (default)" : ""}` }));
  const dirty =
    JSON.stringify([...busy].sort()) !== JSON.stringify([...state.busyCalendarIds].sort()) || destination !== (state.calendarId || "");

  return (
    <div className="space-y-4 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900 surface-dark:border-emerald-900 surface-dark:bg-emerald-950/40 surface-dark:text-emerald-200">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <Check className="h-4 w-4 shrink-0" /> <span className="truncate">Connected as {state.email ?? "your Microsoft account"}</span>
        </span>
        <Button variant="ghost" size="sm" type="button" onClick={disconnect} disabled={disconnecting}>
          {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />} Disconnect
        </Button>
      </div>

      {state.attentionCount ? (
        <Notice tone="warn">
          {state.attentionCount} shoot{state.attentionCount === 1 ? "" : "s"} couldn&apos;t sync to Outlook and will be retried. They&apos;re
          still on the ShootPortal calendar.
        </Notice>
      ) : null}

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
                <span className="min-w-0 truncate">{c.name}</span>
                {c.isDefault ? <span className="text-xs text-muted">(default)</span> : null}
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
          options={destination ? destinationOptions : [{ value: "", label: "Choose a calendar…" }, ...destinationOptions]}
        />
        <p className="mt-1.5 text-xs text-muted">Proposed and confirmed shoots are added here, and removed if they&apos;re cancelled.</p>
      </div>

      <div className="flex justify-end">
        <Button variant="accent" type="button" disabled={!dirty || saving || !destination} onClick={save}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck2 className="h-4 w-4" />} Save
        </Button>
      </div>
    </div>
  );
}

function ProviderRow({
  icon,
  name,
  status,
  tone,
  action,
}: {
  icon: React.ReactNode;
  name: string;
  status: string;
  tone: "connected" | "warn" | "muted";
  action: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border px-3 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-white surface-dark:bg-subtle">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium text-heading">{name}</p>
        <p
          className={cn(
            "flex min-w-0 items-center gap-1 text-xs",
            tone === "connected"
              ? "text-emerald-700 surface-dark:text-emerald-300"
              : tone === "warn"
                ? "text-amber-700 surface-dark:text-amber-300"
                : "text-muted"
          )}
        >
          {tone === "connected" ? <Check className="h-3 w-3 shrink-0" strokeWidth={3} aria-hidden /> : null}
          <span className="truncate">{status}</span>
        </p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

/**
 * "Connect calendar" / "My calendars" on the Shoot Calendar: one modal listing Google and Outlook,
 * each with Connect, or (once connected) its settings. Reopens on the right view after the
 * provider redirects back (?mycal= for Google, ?ocal= for Outlook).
 */
export function CalendarConnectionsButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("list");
  const [google, setGoogle] = useState<GoogleSummary | null>(null);
  const [outlook, setOutlook] = useState<OutlookState | null>(null);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [g, o] = await Promise.all([fetchGoogle().catch(() => null), fetchOutlook().catch(() => null)]);
    setGoogle(g);
    setOutlook(o);
    setLoaded(true);
  }, []);

  useEffect(() => {
    void refresh();
    const params = new URLSearchParams(window.location.search);
    const mycal = params.get("mycal");
    const ocal = params.get("ocal");
    if (!mycal && !ocal) return;
    if (mycal === "connected") toast.success("Your Google Calendar is connected.");
    else if (mycal) toast.error("Google didn't finish connecting your calendar. Try again.");
    if (ocal === "connected") toast.success("Outlook Calendar connected. Check which calendars block your availability.");
    else if (ocal) toast.error(OUTLOOK_REASONS[params.get("reason") || ""] || "Outlook didn't finish connecting. Try again.");
    for (const key of ["mycal", "ocal", "reason"]) params.delete(key);
    const qs = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
    setView(ocal === "connected" ? "outlook" : mycal === "connected" ? "google" : "list");
    setOpen(true);
  }, [refresh]);

  const googleConnected = google?.connection?.status === "active";
  const googleBroken = google?.connection?.status === "needs_reconnect";
  const outlookConnected = Boolean(outlook?.connected) && outlook?.status === "active";
  const outlookBroken = outlook?.status === "needs_reconnect";
  const anyConnected = googleConnected || googleBroken || outlookConnected || outlookBroken;
  const needsAttention = googleBroken || (outlookBroken && outlook?.canManage);

  const googleAvailable = Boolean(google?.configured && google?.ready);
  const outlookAvailable = Boolean(outlook?.configured && outlook?.schemaReady);

  function close() {
    setOpen(false);
    setView("list");
    void refresh();
  }

  const manage = (target: View, label = "Manage") => (
    <Button variant="outline" size="sm" type="button" className="min-h-10" onClick={() => setView(target)}>
      {label} <ChevronRight className="h-4 w-4" />
    </Button>
  );

  let googleRow: React.ReactNode = null;
  if (!google || !googleAvailable) {
    googleRow = (
      <ProviderRow icon={<GoogleMark className="h-5 w-5" />} name="Google Calendar" tone="muted" status="Not available yet" action={null} />
    );
  } else if (googleBroken) {
    googleRow = (
      <ProviderRow
        icon={<GoogleMark className="h-5 w-5" />}
        name="Google Calendar"
        tone="warn"
        status={`Needs reconnecting${google.connection?.email ? ` · ${google.connection.email}` : ""}`}
        action={manage("google", "Fix")}
      />
    );
  } else if (googleConnected) {
    googleRow = (
      <ProviderRow
        icon={<GoogleMark className="h-5 w-5" />}
        name="Google Calendar"
        tone="connected"
        status={`Connected${google.connection?.email ? ` · ${google.connection.email}` : ""}`}
        action={manage("google")}
      />
    );
  } else {
    googleRow = (
      <ProviderRow
        icon={<GoogleMark className="h-5 w-5" />}
        name="Google Calendar"
        tone="muted"
        status="Not connected"
        action={
          <a href={googleConnectHref(google.connectUrl)}>
            <Button variant="accent" size="sm" type="button" className="min-h-10">
              Connect
            </Button>
          </a>
        }
      />
    );
  }

  let outlookRow: React.ReactNode = null;
  const outlookIcon = <OutlookMark className="h-5 w-5" />;
  if (!outlook || !outlookAvailable) {
    outlookRow = <ProviderRow icon={outlookIcon} name="Outlook Calendar" tone="muted" status="Not available yet" action={null} />;
  } else if (!outlook.canManage) {
    outlookRow = (
      <ProviderRow
        icon={outlookIcon}
        name="Outlook Calendar"
        tone={outlook.connected ? "connected" : "muted"}
        status={outlook.connected ? "Connected by the account owner" : "Only the account owner can connect"}
        action={null}
      />
    );
  } else if (outlookBroken) {
    outlookRow = (
      <ProviderRow
        icon={outlookIcon}
        name="Outlook Calendar"
        tone="warn"
        status={`Needs reconnecting${outlook.email ? ` · ${outlook.email}` : ""}`}
        action={manage("outlook", "Fix")}
      />
    );
  } else if (outlookConnected) {
    outlookRow = (
      <ProviderRow
        icon={outlookIcon}
        name="Outlook Calendar"
        tone="connected"
        status={`Connected${outlook.email ? ` · ${outlook.email}` : ""}`}
        action={manage("outlook")}
      />
    );
  } else {
    outlookRow = (
      <ProviderRow
        icon={outlookIcon}
        name="Outlook Calendar"
        tone="muted"
        status="Not connected"
        action={
          <a href={outlookConnectHref()}>
            <Button variant="accent" size="sm" type="button" className="min-h-10">
              Connect
            </Button>
          </a>
        }
      />
    );
  }

  const title = view === "google" ? "Google Calendar" : view === "outlook" ? "Outlook Calendar" : "Calendars";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        type="button"
        className={cn("relative", className)}
        onClick={() => {
          setView("list");
          setOpen(true);
        }}
      >
        <CalendarDays className="h-4 w-4" /> {loaded && anyConnected ? "My calendars" : "Connect calendar"}
        {needsAttention ? <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-500" aria-label="Needs attention" /> : null}
      </Button>
      <Modal open={open} onClose={close} title={title} className="sm:max-w-lg">
        {view === "list" ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted">
              Connect the calendar you already use. Your shoots are added to it, and your busy times keep clients from double-booking you.
            </p>
            {!loaded ? (
              <p className="flex items-center gap-2 text-muted">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking your connections…
              </p>
            ) : (
              <div className="space-y-2">
                {googleRow}
                {outlookRow}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                setView("list");
                void refresh();
              }}
              className="-ml-1 inline-flex min-h-9 items-center gap-1 rounded-lg px-1 text-sm font-medium text-muted hover:text-heading"
            >
              <ChevronLeft className="h-4 w-4" /> All calendars
            </button>
            {view === "google" ? <MyGoogleCalendarPanel onChanged={refresh} /> : <OutlookCalendarPanel onChanged={refresh} />}
          </div>
        )}
      </Modal>
    </>
  );
}
