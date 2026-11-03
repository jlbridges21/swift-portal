"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Calendar,
  Columns3,
  Filter,
  List,
  Mail,
  MoreHorizontal,
  Phone,
  Plus,
  User,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { ClientSidebar } from "@/components/admin/client-view/client-sidebar";
import { ClientViewBoard } from "@/components/admin/client-view/client-view-board";
import { ClientViewList } from "@/components/admin/client-view/client-view-list";
import { ClientViewCalendar } from "@/components/admin/client-view/client-view-calendar";
import {
  ClientProfileModalProvider,
  useOpenClientProfile,
} from "@/components/admin/client-view/client-profile-modal";
import {
  useProjectStageMove,
  type ClientViewProjectRow,
} from "@/components/admin/client-view/client-view-shared";
import {
  ALL_CLIENTS,
  CLIENT_VIEW_SORTS,
  countProjectsByClient,
  filterProjectsByClient,
  filterProjectsByService,
  sortClientViewProjects,
  type ClientViewClient,
  type ClientViewSort,
} from "@/lib/client-view";
import type { ClientViewData } from "@/lib/client-view-data";
import type { PipelineStageParam } from "@/lib/admin-project-pipeline";
import { cn } from "@/lib/utils";

export interface ClientViewPermissions {
  canCreateProject: boolean;
  canCreateClient: boolean;
  /** Clients area — client profile links + contact details. */
  canOpenClients: boolean;
  canOpenCalendar: boolean;
}

type Tab = "pipeline" | "list" | "calendar";

const TABS: { value: Tab; label: string; icon: typeof List }[] = [
  { value: "pipeline", label: "Pipeline", icon: Columns3 },
  { value: "list", label: "List", icon: List },
  { value: "calendar", label: "Calendar", icon: Calendar },
];

/** Per-tab-session conveniences (selected client, tab, sort). */
const SESSION_KEY = "admin.projects.clientView";

function readSession(): { client?: string; tab?: Tab; sort?: ClientViewSort } {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as { client?: string; tab?: Tab; sort?: ClientViewSort }) : {};
  } catch {
    return {};
  }
}

function writeSession(value: { client: string; tab: Tab; sort: ClientViewSort }) {
  try {
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(value));
  } catch {
    // private mode / quota — preference just isn't remembered
  }
}

export function ClientView({
  projects: baseProjects,
  data,
  permissions,
  stage,
  stageLabel,
}: {
  /** Pipeline projects after staff visibility + "Filter by staff". */
  projects: ClientViewProjectRow[];
  /** null while the first refresh after turning Client View on is in flight. */
  data: ClientViewData | null;
  permissions: ClientViewPermissions;
  stage?: PipelineStageParam | null;
  stageLabel?: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string>(ALL_CLIENTS);
  const [tab, setTab] = useState<Tab>("pipeline");
  const [sort, setSort] = useState<ClientViewSort>("updated");
  const [services, setServices] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [addedClients, setAddedClients] = useState<ClientViewClient[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const { moveProject, projects } = useProjectStageMove(baseProjects);

  useEffect(() => {
    const saved = readSession();
    if (saved.client) setSelectedId(saved.client);
    if (saved.tab && TABS.some((t) => t.value === saved.tab)) setTab(saved.tab);
    if (saved.sort && CLIENT_VIEW_SORTS.some((s) => s.value === saved.sort)) setSort(saved.sort);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeSession({ client: selectedId, tab, sort });
  }, [hydrated, selectedId, tab, sort]);

  const clients = useMemo(() => {
    const list = [...(data?.clients ?? [])];
    for (const c of addedClients) if (!list.some((x) => x.id === c.id)) list.push(c);
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [data?.clients, addedClients]);

  const projectClientIds = useMemo(() => data?.projectClientIds ?? {}, [data?.projectClientIds]);
  const counts = useMemo(() => countProjectsByClient(projects, projectClientIds), [projects, projectClientIds]);

  // A remembered client that no longer exists (or isn't visible) → All Clients.
  const selectedClient = clients.find((c) => c.id === selectedId) ?? null;
  const effectiveId = data && !selectedClient ? ALL_CLIENTS : selectedId;
  const isAll = effectiveId === ALL_CLIENTS;

  const clientProjects = filterProjectsByClient(projects, effectiveId, projectClientIds);
  const serviceOptions = [...new Set(clientProjects.map((p) => p.service_type).filter(Boolean))].sort();
  const activeServices = services.filter((s) => serviceOptions.includes(s));
  const shown = sortClientViewProjects(filterProjectsByService(clientProjects, activeServices), sort);

  function selectClient(id: string) {
    setSelectedId(id);
    setServices([]);
  }

  if (!data) return <ClientViewSkeleton />;

  return (
    <ClientProfileModalProvider>
      <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]">
        <ClientSidebar
          clients={clients}
          counts={counts}
          selectedId={effectiveId}
          onSelect={selectClient}
          canCreateClient={permissions.canCreateClient}
          onClientCreated={(client) => {
            setAddedClients((prev) => [
              ...prev,
              {
                id: client.id,
                name: client.name,
                company: client.company ?? null,
                email: permissions.canOpenClients ? client.email ?? null : null,
                phone: permissions.canOpenClients ? client.phone ?? null : null,
              },
            ]);
            selectClient(client.id);
            router.refresh();
          }}
        />

        <section className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
          {isAll || !selectedClient ? (
            <AllClientsHeader projectCount={clientProjects.length} clientCount={clients.length} />
          ) : (
            <ClientHeader
              client={selectedClient}
              projectCount={clientProjects.length}
              permissions={permissions}
            />
          )}

          {stage && stageLabel ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
              <span className="font-medium text-heading">Showing: {stageLabel}</span>
              <Link href="/admin/projects" className="inline-flex items-center gap-1 text-xs text-muted hover:text-heading">
                <X className="h-3.5 w-3.5" /> Clear filter
              </Link>
            </div>
          ) : null}

          <div className="mt-4 flex flex-col gap-3 border-y border-border py-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Project views" className="-mx-1 flex gap-1 overflow-x-auto px-1">
              {TABS.map(({ value, label, icon: Icon }) => (
                <button
                  key={value}
                  type="button"
                  role="tab"
                  aria-selected={tab === value}
                  onClick={() => setTab(value)}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
                    tab === value ? "bg-accent-subtle text-accent" : "text-muted hover:bg-slate-50 hover:text-heading surface-dark:hover:bg-subtle"
                  )}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="relative">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setFilterOpen((o) => !o)}
                  aria-expanded={filterOpen}
                  className={cn(activeServices.length > 0 && "border-accent text-accent")}
                >
                  <Filter className="h-3.5 w-3.5" />
                  Filter
                  {activeServices.length > 0 ? (
                    <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-foreground">
                      {activeServices.length}
                    </span>
                  ) : null}
                </Button>
                {filterOpen ? (
                  <>
                    <button
                      type="button"
                      aria-label="Close filter"
                      className="fixed inset-0 z-20 cursor-default"
                      onClick={() => setFilterOpen(false)}
                    />
                    <div className="absolute right-0 z-30 mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-3 shadow-lg">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs font-semibold text-heading">Package / service</p>
                        {activeServices.length > 0 ? (
                          <button type="button" onClick={() => setServices([])} className="text-xs text-accent hover:underline">
                            Clear
                          </button>
                        ) : null}
                      </div>
                      {serviceOptions.length === 0 ? (
                        <p className="py-2 text-xs text-muted">No packages on these projects yet.</p>
                      ) : (
                        <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                          {serviceOptions.map((service) => (
                            <li key={service}>
                              <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50 surface-dark:hover:bg-subtle">
                                <input
                                  type="checkbox"
                                  checked={activeServices.includes(service)}
                                  onChange={() =>
                                    setServices((prev) =>
                                      prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
                                    )
                                  }
                                />
                                <span className="truncate">{service}</span>
                              </label>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              <label className="relative inline-flex h-8 items-center rounded-md border border-border bg-card text-xs font-medium text-foreground hover:bg-accent-subtle">
                <ArrowUpDown className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-muted" aria-hidden />
                <span className="sr-only">Sort projects</span>
                <select
                  value={sort}
                  onChange={(e) => setSort(e.target.value as ClientViewSort)}
                  className="h-full cursor-pointer appearance-none rounded-md bg-transparent pl-8 pr-3 outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {CLIENT_VIEW_SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      Sort: {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="pt-4">
            {tab === "pipeline" ? (
              <ClientViewBoard
                projects={shown}
                heroUrls={data.heroUrls}
                showClientName={isAll}
                canOpenClients={permissions.canOpenClients}
                onMove={moveProject}
              />
            ) : tab === "list" ? (
              <ClientViewList
                projects={shown}
                heroUrls={data.heroUrls}
                showClientName={isAll}
                canOpenClients={permissions.canOpenClients}
                onMove={moveProject}
              />
            ) : (
              <ClientViewCalendar
                projects={shown}
                heroUrls={data.heroUrls}
                showClientName={isAll}
                canOpenCalendar={permissions.canOpenCalendar}
              />
            )}
          </div>
        </section>
      </div>
    </ClientProfileModalProvider>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function AllClientsHeader({ projectCount, clientCount }: { projectCount: number; clientCount: number }) {
  return (
    <div className="flex items-center gap-4">
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-subtle text-accent sm:h-14 sm:w-14">
        <Users className="h-6 w-6" aria-hidden />
      </div>
      <div className="min-w-0">
        <h2 className="text-xl font-bold text-heading sm:text-2xl">All Clients</h2>
        <p className="text-sm text-muted">
          {projectCount} project{projectCount === 1 ? "" : "s"} across {clientCount} client
          {clientCount === 1 ? "" : "s"}
        </p>
      </div>
    </div>
  );
}

function ClientHeader({
  client,
  projectCount,
  permissions,
}: {
  client: ClientViewClient;
  projectCount: number;
  permissions: ClientViewPermissions;
}) {
  const router = useRouter();
  const openClientProfile = useOpenClientProfile();
  const [anchor, setAnchor] = useState<ActionMenuAnchor | null>(null);

  const menuItems: ActionMenuItem[] = [];
  if (permissions.canOpenClients) {
    menuItems.push({
      id: "profile",
      label: "View client profile",
      icon: User,
      onSelect: () =>
        openClientProfile ? openClientProfile(client.id) : router.push(`/admin/clients/${client.id}`),
    });
  }
  if (client.email) {
    menuItems.push({
      id: "email",
      label: "Email client",
      icon: Mail,
      onSelect: () => {
        window.location.href = `mailto:${client.email}`;
      },
    });
  }
  if (client.phone) {
    menuItems.push({
      id: "call",
      label: "Call client",
      icon: Phone,
      onSelect: () => {
        window.location.href = `tel:${client.phone}`;
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-base font-semibold text-heading surface-dark:bg-subtle sm:h-14 sm:w-14">
          {initials(client.name)}
        </div>
        <div className="min-w-0">
          <h2 className="truncate text-xl font-bold text-heading sm:text-2xl">{client.name}</h2>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm text-muted">
            <span>
              {projectCount} Project{projectCount === 1 ? "" : "s"}
            </span>
            {client.company && client.company !== client.name ? (
              <>
                <span aria-hidden>•</span>
                <span className="truncate">{client.company}</span>
              </>
            ) : null}
            {client.email ? (
              <>
                <span aria-hidden>•</span>
                <a href={`mailto:${client.email}`} className="truncate hover:text-accent">
                  {client.email}
                </a>
              </>
            ) : null}
            {client.phone ? (
              <>
                <span aria-hidden>•</span>
                <a href={`tel:${client.phone}`} className="whitespace-nowrap hover:text-accent">
                  {client.phone}
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {menuItems.length > 0 ? (
          <>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10"
              aria-label={`More for ${client.name}`}
              aria-haspopup="menu"
              onClick={(e) => setAnchor({ kind: "element", element: e.currentTarget })}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
            <ActionMenu anchor={anchor} onClose={() => setAnchor(null)} items={menuItems} title={client.name} />
          </>
        ) : null}
        {permissions.canCreateProject ? (
          <Link href={`/admin/projects/new?client=${encodeURIComponent(client.id)}`} className="flex-1 sm:flex-none">
            <Button variant="accent" className="w-full">
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ClientViewSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)] xl:grid-cols-[17rem_minmax(0,1fr)]" aria-busy="true" aria-label="Loading Client View">
      <div className="space-y-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
        <Skeleton className="h-6 w-24" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
      <div className="min-w-0 space-y-4 rounded-2xl border border-border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <Skeleton className="h-14 w-14 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-3 overflow-hidden">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-80 w-[17rem] shrink-0 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
