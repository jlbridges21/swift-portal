"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowRight,
  Building2,
  Copy,
  FolderOpen,
  FolderPlus,
  Mail,
  MessageSquare,
  MoreHorizontal,
  Phone,
  RotateCw,
  Send,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import { ActionMenu, type ActionMenuAnchor, type ActionMenuItem } from "@/components/ui/action-menu";
import { StatusBadge } from "@/components/ui/badge";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import type { ClientProfileView } from "@/lib/client-profile-view";
import { formatLastSeen, formatShortDate, type ClientWorkspaceRow } from "@/lib/clients-workspace";
import { normalizeStatus } from "@/lib/constants";
import { formatCurrency, cn } from "@/lib/utils";
import { ClientAvatar, PortalStatusBadge } from "./clients-ui";
import type { ClientActions, ClientsPermissions } from "./clients-actions";

type Loaded =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; view: ClientProfileView };

/** Profiles fetched this session — reopening a client is instant; refreshed in the background. */
const profileCache = new Map<string, ClientProfileView>();

export function ClientDetailPanel({
  client,
  permissions,
  actions,
  menuItems,
  onClose,
  onOpenProfile,
  refreshKey,
}: {
  client: ClientWorkspaceRow;
  permissions: ClientsPermissions;
  actions: ClientActions;
  menuItems: (c: ClientWorkspaceRow) => ActionMenuItem[];
  onClose: () => void;
  onOpenProfile: (id: string) => void;
  /** Changes when the list data refreshes, so the projects card reloads too. */
  refreshKey: string;
}) {
  const [loaded, setLoaded] = useState<Loaded>(() => {
    const cached = profileCache.get(client.id);
    return cached ? { status: "ready", view: cached } : { status: "loading" };
  });
  const [attempt, setAttempt] = useState(0);
  const [menu, setMenu] = useState<ActionMenuAnchor | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const cached = profileCache.get(client.id);
    setLoaded(cached ? { status: "ready", view: cached } : { status: "loading" });
    scrollRef.current?.scrollTo({ top: 0 });
    const controller = new AbortController();
    fetch(`/api/admin/clients/${encodeURIComponent(client.id)}/profile`, {
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "This client isn’t available." : "Couldn’t load projects.");
        const view = (await res.json()) as ClientProfileView;
        profileCache.set(client.id, view);
        setLoaded({ status: "ready", view });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        if (!profileCache.has(client.id)) {
          setLoaded({ status: "error", message: err instanceof Error ? err.message : "Couldn’t load projects." });
        }
      });
    return () => controller.abort();
  }, [client.id, attempt, refreshKey]);

  // Escape closes (unless a dialog is open on top).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]')) return;
      onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const hidden = Boolean(client.deleted_at);
  const projects = loaded.status === "ready" ? loaded.view.data.projects : [];
  const covers = loaded.status === "ready" ? loaded.view.projectCovers : {};
  const lastSeen = formatLastSeen(client.last_seen_at);

  async function copy(value: string, what: string) {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`${what} copied`);
    } catch {
      toast.error(`Couldn’t copy — select the ${what.toLowerCase()} and copy it manually.`);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="relative shrink-0 px-5 pb-4 pt-[max(1.25rem,env(safe-area-inset-top))] xl:pt-5">
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close client details"
          className="absolute right-3 top-[max(0.75rem,env(safe-area-inset-top))] flex h-10 w-10 items-center justify-center rounded-xl text-muted transition-colors hover:bg-subtle hover:text-heading"
        >
          <X className="h-5 w-5" aria-hidden />
        </button>
        <div className="flex items-center gap-3.5 pr-10">
          <ClientAvatar name={client.name} email={client.email} size="lg" />
          <div className="min-w-0">
            <h2 id="client-panel-title" className="truncate text-lg font-bold leading-tight text-heading">
              {client.name}
            </h2>
            {client.company ? <p className="truncate text-sm text-muted">{client.company}</p> : null}
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <PortalStatusBadge status={client.portal_status} size="sm" />
              {hidden ? (
                <span className="inline-flex h-6 items-center rounded-lg bg-subtle px-2 text-xs font-medium text-muted ring-1 ring-inset ring-border">
                  Hidden
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Quick actions */}
        <div className="mt-4 space-y-2">
          {permissions.canMessage && !hidden ? (
            <Link
              href={`/admin/messages?client=${encodeURIComponent(client.id)}`}
              className="flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-semibold text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
            >
              <MessageSquare className="h-4 w-4" aria-hidden /> Message
            </Link>
          ) : null}
          <div className="flex gap-2">
            {permissions.canAddToProjects && !hidden ? (
              <QuickAction icon={FolderPlus} label="Add to Project" onClick={() => actions.addToProject([client])} />
            ) : null}
            {permissions.canManagePortal && !hidden ? (
              <QuickAction icon={UsersRound} label="Manage Access" onClick={() => actions.manageAccess(client)} />
            ) : null}
            <button
              type="button"
              onClick={(e) => setMenu({ kind: "element", element: e.currentTarget })}
              aria-label="More actions"
              title="More actions"
              className="flex h-[3.75rem] w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-card text-heading transition-colors hover:bg-subtle"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
        {/* Portal access */}
        <PanelCard title="Portal Access">
          <PortalAccessBody client={client} permissions={permissions} actions={actions} />
        </PanelCard>

        {/* Contact */}
        <PanelCard title="Contact Information">
          <ul className="space-y-1">
            {client.email ? (
              <ContactRow icon={Mail} href={`mailto:${client.email}`} value={client.email} onCopy={() => copy(client.email, "Email")} />
            ) : (
              <li className="text-sm text-muted">No email on file</li>
            )}
            {client.phone ? (
              <ContactRow icon={Phone} href={`tel:${client.phone.replace(/[^\d+]/g, "")}`} value={client.phone} onCopy={() => copy(client.phone!, "Phone number")} />
            ) : null}
            {client.company ? <ContactRow icon={Building2} value={client.company} /> : null}
          </ul>
          <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border pt-3 text-xs">
            <div>
              <dt className="text-muted">Client since</dt>
              <dd className="font-medium text-heading">{formatShortDate(client.created_at)}</dd>
            </div>
            <div>
              <dt className="text-muted">Last activity</dt>
              <dd className="font-medium text-heading">{lastSeen ?? "None yet"}</dd>
            </div>
            {client.referral_source ? (
              <div className="col-span-2">
                <dt className="text-muted">Referral source</dt>
                <dd className="truncate font-medium text-heading">{client.referral_source}</dd>
              </div>
            ) : null}
            {permissions.canViewMoney ? (
              <>
                <div>
                  <dt className="text-muted">Lifetime revenue</dt>
                  <dd className="font-medium tabular-nums text-heading">{formatCurrency(client.lifetime_revenue)}</dd>
                </div>
                <div>
                  <dt className="text-muted">Outstanding</dt>
                  <dd className={cn("font-medium tabular-nums", client.outstanding_balance > 0 ? "text-amber-700 surface-dark:text-amber-300" : "text-heading")}>
                    {client.outstanding_balance > 0 ? formatCurrency(client.outstanding_balance) : "—"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>
        </PanelCard>

        {/* Projects */}
        <PanelCard
          title={`Projects (${loaded.status === "ready" ? projects.length : client.total_projects})`}
          action={
            projects.length > 0 ? (
              <button
                type="button"
                onClick={() => onOpenProfile(client.id)}
                className="inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs font-semibold text-accent hover:bg-accent-subtle"
              >
                View All <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null
          }
        >
          {loaded.status === "loading" ? (
            <div className="space-y-2" aria-busy="true" aria-label="Loading projects">
              {Array.from({ length: Math.min(Math.max(client.total_projects, 1), 3) }, (_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="h-9 w-12 animate-pulse rounded-lg bg-slate-200/70 surface-dark:bg-border/70" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-slate-200/70 surface-dark:bg-border/70" />
                </div>
              ))}
            </div>
          ) : loaded.status === "error" ? (
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-muted">{loaded.message}</span>
              <button type="button" onClick={() => setAttempt((n) => n + 1)} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-subtle">
                <RotateCw className="h-3.5 w-3.5" aria-hidden /> Retry
              </button>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-start gap-2 text-sm text-muted">
              <p>No projects yet.</p>
              {permissions.canCreateProject && !hidden ? (
                <Link
                  href={`/admin/projects/new?client=${encodeURIComponent(client.id)}`}
                  className="inline-flex items-center gap-1 text-sm font-semibold text-accent hover:underline"
                >
                  <FolderPlus className="h-4 w-4" aria-hidden /> Create a project
                </Link>
              ) : null}
            </div>
          ) : (
            <ul className="-mx-1.5 space-y-0.5">
              {projects.slice(0, 5).map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/admin/projects/${p.id}`}
                    className="flex items-center gap-3 rounded-xl px-1.5 py-1.5 transition-colors hover:bg-subtle"
                  >
                    <ProjectCoverImage src={covers[p.id]} sizes="56px" className="h-9 w-12 shrink-0 rounded-lg" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-heading">{p.project_name || "Untitled project"}</span>
                      {p.property_address && p.property_address !== p.project_name ? (
                        <span className="block truncate text-xs text-muted">{p.property_address}</span>
                      ) : null}
                    </span>
                    <StatusBadge status={normalizeStatus(p.status)} className="shrink-0 text-[11px]" />
                  </Link>
                </li>
              ))}
              {projects.length > 5 ? (
                <li>
                  <button
                    type="button"
                    onClick={() => onOpenProfile(client.id)}
                    className="w-full rounded-xl px-1.5 py-2 text-left text-xs font-semibold text-accent hover:bg-accent-subtle"
                  >
                    + {projects.length - 5} more
                  </button>
                </li>
              ) : null}
            </ul>
          )}
        </PanelCard>

        <button
          type="button"
          onClick={() => onOpenProfile(client.id)}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm font-semibold text-heading transition-colors hover:bg-subtle"
        >
          <UserRound className="h-4 w-4 text-muted" aria-hidden /> View Full Profile
        </button>
        <p className="px-1 text-center text-xs text-muted">Payments, notes, properties and full history live in the profile.</p>
      </div>

      <ActionMenu anchor={menu} onClose={() => setMenu(null)} title={client.name} items={menuItems(client)} />
    </div>
  );
}

function QuickAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[3.75rem] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-xl border border-border bg-card px-2 text-xs font-medium text-heading transition-colors hover:border-accent/30 hover:bg-accent-subtle/50"
    >
      <Icon className="h-[18px] w-[18px]" aria-hidden />
      <span className="truncate">{label}</span>
    </button>
  );
}

function PanelCard({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-heading">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

function ContactRow({
  icon: Icon,
  value,
  href,
  onCopy,
}: {
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  href?: string;
  onCopy?: () => void;
}) {
  return (
    <li className="group flex items-center gap-2.5">
      <Icon className="h-4 w-4 shrink-0 text-muted" aria-hidden />
      {href ? (
        <a href={href} className="min-w-0 flex-1 truncate py-1 text-sm text-heading hover:text-accent hover:underline">
          {value}
        </a>
      ) : (
        <span className="min-w-0 flex-1 truncate py-1 text-sm text-heading">{value}</span>
      )}
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          aria-label={`Copy ${value}`}
          title="Copy"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted opacity-100 transition hover:bg-subtle hover:text-heading sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        >
          <Copy className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </li>
  );
}

function PortalAccessBody({
  client,
  permissions,
  actions,
}: {
  client: ClientWorkspaceRow;
  permissions: ClientsPermissions;
  actions: ClientActions;
}) {
  const hidden = Boolean(client.deleted_at);
  const canAct = permissions.canManagePortal && !hidden && !actions.disabled;
  const sent = formatShortDate(client.invite_sent_at);
  const activated = formatShortDate(client.activated_at);

  const line = (tone: string, Icon: React.ComponentType<{ className?: string }>, title: string, sub: string | null) => (
    <div className="flex items-start gap-2.5">
      <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", tone)}>
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-heading">{title}</p>
        {sub ? <p className="text-xs text-muted">{sub}</p> : null}
      </div>
    </div>
  );

  const button = (label: string, Icon: React.ComponentType<{ className?: string }>, onClick: () => void, primary = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={!canAct}
      className={cn(
        "mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50",
        primary
          ? "bg-accent text-accent-foreground shadow-sm hover:opacity-90"
          : "border border-border bg-card text-heading hover:bg-subtle"
      )}
    >
      <Icon className="h-4 w-4" aria-hidden />
      {label}
    </button>
  );

  switch (client.portal_status) {
    case "active":
      return (
        <>
          {line(
            "bg-emerald-100 text-emerald-700 surface-dark:bg-emerald-500/15 surface-dark:text-emerald-300",
            ShieldCheck,
            "Portal Active",
            activated ? `Activated on ${activated}` : "They can sign in to their portal."
          )}
          {permissions.canManagePortal && !hidden ? button("Manage Access", ArrowRight, () => actions.manageAccess(client)) : null}
        </>
      );
    case "invite_sent":
      return (
        <>
          {line(
            "bg-amber-100 text-amber-700 surface-dark:bg-amber-500/15 surface-dark:text-amber-300",
            Mail,
            "Invite Sent",
            sent ? `Sent ${sent} · waiting for them to accept` : "Waiting for them to accept."
          )}
          {permissions.canManagePortal && !hidden ? (
            <div className="flex gap-2">
              <div className="flex-1">{button("Resend Invite", Send, () => actions.resend([client]))}</div>
              <div className="flex-1">{button("Manage", UsersRound, () => actions.manageAccess(client))}</div>
            </div>
          ) : null}
        </>
      );
    case "invite_expired":
      return (
        <>
          {line(
            "bg-orange-100 text-orange-700 surface-dark:bg-orange-500/15 surface-dark:text-orange-300",
            Mail,
            "Invite Expired",
            sent ? `Sent ${sent} · the link has expired` : "The invite link has expired."
          )}
          {permissions.canManagePortal && !hidden ? button("Resend Invite", Send, () => actions.resend([client]), true) : null}
        </>
      );
    case "unavailable":
      return line(
        "bg-slate-100 text-slate-500 surface-dark:bg-subtle surface-dark:text-muted",
        UsersRound,
        "Can’t be invited here",
        "This email’s portal login belongs to another business."
      );
    default:
      return (
        <>
          {line(
            "bg-slate-100 text-slate-500 surface-dark:bg-subtle surface-dark:text-muted",
            FolderOpen,
            "Not Invited",
            client.email ? "They don’t have portal access yet." : "Add an email address to invite them."
          )}
          {permissions.canManagePortal && !hidden && client.email
            ? button("Send Portal Invite", Send, () => actions.invite([client]), true)
            : null}
        </>
      );
  }
}
