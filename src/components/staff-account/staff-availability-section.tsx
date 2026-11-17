"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { CalendarCheck2, CalendarClock, CalendarOff, Gauge, Lock, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BookingCard, FieldLabel, Notice, ToggleRow, WeeklyHoursEditor } from "@/components/admin/booking/booking-ui";
import { MyGoogleCalendarPanel } from "@/components/admin/booking/my-google-calendar";
import { useSectionSave } from "@/components/staff-account/use-section-save";
import type { WeeklyHours } from "@/lib/booking/settings";
import { formatZoned, zonedInstant } from "@/lib/booking/time";
import type { TimeOffEntry } from "@/lib/staff-account-shared";
import type { StaffAccountData } from "@/lib/staff-account";

const MIGRATION_NOTE = "Your studio needs a quick update before this can be saved. Ask your studio owner.";

function hoursSummary(hours: WeeklyHours): string {
  const names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const on = [1, 2, 3, 4, 5, 6, 0].filter((i) => hours[i].enabled);
  if (!on.length) return "No working days";
  const fmt = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return `${((h + 11) % 12) + 1}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
  };
  const first = hours[on[0]];
  const same = on.every((i) => hours[i].start === first.start && hours[i].end === first.end);
  return `${on.map((i) => names[i]).join(", ")}${same ? ` · ${fmt(first.start)}–${fmt(first.end)}` : " · varies by day"}`;
}

/** Availability: hours, limits, time off and personal Google Calendar. Only for bookable people. */
export function StaffAvailabilitySection({ data }: { data: StaffAccountData }) {
  const a = data.availability;
  return (
    <section id="availability" className="scroll-mt-24 space-y-5">
      <HoursCard data={data} />
      <LimitsCard data={data} />
      <TimeOffCard data={data} />
      <BookingCard
        icon={CalendarCheck2}
        title="Your Google Calendar"
        description="Connect your own calendar so busy times there block bookings. Your studio never sees event details."
      >
        <MyGoogleCalendarPanel />
      </BookingCard>
      <p className="px-1 text-xs text-muted">Times are in the studio&apos;s time zone ({a.timeZone.replace(/_/g, " ")}).</p>
    </section>
  );
}

function HoursCard({ data }: { data: StaffAccountData }) {
  const a = data.availability;
  const { saving, save } = useSectionSave("availability");
  const [own, setOwn] = useState(a.workingHours !== null);
  const [hours, setHours] = useState<WeeklyHours>(a.workingHours ?? a.businessHours);
  const [perDay, setPerDay] = useState(false);
  const baseline = JSON.stringify(a.workingHours);
  const current = JSON.stringify(own ? hours : null);
  const dirty = baseline !== current;

  return (
    <BookingCard
      icon={CalendarClock}
      title="Working hours"
      description="When clients can book you. Your studio's hours apply unless you set your own."
    >
      <div className="space-y-4">
        <ToggleRow
          id="own-hours"
          checked={own}
          onChange={(v) => {
            setOwn(v);
            if (v && !a.workingHours) setHours(a.businessHours);
          }}
          label="Set my own hours"
          description={own ? undefined : `Following the studio: ${hoursSummary(a.businessHours)}`}
        />
        {own ? <WeeklyHoursEditor value={hours} onChange={setHours} idPrefix="staff-hours" perDay={perDay} onPerDayChange={setPerDay} /> : null}
        <div className="flex justify-end">
          <Button type="button" disabled={!dirty || saving} onClick={() => void save({ workingHours: own ? hours : null }, "Working hours saved")}>
            {saving ? "Saving…" : "Save hours"}
          </Button>
        </div>
      </div>
    </BookingCard>
  );
}

function LimitsCard({ data }: { data: StaffAccountData }) {
  const a = data.availability;
  const { saving, save } = useSectionSave("availability");
  const [maxShoots, setMaxShoots] = useState(a.maxShootsPerDay == null ? "" : String(a.maxShootsPerDay));
  const [radius, setRadius] = useState(a.serviceRadiusMiles == null ? "" : String(a.serviceRadiusMiles));
  const locked = !a.canEditLimits;
  const dirty =
    maxShoots !== (a.maxShootsPerDay == null ? "" : String(a.maxShootsPerDay)) ||
    radius !== (a.serviceRadiusMiles == null ? "" : String(a.serviceRadiusMiles));

  return (
    <BookingCard
      icon={Gauge}
      title="Shoot limits"
      description="How much you take on. Leave blank to use the studio's settings."
      action={
        locked ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs font-medium text-muted">
            <Lock className="h-3 w-3" aria-hidden /> Set by your studio
          </span>
        ) : null
      }
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="staff-max">Max shoots per day</FieldLabel>
            <Input
              id="staff-max"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={maxShoots}
              disabled={locked}
              onChange={(e) => setMaxShoots(e.target.value)}
              placeholder={`Studio: ${a.businessMaxShootsPerDay}`}
            />
          </div>
          {a.serviceRadiusEnabled ? (
            <div>
              <FieldLabel htmlFor="staff-radius" hint="Measured from your home base. Shoots farther than this aren't offered to you.">
                How far you&apos;ll drive (miles)
              </FieldLabel>
              <Input
                id="staff-radius"
                type="number"
                inputMode="numeric"
                min={1}
                max={1000}
                value={radius}
                disabled={locked}
                onChange={(e) => setRadius(e.target.value)}
                placeholder={a.businessServiceRadiusMiles ? `Studio: ${a.businessServiceRadiusMiles}` : "Studio default"}
              />
            </div>
          ) : null}
        </div>
        {locked ? <p className="text-xs text-muted">Your studio owner manages these. Contact them to change.</p> : null}
        {!locked ? (
          <div className="flex justify-end">
            <Button
              type="button"
              disabled={!dirty || saving}
              onClick={() =>
                void save(
                  {
                    maxShootsPerDay: maxShoots.trim() ? Number(maxShoots) : null,
                    ...(a.serviceRadiusEnabled ? { serviceRadiusMiles: radius.trim() ? Number(radius) : null } : {}),
                  },
                  "Shoot limits saved"
                )
              }
            >
              {saving ? "Saving…" : "Save limits"}
            </Button>
          </div>
        ) : null}
      </div>
    </BookingCard>
  );
}

function describeEntry(e: TimeOffEntry, timeZone: string): string {
  const day = (key: string) =>
    formatZoned(zonedInstant(key, 12 * 60, timeZone), timeZone, { weekday: "short", month: "short", day: "numeric" });
  const range = e.startDay === e.endDay ? day(e.startDay) : `${day(e.startDay)} – ${day(e.endDay)}`;
  if (!e.startTime || !e.endTime) return `${range} · all day`;
  const t = (wall: string) => {
    const [h, m] = wall.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
  };
  return `${range} · ${t(e.startTime)}–${t(e.endTime)}`;
}

function TimeOffCard({ data }: { data: StaffAccountData }) {
  const a = data.availability;
  const { saving, save } = useSectionSave("availability");
  const [entries, setEntries] = useState<TimeOffEntry[]>(a.timeOff);
  const today = a.todayKey;
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const [partial, setPartial] = useState(false);
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("12:00");
  const [note, setNote] = useState("");
  useEffect(() => setEntries(a.timeOff), [a.timeOff]);

  async function persist(next: TimeOffEntry[], message: string) {
    const result = await save({ timeOff: next }, message);
    if (result && Array.isArray(result.timeOff)) setEntries(result.timeOff as TimeOffEntry[]);
    return Boolean(result);
  }

  async function add() {
    if (!start) return;
    const endDay = end && end >= start ? end : start;
    if (partial && to <= from) {
      toast.error("The end time must be after the start time.");
      return;
    }
    const entry: TimeOffEntry = {
      id: Math.random().toString(36).slice(2, 12),
      startDay: start,
      endDay,
      startTime: partial ? from : null,
      endTime: partial ? to : null,
      note: note.trim() || null,
    };
    if (await persist([...entries, entry], "Time off added")) {
      setNote("");
      setPartial(false);
    }
  }

  return (
    <BookingCard
      icon={CalendarOff}
      title="Time off"
      description="Vacations, sick days, appointments. Nobody can book you during these times."
    >
      <div className="space-y-4">
        {!data.v134Ready ? (
          <Notice tone="warn">Time off isn&apos;t available yet. {MIGRATION_NOTE}</Notice>
        ) : (
          <>
            {entries.length ? (
              <ul className="divide-y divide-border rounded-xl border border-border">
                {entries.map((e) => (
                  <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-heading">{describeEntry(e, a.timeZone)}</p>
                      {e.note ? <p className="truncate text-xs text-muted">{e.note}</p> : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove time off"
                      disabled={saving}
                      onClick={() => void persist(entries.filter((x) => x.id !== e.id), "Time off removed")}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">No upcoming time off.</p>
            )}

            <div className="space-y-3 rounded-xl bg-subtle p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="off-start">First day off</FieldLabel>
                  <Input
                    id="off-start"
                    type="date"
                    min={today}
                    value={start}
                    onChange={(e) => {
                      setStart(e.target.value);
                      if (!end || end < e.target.value) setEnd(e.target.value);
                    }}
                  />
                </div>
                <div>
                  <FieldLabel htmlFor="off-end">Last day off</FieldLabel>
                  <Input id="off-end" type="date" min={start || today} value={end} onChange={(e) => setEnd(e.target.value)} />
                </div>
              </div>
              <ToggleRow id="off-partial" checked={partial} onChange={setPartial} label="Only part of the day" />
              {partial ? (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-muted">From</span>
                  <Input type="time" aria-label="Off from" className="w-36" value={from} step={900} onChange={(e) => setFrom(e.target.value)} />
                  <span className="text-muted">to</span>
                  <Input type="time" aria-label="Off until" className="w-36" value={to} step={900} onChange={(e) => setTo(e.target.value)} />
                </div>
              ) : null}
              <div>
                <FieldLabel htmlFor="off-note">Note (optional)</FieldLabel>
                <Input id="off-note" value={note} maxLength={120} placeholder="Vacation" onChange={(e) => setNote(e.target.value)} />
              </div>
              <div className="flex justify-end">
                <Button type="button" variant="outline" disabled={saving || !start} onClick={() => void add()}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add time off
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted">Shoots already booked during new time off stay booked. Let your studio know so they can move them.</p>
          </>
        )}
      </div>
    </BookingCard>
  );
}
