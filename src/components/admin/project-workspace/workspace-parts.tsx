"use client";

/**
 * Presentational building blocks for the New interface project workspace
 * (hero, status pill, tabs, sidebar cards, media cards). They hold no project data
 * logic: AdminProjectDetail owns every fetch / mutation and passes handlers in, so
 * Classic and New share one implementation of each action.
 */

import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react";
import Link from "next/link";
import { Select } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { parseProjectDownloadAccess, type ProjectDownloadAccess } from "@/lib/deliverables";
import {
  Activity,
  ArrowRight,
  Calendar,
  Check,
  ChevronDown,
  Download,
  ChevronRight,
  ChevronUp,
  ExternalLink,
  Eye,
  EyeOff,
  Home,
  ImageIcon,
  Loader2,
  Mail,
  MapPin,
  MoreHorizontal,
  Pencil,
  Phone,
  Play,
  Share2,
  Trash2,
  UserRound,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Switch } from "@/components/ui/switch";
import { PROJECT_STATUSES, normalizeStatus } from "@/lib/constants";
import { getActivityDisplay } from "@/lib/activity-display";
import { fetchThumbUrls, getCachedThumbUrl } from "@/lib/media-thumb-client";
import { mediaDisplayName } from "@/lib/media-display-name";
import type { ActivityLog, MediaAsset } from "@/lib/types";
import type { NextStepInfo } from "@/lib/journey";
import { cn } from "@/lib/utils";
import { useHydrated, viewerDateArgs } from "@/lib/use-hydrated";

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

/** Pill tones per workflow status (same hues as StatusBadge, a touch stronger for a control). */
const STATUS_PILL_TONE: Record<string, string> = {
  new_request: "border-slate-200 bg-slate-50 text-slate-700",
  quote_sent: "border-violet-200 bg-violet-50 text-violet-700",
  proposal_approved: "border-sky-200 bg-sky-50 text-sky-700",
  scheduled: "border-blue-200 bg-blue-50 text-blue-700",
  shoot_complete_editing: "border-indigo-200 bg-indigo-50 text-indigo-700",
  ready_for_review: "border-purple-200 bg-purple-50 text-purple-700",
  awaiting_payment: "border-orange-200 bg-orange-50 text-orange-700",
  delivered: "border-emerald-200 bg-emerald-50 text-emerald-700",
};

export function statusPillTone(status: string) {
  return STATUS_PILL_TONE[normalizeStatus(status)] ?? STATUS_PILL_TONE.new_request;
}

/** Project status as a compact pill that is itself the picker (native select for a11y + mobile). */
export function StatusPill({
  status,
  saving,
  onChange,
  className,
}: {
  status: string;
  saving: boolean;
  onChange: (status: string) => void;
  /** Layout overrides (e.g. flex-1 min-w-0 to share a phone toolbar row). */
  className?: string;
}) {
  const normalized = normalizeStatus(status);
  return (
    <label
      className={cn(
        "relative inline-flex h-9 items-center gap-1.5 rounded-full border pl-3 pr-8 text-sm font-semibold shadow-sm transition-colors",
        statusPillTone(status),
        saving && "opacity-70",
        className
      )}
    >
      {saving ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        // Phones drop the check so the status word keeps its room in the one-row toolbar.
        <Check className="hidden h-4 w-4 shrink-0 min-[400px]:block" />
      )}
      <span className="min-w-0 max-w-[11rem] truncate">
        {PROJECT_STATUSES.find((s) => s.value === normalized)?.label ?? status}
      </span>
      <ChevronDown className="pointer-events-none absolute right-2 h-4 w-4 opacity-70 sm:right-2.5" aria-hidden />
      <select
        aria-label="Project status"
        value={normalized}
        disabled={saving}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 cursor-pointer appearance-none rounded-full opacity-0"
      >
        {PROJECT_STATUSES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * Project page toolbar: Status · Share · Client Preview · More, on one row at every width.
 * Phones: Status flexes and truncates, Client Preview shortens to "Preview" (icon-only under
 * 375px, still labelled for assistive tech), More stays an icon. Desktop is unchanged.
 */
export function ProjectActionBar({
  status,
  statusSaving,
  onStatusChange,
  onShare,
  previewUrl,
  onMore,
}: {
  status: string;
  statusSaving: boolean;
  onStatusChange: (status: string) => void;
  onShare: () => void;
  previewUrl: string;
  onMore: (trigger: HTMLElement) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 sm:flex-wrap sm:justify-end sm:gap-2">
      <StatusPill
        status={status}
        saving={statusSaving}
        onChange={onStatusChange}
        className="h-10 min-w-0 flex-1 pl-2.5 pr-6 sm:h-9 sm:flex-none sm:pl-3 sm:pr-8"
      />
      <Button variant="accent" className="h-10 shrink-0 gap-1.5 px-2.5 sm:h-9 sm:gap-2 sm:px-4" onClick={onShare}>
        <Share2 className="h-4 w-4" /> Share
      </Button>
      <a
        href={previewUrl}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Client Preview"
        title="Client Preview"
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-10 w-10 shrink-0 gap-1.5 px-0 min-[375px]:w-auto min-[375px]:px-3 sm:h-9 sm:gap-2 sm:px-4"
        )}
      >
        <ExternalLink className="h-4 w-4" />
        <span className="hidden min-[375px]:inline sm:hidden">Preview</span>
        <span className="hidden sm:inline">Client Preview</span>
      </a>
      <Button
        variant="outline"
        className="h-10 w-10 shrink-0 px-0 sm:h-9 sm:w-9"
        aria-label="More project actions"
        aria-haspopup="menu"
        onClick={(e) => onMore(e.currentTarget)}
      >
        <MoreHorizontal className="h-4 w-4" />
      </Button>
    </div>
  );
}

const SUMMARY_TONE: Record<NextStepInfo["variant"], string> = {
  info: "border-blue-200 bg-blue-50/80 text-blue-900",
  success: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  warning: "border-amber-200 bg-amber-50/80 text-amber-900",
  accent: "border-sky-200 bg-sky-50/80 text-sky-900",
};

/** Status summary beside Project Type: the workflow's own next-step guidance for this status. */
export function StatusSummary({
  step,
  icon: Icon,
  onAction,
  extraAction,
}: {
  step: NextStepInfo;
  icon: ComponentType<{ className?: string }>;
  onAction?: () => void;
  extraAction?: ReactNode;
}) {
  return (
    <div className={cn("flex min-w-0 items-start gap-2.5 rounded-xl border px-3.5 py-2.5", SUMMARY_TONE[step.variant])}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0 opacity-80" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{step.title}</p>
        <p className="text-xs leading-snug opacity-85">{step.description}</p>
        {(step.actionLabel && onAction) || extraAction ? (
          <div className="mt-1.5 flex flex-wrap items-center gap-3">
            {step.actionLabel && onAction ? (
              <button
                type="button"
                onClick={onAction}
                className="inline-flex items-center gap-1 text-xs font-semibold underline underline-offset-2 hover:opacity-80"
              >
                {step.actionLabel} <ArrowRight className="h-3 w-3" />
              </button>
            ) : null}
            {extraAction}
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------

export function ProjectHero({
  imageUrl,
  name,
  typeLabel,
  dateLabel,
  location,
  onChangeCover,
  hidden,
}: {
  imageUrl: string | null;
  name: string;
  typeLabel: string | null;
  dateLabel: string | null;
  location: string | null;
  onChangeCover?: () => void;
  hidden?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [imageUrl]);
  const showImage = Boolean(imageUrl) && !failed;

  return (
    <section
      aria-label="Project cover"
      className="relative isolate h-44 overflow-hidden rounded-2xl bg-slate-900 shadow-sm sm:h-52 xl:h-56"
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt=""
          className="absolute inset-0 -z-10 h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <div
          aria-hidden
          className="absolute inset-0 -z-10 bg-[radial-gradient(120%_120%_at_85%_0%,color-mix(in_srgb,var(--color-accent)_55%,transparent),transparent_60%),linear-gradient(135deg,#0f172a,#1e293b_55%,#334155)]"
        >
          <ImageIcon className="absolute right-8 top-1/2 h-24 w-24 -translate-y-1/2 text-white/[0.06]" />
        </div>
      )}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/75 via-black/25 to-black/20" />

      <div className="flex h-full flex-col justify-between p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            {typeLabel ? (
              <span className="inline-flex max-w-full items-center gap-1.5 truncate rounded-lg border border-white/30 bg-black/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                <Home className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{typeLabel}</span>
              </span>
            ) : null}
            {hidden ? (
              <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400/95 px-2 py-1 text-xs font-semibold text-amber-950">
                <EyeOff className="h-3.5 w-3.5" /> Hidden project
              </span>
            ) : null}
          </div>
          {onChangeCover ? (
            <button
              type="button"
              onClick={onChangeCover}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/30 bg-black/25 px-2.5 py-1 text-xs font-medium text-white backdrop-blur transition hover:bg-black/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ImageIcon className="h-3.5 w-3.5" /> Change Cover
            </button>
          ) : null}
        </div>
        <div className="min-w-0">
          <h1 className="line-clamp-2 text-2xl font-bold tracking-tight text-white drop-shadow-sm sm:text-3xl">{name}</h1>
          {dateLabel || location ? (
            <p className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-white/90">
              {dateLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" /> {dateLabel}
                </span>
              ) : null}
              {location ? (
                <span className="inline-flex min-w-0 items-center gap-1.5">
                  <MapPin className="h-4 w-4 shrink-0" /> <span className="truncate">{location}</span>
                </span>
              ) : null}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Pick the project cover from photos (and uploaded videos) already on the project. */
export function ChangeCoverDialog({
  open,
  onClose,
  candidates,
  currentId,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  candidates: MediaAsset[];
  currentId: string | null;
  onPick: (id: string) => Promise<void> | void;
}) {
  const [urls, setUrls] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const ids = useMemo(() => candidates.map((c) => c.id), [candidates]);

  useEffect(() => {
    if (!open || ids.length === 0) return;
    let cancelled = false;
    const cached: Record<string, string | null> = {};
    for (const id of ids) cached[id] = getCachedThumbUrl(id);
    setUrls(cached);
    void fetchThumbUrls(ids).then((fresh) => {
      if (!cancelled) setUrls((prev) => ({ ...prev, ...fresh }));
    });
    return () => {
      cancelled = true;
    };
  }, [open, ids]);

  return (
    <Modal open={open} onClose={onClose} title="Change cover" className="sm:max-w-3xl">
      {candidates.length === 0 ? (
        <p className="pb-4 text-sm text-muted">Upload photos to this project, then choose one as the cover.</p>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            The cover shows here, on your project lists, and on the client&apos;s project page.
          </p>
          <div className="grid grid-cols-2 gap-2.5 pb-4 sm:grid-cols-3 md:grid-cols-4">
            {candidates.map((asset) => {
              const current = asset.id === currentId;
              const url = urls[asset.id];
              return (
                <button
                  key={asset.id}
                  type="button"
                  disabled={saving !== null}
                  onClick={async () => {
                    setSaving(asset.id);
                    try {
                      await onPick(asset.id);
                      onClose();
                    } finally {
                      setSaving(null);
                    }
                  }}
                  className={cn(
                    "group relative aspect-[4/3] overflow-hidden rounded-lg border bg-subtle text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
                    current ? "border-accent ring-2 ring-accent" : "border-border hover:border-accent/50"
                  )}
                  aria-label={`Use ${mediaDisplayName(asset)} as cover${current ? " (current)" : ""}`}
                >
                  {url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted">
                      {asset.media_type === "video" ? <Play className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
                    </div>
                  )}
                  {current ? (
                    <span className="absolute left-1.5 top-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-accent-foreground">
                      Current
                    </span>
                  ) : null}
                  {asset.media_type === "video" ? (
                    <span className="absolute bottom-1.5 left-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Video
                    </span>
                  ) : null}
                  {saving === asset.id ? (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="h-5 w-5 animate-spin text-white" />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Tabs
// ---------------------------------------------------------------------------

export type WorkspaceTab<K extends string> = {
  key: K;
  label: string;
  icon: ComponentType<{ className?: string }>;
  count?: number | null;
};

/** Primary tabs: icon + label, accent underline, horizontally scrollable on phones. */
export function WorkspaceTabs<K extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: WorkspaceTab<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
      <div role="tablist" aria-label="Project sections" className="flex min-w-max gap-1 border-b border-border">
        {tabs.map(({ key, label, icon: Icon, count }) => {
          const selected = key === active;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              id={`project-tab-${key}`}
              aria-selected={selected}
              aria-controls={`project-panel-${key}`}
              onClick={() => onChange(key)}
              className={cn(
                "relative -mb-px inline-flex h-11 scroll-mt-24 items-center gap-2 whitespace-nowrap border-b-2 px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent sm:px-4",
                selected ? "border-accent text-accent" : "border-transparent text-muted hover:text-heading"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {count ? (
                <span
                  className={cn(
                    "rounded-full px-1.5 text-[11px] font-semibold leading-5",
                    selected ? "bg-accent/10 text-accent" : "bg-subtle text-muted"
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Media category chips (All Media / Photos / …) with counts. */
export function CategoryChips<K extends string>({
  items,
  active,
  onChange,
}: {
  items: WorkspaceTab<K>[];
  active: K;
  onChange: (key: K) => void;
}) {
  return (
    <div className="-mx-1 flex min-w-0 flex-1 gap-1 overflow-x-auto px-1 py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map(({ key, label, icon: Icon, count }) => {
        const selected = key === active;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(key)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
              selected
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-card text-foreground hover:border-accent/30 hover:text-heading"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span
              className={cn(
                "rounded-md px-1.5 text-[11px] font-semibold leading-5",
                selected ? "bg-accent/15 text-accent" : "bg-subtle text-muted"
              )}
            >
              {count ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

export function SidebarCard({
  title,
  icon: Icon,
  action,
  description,
  children,
  className,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  action?: ReactNode;
  description?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm", className)}>
      <div className="flex items-start justify-between gap-2">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-heading">
          <Icon className="h-4 w-4 text-muted" /> {title}
        </h2>
        {action}
      </div>
      {description ? <p className="mt-0.5 text-xs text-muted">{description}</p> : null}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ClientContactCard({
  client,
  extraClients,
  onManage,
}: {
  client: { id: string; name: string; email: string | null; phone: string | null } | null;
  extraClients: number;
  onManage: () => void;
}) {
  return (
    <SidebarCard
      title="Client"
      icon={UserRound}
      action={
        client ? (
          <Link
            href={`/admin/clients/${client.id}`}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-foreground hover:bg-accent-subtle"
          >
            <Pencil className="h-3 w-3" /> Edit
          </Link>
        ) : null
      }
    >
      {client ? (
        <>
          <div className="min-w-0 text-sm">
            <Link href={`/admin/clients/${client.id}`} className="block truncate font-semibold text-heading hover:text-accent">
              {client.name}
            </Link>
            {client.email ? (
              <a href={`mailto:${client.email}`} className="block truncate text-muted hover:text-accent">
                {client.email}
              </a>
            ) : null}
            {client.phone ? (
              <a href={`tel:${client.phone}`} className="block truncate text-muted hover:text-accent">
                {client.phone}
              </a>
            ) : null}
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Link
              href={`/admin/messages?client=${client.id}`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent-subtle"
            >
              <Mail className="h-4 w-4" /> Message
            </Link>
            {client.phone ? (
              <a
                href={`tel:${client.phone}`}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent-subtle"
              >
                <Phone className="h-4 w-4" /> Call
              </a>
            ) : (
              <span
                aria-disabled
                title="No phone number on file"
                className="inline-flex h-9 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium text-muted opacity-60"
              >
                <Phone className="h-4 w-4" /> Call
              </span>
            )}
          </div>
        </>
      ) : (
        <p className="text-sm text-muted">No client linked to this project yet.</p>
      )}
      <button
        type="button"
        onClick={onManage}
        className="mt-3 w-full rounded-lg px-2 py-1.5 text-left text-xs font-medium text-accent hover:bg-accent-subtle"
      >
        {client
          ? extraClients > 0
            ? `+${extraClients} more client${extraClients === 1 ? "" : "s"} · Manage clients & portal access`
            : "Manage clients & portal access"
          : "Add a client"}
      </button>
    </SidebarCard>
  );
}

export type VisibilityRow = {
  key: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  checked: boolean;
  saving?: boolean;
  onChange?: (visible: boolean) => void;
  /** Read-only rows explain what controls them instead of a switch. */
  readOnlyNote?: string;
  onReadOnlyClick?: () => void;
};

export function VisibilityPanel({ rows, footer }: { rows: VisibilityRow[]; footer?: ReactNode }) {
  return (
    <SidebarCard
      title="Client Portal Visibility"
      icon={Eye}
      description="Choose which sections are visible to your client."
    >
      <ul className="space-y-1">
        {rows.map(({ key, label, icon: Icon, checked, saving, onChange, readOnlyNote, onReadOnlyClick }) =>
          onChange ? (
            <li key={key} className="flex min-h-8 items-center gap-2.5 text-sm">
              <Icon className="h-4 w-4 shrink-0 text-muted" />
              <span className="min-w-0 flex-1 truncate text-foreground">{label}</span>
              <Switch
                checked={checked}
                disabled={saving}
                onCheckedChange={onChange}
                aria-label={`${label} ${checked ? "visible to client" : "hidden from client"}`}
                className={cn(saving && "opacity-60")}
              />
            </li>
          ) : (
            // Not a switch: this section follows its own settings. The whole row navigates there.
            <li key={key} className="-mx-2">
              <button
                type="button"
                onClick={onReadOnlyClick}
                title={readOnlyNote}
                aria-label={`${label}: ${checked ? "visible" : "hidden"} to client. Open ${label} settings`}
                className="group flex min-h-8 w-full items-center gap-2.5 rounded-lg px-2 text-left text-sm transition-colors hover:bg-accent-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon className="h-4 w-4 shrink-0 text-muted group-hover:text-accent" />
                <span className="min-w-0 flex-1 truncate text-foreground group-hover:text-accent">{label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-medium",
                    checked
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-600 surface-dark:bg-subtle surface-dark:text-muted"
                  )}
                >
                  {checked ? "Visible" : "Hidden"}
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-accent" aria-hidden />
              </button>
            </li>
          )
        )}
      </ul>
      {footer}
    </SidebarCard>
  );
}

const DOWNLOAD_ACCESS_OPTIONS: { value: ProjectDownloadAccess; label: string }[] = [
  { value: "default", label: "Use Business Default" },
  { value: "allow", label: "Allow Downloads" },
  { value: "restrict", label: "Restrict Until Delivered" },
];

/**
 * Per-project download timing override (v124). Sits under the visibility switches in the
 * Client Portal Visibility card; it controls when clients may download, not what they see.
 */
export function ClientDownloadsControl({
  value,
  businessRequiresDelivered,
  saving,
  onChange,
}: {
  value: ProjectDownloadAccess;
  /** Admin Settings › Payments › Download Access ("Require Delivered"). */
  businessRequiresDelivered: boolean;
  saving?: boolean;
  onChange: (value: ProjectDownloadAccess) => void;
}) {
  const status =
    value === "allow"
      ? { tone: "open" as const, text: "Downloads enabled for this project, even before payment." }
      : value === "restrict"
        ? { tone: "locked" as const, text: "Downloads become available when this project is Delivered." }
        : businessRequiresDelivered
          ? { tone: "locked" as const, text: "Following business settings: Downloads require Delivered status." }
          : { tone: "neutral" as const, text: "Following business settings: Downloads are available before Delivered." };

  return (
    <div className="mt-3 border-t border-border pt-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
        <Download className="h-4 w-4 text-muted" /> Client Downloads
        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-muted" aria-label="Saving" /> : null}
      </h3>
      <p className="mt-0.5 text-xs text-muted">Control when clients can download media from this project.</p>
      <Select
        aria-label="Client download access"
        className="mt-2 h-9"
        value={value}
        disabled={saving}
        options={DOWNLOAD_ACCESS_OPTIONS}
        onChange={(e) => onChange(parseProjectDownloadAccess(e.target.value))}
      />
      <p
        className={cn(
          "mt-2 flex items-start gap-1.5 text-xs",
          status.tone === "open" ? "text-emerald-700 surface-dark:text-emerald-400" : "text-muted"
        )}
        aria-live="polite"
      >
        <span
          aria-hidden
          className={cn(
            "mt-1 h-1.5 w-1.5 shrink-0 rounded-full",
            status.tone === "open" ? "bg-emerald-500" : status.tone === "locked" ? "bg-amber-500" : "bg-slate-400"
          )}
        />
        {status.text}
      </p>
    </div>
  );
}

export function ActivityPreview({
  activities,
  limit = 5,
  onViewAll,
  onRevisionClick,
}: {
  activities: ActivityLog[];
  limit?: number;
  onViewAll: () => void;
  onRevisionClick?: (revisionId: string) => void;
}) {
  const recent = activities.slice(0, limit);
  // Same text on the server and the hydration pass; viewer's own zone right after (no #418).
  const { locale, timeZone } = viewerDateArgs(useHydrated());
  return (
    <SidebarCard
      title="Project Activity"
      icon={Activity}
      action={
        activities.length > 0 ? (
          <button type="button" onClick={onViewAll} className="text-xs font-semibold text-accent hover:underline">
            View All
          </button>
        ) : null
      }
    >
      {recent.length === 0 ? (
        <p className="text-sm text-muted">Activity will appear here as the project progresses.</p>
      ) : (
        <ul className="space-y-3">
          {recent.map((log) => {
            const { icon, description } = getActivityDisplay(log.activity_type, log.description);
            const revisionId = log.metadata?.revisionId as string | undefined;
            const clickable = log.activity_type === "revision_requested" && revisionId && onRevisionClick;
            return (
              <li key={log.id} className="flex gap-2.5">
                <span
                  aria-hidden
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-subtle text-sm"
                >
                  {icon}
                </span>
                <div className="min-w-0 flex-1">
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => onRevisionClick!(revisionId!)}
                      className="line-clamp-2 text-left text-[13px] font-medium leading-snug text-accent hover:underline"
                    >
                      {description}
                    </button>
                  ) : (
                    <p className="line-clamp-2 text-[13px] font-medium leading-snug text-foreground">{description}</p>
                  )}
                  <p className="text-[11px] text-muted">
                    {new Date(log.created_at).toLocaleString(locale ?? "en-US", {
                      timeZone,
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SidebarCard>
  );
}

// ---------------------------------------------------------------------------
// Media cards (360 tours, 3D models, files)
// ---------------------------------------------------------------------------

export function MediaSectionHeader({
  icon: Icon,
  title,
  count,
  onOpen,
  actions,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  count: number;
  /** All Media overview: jump to this category. */
  onOpen?: () => void;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-heading">
        <Icon className="h-4 w-4 text-muted" /> {title}
        <span className="font-normal text-muted">({count})</span>
      </h3>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="text-xs font-medium text-accent hover:underline">
          Open
        </button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  );
}

/** Link-based media (360 tours, 3D models) as preview cards with the same actions as Classic's rows. */
export function LinkedMediaCard({
  title,
  subtitle,
  href,
  thumbnailUrl,
  placeholderIcon: PlaceholderIcon,
  hidden,
  onToggleVisibility,
  onEdit,
  onDelete,
  onUp,
  onDown,
  canUp,
  canDown,
}: {
  title: string;
  subtitle?: string | null;
  href: string;
  thumbnailUrl?: string | null;
  placeholderIcon: ComponentType<{ className?: string }>;
  hidden: boolean;
  onToggleVisibility: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onUp: () => void;
  onDown: () => void;
  canUp: boolean;
  canDown: boolean;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition hover:shadow-md">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="relative block aspect-[16/10] overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 surface-dark:from-subtle surface-dark:to-card"
        aria-label={`Open ${title} in a new tab`}
      >
        {thumbnailUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnailUrl}
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <PlaceholderIcon className="h-10 w-10 text-slate-400" />
          </div>
        )}
        <span className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/25 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-slate-900 shadow">
            <ExternalLink className="h-3.5 w-3.5" /> Open viewer
          </span>
        </span>
        {hidden ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-amber-400/95 px-1.5 py-0.5 text-[10px] font-semibold text-amber-950">
            <EyeOff className="h-2.5 w-2.5" /> Hidden
          </span>
        ) : null}
      </a>
      <div className="flex items-center gap-1 px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-heading" title={title}>
            {title}
          </p>
          {subtitle ? <p className="truncate text-xs text-muted">{subtitle}</p> : null}
        </div>
        <IconAction label={hidden ? "Show to client" : "Hide from client"} onClick={onToggleVisibility}>
          {hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
        </IconAction>
        <IconAction label="Edit" onClick={onEdit}>
          <Pencil className="h-4 w-4" />
        </IconAction>
        <RowOverflow
          label={`${title} actions`}
          items={[
            { label: "Move earlier", icon: ChevronUp, onSelect: onUp, disabled: !canUp },
            { label: "Move later", icon: ChevronDown, onSelect: onDown, disabled: !canDown },
            { label: "Delete", icon: Trash2, onSelect: onDelete, destructive: true },
          ]}
        />
      </div>
    </div>
  );
}

export function IconAction({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted hover:bg-accent-subtle hover:text-heading focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        className
      )}
    >
      {children}
    </button>
  );
}

type OverflowItem = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onSelect: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

/** Small inline overflow menu (native popover-free: a details/summary dropdown keeps it light). */
export function RowOverflow({ label, items }: { label: string; items: OverflowItem[] }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("click", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);
  return (
    <div className="relative">
      <IconAction
        label={label}
        onClick={() => {
          // Let the window listener from a previous open close first.
          window.setTimeout(() => setOpen((v) => !v), 0);
        }}
      >
        <MoreHorizontal className="h-4 w-4" />
      </IconAction>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-1 w-44 overflow-hidden rounded-lg border border-border bg-card py-1 shadow-lg"
        >
          {items.map(({ label: itemLabel, icon: Icon, onSelect, disabled, destructive }) => (
            <button
              key={itemLabel}
              type="button"
              role="menuitem"
              disabled={disabled}
              onClick={() => {
                setOpen(false);
                onSelect();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent-subtle disabled:cursor-not-allowed disabled:opacity-40",
                destructive ? "text-red-600" : "text-foreground"
              )}
            >
              {Icon ? <Icon className="h-4 w-4" /> : null}
              {itemLabel}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Money summary tiles
// ---------------------------------------------------------------------------

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  onClick,
  actionLabel = "View all",
  ariaLabel,
}: {
  label: string;
  value: string;
  hint?: string | null;
  tone?: "default" | "success" | "warning" | "accent";
  /** Makes the tile a button (hover state + a small "View all" affordance). */
  onClick?: () => void;
  actionLabel?: string;
  ariaLabel?: string;
}) {
  const Root = onClick ? "button" : "div";
  return (
    <Root
      {...(onClick ? { type: "button" as const, onClick, "aria-label": ariaLabel, "aria-haspopup": "dialog" as const } : {})}
      className={cn(
        "min-w-0 rounded-xl border border-border bg-card px-4 py-3 text-left shadow-sm",
        onClick &&
          "group cursor-pointer transition-colors hover:border-accent/40 hover:bg-accent/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      )}
    >
      <p className="flex items-center justify-between gap-2 text-xs font-medium text-muted">
        <span className="truncate">{label}</span>
        {onClick ? (
          <span className="inline-flex shrink-0 items-center gap-0.5 text-[11px] font-semibold text-accent opacity-80 transition-opacity group-hover:opacity-100">
            {actionLabel}
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden />
          </span>
        ) : null}
      </p>
      <p
        className={cn(
          "mt-0.5 truncate text-xl font-semibold tracking-tight",
          tone === "success" && "text-emerald-700",
          tone === "warning" && "text-amber-700",
          tone === "accent" && "text-accent",
          tone === "default" && "text-heading"
        )}
      >
        {value}
      </p>
      {hint ? <p className="mt-0.5 truncate text-xs text-muted">{hint}</p> : null}
    </Root>
  );
}
