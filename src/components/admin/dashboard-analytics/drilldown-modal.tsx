"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Columns3, GripVertical, Loader2, Lock, RotateCcw } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  formatCents,
  moveColumn,
  normalizeColumnPrefs,
  type ColumnPrefs,
  type DrilldownResponse,
  type DrilldownRow,
  type RevenueView,
} from "@/lib/dashboard-analytics";

/**
 * Drill-down modal for the Command Center analytics: the projects behind one chart
 * period or one service slice, in a table whose columns the viewer can show, hide,
 * and reorder (drag or arrow buttons). Column choices are remembered per browser.
 */

export type DrilldownRequest = {
  mode: "period" | "service";
  title: string;
  subtitle: string;
  from: string;
  to: string;
  serviceKeys?: string[];
  view: RevenueView;
};

type Column = {
  key: string;
  label: string;
  align?: "right";
  locked?: boolean;
  sort: (r: DrilldownRow) => string | number;
  render: (r: DrilldownRow) => ReactNode;
};

const dash = <span className="text-muted">—</span>;

function money(cents: number, emphasize = false) {
  if (!cents) return dash;
  return <span className={cn("tabular-nums", emphasize && "font-semibold text-heading", cents < 0 && "text-red-700")}>{formatCents(cents)}</span>;
}

function dateOnly(day: string | null) {
  if (!day) return dash;
  // shoot_date is a calendar date; parse at noon UTC so no timezone shifts it a day.
  return formatDate(`${day.slice(0, 10)}T12:00:00Z`);
}

const COLUMNS: Column[] = [
  {
    key: "project",
    label: "Project",
    locked: true,
    sort: (r) => r.name.toLowerCase(),
    render: (r) => (
      <Link href={`/admin/projects/${r.id}`} className="font-medium text-heading hover:text-accent hover:underline">
        {r.name}
      </Link>
    ),
  },
  {
    key: "client",
    label: "Client",
    sort: (r) => (r.clientName ?? "").toLowerCase(),
    render: (r) =>
      r.clientName ? (
        r.clientId ? (
          <Link href={`/admin/clients/${r.clientId}`} className="text-heading hover:text-accent hover:underline">
            {r.clientName}
          </Link>
        ) : (
          r.clientName
        )
      ) : (
        dash
      ),
  },
  { key: "company", label: "Company", sort: (r) => (r.clientCompany ?? "").toLowerCase(), render: (r) => r.clientCompany || dash },
  {
    key: "email",
    label: "Client email",
    sort: (r) => (r.clientEmail ?? "").toLowerCase(),
    render: (r) => (r.clientEmail ? <a href={`mailto:${r.clientEmail}`} className="hover:text-accent hover:underline">{r.clientEmail}</a> : dash),
  },
  { key: "services", label: "Service", sort: (r) => r.services.join(", ").toLowerCase(), render: (r) => (r.services.length ? r.services.join(", ") : <span className="text-muted">No service set</span>) },
  { key: "status", label: "Status", sort: (r) => r.status, render: (r) => <StatusBadge status={r.status} className="whitespace-nowrap" /> },
  {
    key: "activity",
    label: "In this period",
    sort: (r) => Number(r.isNew) * 4 + Number(r.paymentCount > 0) * 2 + Number(r.invoiceCount > 0),
    render: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.isNew ? <Chip tone="blue">New project</Chip> : null}
        {r.paymentCount ? <Chip tone="green">{r.paymentCount === 1 ? "Paid" : `Paid ×${r.paymentCount}`}</Chip> : null}
        {r.refundedCents ? <Chip tone="red">Refunded</Chip> : null}
        {r.invoiceCount ? <Chip tone="violet">{r.invoiceCount === 1 ? "Invoiced" : `Invoiced ×${r.invoiceCount}`}</Chip> : null}
      </span>
    ),
  },
  { key: "paid", label: "Payments received", align: "right", sort: (r) => r.paidCents, render: (r) => money(r.paidCents, true) },
  { key: "invoiced", label: "Invoices issued", align: "right", sort: (r) => r.invoicedCents, render: (r) => money(r.invoicedCents, true) },
  { key: "payments", label: "Payments (#)", align: "right", sort: (r) => r.paymentCount, render: (r) => (r.paymentCount ? <span className="tabular-nums">{r.paymentCount}</span> : dash) },
  { key: "lifetime", label: "Total paid (all time)", align: "right", sort: (r) => r.lifetimePaidCents, render: (r) => money(r.lifetimePaidCents) },
  { key: "created", label: "Created", sort: (r) => r.createdAt, render: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)}</span> },
  { key: "shoot", label: "Shoot date", sort: (r) => r.shootDate ?? "", render: (r) => <span className="whitespace-nowrap">{dateOnly(r.shootDate)}</span> },
  { key: "address", label: "Property address", sort: (r) => r.address.toLowerCase(), render: (r) => r.address || dash },
];

const COLUMN_KEYS = COLUMNS.map((c) => c.key);
const LOCKED = COLUMNS.filter((c) => c.locked).map((c) => c.key);
const BY_KEY = new Map(COLUMNS.map((c) => [c.key, c]));

function defaultColumns(mode: DrilldownRequest["mode"], view: RevenueView): string[] {
  if (mode === "service") return ["project", "client", "status", "created", "shoot", "lifetime"];
  return ["project", "client", "services", "activity", view === "payments" ? "paid" : "invoiced", "status", "created"];
}

const storageKey = (mode: string) => `shootportal:cc-drilldown-columns:${mode}`;

function readPrefs(mode: DrilldownRequest["mode"], view: RevenueView): ColumnPrefs {
  let stored: unknown = null;
  try {
    const raw = window.localStorage.getItem(storageKey(mode));
    stored = raw ? JSON.parse(raw) : null;
  } catch {
    stored = null;
  }
  return normalizeColumnPrefs(stored, COLUMN_KEYS, defaultColumns(mode, view), LOCKED);
}

function writePrefs(mode: string, prefs: ColumnPrefs | null) {
  try {
    if (prefs) window.localStorage.setItem(storageKey(mode), JSON.stringify(prefs));
    else window.localStorage.removeItem(storageKey(mode));
  } catch {
    // Private mode or blocked storage: the choice just won't be remembered.
  }
}

function Chip({ tone, children }: { tone: "blue" | "green" | "red" | "violet"; children: ReactNode }) {
  const tones = {
    blue: "bg-sky-50 text-sky-700",
    green: "bg-emerald-50 text-emerald-700",
    red: "bg-red-50 text-red-700",
    violet: "bg-violet-50 text-violet-700",
  };
  return <span className={cn("whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium", tones[tone])}>{children}</span>;
}

type Filter = "all" | "new" | "paid" | "invoiced";

export function DrilldownModal({ request, onClose }: { request: DrilldownRequest | null; onClose: () => void }) {
  const [data, setData] = useState<DrilldownResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const [prefs, setPrefs] = useState<ColumnPrefs | null>(null);
  const [editing, setEditing] = useState(false);

  const requestKey = request
    ? `${request.mode}|${request.from}|${request.to}|${JSON.stringify(request.serviceKeys ?? [])}`
    : null;

  useEffect(() => {
    if (!request) return;
    setPrefs(readPrefs(request.mode, request.view));
    setFilter("all");
    setSort(null);
    setEditing(false);
    // Prefs/filters reset per opened drill-down; request fields are captured by requestKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  useEffect(() => {
    if (!request) return;
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);
    const params = new URLSearchParams({ from: request.from, to: request.to });
    for (const key of request.serviceKeys ?? []) params.append("service", key);
    fetch(`/api/admin/dashboard/analytics/projects?${params}`, { credentials: "include", signal: ctrl.signal })
      .then(async (res) => {
        const body = await res.json().catch(() => null);
        if (!res.ok || !body) throw new Error(body?.error || "Could not load projects.");
        setData(body as DrilldownResponse);
      })
      .catch((err: Error) => {
        if (err.name !== "AbortError") setError(err.message);
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setLoading(false);
      });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestKey]);

  const rows = useMemo(() => data?.rows ?? [], [data]);
  const counts = useMemo(
    () => ({
      all: rows.length,
      new: rows.filter((r) => r.isNew).length,
      paid: rows.filter((r) => r.paymentCount > 0 || r.refundedCents > 0).length,
      invoiced: rows.filter((r) => r.invoiceCount > 0).length,
    }),
    [rows]
  );

  const shown = useMemo(() => {
    const filtered = rows.filter((r) =>
      filter === "all"
        ? true
        : filter === "new"
          ? r.isNew
          : filter === "paid"
            ? r.paymentCount > 0 || r.refundedCents > 0
            : r.invoiceCount > 0
    );
    if (!sort) return filtered;
    const col = BY_KEY.get(sort.key);
    if (!col) return filtered;
    return [...filtered].sort((a, b) => {
      const x = col.sort(a);
      const y = col.sort(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, filter, sort]);

  const totals = useMemo(
    () => ({
      paid: shown.reduce((a, r) => a + r.paidCents, 0),
      invoiced: shown.reduce((a, r) => a + r.invoicedCents, 0),
    }),
    [shown]
  );

  if (!request) return null;
  const visible = (prefs?.visible ?? defaultColumns(request.mode, request.view))
    .map((k) => BY_KEY.get(k))
    .filter((c): c is Column => Boolean(c));

  const updatePrefs = (next: ColumnPrefs) => {
    setPrefs(next);
    writePrefs(request.mode, next);
  };

  const toggleSort = (key: string) =>
    setSort((cur) => (!cur || cur.key !== key ? { key, dir: 1 } : cur.dir === 1 ? { key, dir: -1 } : null));

  const filters: { key: Filter; label: string }[] =
    request.mode === "period"
      ? [
          { key: "all", label: "All" },
          { key: "new", label: "New projects" },
          { key: "paid", label: "Payments received" },
          { key: "invoiced", label: "Invoices issued" },
        ]
      : [];

  return (
    <Modal open onClose={onClose} title={request.title} className="sm:max-w-5xl">
      <div className="min-w-0 space-y-4 pb-2">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 text-sm text-muted">
            <p>{request.subtitle}</p>
            {data ? (
              <p className="mt-1">
                <span className="font-medium text-heading">{shown.length}</span> project{shown.length === 1 ? "" : "s"}
                {totals.paid ? <> · {formatCents(totals.paid)} received</> : null}
                {totals.invoiced ? <> · {formatCents(totals.invoiced)} invoiced</> : null}
              </p>
            ) : null}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="min-h-10 shrink-0 self-start"
            aria-expanded={editing}
            onClick={() => setEditing((v) => !v)}
          >
            <Columns3 className="h-4 w-4" /> Columns
            {editing ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </Button>
        </div>

        {editing && prefs ? (
          <ColumnEditor
            prefs={prefs}
            onChange={updatePrefs}
            onReset={() => {
              writePrefs(request.mode, null);
              setPrefs(normalizeColumnPrefs(null, COLUMN_KEYS, defaultColumns(request.mode, request.view), LOCKED));
            }}
          />
        ) : null}

        {filters.length && data ? (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter projects">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                disabled={f.key !== "all" && counts[f.key] === 0}
                className={cn(
                  "min-h-9 rounded-full border px-3 text-xs font-medium transition-colors disabled:opacity-40",
                  filter === f.key ? "border-transparent bg-heading text-white" : "border-border text-muted hover:text-heading"
                )}
              >
                {f.label} <span className="tabular-nums opacity-70">{counts[f.key]}</span>
              </button>
            ))}
          </div>
        ) : null}

        {loading ? (
          <p className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading projects…
          </p>
        ) : error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : shown.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted">
            {request.mode === "service" ? "No projects with this service were created in this range." : "No project activity in this period."}
          </p>
        ) : (
          <div className="-mx-5 overflow-x-auto px-5">
            <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  {visible.map((c) => {
                    const active = sort?.key === c.key;
                    return (
                      <th
                        key={c.key}
                        scope="col"
                        aria-sort={active ? (sort!.dir === 1 ? "ascending" : "descending") : "none"}
                        className={cn("border-b border-border px-3 py-2 text-xs font-semibold text-muted first:pl-0", c.align === "right" ? "text-right" : "text-left")}
                      >
                        <button
                          type="button"
                          onClick={() => toggleSort(c.key)}
                          className={cn("inline-flex items-center gap-1 whitespace-nowrap hover:text-heading", active && "text-heading")}
                        >
                          {c.label}
                          {active ? sort!.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" /> : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.id} className="hover:bg-subtle">
                    {visible.map((c) => (
                      <td
                        key={c.key}
                        className={cn(
                          "max-w-[18rem] border-b border-border px-3 py-2.5 align-top text-foreground first:pl-0",
                          c.align === "right" && "text-right"
                        )}
                      >
                        {c.render(r)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {data?.truncated ? (
          <p className="text-xs text-muted">Showing the first {rows.length} projects. Narrow the date range to see the rest.</p>
        ) : null}
        {request.mode === "period" && data && !data.refundsTracked ? (
          <p className="text-xs text-muted">Refunds issued in Stripe are not recorded in ShootPortal yet, so they are not subtracted.</p>
        ) : null}
      </div>
    </Modal>
  );
}

function ColumnEditor({
  prefs,
  onChange,
  onReset,
}: {
  prefs: ColumnPrefs;
  onChange: (p: ColumnPrefs) => void;
  onReset: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const visible = new Set(prefs.visible);
  const setOrder = (order: string[]) => onChange({ order, visible: order.filter((k) => visible.has(k)) });

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over || e.active.id === e.over.id) return;
    const from = prefs.order.indexOf(String(e.active.id));
    const to = prefs.order.indexOf(String(e.over.id));
    if (from < 0 || to < 0) return;
    setOrder(arrayMove(prefs.order, from, to));
  };

  const toggle = (key: string) => {
    const next = new Set(visible);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange({ order: prefs.order, visible: prefs.order.filter((k) => next.has(k)) });
  };

  return (
    <div className="rounded-xl border border-border bg-subtle p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs text-muted">Choose columns and drag (or use the arrows) to reorder.</p>
        <button type="button" onClick={onReset} className="inline-flex min-h-9 shrink-0 items-center gap-1 text-xs font-medium text-accent hover:underline">
          <RotateCcw className="h-3.5 w-3.5" /> Reset
        </button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={prefs.order} strategy={verticalListSortingStrategy}>
          <ol className="grid max-h-72 gap-1 overflow-y-auto pr-0.5" aria-label="Columns in display order">
            {prefs.order.map((key, i) => (
              <ColumnRow
                key={key}
                column={BY_KEY.get(key)!}
                checked={visible.has(key)}
                first={i === 0}
                last={i === prefs.order.length - 1}
                onToggle={() => toggle(key)}
                onMove={(d) => setOrder(moveColumn(prefs.order, key, d))}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}

function ColumnRow({
  column,
  checked,
  first,
  last,
  onToggle,
  onMove,
}: {
  column: Column;
  checked: boolean;
  first: boolean;
  last: boolean;
  onToggle: () => void;
  onMove: (delta: number) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: column.key });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-lg border border-border bg-card px-1.5 py-1",
        isDragging && "relative z-10 shadow-md"
      )}
    >
      <button
        type="button"
        className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center text-muted active:cursor-grabbing"
        aria-label={`Drag to reorder ${column.label}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <label className={cn("flex min-w-0 flex-1 items-center gap-2 text-sm", column.locked ? "text-muted" : "cursor-pointer text-heading")}>
        <input
          type="checkbox"
          checked={checked}
          disabled={column.locked}
          onChange={onToggle}
          className="h-4 w-4 shrink-0 accent-[var(--color-accent)]"
        />
        <span className="truncate">{column.label}</span>
        {column.locked ? <Lock className="h-3 w-3 shrink-0" aria-label="Always shown" /> : null}
      </label>
      <button
        type="button"
        onClick={() => onMove(-1)}
        disabled={first}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded text-muted hover:bg-subtle hover:text-heading disabled:opacity-30"
        aria-label={`Move ${column.label} earlier`}
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onMove(1)}
        disabled={last}
        className="flex h-8 w-7 shrink-0 items-center justify-center rounded text-muted hover:bg-subtle hover:text-heading disabled:opacity-30"
        aria-label={`Move ${column.label} later`}
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </li>
  );
}
