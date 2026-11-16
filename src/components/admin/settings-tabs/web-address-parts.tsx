"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  CircleAlert,
  Clock3,
  Copy,
  ExternalLink,
  Info,
  Loader,
  Loader2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { readApiJson, REGISTRAR_GUIDES } from "@/components/admin/custom-domain-settings-card";
import type { CustomDomainPublicState, DnsRecordInstruction } from "@/lib/custom-domain";
import { cn } from "@/lib/utils";

/* Building blocks for Settings → Use your own web address (three collapsible address cards). */

export type PillTone = "green" | "amber" | "red" | "neutral";
export type AddressPill = { label: string; tone: PillTone; icon?: LucideIcon };

const PILL_TONES: Record<PillTone, string> = {
  green: "bg-emerald-50 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300",
  amber: "bg-amber-50 text-amber-700 surface-dark:bg-amber-500/15 surface-dark:text-amber-300",
  red: "bg-red-50 text-red-700 surface-dark:bg-red-500/15 surface-dark:text-red-300",
  neutral: "bg-subtle text-muted",
};

/** Status pill for a domain, plus whether the card needs attention (open by default). */
export function domainPill(
  state: CustomDomainPublicState,
  opts: { entitled: boolean; setupRequired?: boolean }
): { pill: AddressPill; needsAttention: boolean; notSetUp: boolean } {
  if (opts.setupRequired) return { pill: { label: "Update needed", tone: "neutral" }, needsAttention: false, notSetUp: false };
  if (!opts.entitled) return { pill: { label: "Not on your plan", tone: "neutral" }, needsAttention: false, notSetUp: false };
  if (!state.domain) return { pill: { label: "Not set up", tone: "neutral" }, needsAttention: false, notSetUp: true };
  switch (state.status) {
    case "connected":
      return { pill: { label: "Connected", tone: "green", icon: Check }, needsAttention: false, notSetUp: false };
    case "verifying":
      return { pill: { label: "Almost there", tone: "amber", icon: Loader }, needsAttention: true, notSetUp: false };
    case "manual":
      return { pill: { label: "Waiting on support", tone: "amber", icon: Clock3 }, needsAttention: true, notSetUp: false };
    case "error":
      return { pill: { label: "Needs attention", tone: "red", icon: CircleAlert }, needsAttention: true, notSetUp: false };
    default:
      return { pill: { label: "Pending", tone: "amber", icon: Clock3 }, needsAttention: true, notSetUp: false };
  }
}

export function StatusPill({ pill }: { pill: AddressPill }) {
  const Icon = pill.icon;
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", PILL_TONES[pill.tone])}>
      {Icon ? <Icon className="h-3.5 w-3.5" aria-hidden /> : null}
      {pill.label}
    </span>
  );
}

/** Opens the card when the page is deep-linked to its anchor (#settings-…). */
export function useOpenOnHash(anchorId: string, open: () => void) {
  useEffect(() => {
    const apply = () => {
      if (window.location.hash.replace(/^#/, "") === anchorId) open();
    };
    apply();
    window.addEventListener("hashchange", apply);
    window.addEventListener("portal:hash-target", apply);
    return () => {
      window.removeEventListener("hashchange", apply);
      window.removeEventListener("portal:hash-target", apply);
    };
  }, [anchorId, open]);
}

/** Domain state + POST/GET helpers for one domain API route. Toasts stay with the caller. */
export function useDomainApi(apiBase: string, initialState: CustomDomainPublicState) {
  const [state, setState] = useState(initialState);
  const [busy, setBusy] = useState(false);
  const [synced, setSynced] = useState(initialState);
  if (synced !== initialState) {
    setSynced(initialState);
    setState(initialState);
  }

  const post = useCallback(
    async (body: Record<string, unknown>): Promise<CustomDomainPublicState | null> => {
      setBusy(true);
      try {
        const res = await fetch(apiBase, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await readApiJson(res);
        if (!res.ok) {
          throw new Error(typeof data.error === "string" && data.error ? data.error : `Request failed (HTTP ${res.status})`);
        }
        const next = (data.state as CustomDomainPublicState | undefined) ?? null;
        if (next) setState(next);
        return next;
      } finally {
        setBusy(false);
      }
    },
    [apiBase]
  );

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(apiBase, { credentials: "include" });
      const data = await readApiJson(res);
      if (res.ok && data.state) setState(data.state as CustomDomainPublicState);
    } catch {
      /* Quiet: the card keeps showing the last known state. */
    }
  }, [apiBase]);

  return { state, busy, post, refresh };
}

/** One address: a single collapsed row; the body shows when expanded. */
export function AddressCard({
  id,
  icon: Icon,
  title,
  purpose,
  domain,
  liveUrl,
  pill,
  showSetUp,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: LucideIcon;
  title: string;
  purpose: string;
  domain: string | null;
  liveUrl: string | null;
  pill: AddressPill;
  showSetUp: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const bodyId = `${id}-body`;
  return (
    <section id={id} tabIndex={-1} className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card outline-none">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-4 sm:flex-nowrap sm:px-5">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={bodyId}
          className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-subtle text-accent">
            <Icon className="h-[18px] w-[18px]" aria-hidden />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-heading">{title}</span>
            <span className="block truncate text-[13px] text-muted">{purpose}</span>
          </span>
        </button>
        <div className="flex w-full min-w-0 items-center justify-end gap-2 pl-12 sm:w-auto sm:pl-0">
          {domain ? (
            liveUrl ? (
              <a
                href={liveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mr-auto inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-foreground hover:text-accent sm:mr-1"
              >
                <span className="truncate">{domain}</span>
                <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-label="Open in a new tab" />
              </a>
            ) : (
              <span className="mr-auto min-w-0 truncate text-[13px] font-semibold text-foreground sm:mr-1">{domain}</span>
            )
          ) : null}
          <StatusPill pill={pill} />
          {showSetUp && !open ? (
            <Button type="button" variant="outline" size="sm" className="h-9" onClick={onToggle}>
              Set up
            </Button>
          ) : null}
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={bodyId}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-accent-subtle hover:text-heading sm:h-9 sm:w-9"
          >
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} aria-hidden />
          </button>
        </div>
      </div>
      {open ? (
        <div id={bodyId} className="space-y-4 border-t border-border bg-subtle/40 px-4 py-5 sm:px-5">
          {children}
        </div>
      ) : null}
    </section>
  );
}

/** Add your domain → Update DNS at your registrar → Live with HTTPS. */
export function SetupSteps({ state }: { state: CustomDomainPublicState }) {
  const connected = state.status === "connected";
  const steps = [
    { label: "Add your domain", done: Boolean(state.domain), current: !state.domain },
    { label: "Update DNS at your registrar", done: connected, current: Boolean(state.domain) && !connected },
    { label: "Live with HTTPS", done: connected, current: false },
  ];
  return (
    <ol className="grid gap-2 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li
          key={s.label}
          aria-current={s.current ? "step" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-xl border bg-card px-3 py-2.5 text-[13px] font-semibold",
            s.current ? "border-accent text-accent ring-2 ring-accent/15" : "border-border",
            s.done ? "text-heading" : !s.current && "text-muted"
          )}
        >
          <span
            className={cn(
              "inline-flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[11px]",
              s.done ? "bg-emerald-500 text-white" : s.current ? "bg-accent text-accent-foreground" : "bg-subtle text-muted"
            )}
          >
            {s.done ? <Check className="h-3 w-3" aria-label="Done" /> : i + 1}
          </span>
          {s.label}
        </li>
      ))}
    </ol>
  );
}

export type DnsRow = { record: DnsRecordInstruction; tag?: string };

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={label}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* Clipboard blocked; the value is still selectable. */
        }
      }}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-muted hover:text-heading sm:h-8 sm:w-8"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
    </button>
  );
}

const mono = "inline-block max-w-full break-all rounded-md border border-border bg-subtle px-2 py-1 font-mono text-[12.5px] text-heading";

/** Compact Type | Name | Points to table with one copy button per row. */
export function DnsRecordsTable({ rows }: { rows: DnsRow[] }) {
  if (rows.length === 0) return null;
  const cols = "sm:grid-cols-[84px_minmax(0,1fr)_minmax(0,2fr)_40px]";
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className={cn("hidden gap-3 border-b border-border px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted sm:grid", cols)}>
        <span>Type</span>
        <span>Name</span>
        <span>Points to</span>
        <span className="sr-only">Copy</span>
      </div>
      <ul className="divide-y divide-border">
        {rows.map(({ record: r, tag }, i) => (
          <li key={`${r.type}-${r.host}-${r.value}-${i}`} className={cn("grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3", cols)}>
            <span className="order-1">
              <span className="inline-flex rounded-full bg-subtle px-2.5 py-0.5 text-xs font-semibold text-muted">{r.type}</span>
            </span>
            <span className="order-2 flex min-w-0 flex-wrap items-center gap-1.5">
              <span className={mono}>{r.host}</span>
              {tag ? <span className="rounded-full bg-subtle px-2 py-0.5 text-[11px] font-semibold text-muted">{tag}</span> : null}
              {r.isGenericFallback ? (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
                  Generic
                </span>
              ) : null}
            </span>
            <span className="order-4 col-span-3 min-w-0 sm:order-3 sm:col-span-1">
              <span className={mono}>{r.value}</span>
            </span>
            <span className="order-3 justify-self-end sm:order-4">
              <CopyButton value={r.value} label={`Copy value for ${r.type} ${r.host}`} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function NoteLine({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "amber" | "red" | "green" }) {
  const toneClass = {
    muted: "text-muted",
    amber: "text-amber-700 surface-dark:text-amber-300",
    red: "text-red-700 surface-dark:text-red-300",
    green: "text-emerald-700 surface-dark:text-emerald-300",
  }[tone];
  const Icon = tone === "green" ? Check : tone === "muted" ? Info : CircleAlert;
  return (
    <p className={cn("flex items-start gap-2 text-[13px] leading-relaxed", toneClass)}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  );
}

/** Check connection / Remove + registrar help chips. */
export function DomainActions({ busy, onCheck, onRemove }: { busy: boolean; onCheck: () => void; onRemove: () => void }) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={busy} onClick={onCheck} className="min-h-11 sm:min-h-10">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Check connection
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={onRemove} className="min-h-11 sm:min-h-10">
          Remove
        </Button>
      </div>
      <RegistrarHelp className="lg:ml-auto lg:justify-end" />
    </div>
  );
}

export function RegistrarHelp({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5 text-xs text-muted", className)}>
      <span className="mr-1">Help for</span>
      {REGISTRAR_GUIDES.map((g) => (
        <a
          key={g.name}
          href={g.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center rounded-lg bg-subtle px-2.5 text-xs font-medium text-foreground hover:bg-accent-subtle hover:text-accent"
        >
          {g.name === "Google Domains / Squarespace Domains" ? "Google / Squarespace Domains" : g.name}
        </a>
      ))}
    </div>
  );
}

/** Small "How this works" disclosure for the longer explanation. */
export function HowItWorks({ children, label = "How this works" }: { children: ReactNode; label?: string }) {
  return (
    <details className="group text-[13px] text-muted">
      <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1 font-medium text-accent [&::-webkit-details-marker]:hidden">
        {label}
        <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" aria-hidden />
      </summary>
      <div className="mt-2 space-y-1.5 rounded-xl border border-border bg-card px-4 py-3 leading-relaxed">{children}</div>
    </details>
  );
}

/** Shared alert lines for a claimed domain (host not configured, DNS target changed, missing target). */
export function DomainAlerts({
  state,
  routingCount,
  busy,
  onRetry,
}: {
  state: CustomDomainPublicState;
  routingCount: number;
  busy: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {!state.vercelApiConfigured ? (
        <NoteLine tone="amber">Automatic setup isn&apos;t available here. Contact support for the exact DNS record; don&apos;t guess a value.</NoteLine>
      ) : null}
      {state.dnsTargetChanged ? (
        <NoteLine tone="amber">
          <span className="font-semibold">Required DNS value changed.</span> {state.dnsTargetChanged.message}
        </NoteLine>
      ) : null}
      {state.dnsConfigMessage && routingCount === 0 ? (
        <div className="flex flex-wrap items-center gap-3">
          <NoteLine tone="amber">{state.dnsConfigMessage}</NoteLine>
          <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onRetry}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null} Retry DNS lookup
          </Button>
        </div>
      ) : state.dnsConfigMessage ? (
        <NoteLine tone="amber">{state.dnsConfigMessage}</NoteLine>
      ) : null}
      {state.dnsRecords.some((r) => r.isGenericFallback) ? (
        <NoteLine tone="amber">A generic value is shown. Press Check connection to load your exact one.</NoteLine>
      ) : null}
      {state.error && state.status !== "connected" ? <NoteLine tone={state.status === "error" ? "red" : "amber"}>{state.error}</NoteLine> : null}
    </>
  );
}

export const radioClass = (on: boolean) =>
  cn(
    "min-h-11 rounded-lg border px-3 py-2 text-left text-sm",
    on ? "border-accent bg-accent-subtle text-heading" : "border-border bg-card text-muted hover:text-heading"
  );
