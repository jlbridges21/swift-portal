"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarDays,
  Car,
  CircleCheck,
  Layers,
  Loader2,
  MapPin,
  ReceiptText,
  RefreshCw,
  UserRoundCog,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { NativeSelect, PersonAvatar } from "@/components/admin/booking/booking-ui";
import { SchedulePanel, bookingPost } from "@/components/admin/booking/schedule-panel";
import { formatCurrency, cn } from "@/lib/utils";
import { formatDuration } from "@/lib/booking/settings";

type Stop = { proposalId: string | null; projectId: string | null; label: string; address: string | null; start: string | null; end: string | null };
type Leg = { minutes: number | null; miles: number | null };
type Details = {
  project: {
    id: string;
    name: string;
    address: string | null;
    clientName: string;
    clientEmail: string | null;
    clientPhone: string | null;
    services: string[];
    durationMinutes: number;
    coverUrl: string | null;
    travelMiles: number | null;
    outsideServiceArea: boolean;
  };
  schedulingStatus: string;
  estimate: { kind: string; status: string; totalCents: number; lines: { description: string; amountCents: number; travel: boolean }[] } | null;
  timeZone: string;
  canManage: boolean;
  canOverride: boolean;
  schemaReady: boolean;
  routesConfigured: boolean;
  team: boolean;
  appointment: {
    id: string;
    start: string;
    end: string;
    source: string | null;
    assignedUserId: string | null;
    assignee: { name: string; avatarUrl: string | null } | null;
    conflictOverride: boolean;
    googleSyncStatus: string | null;
  } | null;
  route: {
    previous: Stop | null;
    current: Stop;
    next: Stop | null;
    startsFromBase: boolean;
    endsAtBase: boolean;
    base: string | null;
    legIn: Leg;
    legOut: Leg;
    shootsThatDay: number;
  } | null;
  mapUrl?: string | null;
  teamOptions: { userId: string; name: string; title: string; avatarUrl: string | null; ok: boolean; issues: string[]; current: boolean }[];
};

const STATUS_LABEL: Record<string, { label: string; dot: string }> = {
  scheduled: { label: "Scheduled", dot: "bg-emerald-500" },
  awaiting_booking: { label: "Awaiting booking", dot: "bg-sky-500" },
  unscheduled: { label: "Unscheduled", dot: "bg-slate-400" },
  reschedule_requested: { label: "Reschedule requested", dot: "bg-amber-500" },
  cancelled: { label: "Cancelled", dot: "bg-red-500" },
};

export function AppointmentModal({
  projectId,
  open,
  onClose,
  onChanged,
}: {
  projectId: string | null;
  open: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [data, setData] = useState<Details | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"view" | "reschedule">("view");
  const [assignTo, setAssignTo] = useState<string>("");
  const [busy, setBusy] = useState<"reassign" | "cancel" | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelAck, setCancelAck] = useState(false);
  const [reassignOverride, setReassignOverride] = useState<string[] | null>(null);
  const [overrideReason, setOverrideReason] = useState("");
  const [mapFailed, setMapFailed] = useState(false);

  const load = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setError(null);
    const res = await bookingPost({ action: "details", projectId });
    if (res.ok) {
      setData(res.body as Details);
      setAssignTo((res.body as Details).appointment?.assignedUserId ?? "");
      setMapFailed(false);
    } else setError(res.body.error || "Couldn't load this shoot.");
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    if (open && projectId) {
      setMode("view");
      setNotice(null);
      void load();
    }
    if (!open) setData(null);
  }, [open, projectId, load]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && !cancelOpen && !reassignOverride && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, cancelOpen, reassignOverride]);

  if (!open) return null;

  const tz = data?.timeZone ?? "UTC";
  const fmt = (iso: string | null, opts: Intl.DateTimeFormatOptions) => (iso ? new Intl.DateTimeFormat("en-US", { timeZone: tz, ...opts }).format(new Date(iso)) : "");
  const time = (iso: string | null) => fmt(iso, { hour: "numeric", minute: "2-digit" });
  const appt = data?.appointment ?? null;
  const route = data?.route ?? null;
  const status = STATUS_LABEL[data?.schedulingStatus ?? "unscheduled"] ?? STATUS_LABEL.unscheduled;
  const selectedOption = data?.teamOptions.find((t) => t.userId === assignTo);
  const changingStaff = Boolean(appt && assignTo && assignTo !== appt.assignedUserId);

  async function reassign(reason?: string) {
    if (!appt || !assignTo) return;
    setBusy("reassign");
    const res = await bookingPost({
      action: "reassign",
      projectId,
      userId: assignTo,
      ...(reason ? { overrideReason: reason, confirmOverride: true } : {}),
    });
    setBusy(null);
    if (res.ok) {
      setReassignOverride(null);
      setNotice("Reassigned. Route, drive times and Google Calendar were updated.");
      onChanged();
      void load();
    } else if (res.status === 409 && res.body.violations?.length && data?.canOverride && !reason) {
      setReassignOverride(res.body.violations);
    } else {
      setError(res.body.error || "Couldn't reassign.");
    }
  }

  async function cancelShoot() {
    setBusy("cancel");
    const res = await bookingPost({ action: "cancel", projectId, reason: cancelReason });
    setBusy(null);
    if (res.ok) {
      setCancelOpen(false);
      onChanged();
      onClose();
    } else setError(res.body.error || "Couldn't cancel.");
  }

  const stops: { key: string; letter: string; title: string; stop: Stop | null; base?: string | null; current?: boolean }[] = route
    ? [
        { key: "a", letter: "A", title: route.previous ? "Previous stop" : "Start of day", stop: route.previous, base: route.previous ? null : route.base },
        { key: "b", letter: "B", title: "Current shoot", stop: route.current, current: true },
        { key: "c", letter: "C", title: route.next ? "Next stop" : "End of day", stop: route.next, base: route.next ? null : route.base },
      ]
    : [];

  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="appt-title">
      <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" onClick={onClose} aria-label="Close" />
      <div className="relative z-10 flex max-h-[calc(100dvh-24px)] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl border border-border bg-card shadow-2xl sm:rounded-2xl">
        <div className="flex items-start gap-4 border-b border-border px-5 py-4 sm:px-6">
          <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent sm:inline-flex">
            <CalendarDays className="h-6 w-6" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="appt-title" className="text-xl font-bold tracking-tight text-heading">
              {mode === "reschedule" ? "Reschedule shoot" : "Scheduled shoot details"}
            </h2>
            <p className="text-sm text-muted">View and manage this shoot: assignment, route and timing.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg border border-border p-2 text-muted hover:text-heading">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {loading && !data ? (
            <p className="flex items-center gap-2 py-16 text-sm text-muted justify-center">
              <Loader2 className="h-5 w-5 animate-spin" /> Loading shoot…
            </p>
          ) : !data ? (
            <p className="py-10 text-center text-sm text-red-600">{error}</p>
          ) : (
            <div className="space-y-5">
              <section className="grid gap-4 rounded-2xl border border-border p-4 lg:grid-cols-[1.4fr_1fr_1fr_1.2fr] lg:divide-x lg:divide-border">
                <div className="flex min-w-0 gap-4">
                  {data.project.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={data.project.coverUrl} alt="" className="h-24 w-32 shrink-0 rounded-xl object-cover" />
                  ) : (
                    <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
                      <MapPin className="h-8 w-8" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-lg font-bold text-heading">{data.project.clientName}</p>
                    <p className="mt-1 flex items-start gap-1.5 text-sm text-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
                      <span>{data.project.address ?? data.project.name}</span>
                    </p>
                    {data.project.clientPhone ? <p className="mt-1 text-xs text-muted">{data.project.clientPhone}</p> : null}
                  </div>
                </div>
                <div className="lg:pl-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-heading">
                    <CalendarDays className="h-4 w-4 text-muted" /> {appt ? fmt(appt.start, { weekday: "short", month: "short", day: "numeric", year: "numeric" }) : "Not scheduled"}
                  </p>
                  {appt ? (
                    <>
                      <p className="mt-1 text-sm text-foreground">
                        {time(appt.start)} – {time(appt.end)}
                      </p>
                      <p className="text-xs text-muted">({formatDuration(Math.round((Date.parse(appt.end) - Date.parse(appt.start)) / 60000))})</p>
                    </>
                  ) : null}
                </div>
                <div className="lg:pl-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-heading">
                    <Layers className="h-4 w-4 text-muted" /> Services
                  </p>
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {data.project.services.map((s) => (
                      <li key={s} className="rounded-lg bg-subtle px-2 py-1 text-xs font-medium">
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="lg:pl-4">
                  <p className="flex items-center gap-2 text-sm font-semibold text-heading">
                    <ReceiptText className="h-4 w-4 text-muted" /> {data.estimate?.kind === "official" ? "Proposal total" : "Estimate total"}
                  </p>
                  {data.estimate ? (
                    <>
                      <p className="mt-1 text-xl font-bold text-heading">{formatCurrency(data.estimate.totalCents)}</p>
                      <dl className="mt-1 space-y-0.5 text-xs">
                        {data.estimate.lines.slice(0, 4).map((l, i) => (
                          <div key={i} className="flex justify-between gap-2">
                            <dt className={cn("truncate text-muted", l.travel && "font-medium text-heading")}>{l.description}</dt>
                            <dd className="text-heading">{formatCurrency(l.amountCents)}</dd>
                          </div>
                        ))}
                      </dl>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-muted">No estimate yet</p>
                  )}
                </div>
              </section>

              {notice ? (
                <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                  <CircleCheck className="h-4 w-4" /> {notice}
                </p>
              ) : null}
              {error && data ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
              {appt?.conflictOverride ? (
                <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                  <AlertTriangle className="h-4 w-4 text-amber-600" /> Booked with an admin override — it may overlap another shoot or drive.
                </p>
              ) : null}

              {mode === "reschedule" ? (
                <section className="rounded-2xl border border-border p-4 sm:p-5">
                  <SchedulePanel
                    projectId={data.project.id}
                    timeZone={tz}
                    team={data.teamOptions.map((t) => ({ userId: t.userId, name: t.name }))}
                    initialStart={appt?.start}
                    initialUserId={data.team ? appt?.assignedUserId : null}
                    durationMinutes={data.project.durationMinutes}
                    canOverride={data.canOverride}
                    submitLabel={appt ? "Move shoot here" : "Schedule shoot"}
                    onDone={() => {
                      setMode("view");
                      setNotice(appt ? "Shoot rescheduled. The client and Google Calendar were updated." : "Shoot scheduled.");
                      onChanged();
                      void load();
                    }}
                  />
                </section>
              ) : (
                <div className="grid gap-5 lg:grid-cols-[1fr_1.15fr]">
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 rounded-xl border border-border px-4 py-3">
                      <span className={cn("h-2.5 w-2.5 rounded-full", status.dot)} />
                      <span className="text-sm font-semibold text-heading">Scheduling status</span>
                      <span className="ml-auto rounded-full bg-subtle px-2.5 py-0.5 text-xs font-semibold text-heading">{status.label}</span>
                    </div>

                    {appt ? (
                      <div className="rounded-xl border border-border p-4">
                        <p className="flex items-center gap-2 text-sm font-semibold text-heading">
                          <Users className="h-4 w-4 text-accent" /> Assigned photographer
                        </p>
                        {data.teamOptions.length > 1 && data.canManage ? (
                          <>
                            <div className="mt-3 flex items-center gap-3">
                              <PersonAvatar name={selectedOption?.name ?? appt.assignee?.name ?? "?"} url={selectedOption?.avatarUrl ?? appt.assignee?.avatarUrl ?? null} size={44} />
                              <NativeSelect
                                ariaLabel="Assigned photographer"
                                className="flex-1"
                                value={assignTo}
                                onChange={setAssignTo}
                                options={data.teamOptions.map((t) => ({
                                  value: t.userId,
                                  label: `${t.name}${t.current ? " (current)" : t.ok ? " · available" : " · conflict"}`,
                                }))}
                              />
                            </div>
                            <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-950 surface-dark:bg-amber-500/10 surface-dark:text-amber-200">
                              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
                              Changing the photographer recalculates the route and drive times for this shoot and the stops around it.
                            </p>
                            {changingStaff && selectedOption && !selectedOption.ok ? (
                              <ul className="mt-2 list-disc pl-5 text-xs text-red-700">
                                {selectedOption.issues.map((i) => (
                                  <li key={i}>{i}</li>
                                ))}
                              </ul>
                            ) : null}
                          </>
                        ) : (
                          <div className="mt-3 flex items-center gap-3">
                            <PersonAvatar name={appt.assignee?.name ?? "?"} url={appt.assignee?.avatarUrl ?? null} size={44} />
                            <div>
                              <p className="text-sm font-semibold text-heading">{appt.assignee?.name ?? "Unassigned"}</p>
                              <p className="text-xs text-muted">Photographer</p>
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}

                    {route ? (
                      <ol className="space-y-0">
                        {stops.map((s, i) => (
                          <li key={s.key} className="relative flex gap-3 pb-3">
                            {i < stops.length - 1 ? <span className="absolute left-[15px] top-8 h-[calc(100%-1.5rem)] border-l-2 border-dashed border-border" aria-hidden /> : null}
                            <span
                              className={cn(
                                "z-10 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                                s.current ? "bg-accent text-accent-foreground" : s.letter === "A" ? "bg-emerald-600 text-white" : "bg-violet-600 text-white"
                              )}
                            >
                              {s.letter}
                            </span>
                            <div
                              className={cn(
                                "flex min-w-0 flex-1 flex-wrap items-start justify-between gap-2 rounded-xl px-3 py-2",
                                s.current ? "border border-accent bg-accent-subtle/60" : "border border-transparent"
                              )}
                            >
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-heading">
                                  {s.title}
                                  {s.current ? <span className="ml-1 text-xs font-medium text-accent">(this shoot)</span> : null}
                                </p>
                                <p className="truncate text-xs text-muted">{s.stop?.address ?? s.base ?? "Base address not set"}</p>
                              </div>
                              {s.stop?.start ? (
                                <span className={cn("rounded-lg px-2 py-1 text-xs font-semibold", s.current ? "bg-card text-accent" : "bg-subtle text-heading")}>
                                  {time(s.stop.start)} – {time(s.stop.end)}
                                </span>
                              ) : (
                                <span className="text-xs text-muted">{i === 0 ? "Home / base" : "Return"}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>

                  {route ? (
                    <div className="space-y-3">
                      <div className="relative overflow-hidden rounded-2xl border border-border bg-subtle">
                        {data.mapUrl && !mapFailed ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={`${data.mapUrl}&v=${encodeURIComponent(appt?.assignedUserId ?? "")}`}
                            alt="Route map: previous stop, this shoot, next stop"
                            onError={() => setMapFailed(true)}
                            className="aspect-[16/10] w-full object-cover"
                          />
                        ) : (
                          <RouteSketch legIn={route.legIn} legOut={route.legOut} routesConfigured={data.routesConfigured} />
                        )}
                        <div className="pointer-events-none absolute left-3 top-3 flex flex-col gap-1.5">
                          <LegChip label="A → B" leg={route.legIn} />
                          <LegChip label="B → C" leg={route.legOut} />
                        </div>
                      </div>
                      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-3 rounded-xl border border-border px-4 py-3">
                        <span className="flex items-center gap-2 text-sm font-semibold text-heading">
                          <Car className="h-5 w-5 text-accent" /> Drive
                        </span>
                        <div className="text-sm">
                          <p className="text-xs text-muted">A → B {route.previous ? "(previous → this)" : "(from base)"}</p>
                          <p className="font-semibold text-heading">{legText(route.legIn)}</p>
                        </div>
                        <div className="text-sm">
                          <p className="text-xs text-muted">B → C {route.next ? "(this → next)" : "(to base)"}</p>
                          <p className="font-semibold text-heading">{legText(route.legOut)}</p>
                        </div>
                      </div>
                      <p className="text-xs text-muted">
                        {route.shootsThatDay} shoot{route.shootsThatDay === 1 ? "" : "s"} that day for this photographer.
                      </p>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
                      {appt ? "Route unavailable." : "Schedule this shoot to see its route and drive times."}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {data ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-subtle/40 px-5 py-3 sm:px-6">
            {data.canManage && appt && data.teamOptions.length > 1 && mode === "view" ? (
              <Button variant="outline" className="min-h-11" disabled={!changingStaff || busy !== null} onClick={() => reassign()}>
                {busy === "reassign" ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserRoundCog className="h-4 w-4" />} Reassign
              </Button>
            ) : null}
            {data.canManage && data.schemaReady ? (
              <Button variant="outline" className="min-h-11" onClick={() => setMode(mode === "view" ? "reschedule" : "view")}>
                <RefreshCw className="h-4 w-4" /> {mode === "reschedule" ? "Back to details" : appt ? "Reschedule" : "Schedule"}
              </Button>
            ) : null}
            <Link href={`/admin/projects/${data.project.id}`}>
              <Button variant="outline" className="min-h-11">
                Open project <ArrowUpRight className="h-4 w-4" />
              </Button>
            </Link>
            {data.canManage && appt ? (
              <Button variant="outline" className="ml-auto min-h-11 border-red-300 text-red-700 hover:bg-red-50" onClick={() => setCancelOpen(true)}>
                <AlertTriangle className="h-4 w-4" /> Cancel shoot
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      <Modal
        open={cancelOpen}
        onClose={() => busy === null && setCancelOpen(false)}
        title="Cancel this shoot?"
        overlayClassName="z-[140]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={busy !== null}>
              Keep shoot
            </Button>
            <Button variant="destructive" disabled={!cancelAck || busy !== null} onClick={cancelShoot}>
              {busy === "cancel" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Cancel shoot
            </Button>
          </div>
        }
      >
        <div className="space-y-3 text-sm">
          <p className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-red-800">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            This removes the shoot from the schedule and Google Calendar even though it was confirmed with the client. The client is
            notified.
          </p>
          <textarea
            rows={2}
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Reason (shared with the client)"
            className="w-full rounded-lg border border-border bg-card px-3 py-2"
          />
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-accent" checked={cancelAck} onChange={(e) => setCancelAck(e.target.checked)} />
            <span>Yes, cancel this confirmed shoot.</span>
          </label>
        </div>
      </Modal>

      <Modal
        open={Boolean(reassignOverride)}
        onClose={() => busy === null && setReassignOverride(null)}
        title="Admin override: reassign anyway?"
        overlayClassName="z-[140]"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setReassignOverride(null)}>
              Go back
            </Button>
            <Button variant="destructive" disabled={overrideReason.trim().length < 3 || busy !== null} onClick={() => reassign(overrideReason.trim())}>
              Override and reassign
            </Button>
          </div>
        }
      >
        <ul className="list-disc space-y-1 rounded-lg bg-red-50 py-2 pl-8 pr-3 text-sm text-red-800">
          {reassignOverride?.map((v) => (
            <li key={v}>{v}</li>
          ))}
        </ul>
        <textarea
          rows={2}
          value={overrideReason}
          onChange={(e) => setOverrideReason(e.target.value)}
          placeholder="Reason (saved to the project history)"
          className="mt-3 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
        />
      </Modal>
    </div>
  );
}

function legText(leg: Leg): string {
  if (leg.minutes == null) return "—";
  return `${leg.minutes} min${leg.miles != null ? ` · ${leg.miles} mi` : ""}`;
}

function LegChip({ label, leg }: { label: string; leg: Leg }) {
  if (leg.minutes == null) return null;
  return (
    <span className="rounded-lg border border-border bg-card/95 px-2.5 py-1 text-xs shadow-sm">
      <span className="font-semibold text-heading">{label}</span>
      <span className="ml-1.5 text-muted">{legText(leg)}</span>
    </span>
  );
}

/** Stylized route when no map image is available (no Maps key, or the image failed). */
function RouteSketch({ legIn, legOut, routesConfigured }: { legIn: Leg; legOut: Leg; routesConfigured: boolean }) {
  return (
    <div className="relative aspect-[16/10] w-full bg-[radial-gradient(circle_at_30%_20%,rgba(59,130,246,0.08),transparent_60%),radial-gradient(circle_at_80%_80%,rgba(124,58,237,0.08),transparent_55%)]">
      <svg viewBox="0 0 400 250" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d="M70 200 C 120 160, 150 150, 190 130 S 280 70, 330 50" fill="none" stroke="currentColor" className="text-accent" strokeWidth="5" strokeLinecap="round" />
        <circle cx="70" cy="200" r="14" className="fill-emerald-600" />
        <circle cx="190" cy="130" r="14" className="fill-blue-600" />
        <circle cx="330" cy="50" r="14" className="fill-violet-600" />
        <text x="70" y="205" textAnchor="middle" className="fill-white text-[13px] font-bold">A</text>
        <text x="190" y="135" textAnchor="middle" className="fill-white text-[13px] font-bold">B</text>
        <text x="330" y="55" textAnchor="middle" className="fill-white text-[13px] font-bold">C</text>
      </svg>
      {!routesConfigured || (legIn.minutes == null && legOut.minutes == null) ? (
        <p className="absolute bottom-3 left-3 right-3 rounded-lg bg-card/90 px-3 py-1.5 text-center text-xs text-muted">
          {routesConfigured ? "Live route unavailable for these addresses." : "Add GOOGLE_MAPS_API_KEY to show the live route map."}
        </p>
      ) : null}
    </div>
  );
}
