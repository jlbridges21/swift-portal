"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Info,
  Loader2,
  MapPin,
  Send,
  User,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PersonAvatar } from "@/components/admin/booking/booking-ui";
import type { ClientBookingView } from "@/lib/booking/client-view";
import { formatDuration } from "@/lib/booking/settings";
import { cn } from "@/lib/utils";

type Slot = { start: string; end: string; dayKey: string; userId: string | null; optimized: boolean };
type StaffRow = { userId: string; name: string; title: string; avatarUrl: string | null; shortBio: string; available: boolean; reason: string | null };
type Availability = {
  slots: Slot[];
  daysWithSlots: string[];
  staff: StaffRow[];
  recommendedUserId: string | null;
  blockedReason: string | null;
  showUnavailableStaff: boolean;
  slotSort: "chronological" | "optimized";
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function todayKey(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return t.toISOString().slice(0, 10);
}
function monthStart(key: string) {
  return `${key.slice(0, 7)}-01`;
}
function monthEnd(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}
function shiftMonth(key: string, delta: number) {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 10);
}

export function ScheduleChooser({
  view,
  auth,
  successPath,
  requestedPath,
}: {
  view: ClientBookingView;
  /** Booking-link token or (signed-in) project id. */
  auth: { b?: string; projectId?: string };
  successPath: string;
  requestedPath: string;
}) {
  const router = useRouter();
  const tz = view.timeZone;
  const today = todayKey(tz);
  const [month, setMonth] = useState(monthStart(today));
  const [cache, setCache] = useState<Record<string, Availability>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [staffMode, setStaffMode] = useState<"any" | "choose">("any");
  const [staffId, setStaffId] = useState<string | null>(null);
  const [showAllStaff, setShowAllStaff] = useState(false);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [busy, setBusy] = useState<"hold" | "confirm" | "skip" | null>(null);
  const [held, setHeld] = useState<{ holdId: string | null; photographer: { name: string; avatarUrl: string | null } | null } | null>(null);
  const [probeEmpty, setProbeEmpty] = useState(false);
  const [probed, setProbed] = useState(false);

  const staffKey = staffMode === "choose" && staffId ? staffId : "any";
  const cacheKey = `${staffKey}:${month}`;
  const data = cache[cacheKey] ?? null;

  const post = useCallback(
    async (payload: Record<string, unknown>) => {
      const res = await fetch("/api/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...auth, ...payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw Object.assign(new Error(body.error || "Something went wrong."), { code: body.code });
      return body;
    },
    [auth]
  );

  // First visit: probe the next two months so "required" mode knows whether anything is open.
  useEffect(() => {
    let cancelled = false;
    post({ action: "availability", from: today, to: addDays(today, 61) })
      .then((body: Availability) => {
        if (cancelled) return;
        setProbeEmpty(body.daysWithSlots.length === 0);
        const first = body.daysWithSlots[0];
        if (first) {
          setMonth(monthStart(first));
          setDay(first);
        }
        // Seed both months from the probe.
        const seeded: Record<string, Availability> = {};
        for (const m of [monthStart(today), shiftMonth(today, 1)]) {
          seeded[`any:${m}`] = {
            ...body,
            slots: body.slots.filter((s) => s.dayKey.startsWith(m.slice(0, 7))),
            daysWithSlots: body.daysWithSlots.filter((d) => d.startsWith(m.slice(0, 7))),
          };
        }
        setCache((c) => ({ ...seeded, ...c }));
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
        setProbed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [post, today]);

  useEffect(() => {
    if (!probed || cache[cacheKey]) return;
    let cancelled = false;
    setLoading(true);
    const from = month < today ? today : month;
    post({ action: "availability", from, to: monthEnd(month), staff: staffKey })
      .then((body: Availability) => !cancelled && setCache((c) => ({ ...c, [cacheKey]: body })))
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [cacheKey, cache, month, post, probed, staffKey, today]);

  const daySlots = useMemo(() => (data && day ? data.slots.filter((s) => s.dayKey === day) : []), [data, day]);
  const available = new Set(data?.daysWithSlots ?? []);
  const staffList = cache[`any:${month}`]?.staff ?? data?.staff ?? [];
  const showStaffPicker = view.team && view.clientChoosesStaff && staffList.length > 0;
  const visibleStaff = staffList.filter((s) => s.available || showAllStaff);
  const hiddenCount = staffList.length - staffList.filter((s) => s.available).length;
  const canSkip = view.mode === "optional" || probeEmpty;

  const grid = useMemo(() => {
    const first = month;
    const [y, m] = first.split("-").map(Number);
    const startWeekday = new Date(Date.UTC(y, m - 1, 1)).getUTCDay();
    const cells: { key: string; inMonth: boolean }[] = [];
    for (let i = -startWeekday; cells.length < 42; i++) {
      const key = addDays(first, i);
      cells.push({ key, inMonth: key.slice(0, 7) === first.slice(0, 7) });
    }
    return cells.slice(0, cells[35].inMonth ? 42 : 35);
  }, [month]);

  const fmtDay = (key: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(`${key}T12:00:00Z`));
  const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz }).format(new Date(iso));

  async function continueWithTime() {
    if (!slot) return;
    setBusy("hold");
    setError(null);
    try {
      const body = await post({ action: "hold", start: slot.start, userId: staffMode === "choose" ? staffId : null });
      setHeld({ holdId: body.holdId, photographer: body.photographer });
    } catch (err) {
      setError((err as Error).message);
      setCache({});
      setSlot(null);
    } finally {
      setBusy(null);
    }
  }

  async function confirmBooking() {
    if (!slot) return;
    setBusy("confirm");
    setError(null);
    try {
      await post({ action: "confirm", start: slot.start, userId: staffMode === "choose" ? staffId : null, holdId: held?.holdId ?? null });
      router.push(successPath);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setHeld(null);
      setSlot(null);
      setCache({});
      setBusy(null);
    }
  }

  async function skip() {
    setBusy("skip");
    try {
      await post({ action: "skip" });
      router.push(requestedPath);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setBusy(null);
    }
  }

  if (held && slot) {
    return (
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <h2 className="text-xl font-bold text-heading">Confirm your shoot</h2>
        <p className="mt-1 text-sm text-muted">We&apos;re holding this time for you for 10 minutes.</p>
        <div className="mt-5 grid gap-4 rounded-xl border border-accent/30 bg-accent-subtle/50 p-4 sm:grid-cols-3">
          <div className="flex items-start gap-3">
            <CalendarDays className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
            <div>
              <p className="text-xs text-muted">Date &amp; time</p>
              <p className="font-semibold text-heading">{fmtDay(slot.dayKey)}</p>
              <p className="text-sm text-heading">
                {fmtTime(slot.start)} – {fmtTime(slot.end)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
            <div>
              <p className="text-xs text-muted">Property</p>
              <p className="text-sm font-semibold text-heading">{view.address}</p>
            </div>
          </div>
          {held.photographer ? (
            <div className="flex items-start gap-3">
              <PersonAvatar name={held.photographer.name} url={held.photographer.avatarUrl} size={40} />
              <div>
                <p className="text-xs text-muted">Photographer</p>
                <p className="text-sm font-semibold text-heading">{held.photographer.name}</p>
              </div>
            </div>
          ) : null}
        </div>
        {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" className="min-h-12" onClick={() => setHeld(null)} disabled={busy !== null}>
            <ChevronLeft className="h-4 w-4" /> Choose a different time
          </Button>
          <Button type="button" variant="accent" size="lg" className="min-h-12" onClick={confirmBooking} disabled={busy !== null}>
            {busy === "confirm" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Confirm booking
          </Button>
        </div>
        <p className="mt-3 text-xs text-muted">
          Booking confirms your appointment. Your estimate and payment are handled separately in your project.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {view.mode === "optional" ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-accent/20 bg-accent-subtle px-4 py-3 text-sm">
          <span className="flex items-center gap-2 font-semibold text-heading">
            <Info className="h-4 w-4 text-accent" aria-hidden /> Scheduling is optional
          </span>
          <span className="text-muted">Choose a time now, or request without scheduling and we&apos;ll follow up to confirm availability.</span>
        </div>
      ) : null}

      <div className="rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
        {showStaffPicker ? (
          <div className="mb-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                  <User className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <h2 className="text-lg font-semibold text-heading">Select a photographer</h2>
                  <p className="text-sm text-muted">Choose who you&apos;d like, or let us assign the best available photographer.</p>
                </div>
              </div>
              <div className="inline-flex rounded-xl border border-border p-1" role="radiogroup" aria-label="Photographer">
                {(
                  [
                    ["any", "Any photographer", Users],
                    ["choose", "Choose a photographer", User],
                  ] as const
                ).map(([mode, label, Icon]) => (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={staffMode === mode}
                    onClick={() => {
                      setStaffMode(mode);
                      setSlot(null);
                      if (mode === "choose" && !staffId) setStaffId(staffList.find((s) => s.available)?.userId ?? null);
                    }}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                      staffMode === mode ? "bg-accent-subtle text-accent ring-1 ring-accent" : "text-muted hover:text-heading"
                    )}
                  >
                    <Icon className="h-4 w-4" /> {label}
                  </button>
                ))}
              </div>
            </div>
            {staffMode === "choose" ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {visibleStaff.map((s) => (
                  <button
                    key={s.userId}
                    type="button"
                    disabled={!s.available}
                    onClick={() => {
                      setStaffId(s.userId);
                      setSlot(null);
                    }}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border p-3 text-left transition-colors",
                      staffId === s.userId ? "border-accent bg-accent-subtle/50 ring-1 ring-accent" : "border-border hover:bg-subtle",
                      !s.available && "cursor-not-allowed opacity-60 hover:bg-transparent"
                    )}
                  >
                    <PersonAvatar name={s.name} url={s.avatarUrl} size={52} className={!s.available ? "grayscale" : undefined} />
                    <span className="min-w-0">
                      <span className="block truncate font-semibold text-heading">{s.name}</span>
                      <span className="block truncate text-xs text-muted">{s.title}</span>
                      <span
                        className={cn(
                          "mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold",
                          s.available ? "bg-emerald-50 text-emerald-700" : "bg-subtle text-muted"
                        )}
                      >
                        {s.available ? "Available" : "Unavailable"}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            ) : null}
            {staffMode === "choose" && view.team && data?.showUnavailableStaff && hiddenCount > 0 ? (
              <button type="button" onClick={() => setShowAllStaff((v) => !v)} className="mt-2 text-xs font-medium text-accent hover:underline">
                {showAllStaff ? "Hide unavailable photographers" : `Show all photographers (${hiddenCount} unavailable)`}
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
          <div className="rounded-xl border border-border p-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                aria-label="Previous month"
                onClick={() => setMonth(shiftMonth(month, -1))}
                disabled={month <= monthStart(today)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-subtle disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <p className="text-base font-semibold text-heading">
                {new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}T12:00:00Z`))}
              </p>
              <button
                type="button"
                aria-label="Next month"
                onClick={() => setMonth(shiftMonth(month, 1))}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border hover:bg-subtle"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted">
              {WEEKDAYS.map((w) => (
                <span key={w} className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {grid.map((cell) => {
                const open = cell.inMonth && available.has(cell.key);
                const selected = day === cell.key;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    disabled={!open}
                    aria-pressed={selected}
                    aria-label={`${fmtDay(cell.key)}${open ? ", available" : ""}`}
                    onClick={() => {
                      setDay(cell.key);
                      setSlot(null);
                    }}
                    className={cn(
                      "relative mx-auto flex h-10 w-10 items-center justify-center rounded-full text-sm transition-colors",
                      !cell.inMonth && "text-muted/40",
                      cell.inMonth && !open && "text-muted/60",
                      open && !selected && "font-semibold text-heading hover:bg-accent-subtle",
                      selected && "bg-accent font-semibold text-accent-foreground"
                    )}
                  >
                    {Number(cell.key.slice(8))}
                    {open && !selected ? <span className="absolute bottom-1 h-1 w-1 rounded-full bg-accent" aria-hidden /> : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border border-border p-4">
            <div className="flex items-start gap-3">
              <CalendarDays className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
              <div>
                <h3 className="text-base font-semibold text-heading">{day ? `Available times for ${fmtDay(day)}` : "Choose a day"}</h3>
                <p className="text-xs text-muted">
                  Times are in {view.timeZoneLabel}. The estimated duration is ~{formatDuration(view.durationMinutes)}.
                </p>
              </div>
            </div>
            <div className="mt-4 min-h-[120px]">
              {loading ? (
                <p className="flex items-center gap-2 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Finding open times…
                </p>
              ) : data?.blockedReason === "too_far" ? (
                <div className="flex items-start gap-2 text-sm text-muted">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
                  <p>
                    This property is too far away to book online, so there are no times to pick here. Send your request without a
                    time and we&apos;ll follow up to schedule it.
                  </p>
                </div>
              ) : data?.blockedReason ? (
                <p className="text-sm text-muted">Online booking isn&apos;t available for this request — we&apos;ll reach out with times.</p>
              ) : !day || !daySlots.length ? (
                <p className="text-sm text-muted">
                  {available.size ? "Pick a highlighted day to see times." : "No open times this month. Try the next month."}
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                  {daySlots.map((s) => {
                    const on = slot?.start === s.start;
                    return (
                      <button
                        key={s.start}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSlot(s)}
                        className={cn(
                          "relative h-11 rounded-full border text-sm font-semibold transition-colors",
                          on ? "border-accent bg-accent text-accent-foreground shadow-sm" : "border-border bg-card text-heading hover:border-accent hover:bg-accent-subtle"
                        )}
                      >
                        {fmtTime(s.start)}
                        {data?.slotSort === "optimized" && s.optimized && !on ? (
                          <Zap className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-accent" aria-label="Suggested" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            {slot ? (
              <div className="mt-4 flex items-start gap-3 rounded-xl bg-accent-subtle px-4 py-3">
                <Zap className="mt-0.5 h-5 w-5 text-accent" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-heading">
                    Selected time: {fmtDay(slot.dayKey)} at {fmtTime(slot.start)}
                  </p>
                  <p className="text-xs text-muted">Continue to review and confirm your shoot.</p>
                </div>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

        {probeEmpty && view.mode === "required" && !data?.blockedReason ? (
          <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            There are no open appointments in the next few weeks. Send your request without a time and {view.businessName} will
            reach out to schedule.
          </div>
        ) : null}

        <div className="mt-6 flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
          {canSkip ? (
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:gap-4">
              <Button type="button" variant="outline" size="lg" className="min-h-12" onClick={skip} disabled={busy !== null}>
                {busy === "skip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Request without scheduling
              </Button>
              <p className="max-w-xs text-xs text-muted">Skip scheduling for now and we&apos;ll follow up to find a time that works for you.</p>
            </div>
          ) : (
            <span />
          )}
          <Button type="button" variant="accent" size="lg" className="min-h-12" disabled={!slot || busy !== null} onClick={continueWithTime}>
            {busy === "hold" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Continue with selected time <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </section>
  );
}
