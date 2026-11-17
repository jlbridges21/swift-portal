"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Loader2, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/admin/booking/booking-ui";
import { bookingPost } from "@/components/admin/booking/schedule-panel";
import { zonedParts } from "@/lib/booking/time";
import { formatDuration } from "@/lib/booking/settings";
import { cn } from "@/lib/utils";

type TeamOption = { userId: string; name: string };
type Slot = { start: string; end: string; dayKey: string; userId: string | null };
type Picked = { start: string; userId: string | null };

const MAX = 3;

/**
 * Offer the client up to three open times. Each one comes from the booking engine (hours,
 * buffers, drive time, Google busy times) and is checked again when sent and when the client
 * picks it.
 */
export function OfferTimesPanel({
  projectId,
  timeZone,
  team,
  durationMinutes,
  clientName,
  onSent,
}: {
  projectId: string;
  timeZone: string;
  team: TeamOption[];
  durationMinutes?: number;
  clientName: string;
  onSent: () => void;
}) {
  const [day, setDay] = useState(() => zonedParts(Date.now() + 24 * 3600_000, timeZone).dayKey);
  const [userId, setUserId] = useState("any");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<{ text: string; problems: { start: string; violations: string[] }[] } | null>(null);

  const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
  const fmtFull = (iso: string) =>
    new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
  const nameOf = (id: string | null) => team.find((t) => t.userId === id)?.name ?? "";

  const load = useCallback(async () => {
    setLoading(true);
    const res = await bookingPost({ action: "availability", projectId, from: day, to: day, staff: userId, allTeam: true });
    setSlots(res.ok ? ((res.body.slots ?? []) as Slot[]).filter((s) => s.dayKey === day) : []);
    setLoading(false);
  }, [day, projectId, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  function toggle(slot: Slot) {
    setError(null);
    setPicked((prev) => {
      if (prev.some((p) => p.start === slot.start)) return prev.filter((p) => p.start !== slot.start);
      if (prev.length >= MAX) return prev;
      return [...prev, { start: slot.start, userId: slot.userId }].sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
    });
  }

  async function send() {
    setSending(true);
    setError(null);
    // One photographer per offer when the business chose one; otherwise the engine picks per time.
    const res = await bookingPost({
      action: "offer",
      projectId,
      starts: picked.map((p) => p.start),
      userId: userId === "any" ? null : userId,
      message: message.trim() || null,
    });
    setSending(false);
    if (res.ok) {
      onSent();
      return;
    }
    setError({ text: res.body.error || "Couldn't send these times.", problems: res.body.problems ?? [] });
    void load();
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted">
        Pick up to {MAX} open times. {clientName} gets them by email and in their portal, and books the one that works with one tap.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Date</span>
          <input
            type="date"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
          />
        </label>
        {team.length > 1 ? (
          <label className="space-y-1.5">
            <span className="text-xs font-medium text-foreground">Photographer</span>
            <NativeSelect
              ariaLabel="Photographer"
              value={userId}
              onChange={(v) => {
                setUserId(v);
                setPicked([]);
              }}
              options={[{ value: "any", label: "Best available for each time" }, ...team.map((t) => ({ value: t.userId, label: t.name }))]}
            />
          </label>
        ) : null}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
          <CalendarDays className="h-3.5 w-3.5" /> Open times{durationMinutes ? ` · ${formatDuration(durationMinutes)} shoot` : ""}
        </p>
        {loading ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
          </p>
        ) : slots.length ? (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => {
              const on = picked.some((p) => p.start === s.start);
              const full = !on && picked.length >= MAX;
              return (
                <button
                  key={s.start}
                  type="button"
                  aria-pressed={on}
                  disabled={full}
                  onClick={() => toggle(s)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors",
                    on ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent hover:bg-accent-subtle",
                    full && "cursor-not-allowed opacity-40 hover:border-border hover:bg-transparent"
                  )}
                >
                  {fmtTime(s.start)}
                  {team.length > 1 && userId === "any" && s.userId ? (
                    <span className="ml-1 text-[11px] font-normal opacity-80">· {nameOf(s.userId).split(" ")[0]}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted">No open times on this day. Try another date.</p>
        )}
      </div>

      <div className="rounded-xl border border-border bg-subtle/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          Times to offer ({picked.length}/{MAX})
        </p>
        {picked.length ? (
          <ul className="mt-2 space-y-1.5">
            {picked.map((p) => (
              <li key={p.start} className="flex items-center justify-between gap-2 rounded-lg bg-card px-3 py-2 text-sm shadow-sm">
                <span className="font-medium text-heading">
                  {fmtFull(p.start)}
                  {team.length > 1 && p.userId ? <span className="font-normal text-muted"> · {nameOf(p.userId)}</span> : null}
                </span>
                <button
                  type="button"
                  aria-label="Remove time"
                  onClick={() => setPicked((prev) => prev.filter((x) => x.start !== p.start))}
                  className="rounded p-1 text-muted hover:bg-subtle hover:text-heading"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted">Pick times above. You can switch dates and keep adding.</p>
        )}
      </div>

      <label className="block space-y-1.5">
        <span className="text-xs font-medium text-foreground">Note to the client (optional)</span>
        <textarea
          rows={2}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          maxLength={1000}
          placeholder="e.g. Morning light is best for the front of the house."
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </label>

      {error ? (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          <p className="flex items-center gap-2 font-medium">
            <AlertTriangle className="h-4 w-4 text-amber-600" /> {error.text}
          </p>
          {error.problems.length ? (
            <ul className="mt-1 list-disc pl-6 text-xs">
              {error.problems.map((p) => (
                <li key={p.start}>
                  {fmtFull(p.start)}: {p.violations.join(" ")}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex justify-end">
        <Button type="button" variant="accent" disabled={!picked.length || sending} onClick={send}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {picked.length > 1 ? ` Send ${picked.length} times` : " Send time"}
        </Button>
      </div>
    </div>
  );
}
