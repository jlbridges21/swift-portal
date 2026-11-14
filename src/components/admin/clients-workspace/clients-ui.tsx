"use client";

import { useId, useMemo, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Ban, Check, ChevronDown, Mail, Search } from "lucide-react";
import { useDismiss } from "@/components/ui/checkbox-dropdown";
import { clientInitials, PORTAL_STATUS_LABEL, type ClientPortalStatus } from "@/lib/clients-workspace";
import { cn } from "@/lib/utils";

// ── Portal status badge ─────────────────────────────────────────────────────

const BADGE_TONE: Record<ClientPortalStatus, string> = {
  active:
    "bg-emerald-50 text-emerald-700 ring-emerald-200/80 surface-dark:bg-emerald-500/10 surface-dark:text-emerald-300 surface-dark:ring-emerald-500/30",
  invite_sent:
    "bg-amber-50 text-amber-700 ring-amber-200/80 surface-dark:bg-amber-500/10 surface-dark:text-amber-300 surface-dark:ring-amber-500/30",
  invite_expired:
    "bg-orange-50 text-orange-700 ring-orange-200/80 surface-dark:bg-orange-500/10 surface-dark:text-orange-300 surface-dark:ring-orange-500/30",
  not_invited:
    "bg-slate-100 text-slate-600 ring-slate-200 surface-dark:bg-subtle surface-dark:text-muted surface-dark:ring-border",
  unavailable:
    "bg-slate-100 text-slate-500 ring-slate-200 surface-dark:bg-subtle surface-dark:text-muted surface-dark:ring-border",
};

const BADGE_ICON: Record<ClientPortalStatus, typeof Check> = {
  active: Check,
  invite_sent: Mail,
  invite_expired: AlertTriangle,
  not_invited: Ban,
  unavailable: Ban,
};

const BADGE_HINT: Record<ClientPortalStatus, string> = {
  active: "This client has activated their portal account.",
  invite_sent: "A portal invite was emailed and hasn’t been accepted yet.",
  invite_expired: "The last invite link expired (links last 7 days). Resend to give them a fresh one.",
  not_invited: "No portal invite has been sent and they have no portal account.",
  unavailable: "This email’s portal login belongs to another business, so it can’t be invited here.",
};

export function PortalStatusBadge({
  status,
  size = "md",
  className,
}: {
  status: ClientPortalStatus;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = BADGE_ICON[status];
  return (
    <span
      title={BADGE_HINT[status]}
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 whitespace-nowrap rounded-lg font-medium ring-1 ring-inset",
        size === "sm" ? "h-6 px-2 text-xs" : "h-7 px-2.5 text-[13px]",
        BADGE_TONE[status],
        className
      )}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} strokeWidth={2.5} aria-hidden />
      {PORTAL_STATUS_LABEL[status]}
    </span>
  );
}

export function portalStatusHint(status: ClientPortalStatus) {
  return BADGE_HINT[status];
}

// ── Avatar ──────────────────────────────────────────────────────────────────

export function ClientAvatar({
  name,
  email,
  size = "md",
  className,
}: {
  name: string;
  email?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 select-none items-center justify-center rounded-full bg-accent-subtle font-semibold text-accent",
        size === "sm" && "h-8 w-8 text-xs",
        size === "md" && "h-9 w-9 text-[13px]",
        size === "lg" && "h-14 w-14 text-lg",
        className
      )}
    >
      {clientInitials(name, email)}
    </span>
  );
}

// ── Compact multi-select ("Company: All ▾") ─────────────────────────────────

export type MenuOption = { value: string; label: string; hint?: string; count?: number };

export function MultiSelectMenu({
  label,
  options,
  selected,
  onChange,
  emptyText = "Nothing to filter yet",
  className,
  align = "left",
}: {
  label: string;
  options: MenuOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyText?: string;
  className?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(open, ref, () => setOpen(false));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? options.filter((o) => o.label.toLowerCase().includes(q)) : options;
  }, [options, query]);

  const summary =
    selected.length === 0
      ? "All"
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? "1 selected"
        : `${selected.length} selected`;

  return (
    <div ref={ref} className={cn("relative shrink-0", className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex h-10 w-full items-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors",
          selected.length
            ? "border-accent/30 bg-accent-subtle text-accent"
            : "border-border bg-card text-heading hover:bg-subtle"
        )}
      >
        <span className="whitespace-nowrap">{label}:</span>
        <span className="min-w-0 max-w-[9rem] truncate">{summary}</span>
        <ChevronDown className={cn("ml-auto h-4 w-4 shrink-0 text-muted transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {open ? (
        <div
          id={listId}
          className={cn(
            "absolute top-full z-40 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-2 shadow-xl",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {options.length > 7 ? (
            <div className="relative mb-2">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" aria-hidden />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={`Search ${label.toLowerCase()}…`}
                aria-label={`Search ${label.toLowerCase()}`}
                className="h-9 w-full rounded-lg border border-border bg-card pl-8 pr-2 text-sm text-heading focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
            </div>
          ) : null}
          {visible.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">{options.length ? "No matches" : emptyText}</p>
          ) : (
            <ul role="listbox" aria-multiselectable className="max-h-72 space-y-0.5 overflow-y-auto">
              {visible.map((o) => {
                const on = selected.includes(o.value);
                return (
                  <li key={o.value}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={on}
                      onClick={() => onChange(on ? selected.filter((v) => v !== o.value) : [...selected, o.value])}
                      className="flex min-h-9 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm text-heading hover:bg-subtle"
                    >
                      <CheckMark on={on} />
                      <span className="min-w-0 flex-1 truncate">{o.label}</span>
                      {o.count !== undefined ? <span className="text-xs tabular-nums text-muted">{o.count}</span> : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {selected.length ? (
            <div className="mt-1 border-t border-border pt-1">
              <button
                type="button"
                onClick={() => onChange([])}
                className="min-h-9 w-full rounded-lg px-2 text-left text-sm font-medium text-accent hover:bg-accent-subtle"
              >
                Clear {label.toLowerCase()} filter
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function CheckMark({ on, mixed }: { on: boolean; mixed?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors",
        on || mixed ? "border-accent bg-accent text-accent-foreground" : "border-slate-300 bg-card surface-dark:border-border"
      )}
    >
      {on ? (
        <svg viewBox="0 0 16 16" className="h-3 w-3">
          <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : mixed ? (
        <span className="h-0.5 w-2 rounded bg-current" />
      ) : null}
    </span>
  );
}

/** Small labelled section used inside popovers and sheets. */
export function FilterSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h4>
      {children}
    </section>
  );
}

export function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-9 items-center rounded-full border px-3 text-sm font-medium transition-colors",
        on
          ? "border-accent bg-accent text-accent-foreground"
          : "border-border bg-card text-heading hover:border-accent/40 hover:bg-accent-subtle/50"
      )}
    >
      {children}
    </button>
  );
}
