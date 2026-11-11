"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Calendar,
  Copy,
  ExternalLink,
  FolderKanban,
  FolderOpen,
  LayoutGrid,
  Link2,
  List,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  Share2,
  SquareArrowOutUpRight,
  Wand2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Modal } from "@/components/ui/modal";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import { cn } from "@/lib/utils";
import type { PropertyWebsiteRow, PropertyWebsiteStatus } from "@/lib/sites-server";

type StatusFilter = "all" | PropertyWebsiteStatus;
type ViewMode = "grid" | "list";

const VIEW_KEY = "sp:sites:property-view";

const STATUS_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "live", label: "Live" },
  { value: "unpublished", label: "Unpublished" },
];

const DATE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });
const TIME_FMT = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });

function formatUpdated(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${DATE_FMT.format(d)} at ${TIME_FMT.format(d)}`;
}

/** Same editor as Projects → project → Marketing Kit; `from=sites` adds a way back here. */
function marketingKitHref(projectId: string, tab?: "social"): string {
  return `/admin/projects/${projectId}/marketing?from=sites${tab ? `&tab=${tab}` : ""}`;
}

function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

async function copyLink(url: string) {
  try {
    await navigator.clipboard.writeText(url);
    toast.success("Website link copied");
  } catch {
    toast.error("Could not copy the link");
  }
}

function matches(row: PropertyWebsiteRow, q: string): boolean {
  if (!q) return true;
  return [row.title, row.projectName, row.address, row.clientName, row.liveUrl].some((v) => v?.toLowerCase().includes(q));
}

function StatusBadge({ status }: { status: PropertyWebsiteStatus }) {
  const live = status === "live";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset",
        live
          ? "bg-emerald-50 text-emerald-700 ring-emerald-200 surface-dark:bg-emerald-500/10 surface-dark:text-emerald-300 surface-dark:ring-emerald-500/30"
          : "bg-slate-100 text-slate-600 ring-slate-200 surface-dark:bg-subtle surface-dark:text-muted surface-dark:ring-border"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", live ? "bg-emerald-500" : "bg-slate-400")} aria-hidden />
      {live ? "Live" : "Unpublished"}
    </span>
  );
}

function UrlLine({ row, compact = false }: { row: PropertyWebsiteRow; compact?: boolean }) {
  if (!row.liveUrl) {
    return (
      <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
        <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate italic">{row.configured ? "Not published yet" : "No website yet"}</span>
      </p>
    );
  }
  return (
    <div className="flex min-w-0 items-center gap-1.5 text-xs">
      <Link2 className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
      <a href={row.liveUrl} target="_blank" rel="noreferrer" className="min-w-0 truncate font-medium text-accent hover:underline">
        {displayUrl(row.liveUrl)}
      </a>
      <button
        type="button"
        onClick={() => void copyLink(row.liveUrl!)}
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-subtle hover:text-heading",
          compact ? "h-7 w-7" : "h-8 w-8 -my-1.5"
        )}
        aria-label={`Copy website link for ${row.title}`}
        title="Copy link"
      >
        <Copy className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

function RowActions({
  row,
  onMenu,
  size = "md",
}: {
  row: PropertyWebsiteRow;
  onMenu: (row: PropertyWebsiteRow, el: HTMLElement) => void;
  size?: "md" | "sm";
}) {
  const href = marketingKitHref(row.projectId);
  const btn = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors",
    size === "md" ? "min-h-10 px-3.5" : "min-h-9 px-3"
  );
  return (
    <div className="flex min-w-0 items-center gap-2">
      <Link href={href} className={cn(btn, "border-accent/30 bg-accent-subtle/60 text-accent hover:bg-accent-subtle")}>
        <SquareArrowOutUpRight className="h-4 w-4" aria-hidden /> Open
      </Link>
      <Link href={href} className={cn(btn, "border-border bg-card text-heading hover:bg-subtle")}>
        {row.configured ? <Pencil className="h-4 w-4" aria-hidden /> : <Wand2 className="h-4 w-4" aria-hidden />}
        {row.configured ? "Edit" : "Set up"}
      </Link>
      <button
        type="button"
        onClick={(e) => onMenu(row, e.currentTarget)}
        className={cn(btn, "border-border bg-card px-0 text-muted hover:bg-subtle hover:text-heading", size === "md" ? "w-10" : "w-9")}
        aria-label={`More actions for ${row.title}`}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
    </div>
  );
}

function WebsiteCard({ row, onMenu }: { row: PropertyWebsiteRow; onMenu: (row: PropertyWebsiteRow, el: HTMLElement) => void }) {
  return (
    <article className="flex h-full min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-3 shadow-sm transition-shadow hover:shadow-md sm:flex-row sm:p-3.5">
      <Link
        href={marketingKitHref(row.projectId)}
        className="block shrink-0 overflow-hidden rounded-xl sm:w-40 lg:w-36 xl:w-44"
        tabIndex={-1}
        aria-hidden
      >
        <ProjectCoverImage
          src={row.heroUrl}
          sizes="(min-width: 1280px) 176px, (min-width: 640px) 160px, 100vw"
          className="aspect-[16/9] h-full w-full sm:aspect-auto sm:min-h-[8.5rem]"
        />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex min-w-0 items-start justify-between gap-2">
          <h3 className="min-w-0 truncate text-base font-semibold text-heading">
            <Link href={marketingKitHref(row.projectId)} className="hover:text-accent">
              {row.title}
            </Link>
          </h3>
          <StatusBadge status={row.status} />
        </div>
        <div className="min-w-0 space-y-1.5">
          <UrlLine row={row} />
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <FolderKanban className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">
              Project: <span className="text-heading">{row.projectName}</span>
              {row.clientName ? <span> · {row.clientName}</span> : null}
            </span>
          </p>
          <p className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
            <Calendar className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="truncate">Last updated: {formatUpdated(row.updatedAt)}</span>
          </p>
        </div>
        <div className="mt-auto pt-1">
          <RowActions row={row} onMenu={onMenu} />
        </div>
      </div>
    </article>
  );
}

function WebsiteListRow({ row, onMenu }: { row: PropertyWebsiteRow; onMenu: (row: PropertyWebsiteRow, el: HTMLElement) => void }) {
  return (
    <li className="flex min-w-0 flex-col gap-3 px-3 py-3 sm:px-4 md:flex-row md:items-center md:gap-4">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Link href={marketingKitHref(row.projectId)} className="block shrink-0 overflow-hidden rounded-lg" tabIndex={-1} aria-hidden>
          <ProjectCoverImage src={row.heroUrl} sizes="80px" className="h-12 w-[4.5rem]" />
        </Link>
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 items-center gap-2">
            <Link href={marketingKitHref(row.projectId)} className="min-w-0 truncate text-sm font-semibold text-heading hover:text-accent">
              {row.title}
            </Link>
            <StatusBadge status={row.status} />
          </div>
          <UrlLine row={row} compact />
          <p className="truncate text-xs text-muted">
            {row.projectName} · Updated {formatUpdated(row.updatedAt)}
          </p>
        </div>
      </div>
      <div className="shrink-0 pl-[5.25rem] md:pl-0">
        <RowActions row={row} onMenu={onMenu} size="sm" />
      </div>
    </li>
  );
}

function NewWebsitePicker({ open, onClose, rows }: { open: boolean; onClose: () => void; rows: PropertyWebsiteRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);
  // Projects without a live website first — those are the ones a new website is for.
  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return [...rows]
      .sort((a, b) => Number(a.status === "live") - Number(b.status === "live"))
      .filter((r) => matches(r, q))
      .slice(0, 50);
  }, [rows, query]);

  return (
    <Modal open={open} onClose={onClose} title="New property website" className="sm:max-w-lg">
      {rows.length === 0 ? (
        <div className="space-y-3 py-2 text-center">
          <p className="text-sm text-muted">
            Property websites are built from a project&apos;s photos and details. Create a project first, then build its website from
            the Marketing Kit.
          </p>
          <Link href="/admin/projects/new">
            <Button variant="accent" className="min-h-11">
              <Plus className="h-4 w-4" /> New project
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted">Choose the project this website is for. It opens in that project&apos;s Marketing Kit.</p>
          <label className="relative block">
            <span className="sr-only">Search projects</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
            <input
              type="search"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by address or project..."
              className="h-10 w-full rounded-lg border border-border bg-card pl-9 pr-3 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
            />
          </label>
          <ul className="max-h-[50vh] divide-y divide-border overflow-y-auto rounded-xl border border-border">
            {candidates.length === 0 ? (
              <li className="px-4 py-6 text-center text-sm text-muted">No projects match.</li>
            ) : (
              candidates.map((r) => (
                <li key={r.projectId}>
                  <button
                    type="button"
                    onClick={() => router.push(marketingKitHref(r.projectId))}
                    className="flex min-h-14 w-full min-w-0 items-center gap-3 px-3 py-2 text-left hover:bg-subtle"
                  >
                    <ProjectCoverImage src={r.heroUrl} sizes="64px" className="h-10 w-14 shrink-0 rounded-md" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-heading">{r.title}</span>
                      <span className="block truncate text-xs text-muted">{r.projectName}</span>
                    </span>
                    <StatusBadge status={r.status} />
                  </button>
                </li>
              ))
            )}
          </ul>
          <p className="text-xs text-muted">
            Not listed?{" "}
            <Link href="/admin/projects/new" className="font-medium text-accent hover:underline">
              Create a new project
            </Link>
          </p>
        </div>
      )}
    </Modal>
  );
}

/**
 * Sites → Property Websites: every eligible project and its Marketing Kit website.
 * Nothing is edited here — Open/Edit go to the project's existing Marketing Kit editor.
 */
export function PropertyWebsitesLibrary({ rows, setupRequired }: { rows: PropertyWebsiteRow[]; setupRequired: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [view, setView] = useState<ViewMode>("grid");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menu, setMenu] = useState<{ row: PropertyWebsiteRow; anchor: ActionMenuAnchor } | null>(null);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(VIEW_KEY) === "list") setView("list");
    } catch {
      /* storage blocked */
    }
  }, []);
  const chooseView = (v: ViewMode) => {
    setView(v);
    try {
      window.localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* storage blocked */
    }
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => (status === "all" || r.status === status) && matches(r, q));
  }, [rows, query, status]);
  const liveCount = useMemo(() => visible.filter((r) => r.status === "live").length, [visible]);

  const openMenu = (row: PropertyWebsiteRow, element: HTMLElement) => setMenu({ row, anchor: { kind: "element", element } });

  const menuItems: ActionMenuItem[] = menu
    ? [
        { id: "kit", label: menu.row.configured ? "Edit property website" : "Set up property website", icon: Pencil, onSelect: () => router.push(marketingKitHref(menu.row.projectId)) },
        { id: "social", label: "Social Media Kit", icon: Share2, onSelect: () => router.push(marketingKitHref(menu.row.projectId, "social")) },
        { id: "project", label: "Open project", icon: FolderOpen, onSelect: () => router.push(`/admin/projects/${menu.row.projectId}`) },
        ...(menu.row.liveUrl
          ? ([
              { type: "separator", id: "sep" },
              { id: "view", label: "View live website", icon: ExternalLink, onSelect: () => window.open(menu.row.liveUrl!, "_blank", "noopener,noreferrer") },
              { id: "copy", label: "Copy website link", icon: Copy, onSelect: () => void copyLink(menu.row.liveUrl!) },
            ] satisfies ActionMenuItem[])
          : []),
      ]
    : [];

  const countLabel = `${visible.length} Property Website${visible.length === 1 ? "" : "s"}`;
  const filtered = Boolean(query.trim()) || status !== "all";

  return (
    <div className="min-w-0 space-y-5">
      {setupRequired ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Property websites aren&apos;t enabled for this account yet, so every project shows as Unpublished.
        </p>
      ) : null}

      {/* Toolbar */}
      <div className="flex min-w-0 flex-col gap-3 md:flex-row md:items-center">
        <label className="relative block min-w-0 flex-1">
          <span className="sr-only">Search property websites</span>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search property websites by address, title, or project..."
            title="Search by address, title, or project"
            className="h-11 w-full rounded-xl border border-border bg-card pl-10 pr-3 text-sm text-heading shadow-sm placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          />
        </label>
        <div className="flex min-w-0 gap-3">
          <div className="min-w-0 flex-1 md:w-48 md:flex-none">
            <Select
              aria-label="Filter by status"
              value={status}
              onChange={(e) => setStatus(e.target.value as StatusFilter)}
              options={STATUS_OPTIONS}
              className="h-11 rounded-xl shadow-sm"
            />
          </div>
          <Button variant="accent" onClick={() => setPickerOpen(true)} className="h-11 shrink-0 rounded-xl px-4">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">New Property Website</span>
            <span className="sm:hidden">New</span>
          </Button>
        </div>
      </div>

      {/* Results heading */}
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-heading">{countLabel}</h2>
          {visible.length > 0 ? (
            <p className="text-xs text-muted">
              {liveCount} live · {visible.length - liveCount} unpublished
              {filtered ? ` · filtered from ${rows.length}` : ""}
            </p>
          ) : null}
        </div>
        <div role="radiogroup" aria-label="Layout" className="inline-flex shrink-0 rounded-lg border border-border bg-card p-0.5 shadow-sm">
          {(
            [
              { v: "grid", label: "Grid view", Icon: LayoutGrid },
              { v: "list", label: "List view", Icon: List },
            ] as const
          ).map(({ v, label, Icon }) => (
            <button
              key={v}
              type="button"
              role="radio"
              aria-checked={view === v}
              aria-label={label}
              title={label}
              onClick={() => chooseView(v)}
              className={cn(
                "inline-flex h-9 w-9 items-center justify-center rounded-md transition-colors",
                view === v ? "bg-accent-subtle text-accent" : "text-muted hover:text-heading"
              )}
            >
              <Icon className="h-4 w-4" aria-hidden />
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-accent-subtle text-accent">
            <FolderKanban className="h-5 w-5" aria-hidden />
          </span>
          <h3 className="text-base font-semibold text-heading">No projects yet</h3>
          <p className="max-w-md text-sm text-muted">
            Every property website comes from a project. Create a project, then build its website from the Marketing Kit.
          </p>
          <Link href="/admin/projects/new">
            <Button variant="accent" className="min-h-11">
              <Plus className="h-4 w-4" /> New project
            </Button>
          </Link>
        </div>
      ) : visible.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-sm text-muted">No property websites match your search.</p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setStatus("all");
            }}
            className="mt-2 min-h-10 text-sm font-medium text-accent hover:underline"
          >
            Clear filters
          </button>
        </div>
      ) : view === "grid" ? (
        <ul className="grid min-w-0 gap-4 lg:grid-cols-2">
          {visible.map((row) => (
            <li key={row.projectId} className="min-w-0">
              <WebsiteCard row={row} onMenu={openMenu} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="min-w-0 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {visible.map((row) => (
            <WebsiteListRow key={row.projectId} row={row} onMenu={openMenu} />
          ))}
        </ul>
      )}

      <ActionMenu anchor={menu?.anchor ?? null} onClose={() => setMenu(null)} items={menuItems} title={menu?.row.title ?? "Website"} />
      <NewWebsitePicker open={pickerOpen} onClose={() => setPickerOpen(false)} rows={rows} />
    </div>
  );
}
