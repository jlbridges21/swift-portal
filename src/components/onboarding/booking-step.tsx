"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CalendarCheck2, CalendarClock, Check, Loader2, MousePointerClick, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { WeeklyHoursEditor } from "@/components/admin/booking/booking-ui";
import type { AppSettings } from "@/lib/app-settings";
import type { BookingMode, WeeklyHours } from "@/lib/booking/settings";
import { cn } from "@/lib/utils";

type CalendarStatus = { configured: boolean; connected: boolean; status: string; email: string | null; calendarId: string | null };

const CHOICES: { mode: BookingMode; title: string; description: string; icon: typeof UserRound }[] = [
  {
    mode: "off",
    title: "I'll schedule each shoot",
    description: "Clients send a request. You pick the time with them.",
    icon: UserRound,
  },
  {
    mode: "optional",
    title: "Clients pick a time",
    description: "They book an open time when they request. They can still ask you to schedule instead.",
    icon: MousePointerClick,
  },
];

/**
 * Onboarding → Booking & calendar: how clients get a shoot time, working hours, and the business
 * Google Calendar. Everything here lives in Settings → Instant Booking afterwards.
 */
export function BookingStep({
  busy,
  onBack,
  onSkip,
  onContinue,
}: {
  busy: boolean;
  onBack: () => void;
  onSkip: () => void;
  onContinue: () => Promise<void>;
}) {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [calendar, setCalendar] = useState<CalendarStatus | null>(null);
  const [mode, setMode] = useState<BookingMode>("off");
  const [hours, setHours] = useState<WeeklyHours | null>(null);
  const [perDay, setPerDay] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [settingsRes, calendarRes] = await Promise.all([
        fetch("/api/admin/settings", { credentials: "include" }),
        fetch("/api/integrations/google-calendar", { credentials: "include" }),
      ]);
      const body = (await settingsRes.json().catch(() => ({}))) as { settings?: AppSettings; error?: string };
      const cal = (await calendarRes.json().catch(() => null)) as CalendarStatus | null;
      if (cancelled) return;
      if (!settingsRes.ok || !body.settings) {
        setError(body.error || "Couldn't load your booking settings.");
        return;
      }
      setSettings(body.settings);
      // "Required" is a Settings-only choice; here it reads as "Clients pick a time".
      setMode(body.settings.booking.mode === "off" ? "off" : "optional");
      setHours(body.settings.booking.workingHours);
      if (calendarRes.ok && cal) setCalendar(cal);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function saveAndContinue() {
    if (!settings || !hours) return;
    setSaving(true);
    setError(null);
    try {
      const current = settings.booking;
      const keepRequired = current.mode === "required" && mode !== "off";
      const blockIds =
        calendar?.connected && calendar.calendarId && !current.blockCalendarIds.length ? [calendar.calendarId] : current.blockCalendarIds;
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settings: {
            booking: {
              ...current,
              mode: keepRequired ? "required" : mode,
              workingHours: hours,
              // A newly connected calendar blocks your availability straight away.
              blockCalendarIds: blockIds,
            },
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Couldn't save your booking settings.");
      await onContinue();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
      toast.error(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  if (!settings || !hours) {
    return error ? (
      <p className="text-sm text-red-600">{error}</p>
    ) : (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-heading">How do clients get a shoot time?</p>
        <div role="radiogroup" aria-label="How clients get a shoot time" className="grid gap-2 sm:grid-cols-2">
          {CHOICES.map((c) => {
            const selected = mode === c.mode;
            return (
              <button
                key={c.mode}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setMode(c.mode)}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-left transition-shadow",
                  selected ? "border-accent bg-accent-subtle/60 ring-1 ring-accent" : "border-border hover:bg-subtle"
                )}
              >
                <c.icon className={cn("mt-0.5 h-5 w-5 shrink-0", selected ? "text-accent" : "text-muted")} aria-hidden />
                <span>
                  <span className="block text-sm font-semibold text-heading">{c.title}</span>
                  <span className="block text-xs text-muted">{c.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-heading">
          <CalendarClock className="h-4 w-4 text-accent" aria-hidden /> Working hours
        </p>
        <p className="text-xs text-muted">
          {mode === "off" ? "Used when you schedule and for your calendar." : "Clients only see open times inside these hours."}
        </p>
        <WeeklyHoursEditor value={hours} onChange={setHours} idPrefix="ob-hours" perDay={perDay} onPerDayChange={setPerDay} />
      </div>

      {calendar?.configured ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="flex items-start gap-3">
            <CalendarCheck2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-heading">Google Calendar</p>
              <p className="text-xs text-muted">
                {calendar.connected
                  ? `Connected${calendar.email ? ` as ${calendar.email}` : ""}. Busy times block bookings and shoots are added to it.`
                  : "Connect it so you're never double-booked. Your shoots are added to it automatically."}
              </p>
            </div>
          </div>
          {calendar.connected && calendar.status === "active" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
              <Check className="h-3.5 w-3.5" aria-hidden /> Connected
            </span>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.assign("/api/integrations/google-calendar/start?return=/onboarding")}
            >
              {calendar.connected ? "Reconnect" : "Connect Google Calendar"}
            </Button>
          )}
        </div>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={busy || saving} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
        <Button type="button" variant="outline" disabled={busy || saving} onClick={onSkip}>
          Skip for now
        </Button>
        <Button type="button" variant="accent" disabled={busy || saving} onClick={() => void saveAndContinue()}>
          {saving || busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue
        </Button>
      </div>
    </div>
  );
}
