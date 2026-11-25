"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Car,
  ChevronDown,
  Clock,
  Gift,
  Loader2,
  MapPin,
  MinusCircle,
  Pencil,
  Plus,
  Receipt,
  RotateCcw,
  Trash2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDateKey } from "@/lib/team-pay/periods";
import {
  ADJUSTMENT_LABEL,
  formatCents,
  formatHours,
  formatMilesShort,
  formatMinutes,
  driveTripLabel,
  type AdjustmentKind,
  type PayLine,
  type PayPeriod,
  type PayStatement,
} from "@/lib/team-pay/types";
import { DriveLegList, InfoTip } from "./drive-legs";
import { MoneyField } from "./money-field";

/** What the owner can do to a statement; all return when the change is saved and reloaded. */
export type StatementActions = {
  editShoot: (proposalId: string, patch: Record<string, unknown>) => Promise<boolean>;
  decideRequest: (requestId: string, approve: boolean) => Promise<boolean>;
  addAdjustment: (input: { kind: AdjustmentKind; label: string; amountCents: number; dateKey: string }) => Promise<boolean>;
  deleteAdjustment: (adjustmentId: string) => Promise<boolean>;
};

/** What a team member can do on their own statement. */
export type MemberActions = {
  requestTime?: (proposalId: string, onsiteMinutes: number, note: string) => Promise<boolean>;
  checkIn?: (proposalId: string, step: "arrive" | "done") => Promise<boolean>;
};

function timeOf(iso: string | null, timeZone: string): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
}

function Chip({ icon: Icon, children, tone = "plain" }: { icon?: typeof Clock; children: React.ReactNode; tone?: "plain" | "edited" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs",
        tone === "edited" ? "bg-accent-subtle font-medium text-accent" : "bg-subtle text-muted"
      )}
    >
      {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
      {children}
    </span>
  );
}

/** Hours and minutes as two small boxes: nobody should have to type "190". */
function DurationField({ minutes, onChange, label }: { minutes: number; onChange: (minutes: number) => void; label: string }) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const box = "h-11 w-16 rounded-lg border border-border bg-white px-2 text-center text-sm text-foreground surface-dark:bg-card";
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted">
      <input
        type="number"
        min={0}
        max={24}
        aria-label={`${label} hours`}
        value={h}
        onChange={(e) => onChange(Math.min(24, Math.max(0, Math.round(Number(e.target.value) || 0))) * 60 + m)}
        className={box}
      />
      hr
      <input
        type="number"
        min={0}
        max={59}
        step={5}
        aria-label={`${label} minutes`}
        value={m}
        onChange={(e) => onChange(h * 60 + Math.min(59, Math.max(0, Math.round(Number(e.target.value) || 0))))}
        className={box}
      />
      min
    </span>
  );
}

/** (i) beside the drive fields: what the total is made of, leg by leg. */
function DriveInfo({ line }: { line: PayLine }) {
  return (
    <InfoTip label="What's counted in the drive">
      <span className="block font-medium text-heading">Enter the total for this shoot</span>
      <span className="mt-1 block text-muted">Every drive counted for this shoot, added together. Each leg below is one way.</span>
      {line.driveLegs?.length ? (
        <DriveLegList legs={line.driveLegs} className="mt-2 rounded-lg bg-subtle px-2.5 py-2" />
      ) : (
        <span className="mt-2 block rounded-lg bg-subtle px-2.5 py-2 text-muted">No planned route for this shoot. Enter what they drove.</span>
      )}
    </InfoTip>
  );
}

function ShootEditor({ line, onSave, onCancel }: { line: PayLine; onSave: (patch: Record<string, unknown>) => Promise<boolean>; onCancel: () => void }) {
  const [onsite, setOnsite] = useState(line.onsiteMinutes);
  const [drive, setDrive] = useState(line.driveMinutes);
  const [miles, setMiles] = useState(String(line.miles));
  const [amount, setAmount] = useState<number | null>(line.amountEdited ? line.amountCents : null);
  const [note, setNote] = useState(line.note ?? "");
  const [busy, setBusy] = useState(false);

  async function save(reset = false) {
    setBusy(true);
    const patch = reset
      ? { onsiteMinutes: null, driveMinutes: null, miles: null, amountCents: null, note: null }
      : {
          // Only what changed is stored: untouched values keep following the calendar.
          ...(onsite !== line.onsiteMinutes ? { onsiteMinutes: onsite } : {}),
          ...(drive !== line.driveMinutes ? { driveMinutes: drive } : {}),
          ...(Number(miles) !== line.miles ? { miles: Number(miles) || 0 } : {}),
          amountCents: amount,
          note: note.trim() || null,
        };
    const ok = await onSave(patch);
    setBusy(false);
    if (ok) onCancel();
  }

  const edited = line.onsiteSource === "edited" || line.amountEdited || Boolean(line.note) || Boolean(line.driveEdited);
  const plannedTrip = driveTripLabel(line.driveLegs);
  const plannedLegMinutes = (line.driveLegs ?? []).reduce((sum, l) => sum + l.minutes, 0);
  const plannedLegMiles = (line.driveLegs ?? []).reduce((sum, l) => sum + l.miles, 0);
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1">
          <span className="flex h-5 items-center text-xs font-medium text-muted">Time on site</span>
          <DurationField label="Time on site" minutes={onsite} onChange={setOnsite} />
        </label>
        <label className="space-y-1">
          <span className="flex h-5 items-center text-xs font-medium text-muted">Pay a set amount instead</span>
          <MoneyField className="w-32" ariaLabel="Set amount" placeholder="Worked out" valueCents={amount} onCommit={setAmount} />
        </label>
        <div className="space-y-1">
          <span className="flex h-5 items-center gap-1 text-xs font-medium text-muted">
            Driving <span className="font-normal">· total for this shoot</span>
            <DriveInfo line={line} />
          </span>
          <DurationField label="Driving, total for this shoot" minutes={drive} onChange={setDrive} />
        </div>
        <div className="space-y-1">
          <span className="flex h-5 items-center gap-1 text-xs font-medium text-muted">
            Miles <span className="font-normal">· total for this shoot</span>
            <DriveInfo line={line} />
          </span>
          <span className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={0.1}
              aria-label="Miles, total for this shoot"
              value={miles}
              onChange={(e) => setMiles(e.target.value)}
              className="h-11 w-28 rounded-lg border border-border bg-white px-3 text-sm text-foreground surface-dark:bg-card"
            />
            <span className="text-sm text-muted">mi</span>
          </span>
        </div>
        {plannedTrip ? (
          <p className="text-xs text-muted sm:col-span-2">
            Planned: {plannedTrip} ({formatMinutes(plannedLegMinutes)} · {formatMilesShort(plannedLegMiles)}). If they drove somewhere else too, add it in.
          </p>
        ) : null}
      </div>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Note (your team member sees it)"
        aria-label="Note"
        className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground surface-dark:bg-card"
      />
      <div className="flex flex-wrap items-center justify-between gap-2">
        {edited ? (
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void save(true)}>
            <RotateCcw className="h-4 w-4" /> Back to planned
          </Button>
        ) : (
          <span />
        )}
        <span className="flex gap-2">
          <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button type="button" variant="accent" size="sm" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Save
          </Button>
        </span>
      </div>
    </div>
  );
}

function RequestForm({ line, onSend, onCancel }: { line: PayLine; onSend: (minutes: number, note: string) => Promise<boolean>; onCancel: () => void }) {
  const [minutes, setMinutes] = useState(line.request?.onsiteMinutes ?? line.onsiteMinutes);
  const [note, setNote] = useState(line.request?.note ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="mt-3 space-y-3 rounded-xl border border-border bg-card p-3">
      <label className="block space-y-1">
        <span className="block text-xs font-medium text-muted">How long were you on site?</span>
        <DurationField label="Time on site" minutes={minutes} onChange={setMinutes} />
      </label>
      <input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="What happened? (optional)"
        aria-label="Note"
        className="h-11 w-full rounded-lg border border-border bg-white px-3 text-sm text-foreground surface-dark:bg-card"
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            const ok = await onSend(minutes, note);
            setBusy(false);
            if (ok) onCancel();
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Send to manager
        </Button>
      </div>
    </div>
  );
}

function AdjustmentForm({ period, todayKey, onAdd, onCancel }: { period: PayPeriod; todayKey: string; onAdd: StatementActions["addAdjustment"]; onCancel: () => void }) {
  const [kind, setKind] = useState<AdjustmentKind>("bonus");
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState<number | null>(null);
  const [dateKey, setDateKey] = useState(todayKey >= period.start && todayKey <= period.end ? todayKey : period.end);
  const [busy, setBusy] = useState(false);
  const kinds: { id: AdjustmentKind; icon: typeof Gift }[] = [
    { id: "bonus", icon: Gift },
    { id: "reimbursement", icon: Receipt },
    { id: "deduction", icon: MinusCircle },
  ];
  return (
    <div className="space-y-3 rounded-xl border border-border bg-card p-3">
      <div role="radiogroup" aria-label="Kind" className="flex flex-wrap gap-2">
        {kinds.map(({ id, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={kind === id}
            onClick={() => setKind(id)}
            className={cn(
              "inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-sm font-medium transition-colors",
              kind === id ? "border-accent bg-accent-subtle/60 text-accent ring-1 ring-accent" : "border-border text-heading hover:bg-subtle"
            )}
          >
            <Icon className="h-4 w-4" aria-hidden /> {ADJUSTMENT_LABEL[id]}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          maxLength={200}
          placeholder={kind === "reimbursement" ? "Drone battery" : kind === "deduction" ? "Gear damage" : "Great week"}
          aria-label="What it's for"
          className="h-11 min-w-[10rem] flex-1 rounded-lg border border-border bg-white px-3 text-sm text-foreground surface-dark:bg-card"
        />
        <MoneyField className="w-32" ariaLabel="Amount" valueCents={amount} onCommit={setAmount} />
        <input
          type="date"
          aria-label="Date"
          min={period.start}
          max={period.end}
          value={dateKey}
          onChange={(e) => e.target.value && setDateKey(e.target.value)}
          className="h-11 rounded-lg border border-border bg-white px-3 text-sm text-foreground surface-dark:bg-card"
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
        <Button
          type="button"
          variant="accent"
          size="sm"
          disabled={busy || !amount}
          onClick={async () => {
            if (!amount) return;
            setBusy(true);
            const ok = await onAdd({ kind, label: label.trim(), amountCents: amount, dateKey });
            setBusy(false);
            if (ok) onCancel();
          }}
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Add
        </Button>
      </div>
    </div>
  );
}

function LineRow({
  line,
  timeZone,
  todayKey,
  locked,
  actions,
  member,
}: {
  line: PayLine;
  timeZone: string;
  todayKey: string;
  locked: boolean;
  actions?: StatementActions;
  member?: MemberActions;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const flag = line.flags[0] ?? null;
  const needsReview = Boolean(flag) && !line.upcoming;
  const run = async (key: string, fn: () => Promise<boolean>) => {
    setBusy(key);
    await fn();
    setBusy(null);
  };

  if (line.kind === "adjustment") {
    const Icon = line.adjustmentKind === "deduction" ? MinusCircle : line.adjustmentKind === "reimbursement" ? Receipt : Gift;
    return (
      <li className="flex items-center gap-3 px-3 py-3 sm:px-4">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-muted">
          <Icon className="h-4 w-4" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-heading">{line.title}</span>
          <span className="block text-xs text-muted">{line.detail}</span>
        </span>
        <span className={cn("text-sm font-semibold tabular-nums", line.amountCents < 0 ? "text-red-600" : "text-heading")}>{formatCents(line.amountCents)}</span>
        {actions && !locked ? (
          <button
            type="button"
            aria-label={`Remove ${line.title}`}
            disabled={busy !== null}
            onClick={() => void run("del", () => actions.deleteAdjustment(line.id.replace(/^adj:/, "")))}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-red-600"
          >
            {busy === "del" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </button>
        ) : null}
      </li>
    );
  }

  const isToday = line.dateKey === todayKey;
  const canCheckIn = Boolean(member?.checkIn) && line.kind === "shoot" && isToday && !locked;
  const canRequest = Boolean(member?.requestTime) && line.kind === "shoot" && !line.upcoming && !locked;

  return (
    <li className={cn("px-3 py-3 sm:px-4", needsReview && "bg-amber-50 surface-dark:bg-amber-500/10", line.upcoming && "opacity-60")}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-start gap-3 text-left">
        <span className="hidden w-[4.5rem] shrink-0 pt-0.5 text-xs tabular-nums text-muted sm:block">{timeOf(line.startIso, timeZone)}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs tabular-nums text-muted sm:hidden">{timeOf(line.startIso, timeZone)}</span>
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-sm font-medium text-heading">{line.title}</span>
            {line.kind === "late_cancel" ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 surface-dark:bg-red-500/20 surface-dark:text-red-300">
                <XCircle className="h-3 w-3" aria-hidden /> Late cancel
              </span>
            ) : null}
            {line.upcoming ? <span className="rounded-full bg-subtle px-2 py-0.5 text-xs font-medium text-muted">Upcoming</span> : null}
          </span>
          {line.detail ? (
            <span className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted">
              <MapPin className="h-3 w-3 shrink-0" aria-hidden /> <span className="truncate">{line.detail}</span>
            </span>
          ) : null}
          {line.kind === "shoot" ? (
            <span className="mt-1.5 flex flex-wrap gap-1.5">
              <Chip icon={Clock} tone={line.onsiteSource === "booked" ? "plain" : "edited"}>
                {formatMinutes(line.onsiteMinutes)}
                {line.onsiteSource === "checked_in" ? " checked in" : line.onsiteSource === "edited" ? " adjusted" : ""}
              </Chip>
              {line.driveMinutes > 0 || line.miles > 0 ? (
                <Chip icon={Car} tone={line.driveEdited ? "edited" : "plain"}>
                  {formatMinutes(line.driveMinutes)} · {formatMilesShort(line.miles)}
                  {line.driveEdited ? " adjusted" : driveTripLabel(line.driveLegs) ? ` · ${driveTripLabel(line.driveLegs)}` : ""}
                </Chip>
              ) : null}
              {line.services.length ? <Chip>{line.services.join(" + ")}</Chip> : null}
            </span>
          ) : null}
        </span>
        <span className="flex shrink-0 items-center gap-1.5 pt-0.5">
          <span className="text-sm font-semibold tabular-nums text-heading">{formatCents(line.amountCents)}</span>
          <ChevronDown className={cn("h-4 w-4 text-muted transition-transform", open && "rotate-180")} aria-hidden />
        </span>
      </button>

      {/* What needs a decision sits on the line itself, with the two answers as buttons. */}
      {needsReview && flag ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 sm:pl-[5.25rem]">
          <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-medium text-amber-900 surface-dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            <span>
              {flag.message}
              {flag.code === "time_request" && line.request?.note ? <span className="font-normal"> · “{line.request.note}”</span> : null}
            </span>
          </span>
          {actions && flag.code === "time_request" && line.request ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("no", () => actions.decideRequest(line.request!.id, false))}>
                Keep {formatMinutes(line.onsiteMinutes)}
              </Button>
              <Button type="button" size="sm" variant="accent" disabled={busy !== null} onClick={() => void run("yes", () => actions.decideRequest(line.request!.id, true))}>
                {busy === "yes" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Approve {formatMinutes(flag.minutes ?? 0)}
              </Button>
            </>
          ) : null}
          {actions && flag.code === "over_time" && line.proposalId ? (
            <>
              <Button type="button" size="sm" variant="outline" disabled={busy !== null} onClick={() => void run("no", () => actions.editShoot(line.proposalId!, { onsiteMinutes: line.plannedMinutes }))}>
                Pay booked {formatMinutes(line.plannedMinutes)}
              </Button>
              <Button type="button" size="sm" variant="accent" disabled={busy !== null} onClick={() => void run("yes", () => actions.editShoot(line.proposalId!, { onsiteMinutes: flag.minutes ?? line.plannedMinutes }))}>
                {busy === "yes" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Pay {formatMinutes(flag.minutes ?? 0)}
              </Button>
            </>
          ) : null}
          {actions && flag.code === "no_rate" ? (
            <Link href="/admin/settings#settings-team-pay" className="inline-flex min-h-9 items-center rounded-lg border border-border bg-card px-3 text-sm font-medium text-heading hover:bg-subtle">
              Set service pay
            </Link>
          ) : null}
          {actions && (flag.code === "no_drive" || flag.code === "no_price" || flag.code === "no_rate") ? (
            <Button type="button" size="sm" variant="accent" onClick={() => { setOpen(true); setEditing(true); }}>
              Enter it
            </Button>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="mt-3 sm:pl-[5.25rem]">
          <div className="space-y-1 rounded-xl bg-subtle px-3 py-2.5">
            {line.amountEdited ? (
              <p className="text-sm text-muted">Amount set by hand.</p>
            ) : line.parts.length ? (
              line.parts.map((part) => (
                <div key={part.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-muted">{part.label}</span>
                  <span className="shrink-0 tabular-nums text-foreground">{formatCents(part.cents)}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted">Nothing to pay on this shoot yet.</p>
            )}
            {line.driveLegs?.length ? (
              <div className="mt-1.5 border-t border-border pt-2">
                <p className="mb-1 text-xs font-medium text-muted">{line.driveEdited ? "Planned drive (changed by hand above)" : "Drive counted"}</p>
                <DriveLegList legs={line.driveLegs} />
              </div>
            ) : line.includesDriveHome ? (
              <p className="pt-1 text-xs text-muted">Includes the drive home.</p>
            ) : null}
            {line.note ? <p className="pt-1 text-xs text-foreground">Note: {line.note}</p> : null}
          </div>

          {line.kind === "shoot" && !locked ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {actions && line.proposalId && !editing ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4" /> Change time or amount
                </Button>
              ) : null}
              {canCheckIn && line.proposalId ? (
                !line.checkIn?.arrivedAt ? (
                  <Button type="button" size="sm" variant="accent" disabled={busy !== null} onClick={() => void run("in", () => member!.checkIn!(line.proposalId!, "arrive"))}>
                    {busy === "in" ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} I&apos;ve arrived
                  </Button>
                ) : !line.checkIn.doneAt ? (
                  <Button type="button" size="sm" variant="accent" disabled={busy !== null} onClick={() => void run("out", () => member!.checkIn!(line.proposalId!, "done"))}>
                    {busy === "out" ? <Loader2 className="h-4 w-4 animate-spin" /> : null} I&apos;m done · arrived {timeOf(line.checkIn.arrivedAt, timeZone)}
                  </Button>
                ) : (
                  <Chip icon={Clock} tone="edited">
                    {timeOf(line.checkIn.arrivedAt, timeZone)} – {timeOf(line.checkIn.doneAt, timeZone)}
                  </Chip>
                )
              ) : null}
              {canRequest && !requesting ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setRequesting(true)}>
                  <Clock className="h-4 w-4" /> {line.request ? "Change my request" : "My time was different"}
                </Button>
              ) : null}
            </div>
          ) : null}
          {editing && actions && line.proposalId ? (
            <ShootEditor line={line} onCancel={() => setEditing(false)} onSave={(patch) => actions.editShoot(line.proposalId!, patch)} />
          ) : null}
          {requesting && member?.requestTime && line.proposalId ? (
            <RequestForm line={line} onCancel={() => setRequesting(false)} onSend={(minutes, note) => member.requestTime!(line.proposalId!, minutes, note)} />
          ) : null}
        </div>
      ) : null}
    </li>
  );
}

/**
 * One person's pay for one period: every shoot by day, how each amount was reached, and the
 * total. The owner gets the controls (`actions`); a team member gets theirs (`member`).
 */
export function StatementView({
  statement,
  timeZone,
  todayKey,
  actions,
  member,
}: {
  statement: PayStatement;
  timeZone: string;
  todayKey: string;
  actions?: StatementActions;
  member?: MemberActions;
}) {
  const [adding, setAdding] = useState(false);
  const locked = statement.status === "approved" || statement.status === "paid";
  const days = new Map<string, PayLine[]>();
  for (const line of statement.lines) days.set(line.dateKey, [...(days.get(line.dateKey) ?? []), line]);
  const t = statement.totals;

  return (
    <div className="space-y-4">
      {statement.overtimeWeeks.length ? (
        <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-sm text-amber-900 surface-dark:bg-amber-500/10 surface-dark:text-amber-200">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>
            Over 40 hours:{" "}
            {statement.overtimeWeeks.map((w) => `week of ${formatDateKey(w.weekStart)} (${formatHours(w.minutes)})`).join(", ")}. Overtime is
            worked out in your payroll software.
          </span>
        </p>
      ) : null}

      {statement.lines.length ? (
        <div className="overflow-hidden rounded-xl border border-border">
          {[...days.entries()].map(([dateKey, lines]) => (
            <section key={dateKey}>
              <h4 className="flex items-center justify-between border-b border-border bg-subtle px-3 py-1.5 text-xs font-semibold text-muted sm:px-4">
                <span>
                  {formatDateKey(dateKey, { weekday: true })}
                  {dateKey === todayKey ? " · Today" : ""}
                </span>
                <span className="tabular-nums">{formatCents(lines.filter((l) => !l.upcoming).reduce((s, l) => s + l.amountCents, 0))}</span>
              </h4>
              <ul className="divide-y divide-border border-b border-border last:border-b-0">
                {lines.map((line) => (
                  <LineRow key={line.id} line={line} timeZone={timeZone} todayKey={todayKey} locked={locked} actions={actions} member={member} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted">No shoots in this pay period.</p>
      )}

      {actions && !locked ? (
        adding ? (
          <AdjustmentForm period={statement.period} todayKey={todayKey} onAdd={actions.addAdjustment} onCancel={() => setAdding(false)} />
        ) : (
          <button type="button" onClick={() => setAdding(true)} className="inline-flex min-h-10 items-center gap-1.5 text-sm font-medium text-accent">
            <Plus className="h-4 w-4" aria-hidden /> Add a bonus, reimbursement or deduction
          </button>
        )
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3 rounded-xl bg-subtle px-4 py-3">
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
          <span>
            <span className="font-semibold text-heading">{t.shoots}</span> shoot{t.shoots === 1 ? "" : "s"}
          </span>
          <span>
            <span className="font-semibold text-heading">{formatHours(t.onsiteMinutes)}</span> on site
          </span>
          {t.driveMinutes > 0 || t.miles > 0 ? (
            <span>
              <span className="font-semibold text-heading">{formatHours(t.driveMinutes)}</span> · {formatMilesShort(t.miles)} driving
            </span>
          ) : null}
          {t.upcomingShoots > 0 ? (
            <span>
              {t.upcomingShoots} still to come ({formatCents(t.upcomingCents)})
            </span>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-xs text-muted">{locked ? "Total" : "So far"}</p>
          <p className="text-2xl font-semibold tabular-nums text-heading">{formatCents(t.amountCents)}</p>
        </div>
      </div>
    </div>
  );
}
