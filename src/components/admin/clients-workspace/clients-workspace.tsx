"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArchiveRestore,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  EyeOff,
  Filter,
  FolderOpen,
  FolderPlus,
  LayoutGrid,
  List,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  SearchX,
  Send,
  SlidersHorizontal,
  Trash2,
  Upload,
  UserRound,
  Users,
  UsersRound,
  X,
} from "lucide-react";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { Button } from "@/components/ui/button";
import { useDismiss } from "@/components/ui/checkbox-dropdown";
import { CreateClientModal } from "@/components/admin/create-client-modal";
import { ClientProfileModalProvider, useOpenClientProfile } from "@/components/admin/client-view/client-profile-modal";
import {
  ACTIVITY_FILTER_OPTIONS,
  CLIENT_STATUS_TABS,
  CLIENTS_SORT_OPTIONS,
  EMPTY_CLIENT_FILTERS,
  NO_COMPANY,
  PORTAL_STATUS_LABEL,
  canInvite,
  canResend,
  countTabs,
  filterByTab,
  filterClients,
  formatLastSeen,
  isClientsSort,
  sortClients,
  type ActivityFilter,
  type ClientPortalStatus,
  type ClientStatusTab,
  type ClientWorkspaceRow,
  type ClientsFilters,
  type ClientsSort,
  type ProjectsFilter,
} from "@/lib/clients-workspace";
import { cn, formatCurrency } from "@/lib/utils";
import { CheckMark, Chip, ClientAvatar, FilterSection, MultiSelectMenu, PortalStatusBadge, type MenuOption } from "./clients-ui";
import { downloadClientsCsv, useClientActions, type ClientsPermissions } from "./clients-actions";
import { ClientDetailPanel } from "./clients-panel";
import { ImportClientsModal } from "./clients-import";

type ViewMode = "list" | "grid";
const PAGE_SIZES = [10, 25, 50, 100] as const;
const PREFS_KEY = "sp:clients:prefs";
const STATUS_ORDER: ClientPortalStatus[] = ["active", "invite_sent", "invite_expired", "not_invited", "unavailable"];
const TAB_PARAM: Record<ClientStatusTab, string | null> = { all: null, active: "active", invited: "invited", not_invited: "not-invited" };

type Prefs = { view: ViewMode; pageSize: number; sort: ClientsSort };

function readPrefs(): Partial<Prefs> {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    return raw ? (JSON.parse(raw) as Partial<Prefs>) : {};
  } catch {
    return {};
  }
}

function writePrefs(p: Prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    /* storage blocked */
  }
}

const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString()} ${n === 1 ? one : many}`;

const noopSubscribe = () => () => {};
/**
 * False during SSR and hydration, true after. Relative times ("2h ago") and local dates depend on
 * the viewer's clock and time zone, so they render only in the browser (no hydration mismatch).
 */
function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function ClientsWorkspace(props: {
  clients: ClientWorkspaceRow[];
  showDeleted: boolean;
  hiddenCount: number;
  activeCount: number;
  permissions: ClientsPermissions;
}) {
  return (
    <ClientProfileModalProvider>
      <ClientsWorkspaceInner {...props} />
    </ClientProfileModalProvider>
  );
}

function ClientsWorkspaceInner({
  clients,
  showDeleted,
  hiddenCount,
  activeCount,
  permissions,
}: {
  clients: ClientWorkspaceRow[];
  showDeleted: boolean;
  hiddenCount: number;
  activeCount: number;
  permissions: ClientsPermissions;
}) {
  const router = useRouter();
  const openProfileModal = useOpenClientProfile();
  const openProfile = useCallback(
    (id: string) => (openProfileModal ? openProfileModal(id) : router.push(`/admin/clients/${id}`)),
    [openProfileModal, router]
  );

  // Local copy so actions can update rows instantly; server refreshes replace it.
  const [rows, setRows] = useState(clients);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    setRows(clients);
    setRefreshKey((k) => k + 1);
  }, [clients]);

  const [tab, setTab] = useState<ClientStatusTab>("all");
  const [filters, setFilters] = useState<ClientsFilters>(EMPTY_CLIENT_FILTERS);
  const [sort, setSort] = useState<ClientsSort>("activity_desc");
  const [view, setView] = useState<ViewMode>("list");
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [panelId, setPanelId] = useState<string | null>(null);
  const [panelMode, setPanelMode] = useState<"details" | "messages">("details");
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  const [rowMenu, setRowMenu] = useState<{ client: ClientWorkspaceRow; anchor: ActionMenuAnchor } | null>(null);
  const lastToggled = useRef<string | null>(null);
  const listTopRef = useRef<HTMLDivElement>(null);

  // Restore saved view / page size / sort and the tab from the URL (after mount — no SSR mismatch).
  useEffect(() => {
    const p = readPrefs();
    if (p.view === "grid" || p.view === "list") setView(p.view);
    if (typeof p.pageSize === "number" && (PAGE_SIZES as readonly number[]).includes(p.pageSize)) setPageSize(p.pageSize);
    if (isClientsSort(p.sort) && (p.sort !== "revenue_desc" || permissions.canViewMoney)) setSort(p.sort);
    const status = new URLSearchParams(window.location.search).get("status");
    const fromUrl = (Object.entries(TAB_PARAM) as [ClientStatusTab, string | null][]).find(([, v]) => v && v === status)?.[0];
    if (fromUrl) setTab(fromUrl);
  }, [permissions.canViewMoney]);

  useEffect(() => writePrefs({ view, pageSize, sort }), [view, pageSize, sort]);

  function changeTab(next: ClientStatusTab) {
    setTab(next);
    setPage(1);
    try {
      const url = new URL(window.location.href);
      if (TAB_PARAM[next]) url.searchParams.set("status", TAB_PARAM[next]!);
      else url.searchParams.delete("status");
      // null state: Next.js syncs its router to the new URL (keeps it across router.refresh()).
      window.history.replaceState(null, "", url.toString());
    } catch {
      /* ignore */
    }
  }

  function patchFilters(patch: Partial<ClientsFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    setPage(1);
  }
  const clearAll = () => {
    setFilters(EMPTY_CLIENT_FILTERS);
    setPage(1);
  };

  // ── Derived lists ──
  const filtered = useMemo(() => filterClients(rows, filters), [rows, filters]);
  const tabCounts = useMemo(() => countTabs(filtered), [filtered]);
  const shown = useMemo(() => sortClients(filterByTab(filtered, tab), sort), [filtered, tab, sort]);
  const pageCount = Math.max(1, Math.ceil(shown.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const pageRows = useMemo(() => shown.slice((safePage - 1) * pageSize, safePage * pageSize), [shown, safePage, pageSize]);
  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows]);
  const selectedRows = useMemo(() => [...selected].map((id) => byId.get(id)).filter(Boolean) as ClientWorkspaceRow[], [selected, byId]);
  const shownIds = useMemo(() => new Set(shown.map((c) => c.id)), [shown]);
  const selectedOffscreen = selectedRows.filter((c) => !shownIds.has(c.id)).length;
  const panelClient = panelId ? byId.get(panelId) ?? null : null;

  useEffect(() => {
    // Drop selections for clients that left the data entirely.
    setSelected((prev) => {
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (byId.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
    if (panelId && !byId.has(panelId)) setPanelId(null);
  }, [byId, panelId]);

  const companyOptions: MenuOption[] = useMemo(() => {
    const counts = new Map<string, { label: string; count: number }>();
    let none = 0;
    for (const c of rows) {
      const name = c.company?.trim();
      if (!name) {
        none++;
        continue;
      }
      const key = name;
      const prev = counts.get(key);
      counts.set(key, { label: name, count: (prev?.count ?? 0) + 1 });
    }
    const list = [...counts.entries()]
      .sort((a, b) => a[1].label.localeCompare(b[1].label))
      .map(([value, v]) => ({ value, label: v.label, count: v.count }));
    if (none) list.push({ value: NO_COMPANY, label: "No company", count: none });
    return list;
  }, [rows]);

  const statusOptions: MenuOption[] = useMemo(() => {
    const counts = new Map<ClientPortalStatus, number>();
    for (const c of rows) counts.set(c.portal_status, (counts.get(c.portal_status) ?? 0) + 1);
    return STATUS_ORDER.filter((s) => s !== "unavailable" || counts.get(s)).map((s) => ({
      value: s,
      label: PORTAL_STATUS_LABEL[s],
      count: counts.get(s) ?? 0,
    }));
  }, [rows]);

  const referralOptions = useMemo(
    () => [...new Set(rows.map((c) => c.referral_source).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b)),
    [rows]
  );

  // ── Actions ──
  const actions = useClientActions({
    permissions,
    onPatch: (id, patch) => setRows((list) => list.map((r) => (r.id === id ? { ...r, ...patch } : r))),
    onRemoved: (ids) => {
      const gone = new Set(ids);
      setRows((list) => list.filter((r) => !gone.has(r.id)));
    },
    onSettled: (doneIds) => {
      if (!doneIds.length) return;
      const done = new Set(doneIds);
      setSelected((prev) => new Set([...prev].filter((id) => !done.has(id))));
    },
  });

  const menuItems = useCallback(
    (c: ClientWorkspaceRow): ActionMenuItem[] => {
      const hidden = Boolean(c.deleted_at);
      const items: ActionMenuItem[] = [
        { id: "profile", label: "View Client Profile", icon: UserRound, onSelect: () => openProfile(c.id) },
      ];
      if (!hidden && permissions.canMessage) {
        items.push({ id: "message", label: "Message Client", icon: MessageSquare, onSelect: () => {
            setPanelMode("messages");
            setPanelId(c.id);
          } });
      }
      if (!hidden && permissions.canCreateProject) {
        items.push({ id: "new-project", label: "Add Project", icon: Plus, onSelect: () => router.push(`/admin/projects/new?client=${encodeURIComponent(c.id)}`) });
      }
      if (!hidden && permissions.canAddToProjects) {
        items.push({ id: "add-to-project", label: "Add to Existing Project", icon: FolderPlus, onSelect: () => actions.addToProject([c]) });
      }
      if (!hidden && permissions.canManagePortal) {
        items.push({ type: "separator", id: "sep-portal" });
        if (canInvite(c) && c.portal_status === "not_invited") {
          items.push({ id: "invite", label: "Send Portal Invite", icon: Send, onSelect: () => actions.invite([c]) });
        }
        if (canResend(c)) {
          items.push({ id: "resend", label: "Resend Invitation", icon: RefreshCw, onSelect: () => actions.resend([c]) });
        }
        items.push({ id: "access", label: "Manage Portal Access", icon: UsersRound, onSelect: () => actions.manageAccess(c) });
      }
      items.push({ type: "separator", id: "sep-edit" });
      if (!hidden && permissions.canEdit) items.push({ id: "edit", label: "Edit Client", icon: Pencil, onSelect: () => actions.edit(c) });
      items.push({ id: "export", label: "Export to CSV", icon: Download, onSelect: () => downloadClientsCsv([c], permissions.canViewMoney, "client") });
      if (permissions.canEdit) {
        items.push(
          hidden
            ? { id: "restore", label: "Restore Client", icon: ArchiveRestore, onSelect: () => actions.restore([c]) }
            : { id: "hide", label: "Hide Client", icon: EyeOff, onSelect: () => actions.hide([c]) }
        );
      }
      if (permissions.canDelete) {
        items.push({ id: "delete", label: "Delete Client", icon: Trash2, destructive: true, onSelect: () => actions.remove([c]) });
      }
      return items;
    },
    [actions, openProfile, permissions, router]
  );

  // ── Selection ──
  function toggleOne(id: string, range: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (range && lastToggled.current) {
        const ids = pageRows.map((c) => c.id);
        const a = ids.indexOf(lastToggled.current);
        const b = ids.indexOf(id);
        if (a >= 0 && b >= 0) {
          const on = !prev.has(id);
          for (const x of ids.slice(Math.min(a, b), Math.max(a, b) + 1)) {
            if (on) next.add(x);
            else next.delete(x);
          }
          lastToggled.current = id;
          return next;
        }
      }
      if (next.has(id)) next.delete(id);
      else next.add(id);
      lastToggled.current = id;
      return next;
    });
  }
  const pageSelectedCount = pageRows.filter((c) => selected.has(c.id)).length;
  const headerState: boolean | "mixed" =
    pageRows.length === 0 || pageSelectedCount === 0 ? false : pageSelectedCount === pageRows.length ? true : "mixed";
  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (headerState === true) pageRows.forEach((c) => next.delete(c.id));
      else pageRows.forEach((c) => next.add(c.id));
      return next;
    });
  }
  const allShownSelected = shown.length > 0 && shown.every((c) => selected.has(c.id));

  // Below xl the panel is a drawer / full-screen sheet over the list: lock the page behind it.
  const panelOpen = Boolean(panelId);
  useEffect(() => {
    if (!panelOpen || !window.matchMedia("(max-width: 1279px)").matches) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [panelOpen]);

  /** Clicking a row opens its details; "Message" opens the thread. Re-clicking the open row keeps its view. */
  function openPanel(id: string, mode?: "details" | "messages") {
    if (mode) setPanelMode(mode);
    else if (id !== panelId) setPanelMode("details");
    setPanelId(id);
  }

  // ── Active filter chips ──
  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.search.trim()) chips.push({ key: "q", label: `“${filters.search.trim()}”`, clear: () => patchFilters({ search: "" }) });
  if (filters.companies.length) {
    chips.push({
      key: "company",
      label: `Company: ${filters.companies.map((v) => companyOptions.find((o) => o.value === v)?.label ?? v).join(", ")}`,
      clear: () => patchFilters({ companies: [] }),
    });
  }
  if (filters.statuses.length) {
    chips.push({ key: "status", label: `Portal: ${filters.statuses.map((s) => PORTAL_STATUS_LABEL[s]).join(", ")}`, clear: () => patchFilters({ statuses: [] }) });
  }
  if (filters.referrals.length) chips.push({ key: "referral", label: `Referral: ${filters.referrals.join(", ")}`, clear: () => patchFilters({ referrals: [] }) });
  if (filters.projects !== "any") {
    chips.push({ key: "projects", label: filters.projects === "with" ? "Has projects" : "No projects", clear: () => patchFilters({ projects: "any" }) });
  }
  if (filters.activity !== "any") {
    chips.push({
      key: "activity",
      label: ACTIVITY_FILTER_OPTIONS.find((o) => o.value === filters.activity)?.label ?? "Activity",
      clear: () => patchFilters({ activity: "any" }),
    });
  }
  if (filters.outstandingOnly) chips.push({ key: "outstanding", label: "Outstanding balance", clear: () => patchFilters({ outstandingOnly: false }) });
  const moreCount = filters.referrals.length + (filters.projects !== "any" ? 1 : 0) + (filters.activity !== "any" ? 1 : 0) + (filters.outstandingOnly ? 1 : 0);
  const sheetCount = moreCount + filters.companies.length + filters.statuses.length;

  const resultsLabel = plural(shown.length, "client");

  // ── Render ──
  const noClients = rows.length === 0;

  return (
    <div className="flex min-w-0 items-start gap-5">
      <div className="min-w-0 flex-1 space-y-3" ref={listTopRef}>
        {/* Row 1 — status tabs + Hidden / Import / New Client */}
        <div className="flex min-w-0 flex-col-reverse gap-2 border-b border-border sm:flex-row sm:items-end sm:gap-3">
          {showDeleted ? (
            <div className="flex h-11 items-center gap-2 text-sm font-semibold text-heading">
              <EyeOff className="h-4 w-4 text-muted" aria-hidden /> Hidden clients
              <span className="rounded-full bg-subtle px-2 text-xs tabular-nums text-muted">{rows.length}</span>
            </div>
          ) : (
            <nav aria-label="Portal status" className="-mb-px flex min-w-0 flex-1 overflow-x-auto no-scrollbar">
              {CLIENT_STATUS_TABS.map((t) => {
                const on = tab === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => changeTab(t.value)}
                    aria-current={on ? "page" : undefined}
                    className={cn(
                      "inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-sm font-semibold transition-colors sm:px-4",
                      on ? "border-accent text-accent" : "border-transparent text-muted hover:border-border hover:text-heading"
                    )}
                  >
                    {t.label}
                    <span
                      className={cn(
                        "min-w-6 rounded-full px-1.5 text-center text-xs leading-5 tabular-nums",
                        on ? "bg-accent-subtle text-accent" : "bg-subtle text-muted"
                      )}
                    >
                      {tabCounts[t.value]}
                    </span>
                  </button>
                );
              })}
            </nav>
          )}
          <div className="flex shrink-0 items-center gap-2 pb-2 sm:ml-auto">
            <Link
              href={showDeleted ? "/admin/clients" : "/admin/clients?view=deleted"}
              title={showDeleted ? "Back to your clients" : "View hidden clients"}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-heading shadow-sm transition-colors hover:bg-subtle"
            >
              {showDeleted ? <Users className="h-4 w-4 text-muted" aria-hidden /> : <EyeOff className="h-4 w-4 text-muted" aria-hidden />}
              <span className={showDeleted ? undefined : "max-[399px]:sr-only"}>{showDeleted ? "Active Clients" : "Hidden"}</span>
              <span className="rounded-full bg-subtle px-1.5 text-xs tabular-nums text-muted">{showDeleted ? activeCount : hiddenCount}</span>
            </Link>
            {!showDeleted && permissions.canCreate ? (
              <>
                <button
                  type="button"
                  onClick={() => setImporting(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-border bg-card px-3 text-sm font-semibold text-heading shadow-sm transition-colors hover:bg-subtle"
                >
                  <Upload className="h-4 w-4" aria-hidden />
                  <span className="max-[399px]:sr-only">Import</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="ml-auto inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-xl bg-accent px-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90 sm:ml-0 sm:px-4"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                  New Client
                </button>
              </>
            ) : null}
          </div>
        </div>

        {noClients ? (
          <EmptyClients showDeleted={showDeleted} canCreate={permissions.canCreate} onCreate={() => setCreating(true)} onImport={() => setImporting(true)} />
        ) : (
          <>
            {/* Row 2 — search, filters, sort, view */}
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <label className="relative block min-w-0 flex-1 basis-36 sm:basis-48 md:max-w-xs">
                <span className="sr-only">Search clients</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
                <input
                  type="search"
                  value={filters.search}
                  onChange={(e) => patchFilters({ search: e.target.value })}
                  placeholder="Search clients…"
                  title="Search by name, email, company, phone or referral source"
                  className="h-10 w-full rounded-xl border border-border bg-card pl-9 pr-9 text-sm text-heading placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                />
                {filters.search ? (
                  <button
                    type="button"
                    onClick={() => patchFilters({ search: "" })}
                    aria-label="Clear search"
                    className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted hover:text-heading"
                  >
                    <X className="h-4 w-4" aria-hidden />
                  </button>
                ) : null}
              </label>
              <MultiSelectMenu
                label="Company"
                options={companyOptions}
                selected={filters.companies}
                onChange={(companies) => patchFilters({ companies })}
                emptyText="No companies on your clients yet"
                className="hidden md:block"
              />
              <MultiSelectMenu
                label="Portal Status"
                options={statusOptions}
                selected={filters.statuses}
                onChange={(statuses) => patchFilters({ statuses: statuses as ClientPortalStatus[] })}
                className="hidden md:block"
              />
              <MoreFilters
                count={moreCount}
                sheetCount={sheetCount}
                resultsLabel={resultsLabel}
                filters={filters}
                onChange={patchFilters}
                onClearAll={clearAll}
                referralOptions={referralOptions}
                companyOptions={companyOptions}
                statusOptions={statusOptions}
                canViewMoney={permissions.canViewMoney}
              />
              <div className="ml-auto flex items-center gap-2">
                <SortMenu value={sort} onChange={(s) => setSort(s)} canViewMoney={permissions.canViewMoney} />
                <div role="radiogroup" aria-label="Layout" className="flex rounded-xl border border-border bg-card p-0.5">
                  {(
                    [
                      { v: "list", label: "List view", icon: List },
                      { v: "grid", label: "Grid view", icon: LayoutGrid },
                    ] as const
                  ).map(({ v, label, icon: Icon }) => (
                    <button
                      key={v}
                      type="button"
                      role="radio"
                      aria-checked={view === v}
                      aria-label={label}
                      title={label}
                      onClick={() => setView(v)}
                      className={cn(
                        "flex h-8 w-9 items-center justify-center rounded-[10px] transition-colors",
                        view === v ? "bg-accent-subtle text-accent" : "text-muted hover:text-heading"
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {chips.length ? (
              <div className="flex min-w-0 flex-wrap items-center gap-1.5" aria-label="Active filters">
                {chips.map((c) => (
                  <span key={c.key} className="inline-flex h-8 max-w-[20rem] items-center gap-1 rounded-lg border border-accent/25 bg-accent-subtle/70 pl-2.5 pr-0.5 text-sm font-medium text-accent">
                    <span className="truncate" title={c.label}>
                      {c.label}
                    </span>
                    <button type="button" onClick={c.clear} aria-label={`Remove filter: ${c.label}`} className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md hover:bg-accent/10">
                      <X className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                ))}
                <button type="button" onClick={clearAll} className="h-8 rounded-lg px-2 text-sm font-semibold text-accent hover:bg-accent-subtle">
                  Clear All
                </button>
                <span className="text-xs text-muted" aria-live="polite">
                  {resultsLabel}
                </span>
              </div>
            ) : null}

            {/* Bulk actions */}
            {selectedRows.length ? (
              <BulkBar
                selected={selectedRows}
                offscreen={selectedOffscreen}
                showDeleted={showDeleted}
                permissions={permissions}
                busy={actions.busy}
                headerState={headerState}
                onTogglePage={togglePage}
                onClear={() => setSelected(new Set())}
                actions={actions}
              />
            ) : null}

            {headerState === true && !allShownSelected && shown.length > pageRows.length ? (
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl bg-accent-subtle/60 px-3 py-2 text-sm text-heading">
                <span>All {pageRows.length} clients on this page are selected.</span>
                <button type="button" onClick={() => setSelected((prev) => new Set([...prev, ...shown.map((c) => c.id)]))} className="font-semibold text-accent hover:underline">
                  Select all {plural(shown.length, "matching client")}
                </button>
              </div>
            ) : allShownSelected && shown.length > pageRows.length ? (
              <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-xl bg-accent-subtle/60 px-3 py-2 text-sm text-heading">
                <span>All {plural(shown.length, "matching client")} are selected.</span>
                <button type="button" onClick={() => setSelected(new Set())} className="font-semibold text-accent hover:underline">
                  Clear selection
                </button>
              </div>
            ) : null}

            {shown.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-14 text-center">
                <SearchX className="h-7 w-7 text-muted" aria-hidden />
                <p className="text-sm font-medium text-heading">
                  {chips.length ? "No clients match your filters." : `No clients are ${CLIENT_STATUS_TABS.find((t) => t.value === tab)?.label.toLowerCase()} yet.`}
                </p>
                {chips.length ? (
                  <Button variant="outline" className="min-h-10" onClick={clearAll}>
                    Clear filters
                  </Button>
                ) : tab !== "all" ? (
                  <Button variant="outline" className="min-h-10" onClick={() => changeTab("all")}>
                    Show all clients
                  </Button>
                ) : null}
              </div>
            ) : view === "list" ? (
              <ClientsTable
                rows={pageRows}
                sort={sort}
                onSort={setSort}
                selected={selected}
                headerState={headerState}
                onTogglePage={togglePage}
                onToggle={toggleOne}
                activeId={panelId}
                onOpen={openPanel}
                onMenu={(client, el) => setRowMenu({ client, anchor: { kind: "element", element: el } })}
              />
            ) : (
              <ClientsGrid
                rows={pageRows}
                selected={selected}
                onToggle={toggleOne}
                activeId={panelId}
                onOpen={openPanel}
                onMenu={(client, el) => setRowMenu({ client, anchor: { kind: "element", element: el } })}
              />
            )}

            {shown.length > 0 ? (
              <Pagination
                page={safePage}
                pageCount={pageCount}
                total={shown.length}
                pageSize={pageSize}
                onPage={(p) => {
                  setPage(p);
                  listTopRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
                }}
                onPageSize={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            ) : null}
          </>
        )}
      </div>

      {/* Detail panel: in the layout on wide screens, a drawer / full-screen sheet below that. */}
      {panelClient ? (
        <>
          <button
            type="button"
            aria-label="Close client details"
            tabIndex={-1}
            onClick={() => setPanelId(null)}
            className="fixed inset-0 z-[60] bg-slate-950/30 backdrop-blur-[1px] animate-[sp-sheet-fade_200ms_ease-out] motion-reduce:animate-none xl:hidden"
          />
          <aside
            role="dialog"
            aria-modal={false}
            aria-labelledby="client-panel-title"
            className={cn(
              "fixed inset-y-0 right-0 z-[61] w-full bg-background shadow-2xl animate-[sp-panel-in_240ms_cubic-bezier(0.32,0.72,0,1)] motion-reduce:animate-none sm:w-[400px] sm:border-l sm:border-border",
              "xl:sticky xl:top-20 xl:z-auto xl:h-[calc(100dvh-6rem)] xl:w-[360px] xl:shrink-0 xl:overflow-hidden xl:rounded-2xl xl:border xl:border-border xl:bg-card xl:shadow-[0_8px_30px_-12px_rgba(15,23,42,0.18)] 2xl:w-[380px]"
            )}
          >
            <ClientDetailPanel
              key={panelClient.id}
              client={panelClient}
              permissions={permissions}
              actions={actions}
              menuItems={menuItems}
              onClose={() => setPanelId(null)}
              onOpenProfile={openProfile}
              refreshKey={String(refreshKey)}
              mode={panelMode}
              onModeChange={setPanelMode}
            />
          </aside>
        </>
      ) : null}

      <ActionMenu
        anchor={rowMenu?.anchor ?? null}
        onClose={() => setRowMenu(null)}
        title={rowMenu?.client.name ?? "Client actions"}
        items={rowMenu ? menuItems(rowMenu.client) : []}
      />
      <CreateClientModal open={creating} onClose={() => setCreating(false)} onCreated={() => router.refresh()} />
      <ImportClientsModal open={importing} onClose={() => setImporting(false)} />
      {actions.dialogs}
    </div>
  );
}

// ── Empty state ─────────────────────────────────────────────────────────────

function EmptyClients({
  showDeleted,
  canCreate,
  onCreate,
  onImport,
}: {
  showDeleted: boolean;
  canCreate: boolean;
  onCreate: () => void;
  onImport: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-subtle text-accent">
        {showDeleted ? <EyeOff className="h-6 w-6" aria-hidden /> : <Users className="h-6 w-6" aria-hidden />}
      </span>
      <p className="text-base font-semibold text-heading">{showDeleted ? "No hidden clients" : "No clients yet"}</p>
      <p className="max-w-sm text-sm text-muted">
        {showDeleted
          ? "Clients you hide show up here, and you can restore them any time."
          : "Add your first client, or import the list you already have from a spreadsheet."}
      </p>
      {!showDeleted && canCreate ? (
        <div className="mt-1 flex flex-wrap justify-center gap-2">
          <Button variant="outline" className="min-h-10" onClick={onImport}>
            <Upload className="h-4 w-4" aria-hidden /> Import CSV
          </Button>
          <Button variant="accent" className="min-h-10" onClick={onCreate}>
            <Plus className="h-4 w-4" aria-hidden /> New Client
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ── Sort ────────────────────────────────────────────────────────────────────

function SortMenu({ value, onChange, canViewMoney }: { value: ClientsSort; onChange: (s: ClientsSort) => void; canViewMoney: boolean }) {
  const options = CLIENTS_SORT_OPTIONS.filter((o) => !o.money || canViewMoney);
  const label = options.find((o) => o.value === value)?.label ?? "Sort";
  return (
    <label className="relative inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-border bg-card px-3 text-sm font-medium text-heading hover:bg-subtle focus-within:ring-2 focus-within:ring-accent/30">
      <ArrowUpDown className="h-4 w-4 text-muted lg:hidden" aria-hidden />
      <span className="hidden whitespace-nowrap lg:inline">Sort: {label}</span>
      <ChevronDown className="hidden h-4 w-4 text-muted lg:block" aria-hidden />
      <select aria-label="Sort clients" value={value} onChange={(e) => onChange(e.target.value as ClientsSort)} className="absolute inset-0 h-full w-full cursor-pointer opacity-0">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// ── More filters (popover on desktop, sheet with every filter on phones) ────

function MoreFilters({
  count,
  sheetCount,
  resultsLabel,
  filters,
  onChange,
  onClearAll,
  referralOptions,
  companyOptions,
  statusOptions,
  canViewMoney,
}: {
  count: number;
  sheetCount: number;
  resultsLabel: string;
  filters: ClientsFilters;
  onChange: (patch: Partial<ClientsFilters>) => void;
  onClearAll: () => void;
  referralOptions: string[];
  companyOptions: MenuOption[];
  statusOptions: MenuOption[];
  canViewMoney: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, ref, () => setOpen(false));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const panel = (full: boolean) => (
    <div className="space-y-4">
      {full ? (
        <>
          <FilterSection title="Portal status">
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((o) => (
                <Chip key={o.value} on={filters.statuses.includes(o.value as ClientPortalStatus)} onClick={() => onChange({ statuses: toggle(filters.statuses, o.value as ClientPortalStatus) })}>
                  {o.label}
                </Chip>
              ))}
            </div>
          </FilterSection>
          {companyOptions.length ? (
            <FilterSection title="Company">
              <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
                {companyOptions.map((o) => (
                  <Chip key={o.value} on={filters.companies.includes(o.value)} onClick={() => onChange({ companies: toggle(filters.companies, o.value) })}>
                    {o.label}
                  </Chip>
                ))}
              </div>
            </FilterSection>
          ) : null}
        </>
      ) : null}
      <FilterSection title="Projects">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["with", "Has projects"],
              ["without", "No projects"],
            ] as [ProjectsFilter, string][]
          ).map(([v, label]) => (
            <Chip key={v} on={filters.projects === v} onClick={() => onChange({ projects: filters.projects === v ? "any" : v })}>
              {label}
            </Chip>
          ))}
          {canViewMoney ? (
            <Chip on={filters.outstandingOnly} onClick={() => onChange({ outstandingOnly: !filters.outstandingOnly })}>
              Outstanding balance
            </Chip>
          ) : null}
        </div>
      </FilterSection>
      <FilterSection title="Last activity">
        <div className="flex flex-wrap gap-1.5">
          {ACTIVITY_FILTER_OPTIONS.map((o) => (
            <Chip key={o.value} on={filters.activity === o.value} onClick={() => onChange({ activity: (filters.activity === o.value ? "any" : o.value) as ActivityFilter })}>
              {o.label}
            </Chip>
          ))}
        </div>
      </FilterSection>
      <FilterSection title="Referral source">
        {referralOptions.length ? (
          <div className="flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
            {referralOptions.map((r) => (
              <Chip key={r} on={filters.referrals.includes(r)} onClick={() => onChange({ referrals: toggle(filters.referrals, r) })}>
                {r}
              </Chip>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No referral sources recorded yet.</p>
        )}
      </FilterSection>
    </div>
  );

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => {
          if (window.matchMedia("(max-width: 767px)").matches) setSheet(true);
          else setOpen((o) => !o);
        }}
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
          open || count ? "border-accent/30 bg-accent-subtle text-accent" : "border-transparent text-accent hover:bg-accent-subtle",
          sheetCount && "max-md:border-accent/30 max-md:bg-accent-subtle"
        )}
      >
        <SlidersHorizontal className="h-4 w-4 max-md:hidden" aria-hidden />
        <Filter className="h-4 w-4 md:hidden" aria-hidden />
        <span className="hidden md:inline">More filters</span>
        <span className="max-sm:sr-only md:hidden">Filters</span>
        {count ? (
          <span className="hidden min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 text-accent-foreground md:inline">{count}</span>
        ) : null}
        {sheetCount ? (
          <span className="min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] leading-5 text-accent-foreground md:hidden">{sheetCount}</span>
        ) : null}
      </button>
      {open ? (
        <div role="dialog" aria-label="More filters" className="absolute left-0 top-full z-40 mt-2 w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-4 shadow-xl">
          <div className="max-h-[min(65vh,32rem)] overflow-y-auto pr-1">{panel(false)}</div>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-3">
            <button type="button" onClick={onClearAll} className="min-h-9 rounded-lg px-2 text-sm font-medium text-accent hover:bg-accent-subtle">
              Clear all
            </button>
            <div className="flex items-center gap-3">
              <span className="text-xs text-muted" aria-live="polite">
                {resultsLabel}
              </span>
              <Button variant="accent" size="sm" className="min-h-9" onClick={() => setOpen(false)}>
                Done
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <BottomSheet
        open={sheet}
        onClose={() => setSheet(false)}
        title="Filter clients"
        description="Clients must match every filter you set."
        footer={
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11 flex-1" onClick={onClearAll}>
              Clear all
            </Button>
            <Button variant="accent" className="min-h-11 flex-1" onClick={() => setSheet(false)}>
              Show {resultsLabel}
            </Button>
          </div>
        }
      >
        {panel(true)}
      </BottomSheet>
    </div>
  );
}

// ── Bulk bar ────────────────────────────────────────────────────────────────

function BulkBar({
  selected,
  offscreen,
  showDeleted,
  permissions,
  busy,
  headerState,
  onTogglePage,
  onClear,
  actions,
}: {
  selected: ClientWorkspaceRow[];
  offscreen: number;
  showDeleted: boolean;
  permissions: ClientsPermissions;
  busy: { label: string; total: number; finished: number } | null;
  headerState: boolean | "mixed";
  onTogglePage: () => void;
  onClear: () => void;
  actions: ReturnType<typeof useClientActions>;
}) {
  const [accessMenu, setAccessMenu] = useState<ActionMenuAnchor | null>(null);
  const disabled = Boolean(busy);
  const invitable = selected.filter((c) => canInvite(c) && c.portal_status === "not_invited");
  const resendable = selected.filter(canResend);
  const activeOnes = selected.filter((c) => c.portal_status === "active");
  const portal = permissions.canManagePortal && !showDeleted;

  return (
    <div
      role="toolbar"
      aria-label="Bulk client actions"
      className="media-bulk-bar fixed inset-x-3 z-40 rounded-2xl border border-border bg-card/95 px-2 py-2 shadow-[0_12px_40px_-12px_rgba(15,23,42,0.35)] backdrop-blur md:static md:inset-auto md:z-auto md:bg-card md:px-2.5 md:shadow-sm"
    >
      <div className="flex min-w-0 items-center gap-1.5">
        <button
          type="button"
          role="checkbox"
          aria-checked={headerState}
          aria-label={headerState === true ? "Deselect this page" : "Select this page"}
          onClick={onTogglePage}
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg hover:bg-subtle md:flex"
        >
          <CheckMark on={headerState === true} mixed={headerState === "mixed"} />
        </button>
        <span className="min-w-0 shrink truncate pl-1 text-sm font-semibold text-heading md:pl-0" aria-live="polite">
          {busy ? (
            <span className="inline-flex items-center gap-1.5">
              <RefreshCw className="h-4 w-4 animate-spin text-accent" aria-hidden />
              {busy.label}… {busy.finished}/{busy.total}
            </span>
          ) : (
            <>
              {selected.length.toLocaleString()}
              <span className="hidden min-[420px]:inline"> {selected.length === 1 ? "client" : "clients"}</span> selected
              {offscreen ? <span className="hidden font-normal text-muted lg:inline"> · {offscreen} not shown</span> : null}
            </>
          )}
        </span>
        <div className="ml-auto flex min-w-0 items-center gap-1 overflow-x-auto no-scrollbar md:ml-3 md:gap-1.5">
          {portal && invitable.length ? (
            <BulkButton icon={Mail} label="Send Portal Invite" disabled={disabled} onClick={() => actions.invite(selected)} />
          ) : null}
          {portal && resendable.length ? (
            <BulkButton icon={RefreshCw} label="Resend Invite" disabled={disabled} onClick={() => actions.resend(selected)} />
          ) : null}
          {portal ? (
            <BulkButton icon={UsersRound} label="Manage Access" chevron disabled={disabled} onClick={(el) => setAccessMenu({ kind: "element", element: el })} />
          ) : null}
          {!showDeleted && permissions.canAddToProjects ? (
            <BulkButton icon={FolderPlus} label="Add to Project" disabled={disabled} onClick={() => actions.addToProject(selected)} />
          ) : null}
          <BulkButton icon={Download} label="Export" disabled={disabled} onClick={() => downloadClientsCsv(selected, permissions.canViewMoney)} />
          {permissions.canEdit ? (
            showDeleted ? (
              <BulkButton icon={Eye} label="Restore" disabled={disabled} onClick={() => actions.restore(selected)} />
            ) : (
              <BulkButton icon={EyeOff} label="Hide" disabled={disabled} onClick={() => actions.hide(selected)} />
            )
          ) : null}
          {permissions.canDelete ? (
            <BulkButton icon={Trash2} label="Delete" tone="danger" disabled={disabled} onClick={() => actions.remove(selected)} />
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClear}
          disabled={disabled}
          aria-label="Clear selection"
          title="Clear selection"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted hover:bg-subtle hover:text-heading disabled:opacity-40"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <ActionMenu
        anchor={accessMenu}
        onClose={() => setAccessMenu(null)}
        title="Manage portal access"
        items={[
          { type: "label", id: "l", label: `${plural(selected.length, "client")} selected` },
          {
            id: "invite",
            label: "Send portal invite",
            icon: Send,
            hint: String(invitable.length),
            disabled: invitable.length === 0,
            description: "Clients who were never invited",
            onSelect: () => actions.invite(selected),
          },
          {
            id: "resend",
            label: "Resend invite",
            icon: RefreshCw,
            hint: String(resendable.length),
            disabled: resendable.length === 0,
            description: "Pending or expired invites",
            onSelect: () => actions.resend(selected),
          },
          {
            id: "reset",
            label: "Send password reset",
            icon: Mail,
            hint: String(activeOnes.length),
            disabled: activeOnes.length === 0,
            description: "Clients with an active portal",
            onSelect: () => actions.passwordReset(selected),
          },
        ]}
      />
    </div>
  );
}

function BulkButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  tone = "default",
  chevron,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: (el: HTMLButtonElement) => void;
  disabled?: boolean;
  tone?: "default" | "danger";
  chevron?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={(e) => onClick(e.currentTarget)}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-9 shrink-0 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-[13px] font-semibold transition-colors disabled:opacity-50 xl:px-3",
        tone === "danger"
          ? "border-red-200 bg-red-50/60 text-red-600 hover:bg-red-50 surface-dark:border-red-500/30 surface-dark:bg-red-500/10 surface-dark:hover:bg-red-500/15"
          : "border-border bg-card text-heading hover:bg-subtle"
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden whitespace-nowrap xl:inline">{label}</span>
      {chevron ? <ChevronDown className="hidden h-3.5 w-3.5 text-muted xl:block" aria-hidden /> : null}
    </button>
  );
}

// ── Table ───────────────────────────────────────────────────────────────────

function SortableHeader({
  label,
  asc,
  desc,
  sort,
  onSort,
  className,
}: {
  label: string;
  asc?: ClientsSort;
  desc: ClientsSort;
  sort: ClientsSort;
  onSort: (s: ClientsSort) => void;
  className?: string;
}) {
  const active = sort === asc || sort === desc;
  const dir = sort === asc ? "asc" : sort === desc ? "desc" : null;
  return (
    <th className={cn("px-3 py-2.5 text-left text-xs font-semibold text-muted", className)} aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}>
      <button
        type="button"
        onClick={() => onSort(active ? (sort === desc && asc ? asc : desc) : asc ?? desc)}
        className={cn("inline-flex items-center gap-1 rounded-md transition-colors hover:text-heading", active && "text-heading")}
      >
        {label}
        {dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" aria-hidden /> : dir === "desc" ? <ArrowDown className="h-3.5 w-3.5" aria-hidden /> : null}
      </button>
    </th>
  );
}

function ClientsTable({
  rows,
  sort,
  onSort,
  selected,
  headerState,
  onTogglePage,
  onToggle,
  activeId,
  onOpen,
  onMenu,
}: {
  rows: ClientWorkspaceRow[];
  sort: ClientsSort;
  onSort: (s: ClientsSort) => void;
  selected: Set<string>;
  headerState: boolean | "mixed";
  onTogglePage: () => void;
  onToggle: (id: string, range: boolean) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
  onMenu: (c: ClientWorkspaceRow, el: HTMLElement) => void;
}) {
  const hydrated = useHydrated();
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_1px_3px_rgba(15,23,42,0.05)]">
      <table className="w-full table-fixed text-sm">
        <thead className="border-b border-border bg-subtle/50">
          <tr>
            <th className="w-11 pl-1.5 pr-0 sm:w-12 sm:pl-2">
              <button
                type="button"
                role="checkbox"
                aria-checked={headerState}
                aria-label={headerState === true ? "Deselect all clients on this page" : "Select all clients on this page"}
                onClick={onTogglePage}
                className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-subtle"
              >
                <CheckMark on={headerState === true} mixed={headerState === "mixed"} />
              </button>
            </th>
            <SortableHeader label="Client" asc="name_asc" desc="name_desc" sort={sort} onSort={onSort} className="w-auto" />
            <th className="hidden w-[18%] px-3 py-2.5 text-left text-xs font-semibold text-muted lg:table-cell">Company</th>
            <th className="hidden w-[150px] px-3 py-2.5 text-left text-xs font-semibold text-muted sm:table-cell">Portal Status</th>
            <SortableHeader label="Last Activity" asc="activity_asc" desc="activity_desc" sort={sort} onSort={onSort} className="hidden w-[130px] md:table-cell" />
            <SortableHeader label="Projects" desc="projects_desc" sort={sort} onSort={onSort} className="hidden w-[96px] sm:table-cell" />
            <th className="w-12 px-2" aria-label="Actions" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((c) => {
            const isSelected = selected.has(c.id);
            const isActive = activeId === c.id;
            const lastSeen = hydrated ? formatLastSeen(c.last_seen_at) : null;
            return (
              <tr
                key={c.id}
                onClick={() => onOpen(c.id)}
                aria-selected={isSelected}
                className={cn(
                  "group cursor-pointer transition-colors",
                  isSelected ? "bg-accent/[0.06] hover:bg-accent/[0.09]" : isActive ? "bg-subtle/70" : "hover:bg-subtle/50"
                )}
              >
                <td className={cn("relative pl-1.5 pr-0 sm:pl-2", isActive && "before:absolute before:inset-y-1.5 before:left-0 before:w-[3px] before:rounded-full before:bg-accent")} onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select ${c.name}`}
                    onClick={(e) => onToggle(c.id, e.shiftKey)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <CheckMark on={isSelected} />
                  </button>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <ClientAvatar name={c.name} email={c.email} />
                    <div className="min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpen(c.id);
                        }}
                        className="block max-w-full truncate text-left font-semibold text-heading hover:text-accent"
                      >
                        {c.name}
                      </button>
                      <p className="truncate text-xs text-muted" title={c.email}>
                        {c.email || "No email"}
                      </p>
                      <div className="mt-1 sm:hidden">
                        <PortalStatusBadge status={c.portal_status} size="sm" />
                      </div>
                    </div>
                  </div>
                </td>
                <td className="hidden truncate px-3 py-2.5 text-heading lg:table-cell" title={c.company ?? undefined}>
                  {c.company || <span className="text-muted">—</span>}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell">
                  <PortalStatusBadge status={c.portal_status} />
                </td>
                <td className="hidden truncate px-3 py-2.5 text-heading md:table-cell" title={hydrated && c.last_seen_at ? new Date(c.last_seen_at).toLocaleString() : undefined}>
                  {!hydrated ? null : lastSeen ?? <span className="text-muted">—</span>}
                </td>
                <td className="hidden px-3 py-2.5 sm:table-cell" onClick={(e) => e.stopPropagation()}>
                  {c.total_projects > 0 ? (
                    <button
                      type="button"
                      onClick={() => onOpen(c.id)}
                      title={`View ${plural(c.total_projects, "project")}`}
                      aria-label={`View ${c.name}’s ${plural(c.total_projects, "project")}`}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-sm font-semibold tabular-nums text-heading transition-colors hover:border-accent/40 hover:text-accent"
                    >
                      <FolderOpen className="h-4 w-4" aria-hidden />
                      {c.total_projects}
                    </button>
                  ) : (
                    <span className="pl-3 text-muted">—</span>
                  )}
                </td>
                <td className="px-2 py-2.5" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={(e) => onMenu(c, e.currentTarget)}
                    aria-label={`Actions for ${c.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-accent transition-colors hover:bg-accent-subtle"
                  >
                    <MoreHorizontal className="h-5 w-5" aria-hidden />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ── Grid ────────────────────────────────────────────────────────────────────

function ClientsGrid({
  rows,
  selected,
  onToggle,
  activeId,
  onOpen,
  onMenu,
}: {
  rows: ClientWorkspaceRow[];
  selected: Set<string>;
  onToggle: (id: string, range: boolean) => void;
  activeId: string | null;
  onOpen: (id: string) => void;
  onMenu: (c: ClientWorkspaceRow, el: HTMLElement) => void;
}) {
  const hydrated = useHydrated();
  return (
    <ul className="grid grid-cols-1 gap-3 min-[560px]:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
      {rows.map((c) => {
        const isSelected = selected.has(c.id);
        const lastSeen = hydrated ? formatLastSeen(c.last_seen_at) : null;
        return (
          <li key={c.id}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => onOpen(c.id)}
              onKeyDown={(e) => {
                if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onOpen(c.id);
                }
              }}
              className={cn(
                "group relative flex h-full cursor-pointer flex-col rounded-2xl border bg-card p-4 shadow-[0_1px_3px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-px hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
                isSelected ? "border-accent/50 bg-accent/[0.04]" : activeId === c.id ? "border-accent/40" : "border-border"
              )}
            >
              <div className="flex items-start gap-3">
                <ClientAvatar name={c.name} email={c.email} size="md" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-heading">{c.name}</p>
                  <p className="truncate text-xs text-muted">{c.email || "No email"}</p>
                  <p className="mt-0.5 truncate text-xs text-heading">{c.company || <span className="text-muted">No company</span>}</p>
                </div>
                <div className="-mr-1.5 -mt-1.5 flex items-center" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={isSelected}
                    aria-label={`Select ${c.name}`}
                    onClick={(e) => onToggle(c.id, e.shiftKey)}
                    className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-subtle"
                  >
                    <CheckMark on={isSelected} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => onMenu(c, e.currentTarget)}
                    aria-label={`Actions for ${c.name}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-accent hover:bg-accent-subtle"
                  >
                    <MoreHorizontal className="h-5 w-5" aria-hidden />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between gap-2 border-t border-border pt-3">
                <PortalStatusBadge status={c.portal_status} size="sm" />
                <div className="flex items-center gap-3 text-xs text-muted">
                  <span title="Last activity">{hydrated ? lastSeen ?? "No activity" : null}</span>
                  <span className="inline-flex items-center gap-1 font-semibold text-heading" title="Projects">
                    <FolderOpen className="h-3.5 w-3.5 text-muted" aria-hidden />
                    {c.total_projects}
                  </span>
                </div>
              </div>
              {c.outstanding_balance > 0 ? (
                <p className="mt-2 text-xs font-medium text-amber-700 surface-dark:text-amber-300">{formatCurrency(c.outstanding_balance)} outstanding</p>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Pagination ──────────────────────────────────────────────────────────────

function pageWindow(page: number, count: number): (number | "…")[] {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(count - 1, page + 1);
  if (start > 2) out.push("…");
  for (let p = start; p <= end; p++) out.push(p);
  if (end < count - 1) out.push("…");
  out.push(count);
  return out;
}

function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPage,
  onPageSize,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPage: (p: number) => void;
  onPageSize: (n: number) => void;
}) {
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pb-20 pt-1 md:pb-2">
      <p className="text-sm text-muted">
        Showing <span className="font-medium text-heading tabular-nums">{from.toLocaleString()}–{to.toLocaleString()}</span> of{" "}
        <span className="font-medium text-heading tabular-nums">{total.toLocaleString()}</span> {total === 1 ? "client" : "clients"}
      </p>
      {pageCount > 1 ? (
        <nav aria-label="Pagination" className="order-3 flex w-full items-center justify-center gap-1 sm:order-none sm:w-auto">
          <button
            type="button"
            onClick={() => onPage(page - 1)}
            disabled={page <= 1}
            aria-label="Previous page"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-heading hover:bg-subtle disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </button>
          {pageWindow(page, pageCount).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="w-6 text-center text-sm text-muted">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                className={cn(
                  "h-9 min-w-9 rounded-lg px-2 text-sm font-semibold tabular-nums transition-colors",
                  p === page ? "bg-accent text-accent-foreground shadow-sm" : "text-heading hover:bg-subtle"
                )}
              >
                {p}
              </button>
            )
          )}
          <button
            type="button"
            onClick={() => onPage(page + 1)}
            disabled={page >= pageCount}
            aria-label="Next page"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-heading hover:bg-subtle disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" aria-hidden />
          </button>
        </nav>
      ) : null}
      <label className="flex items-center gap-2 text-sm text-muted">
        Rows per page
        <span className="relative">
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-9 appearance-none rounded-lg border border-border bg-card pl-3 pr-8 text-sm font-semibold text-heading focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
          >
            {PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden />
        </span>
      </label>
    </div>
  );
}
