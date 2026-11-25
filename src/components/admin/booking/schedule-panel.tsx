"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CalendarDays, Check, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/admin/booking/booking-ui";
import { zonedInstant, zonedParts } from "@/lib/booking/time";
import { formatDuration } from "@/lib/booking/settings";
import { cn } from "@/lib/utils";

type TeamOption = { userId: string; name: string };
type Slot = { start: string; end: string; dayKey: string; userId: string | null };

export async function bookingPost(payload: Record<string, unknown>) {
  const res = await fetch("/api/booking", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

/**
 * Schedule or reschedule a project's shoot through the booking engine: open times for a day,
 * or any exact time (checked against every rule). Conflicts can be overridden only by an
 * owner/admin, after an explicit confirmation with a reason.
 */
export function SchedulePanel({
  projectId,
  timeZone,
  team,
  initialStart,
  initialUserId,
  durationMinutes,
  canOverride,
  onDone,
  submitLabel = "Schedule shoot",
  calendarOverride = false,
}: {
  projectId: string;
  timeZone: string;
  team: TeamOption[];
  initialStart?: string | null;
  initialUserId?: string | null;
  durationMinutes?: number;
  canOverride: boolean;
  onDone: () => void;
  submitLabel?: string;
  /** Shoot Calendar (owner/admin): any time books straight away, overriding availability. */
  calendarOverride?: boolean;
}) {
  const [day, setDay] = useState(
    () => zonedParts(initialStart ? Date.parse(initialStart) : Date.now() + 24 * 3600_000, timeZone).dayKey
  );
  const [userId, setUserId] = useState<string>(initialUserId ?? "any");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [manualTime, setManualTime] = useState("");
  const [check, setCheck] = useState<{ ok: boolean; issues: string[]; recommended: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [override, setOverride] = useState<{ start: string; issues: string[] } | null>(null);
  const [reason, setReason] = useState("");
  const [acknowledged, setAcknowledged] = useState(false);
  const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(new Date(iso));
  const nameOf = (id: string | null) => team.find((t) => t.userId === id)?.name ?? "";

  const loadSlots = useCallback(async () => {
    setLoadingSlots(true);
    setPicked(null);
    const res = await bookingPost({ action: "availability", projectId, from: day, to: day, staff: userId, allTeam: true });
    setSlots(res.ok ? (res.body.slots as Slot[]).filter((s) => s.dayKey === day) : []);
    setLoadingSlots(false);
  }, [day, projectId, userId]);

  useEffect(() => {
    void loadSlots();
  }, [loadSlots]);

  function manualIso(): string | null {
    if (!/^\d{2}:\d{2}$/.test(manualTime)) return null;
    const [h, m] = manualTime.split(":").map(Number);
    return new Date(zonedInstant(day, h * 60 + m, timeZone)).toISOString();
  }

  async function runCheck() {
    const start = manualIso();
    if (!start) return;
    setCheck(null);
    const res = await bookingPost({ action: "check", projectId, start, userId: userId === "any" ? null : userId });
    if (!res.ok) {
      setError(res.body.error || "Couldn't check that time.");
      return;
    }
    const ranked = (res.body.ranked ?? []) as { userId: string; ok: boolean; violations: string[] }[];
    const relevant = userId === "any" ? ranked[0] : ranked.find((r) => r.userId === userId);
    setCheck({ ok: Boolean(res.body.ok), issues: relevant?.violations ?? [], recommended: res.body.recommendedUserId ?? null });
  }

  async function submit(start: string, overrideReason?: string) {
    setBusy(true);
    setError(null);
    const slotUser = slots.find((s) => s.start === start)?.userId;
    const res = await bookingPost({
      action: "schedule",
      projectId,
      start,
      userId: userId === "any" ? (slotUser ?? null) : userId,
      ...(overrideReason ? { overrideReason, confirmOverride: true } : {}),
      ...(calendarOverride && !overrideReason ? { calendarOverride: true } : {}),
    });
    setBusy(false);
    if (res.ok) {
      setOverride(null);
      onDone();
      return;
    }
    if (res.status === 409 && res.body.violations?.length && canOverride && !overrideReason) {
      setOverride({ start, issues: res.body.violations });
      return;
    }
    setError(res.body.error || "Couldn't schedule the shoot.");
  }

  const chosenStart = picked ?? manualIso();

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Date</span>
          <input
            type="date"
            value={day}
            onChange={(e) => {
              setDay(e.target.value);
              setCheck(null);
            }}
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
                setCheck(null);
              }}
              options={[{ value: "any", label: "Recommended (best available)" }, ...team.map((t) => ({ value: t.userId, label: t.name }))]}
            />
          </label>
        ) : null}
      </div>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted">
          <CalendarDays className="h-3.5 w-3.5" /> Open times{durationMinutes ? ` · ${formatDuration(durationMinutes)} shoot` : ""}
        </p>
        {loadingSlots ? (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Checking availability…
          </p>
        ) : slots.length ? (
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <button
                key={s.start}
                type="button"
                onClick={() => {
                  setPicked(s.start);
                  setManualTime("");
                  setCheck(null);
                }}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-sm font-semibold",
                  picked === s.start ? "border-accent bg-accent text-accent-foreground" : "border-border hover:border-accent hover:bg-accent-subtle"
                )}
              >
                {fmtTime(s.start)}
                {team.length > 1 && userId === "any" && s.userId ? <span className="ml-1 text-[11px] font-normal opacity-80">· {nameOf(s.userId).split(" ")[0]}</span> : null}
              </button>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No open times on this day. You can still pick an exact time below.</p>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1.5">
          <span className="text-xs font-medium text-foreground">Or an exact time</span>
          <input
            type="time"
            value={manualTime}
            onChange={(e) => {
              setManualTime(e.target.value);
              setPicked(null);
              setCheck(null);
            }}
            className="h-10 rounded-lg border border-border bg-card px-3 text-sm"
          />
        </label>
        <Button type="button" variant="outline" onClick={runCheck} disabled={!manualIso()}>
          Check time
        </Button>
      </div>

      {check ? (
        check.ok ? (
          <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <Check className="h-4 w-4" /> This time works
            {team.length > 1 && check.recommended ? (
              <span className="inline-flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> with {nameOf(check.recommended)}
              </span>
            ) : null}
            .
          </p>
        ) : (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            <p className="flex items-center gap-2 font-medium">
              <AlertTriangle className="h-4 w-4 text-amber-600" /> This time breaks your scheduling rules
            </p>
            <ul className="mt-1 list-disc pl-6 text-xs">
              {check.issues.map((i) => (
                <li key={i}>{i}</li>
              ))}
            </ul>
          </div>
        )
      ) : null}

      {error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

      <div className="flex justify-end">
        <Button type="button" variant="accent" disabled={!chosenStart || busy} onClick={() => chosenStart && submit(chosenStart)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {submitLabel}
        </Button>
      </div>

      <Modal
        open={Boolean(override)}
        onClose={() => !busy && setOverride(null)}
        title="Admin override: book despite conflicts?"
        overlayClassName="z-[160]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOverride(null)} disabled={busy}>
              Go back
            </Button>
            <Button
              variant="destructive"
              disabled={!acknowledged || reason.trim().length < 3 || busy}
              onClick={() => override && submit(override.start, reason.trim())}
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />} Override and book
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="text-muted">ShootPortal found these problems with {override ? fmtTime(override.start) : "this time"}:</p>
          <ul className="list-disc space-y-1 rounded-lg bg-red-50 py-2 pl-8 pr-3 text-red-800">
            {override?.issues.map((i) => (
              <li key={i}>{i}</li>
            ))}
          </ul>
          <label className="block">
            <span className="text-xs font-medium text-heading">Reason (saved to the project history)</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2"
              placeholder="e.g. Client confirmed by phone; Ryan will skip lunch"
            />
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            <span>I understand this can double-book a team member or leave too little drive time.</span>
          </label>
        </div>
      </Modal>
    </div>
  );
}
