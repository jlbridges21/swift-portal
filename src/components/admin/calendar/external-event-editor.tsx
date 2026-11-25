"use client";

import { useMemo, useState } from "react";
import { AlignLeft, Clock, Loader2, MapPin, Repeat, Trash2, Users, Video, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { zonedDayAndMinutes, zonedTimeToIso } from "@/lib/projects-calendar";
import { addDaysToDate, type ExternalEventDetails } from "@/lib/external-event-details";
import type { ExternalCalendarEvent } from "@/lib/google-calendar-pull";

type Provider = "Google" | "Outlook";

/** What changed, so the calendar can update the block before the provider is re-read. */
export type ExternalEventChange =
  | { kind: "updated"; title?: string; start?: string; end?: string; allDay?: boolean; scope: "this" | "all" }
  | { kind: "deleted"; scope: "this" | "all" };

const pad = (n: number) => String(n).padStart(2, "0");
const toHm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const fromHm = (hm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const EMAIL_RE = /^[^\s@<>(),;:"]+@[^\s@<>(),;:"]+\.[^\s@<>(),;:"]+$/;

const inputClass = "h-10 rounded-lg border border-border bg-card px-2 text-sm";

type Guest = { email: string; name: string | null; optional: boolean };

/** Sends the change to the provider through ShootPortal. Throws the provider's reason. */
export async function saveExternalEvent(
  event: Pick<ExternalCalendarEvent, "calendarId" | "id">,
  change: Record<string, unknown>
): Promise<void> {
  const res = await fetch("/api/integrations/calendar-event-details", {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calendarId: event.calendarId, eventId: event.id, ...change }),
  }).catch(() => null);
  if (!res?.ok) {
    const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
    throw new Error(body?.error || "Couldn't save the change. Check your connection and try again.");
  }
}

function ScopeChoice({ value, onChange, provider }: { value: "this" | "all"; onChange: (v: "this" | "all") => void; provider: Provider }) {
  return (
    <fieldset className="space-y-1.5 rounded-lg bg-subtle px-3 py-2.5">
      <legend className="sr-only">Repeating event</legend>
      <p className="flex items-center gap-1.5 text-xs font-medium text-foreground">
        <Repeat className="h-3.5 w-3.5 text-muted" aria-hidden /> This is a repeating event
      </p>
      {(["this", "all"] as const).map((v) => (
        <label key={v} className="flex items-center gap-2 text-sm">
          <input type="radio" name="scope" checked={value === v} onChange={() => onChange(v)} />
          {v === "this" ? "This event" : "All events in the series"}
        </label>
      ))}
      {value === "all" ? (
        <p className="text-xs text-muted">The series can change its time and length here; moving it to another day is done in {provider} Calendar.</p>
      ) : null}
    </fieldset>
  );
}

export function ExternalEventEditor({
  event,
  details,
  provider,
  timeZone,
  onCancel,
  onDone,
}: {
  event: ExternalCalendarEvent;
  details: ExternalEventDetails;
  provider: Provider;
  timeZone: string;
  onCancel: () => void;
  onDone: (change: ExternalEventChange) => void;
}) {
  const edit = details.edit;
  // Starting values, in the business time zone (the calendar's own zone).
  const initial = useMemo(() => {
    const allDay = edit.allDay;
    if (allDay) {
      const startDay = edit.start ?? event.start.slice(0, 10);
      const endExclusive = edit.end ?? addDaysToDate(startDay, 1);
      return { allDay, startDay, endDay: addDaysToDate(endExclusive, -1), startTime: "09:00", endTime: "10:00" };
    }
    const s = zonedDayAndMinutes(edit.start ?? event.start, timeZone);
    const e = zonedDayAndMinutes(edit.end ?? event.end ?? event.start, timeZone);
    return {
      allDay,
      startDay: s?.dayKey ?? "",
      endDay: e?.dayKey ?? s?.dayKey ?? "",
      startTime: toHm(s?.minutes ?? 540),
      endTime: toHm(e?.minutes ?? 600),
    };
  }, [edit, event.start, event.end, timeZone]);
  const initialGuests: Guest[] = useMemo(
    () =>
      details.attendees
        .filter((a) => a.email)
        .map((a) => ({ email: a.email!, name: a.name, optional: a.optional })),
    [details.attendees]
  );

  const [title, setTitle] = useState(event.title === "(No title)" ? "" : event.title);
  const [allDay, setAllDay] = useState(initial.allDay);
  const [startDay, setStartDay] = useState(initial.startDay);
  const [endDay, setEndDay] = useState(initial.endDay);
  const [startTime, setStartTime] = useState(initial.startTime);
  const [endTime, setEndTime] = useState(initial.endTime);
  const [location, setLocation] = useState(details.location ?? "");
  const [description, setDescription] = useState(details.description ?? "");
  const [guests, setGuests] = useState<Guest[]>(initialGuests);
  const [guestInput, setGuestInput] = useState("");
  const [meeting, setMeeting] = useState<"keep" | "add" | "remove">("keep");
  const [scope, setScope] = useState<"this" | "all">("this");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the length when the start moves (like Google Calendar).
  function changeStartTime(value: string) {
    const before = fromHm(startTime);
    const after = fromHm(value);
    const end = fromHm(endTime);
    setStartTime(value);
    if (before !== null && after !== null && end !== null && startDay === endDay) {
      const next = Math.min(after + Math.max(15, end - before), 24 * 60 - 1);
      setEndTime(toHm(next));
    }
  }
  function changeStartDay(value: string) {
    if (value && startDay && endDay) {
      const span = Math.round((Date.parse(`${endDay}T00:00:00Z`) - Date.parse(`${startDay}T00:00:00Z`)) / 86_400_000);
      setEndDay(addDaysToDate(value, Math.max(0, span)));
    }
    setStartDay(value);
  }

  const times = useMemo(() => {
    if (!startDay || !endDay) return { error: "Choose the dates." } as const;
    if (allDay) {
      if (endDay < startDay) return { error: "The end date must be on or after the start date." } as const;
      return { start: startDay, end: addDaysToDate(endDay, 1) } as const;
    }
    const s = fromHm(startTime);
    const e = fromHm(endTime);
    if (s === null || e === null) return { error: "Choose a start and end time." } as const;
    const start = zonedTimeToIso(startDay, s, timeZone);
    const end = zonedTimeToIso(endDay, e, timeZone);
    if (Date.parse(end) <= Date.parse(start)) return { error: "The end time must be after the start time." } as const;
    return { start, end } as const;
  }, [allDay, startDay, endDay, startTime, endTime, timeZone]);

  function addGuests(raw: string) {
    const parts = raw.split(/[\s,;]+/).map((p) => p.trim().replace(/^<|>$/g, "")).filter(Boolean);
    if (!parts.length) return;
    const bad = parts.filter((p) => !EMAIL_RE.test(p));
    if (bad.length) {
      setError(`"${bad[0]}" isn't a valid email address.`);
      return;
    }
    setError(null);
    setGuests((current) => {
      const seen = new Set(current.map((g) => g.email.toLowerCase()));
      const added = parts.filter((p) => !seen.has(p.toLowerCase())).map((email) => ({ email, name: null, optional: false }));
      return [...current, ...added];
    });
    setGuestInput("");
  }

  const guestsChanged =
    guests.length !== initialGuests.length ||
    guests.some((g, i) => g.email.toLowerCase() !== initialGuests[i]?.email.toLowerCase() || g.optional !== initialGuests[i]?.optional);
  const hadGuests = initialGuests.length > 0;
  const hasGuests = guests.length > 0;

  function buildChange(): Record<string, unknown> | null {
    const change: Record<string, unknown> = {};
    const cleanTitle = title.trim();
    if (cleanTitle !== (event.title === "(No title)" ? "" : event.title)) change.title = cleanTitle;
    if (location.trim() !== (details.location ?? "")) change.location = location.trim();
    if (description !== (details.description ?? "")) change.description = description;
    if ("error" in times) return null;
    const timeChanged =
      allDay !== initial.allDay ||
      startDay !== initial.startDay ||
      endDay !== initial.endDay ||
      (!allDay && (startTime !== initial.startTime || endTime !== initial.endTime));
    if (timeChanged) {
      change.allDay = allDay;
      change.start = times.start;
      change.end = times.end;
    }
    if (guestsChanged) change.attendees = guests.map((g) => ({ email: g.email, optional: g.optional }));
    if (meeting !== "keep") change.meeting = meeting;
    return change;
  }

  async function save() {
    if (saving) return;
    const change = buildChange();
    if (!change) {
      setError(("error" in times && times.error) || "Check the times.");
      return;
    }
    if (!Object.keys(change).length) {
      onCancel();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveExternalEvent(event, { ...change, scope, notify });
      toast.success(`Saved to ${provider} Calendar.`);
      onDone({
        kind: "updated",
        scope,
        title: typeof change.title === "string" ? change.title : undefined,
        start: typeof change.start === "string" ? change.start : undefined,
        end: typeof change.end === "string" ? change.end : undefined,
        allDay: typeof change.allDay === "boolean" ? change.allDay : undefined,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the change.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (deleting) return;
    setDeleting(true);
    setError(null);
    const params = new URLSearchParams({
      calendarId: event.calendarId,
      eventId: event.id,
      scope,
      notify: notify ? "1" : "0",
    });
    const res = await fetch(`/api/integrations/calendar-event-details?${params.toString()}`, {
      method: "DELETE",
      credentials: "include",
    }).catch(() => null);
    setDeleting(false);
    if (!res?.ok) {
      const body = (await res?.json().catch(() => ({}))) as { error?: string } | undefined;
      setError(body?.error || "Couldn't delete the event.");
      return;
    }
    toast.success(`Deleted from ${provider} Calendar.`);
    onDone({ kind: "deleted", scope });
  }

  const meetingName = provider === "Google" ? "Google Meet" : "Teams meeting";
  const busy = saving || deleting;

  return (
    <div className="space-y-4 pb-1 text-sm">
      <input
        autoFocus
        aria-label="Title"
        placeholder="Add title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full border-b-2 border-border bg-transparent pb-1.5 text-lg font-semibold text-heading outline-none placeholder:font-normal placeholder:text-muted focus:border-accent"
      />

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
          <input type="date" aria-label="Start date" value={startDay} onChange={(e) => changeStartDay(e.target.value)} className={inputClass} />
          {!allDay ? (
            <input type="time" aria-label="Start time" step={300} value={startTime} onChange={(e) => changeStartTime(e.target.value)} className={inputClass} />
          ) : null}
          <span className="text-muted">to</span>
          {!allDay ? (
            <input type="time" aria-label="End time" step={300} value={endTime} onChange={(e) => setEndTime(e.target.value)} className={inputClass} />
          ) : null}
          <input type="date" aria-label="End date" value={endDay} min={startDay} onChange={(e) => setEndDay(e.target.value)} className={inputClass} />
        </div>
        <label className="ml-6 inline-flex items-center gap-2">
          <input type="checkbox" checked={allDay} onChange={(e) => setAllDay(e.target.checked)} />
          All day
        </label>
        {"error" in times ? <p className="ml-6 text-xs text-red-600">{times.error}</p> : null}
      </div>

      {details.recurring ? <ScopeChoice value={scope} onChange={setScope} provider={provider} /> : null}

      <div className="flex items-start gap-2">
        <Video className="mt-2.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1">
          {details.meeting ? (
            meeting === "remove" ? (
              <p className="py-2">
                {meetingName} will be removed.{" "}
                <button type="button" className="font-medium text-indigo-700" onClick={() => setMeeting("keep")}>
                  Undo
                </button>
              </p>
            ) : (
              <div className="flex flex-wrap items-center gap-2 py-1.5">
                <span className="truncate text-muted">{details.meeting.label.replace(/^Join /, "")} link attached</span>
                {edit.canRemoveMeeting ? (
                  <button type="button" className="font-medium text-red-600" onClick={() => setMeeting("remove")}>
                    Remove
                  </button>
                ) : null}
              </div>
            )
          ) : edit.canAddMeeting ? (
            <label className="inline-flex min-h-10 items-center gap-2">
              <input type="checkbox" checked={meeting === "add"} onChange={(e) => setMeeting(e.target.checked ? "add" : "keep")} />
              Add {meetingName} video call
            </label>
          ) : (
            <p className="py-2 text-muted">No video call. {provider === "Outlook" ? "This Outlook account can't add online meetings." : ""}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <MapPin className="h-4 w-4 shrink-0 text-muted" aria-hidden />
        <input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Add location" aria-label="Location" className={`${inputClass} w-full px-3`} />
      </div>

      <div className="flex items-start gap-2">
        <Users className="mt-2.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex gap-2">
            <input
              value={guestInput}
              onChange={(e) => setGuestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === ",") {
                  e.preventDefault();
                  addGuests(guestInput);
                }
              }}
              onBlur={() => guestInput.trim() && addGuests(guestInput)}
              placeholder="Add guests by email"
              aria-label="Add guest email"
              type="email"
              className={`${inputClass} min-w-0 flex-1 px-3`}
            />
            <Button type="button" variant="outline" className="h-10" onClick={() => addGuests(guestInput)} disabled={!guestInput.trim()}>
              Add
            </Button>
          </div>
          {guests.length ? (
            <ul className="space-y-1">
              {guests.map((g) => (
                <li key={g.email.toLowerCase()} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-subtle">
                  <span className="min-w-0 flex-1 truncate" title={g.email}>
                    {g.name ? (
                      <>
                        {g.name} <span className="text-muted">{g.email}</span>
                      </>
                    ) : (
                      g.email
                    )}
                  </span>
                  <label className="inline-flex shrink-0 items-center gap-1 text-xs text-muted">
                    <input
                      type="checkbox"
                      checked={g.optional}
                      onChange={(e) =>
                        setGuests((list) => list.map((x) => (x.email === g.email ? { ...x, optional: e.target.checked } : x)))
                      }
                    />
                    Optional
                  </label>
                  <button
                    type="button"
                    aria-label={`Remove ${g.email}`}
                    onClick={() => setGuests((list) => list.filter((x) => x.email !== g.email))}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-card hover:text-heading"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="flex items-start gap-2">
        <AlignLeft className="mt-2.5 h-4 w-4 shrink-0 text-muted" aria-hidden />
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          placeholder="Add description"
          aria-label="Description"
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </div>

      {hadGuests || hasGuests ? (
        edit.canChooseNotify ? (
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
            Email guests about this change
          </label>
        ) : (
          <p className="text-xs text-muted">Outlook emails guests about changes to this meeting.</p>
        )
      ) : null}

      {error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 surface-dark:bg-red-500/10 surface-dark:text-red-300">{error}</p>
      ) : null}

      {confirmDelete ? (
        <div className="space-y-3 rounded-lg border border-red-200 bg-red-50 px-3 py-3 surface-dark:border-red-500/30 surface-dark:bg-red-500/10">
          <p className="font-medium text-red-800 surface-dark:text-red-200">
            {`Delete ${scope === "all" ? "every event in this series" : "this event"} from ${provider} Calendar? This can't be undone here.`}
          </p>
          {hadGuests ? <p className="text-xs text-red-800 surface-dark:text-red-200">{notify ? "Guests will get a cancellation." : "Guests won't be emailed."}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-10" disabled={deleting} onClick={() => setConfirmDelete(false)}>
              Keep it
            </Button>
            <Button type="button" className="min-h-10 bg-red-600 text-white hover:bg-red-700" disabled={deleting} onClick={() => void remove()}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <Button type="button" variant="ghost" className="min-h-11 text-red-600 sm:min-h-10" disabled={busy || confirmDelete} onClick={() => setConfirmDelete(true)}>
          <Trash2 className="h-4 w-4" /> Delete
        </Button>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Button type="button" variant="outline" className="min-h-11 sm:min-h-10" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="accent" className="min-h-11 sm:min-h-10" disabled={busy || "error" in times} onClick={() => void save()}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
