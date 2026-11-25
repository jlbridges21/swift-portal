"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Clock, Loader2, MapPin, Trash2, User } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NativeSelect } from "@/components/admin/booking/booking-ui";
import { zonedDayAndMinutes, zonedTimeToIso } from "@/lib/projects-calendar";
import type { CalendarCreateProject, CalendarService } from "@/components/admin/shoot-calendar-mobile";
import type { CalendarEventRow } from "@/lib/calendar-events";

export type EventEditorTarget =
  | { kind: "new"; dayKey: string; startMin: number }
  | { kind: "edit"; event: CalendarEventRow };

/** What the grid draws while the form is open (Google Calendar's placeholder block). */
export type EventDraftPreview = { dayKey: string; startMin: number; endMin: number; label: string };

const pad = (n: number) => String(n).padStart(2, "0");
const toHm = (min: number) => `${pad(Math.floor(min / 60) % 24)}:${pad(min % 60)}`;
const fromHm = (hm: string) => {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
function durationLabel(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h && m ? `${h} hr ${m} min` : h ? `${h} hr` : `${m} min`;
}

/**
 * Google Calendar-style event form for the Shoot Calendar. Everything but the time is optional:
 * - Service: sets the length (its on-site duration).
 * - Project: makes it that project's shoot (client + address come from the project), booked as a
 *   manual override — any time, any length. Without a project it's a calendar event of its own.
 * Both kinds are written to the connected Google / Outlook calendar.
 */
export function EventEditor({
  target,
  onClose,
  onSaved,
  onDraftChange,
  timeZone,
  services,
  projects,
  team,
  viewerUserId,
  canBookProjects,
}: {
  target: EventEditorTarget | null;
  onClose: () => void;
  onSaved: () => void;
  onDraftChange?: (draft: EventDraftPreview | null) => void;
  timeZone: string;
  services: CalendarService[];
  projects: CalendarCreateProject[];
  team: { userId: string; name: string }[];
  viewerUserId: string | null;
  canBookProjects: boolean;
}) {
  const editing = target?.kind === "edit" ? target.event : null;
  const [title, setTitle] = useState("");
  const [day, setDay] = useState("");
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [serviceId, setServiceId] = useState("");
  const [projectId, setProjectId] = useState("");
  const [userId, setUserId] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load the target into the form — only when a different event opens (the parent re-renders
  // often and rebuilds its lists; that must not wipe what's being typed).
  const latest = useRef({ team, viewerUserId, timeZone });
  useLayoutEffect(() => {
    latest.current = { team, viewerUserId, timeZone };
  });
  useEffect(() => {
    if (!target) return;
    const { team, viewerUserId, timeZone } = latest.current;
    setError(null);
    if (target.kind === "new") {
      setTitle("");
      setDay(target.dayKey);
      setStart(toHm(target.startMin));
      setEnd(toHm(Math.min(24 * 60 - 15, target.startMin + 60)));
      setServiceId("");
      setProjectId("");
      setUserId(viewerUserId && team.some((t) => t.userId === viewerUserId) ? viewerUserId : (team[0]?.userId ?? ""));
      setLocation("");
      setDescription("");
    } else {
      const ev = target.event;
      const s = zonedDayAndMinutes(ev.start_at, timeZone);
      const e = zonedDayAndMinutes(ev.end_at, timeZone);
      setTitle(ev.title);
      setDay(s?.dayKey ?? "");
      setStart(toHm(s?.minutes ?? 540));
      setEnd(toHm(e && e.dayKey === s?.dayKey ? e.minutes : Math.min(24 * 60 - 15, (s?.minutes ?? 540) + 60)));
      setServiceId(ev.service_id ?? "");
      setProjectId("");
      setUserId(ev.assigned_user_id ?? "");
      setLocation(ev.location ?? "");
      setDescription(ev.description ?? "");
    }
  }, [target]);

  const project = projects.find((p) => p.id === projectId) ?? null;
  const startMin = fromHm(start);
  const endMin = fromHm(end);

  // Keep the grid's placeholder in step with the form.
  useEffect(() => {
    if (!target || target.kind !== "new" || startMin == null || endMin == null || !day) {
      onDraftChange?.(null);
      return;
    }
    onDraftChange?.({
      dayKey: day,
      startMin,
      endMin: Math.max(startMin + 15, endMin),
      label: project ? project.name : title.trim() || "(No title)",
    });
  }, [target, day, startMin, endMin, title, project, onDraftChange]);

  function pickService(id: string) {
    setServiceId(id);
    const svc = services.find((s) => s.id === id);
    if (svc && startMin != null) setEnd(toHm(Math.min(24 * 60 - 1, startMin + svc.durationMinutes)));
  }

  function changeStart(value: string) {
    // Moving the start keeps the length, like Google Calendar.
    const prevStart = startMin;
    setStart(value);
    const next = fromHm(value);
    if (next != null && prevStart != null && endMin != null) {
      setEnd(toHm(Math.min(24 * 60 - 1, next + Math.max(15, endMin - prevStart))));
    }
  }

  const lengthMin = startMin != null && endMin != null ? endMin - startMin : 0;
  const timesValid = Boolean(day) && startMin != null && endMin != null && lengthMin > 0;
  const projectOptions = useMemo(
    () => [
      { value: "", label: "No project (my own event)" },
      ...projects.map((p) => ({ value: p.id, label: p.clientName ? `${p.name} · ${p.clientName}` : p.name })),
    ],
    [projects]
  );

  async function save() {
    if (!timesValid || startMin == null || endMin == null) {
      setError("Choose a date, and an end time after the start.");
      return;
    }
    setSaving(true);
    setError(null);
    const startIso = zonedTimeToIso(day, startMin, timeZone);
    const endIso = zonedTimeToIso(day, endMin, timeZone);
    try {
      if (project && !editing) {
        // The project's shoot: booked as a manual override at exactly this time and length.
        const res = await fetch("/api/booking", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "schedule",
            projectId: project.id,
            start: startIso,
            userId: userId || null,
            durationMinutes: lengthMin,
            calendarOverride: true,
          }),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; violations?: string[] };
        if (!res.ok) throw new Error(body.error || "Couldn't book the shoot.");
        toast.success(`Shoot booked for ${project.name}.`);
      } else {
        const payload = {
          title,
          description,
          location,
          start: startIso,
          end: endIso,
          assignedUserId: userId || null,
          serviceId: serviceId || null,
        };
        const res = await fetch("/api/calendar-events", {
          method: editing ? "PATCH" : "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(editing ? { id: editing.id, ...payload } : payload),
        });
        const body = (await res.json().catch(() => ({}))) as { error?: string; event?: CalendarEventRow };
        if (!res.ok) throw new Error(body.error || "Couldn't save the event.");
        if (body.event?.sync_error) toast.warning(`Saved in ShootPortal. Calendar sync: ${body.event.sync_error}`);
        else toast.success(editing ? "Event updated." : "Event added.");
      }
      onDraftChange?.(null);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!editing) return;
    if (!window.confirm("Delete this event? It's also removed from your Google / Outlook calendar.")) return;
    setDeleting(true);
    const res = await fetch(`/api/calendar-events?id=${encodeURIComponent(editing.id)}`, { method: "DELETE", credentials: "include" });
    setDeleting(false);
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      setError(body.error || "Couldn't delete the event.");
      return;
    }
    toast.success("Event deleted.");
    onSaved();
  }

  const close = () => {
    onDraftChange?.(null);
    onClose();
  };

  return (
    <Modal
      open={Boolean(target)}
      onClose={close}
      title={editing ? "Edit event" : "New event"}
      className="sm:max-w-lg"
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {editing ? (
              <Button variant="ghost" type="button" className="min-h-11 text-red-600 sm:min-h-10" disabled={deleting || saving} onClick={remove}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Delete
              </Button>
            ) : null}
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button variant="outline" type="button" className="min-h-11 sm:min-h-10" disabled={saving} onClick={close}>
              Cancel
            </Button>
            <Button variant="accent" type="button" className="min-h-11 sm:min-h-10" disabled={saving || !timesValid} onClick={save}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {project && !editing ? "Book shoot" : "Save"}
            </Button>
          </div>
        </div>
      }
    >
      {target ? (
        <div className="space-y-4 text-sm">
          {!project ? (
            <input
              autoFocus
              aria-label="Title"
              placeholder="Add title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && timesValid) void save();
              }}
              className="w-full border-b-2 border-border bg-transparent pb-1.5 text-lg font-semibold text-heading outline-none placeholder:font-normal placeholder:text-muted focus:border-accent"
            />
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-muted" aria-hidden />
            <input
              type="date"
              aria-label="Date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-2 text-sm"
            />
            <input
              type="time"
              aria-label="Start time"
              step={900}
              value={start}
              onChange={(e) => changeStart(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-2 text-sm"
            />
            <span className="text-muted">–</span>
            <input
              type="time"
              aria-label="End time"
              step={900}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="h-10 rounded-lg border border-border bg-card px-2 text-sm"
            />
            {lengthMin > 0 ? <span className="text-xs text-muted">{durationLabel(lengthMin)}</span> : null}
          </div>

          {services.length ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Service (optional)</span>
              <NativeSelect
                ariaLabel="Service"
                value={serviceId}
                onChange={pickService}
                options={[
                  { value: "", label: "No service" },
                  ...services.map((s) => ({ value: s.id, label: `${s.name} (${durationLabel(s.durationMinutes)})` })),
                ]}
              />
              <span className="block text-xs text-muted">Picking a service sets the length to its time on site.</span>
            </label>
          ) : null}

          {canBookProjects && !editing ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">Project (optional)</span>
              <NativeSelect ariaLabel="Project" value={projectId} onChange={setProjectId} options={projectOptions} />
              {project ? (
                <span className="block space-y-0.5 rounded-lg bg-subtle px-3 py-2 text-xs text-foreground">
                  {project.clientName ? (
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted" aria-hidden /> {project.clientName}
                    </span>
                  ) : null}
                  {project.address ? (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-muted" aria-hidden /> {project.address}
                    </span>
                  ) : null}
                  <span className="block text-muted">
                    Booked as this project&apos;s shoot (any time, overriding availability). If it already has a shoot, it moves here.
                  </span>
                </span>
              ) : null}
            </label>
          ) : null}

          {team.length > 1 ? (
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-foreground">{project ? "Photographer" : "Whose calendar"}</span>
              <NativeSelect ariaLabel="Team member" value={userId} onChange={setUserId} options={team.map((t) => ({ value: t.userId, label: t.name }))} />
            </label>
          ) : null}

          {!project ? (
            <>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-foreground">Location (optional)</span>
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="Add location"
                  className="h-10 w-full rounded-lg border border-border bg-card px-3 text-sm"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-medium text-foreground">Description (optional)</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Add description"
                  className="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
                />
              </label>
            </>
          ) : null}

          {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 surface-dark:bg-red-500/10 surface-dark:text-red-300">{error}</p> : null}
        </div>
      ) : null}
    </Modal>
  );
}
