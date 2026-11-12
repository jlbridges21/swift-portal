"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight, CalendarDays, CheckCircle2, CreditCard, FileText, FolderOpen, MapPin, Plus, Sparkles,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CoverPlaceholder } from "@/components/projects/cover-placeholder";
import { ActivityFeed } from "@/components/admin/activity-feed";
import { PortalCard, PortalTopBar } from "@/components/client-portal/portal-ui";
import type { ActivityLog } from "@/lib/types";
import { cn, formatCurrency } from "@/lib/utils";

export type PortalHomeProject = {
  id: string;
  name: string;
  address: string;
  serviceType: string | null;
  status: string;
  delivered: boolean;
  coverUrl: string | null;
  /** Open payment links on this project (visible payments only). */
  dueCents: number;
  /** Open optional Marketing Kit add-on charges (never shown as "due"). */
  optionalDueCents: number;
  /** A shared proposal waits for approval. */
  estimateAwaiting: { title: string; priceCents: number | null } | null;
  nextStepTitle: string | null;
  dateLabel: string | null;
  updatedAt: string;
};

type Filter = "all" | "active" | "delivered";

/** New-experience "My Projects": every project this client can open, as clickable cover cards. */
export function ClientPortalHome({
  firstName,
  businessName,
  userName,
  userAvatar,
  isSharedViewer,
  projects,
  activities,
}: {
  firstName: string;
  businessName: string;
  userName: string | null;
  userAvatar: string | null;
  isSharedViewer: boolean;
  projects: PortalHomeProject[];
  activities: (ActivityLog & { projects?: { id: string; project_name: string } | null })[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const activeCount = projects.filter((p) => !p.delivered).length;
  const deliveredCount = projects.length - activeCount;
  const attention = useMemo(
    () => projects.filter((p) => p.dueCents > 0 || p.estimateAwaiting || p.optionalDueCents > 0),
    [projects]
  );
  const shown = projects.filter((p) => (filter === "all" ? true : filter === "active" ? !p.delivered : p.delivered));

  return (
    <div className="min-h-screen bg-slate-50 surface-dark:bg-background">
      <PortalTopBar userName={userName} userAvatar={userAvatar} />
      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-accent">{businessName}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-heading sm:text-3xl">My Projects</h1>
            <p className="mt-1 text-sm text-muted sm:text-base">
              Welcome back, {firstName}.{" "}
              {projects.length
                ? `You have ${projects.length} project${projects.length === 1 ? "" : "s"}${activeCount ? ` · ${activeCount} active` : ""}.`
                : ""}
            </p>
          </div>
          {!isSharedViewer ? (
            <Link href="/dashboard/request" className={cn(buttonVariants({ variant: "accent" }), "min-h-11 w-full sm:w-auto")}>
              <Plus className="h-4 w-4" /> Request New Project
            </Link>
          ) : null}
        </div>

        {attention.length > 0 && !isSharedViewer ? (
          <section aria-label="Needs your attention" className="mt-6 space-y-2">
            {attention.map((p) => (
              <Link
                key={`attn-${p.id}`}
                href={`/dashboard/projects/${p.id}?tab=pay`}
                className={cn(
                  "flex flex-col gap-3 rounded-2xl border p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center",
                  p.dueCents > 0
                    ? "border-red-200 bg-gradient-to-r from-red-50 to-white surface-dark:from-card surface-dark:to-card"
                    : "border-accent/25 bg-gradient-to-r from-accent-subtle to-white surface-dark:from-card surface-dark:to-card"
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                      p.dueCents > 0 ? "bg-red-100 text-red-600" : "bg-accent/15 text-accent"
                    )}
                  >
                    {p.dueCents > 0 ? <CreditCard className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold text-heading">
                      {p.dueCents > 0
                        ? `${formatCurrency(p.dueCents)} due`
                        : p.estimateAwaiting
                          ? "Estimate ready for review"
                          : `Marketing Kit checkout · ${formatCurrency(p.optionalDueCents)}`}
                    </p>
                    <p className="truncate text-sm text-muted">
                      {p.name}
                      {p.dueCents <= 0 && p.estimateAwaiting?.priceCents != null ? ` · ${formatCurrency(p.estimateAwaiting.priceCents)}` : ""}
                      {p.dueCents <= 0 && !p.estimateAwaiting ? " · optional add-ons" : ""}
                    </p>
                  </div>
                </div>
                <span
                  className={cn(
                    buttonVariants({ variant: p.dueCents > 0 ? "accent" : "outline" }),
                    "min-h-11 w-full sm:w-auto",
                    p.dueCents > 0 ? "" : "text-accent"
                  )}
                >
                  {p.dueCents > 0 ? "Pay Now" : p.estimateAwaiting ? "Review Estimate" : "Complete Checkout"} <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </section>
        ) : null}

        {projects.length > 0 ? (
          <>
            {activeCount > 0 && deliveredCount > 0 ? (
              <div className="no-scrollbar mt-6 flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter projects">
                {(
                  [
                    ["all", `All (${projects.length})`],
                    ["active", `Active (${activeCount})`],
                    ["delivered", `Delivered (${deliveredCount})`],
                  ] as [Filter, string][]
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    role="tab"
                    aria-selected={filter === key}
                    onClick={() => setFilter(key)}
                    className={cn(
                      "inline-flex h-10 shrink-0 items-center rounded-lg px-3.5 text-sm font-medium transition-colors",
                      filter === key ? "bg-accent text-accent-foreground" : "bg-card text-foreground ring-1 ring-border hover:bg-accent-subtle"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="mt-5 grid gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
              {shown.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </>
        ) : (
          <PortalCard className="mt-8">
            <div className="flex flex-col items-center px-4 py-10 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <FolderOpen className="h-7 w-7" />
              </span>
              <p className="mt-4 text-lg font-semibold text-heading">No projects yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted">
                {isSharedViewer
                  ? "Projects shared with you will appear here."
                  : `Request a shoot to get started with ${businessName}. Your projects will appear here.`}
              </p>
              {!isSharedViewer ? (
                <Link href="/dashboard/request" className={cn(buttonVariants({ variant: "accent" }), "mt-5 min-h-11")}>
                  <Sparkles className="h-4 w-4" /> Request a Shoot
                </Link>
              ) : null}
            </div>
          </PortalCard>
        )}

        {!isSharedViewer && activities.length > 0 ? (
          <PortalCard title="Recent Activity" className="mt-8">
            <ActivityFeed logs={activities} projectLinkPrefix="/dashboard/projects" clientMode />
          </PortalCard>
        ) : null}
      </main>
    </div>
  );
}

function ProjectCard({ project: p }: { project: PortalHomeProject }) {
  return (
    <Link
      href={`/dashboard/projects/${p.id}`}
      className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-slate-900">
        {p.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={p.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <CoverPlaceholder />
        )}
        <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />
        <div className="absolute left-3 top-3 flex flex-wrap gap-1.5">
          <StatusBadge status={p.status} audience="client" className="shadow-sm" />
        </div>
        {p.dueCents > 0 ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
            <CreditCard className="h-3 w-3" /> {formatCurrency(p.dueCents)} due
          </span>
        ) : p.optionalDueCents > 0 && !p.estimateAwaiting ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground shadow-sm">
            <CreditCard className="h-3 w-3" /> {formatCurrency(p.optionalDueCents)} checkout
          </span>
        ) : p.estimateAwaiting ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-0.5 text-xs font-semibold text-accent-foreground shadow-sm">
            <FileText className="h-3 w-3" /> Review estimate
          </span>
        ) : p.delivered ? (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-semibold text-white shadow-sm">
            <CheckCircle2 className="h-3 w-3" /> Delivered
          </span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        {p.serviceType ? <p className="text-xs font-medium uppercase tracking-wide text-accent">{p.serviceType}</p> : null}
        <p className="line-clamp-2 font-semibold text-heading">{p.name}</p>
        {p.address && p.address !== p.name ? (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{p.address}</span>
          </p>
        ) : null}
        {p.dateLabel ? (
          <p className="flex items-center gap-1.5 text-sm text-muted">
            <CalendarDays className="h-3.5 w-3.5 shrink-0" /> {p.dateLabel}
          </p>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-2 pt-3">
          <p className="min-w-0 truncate text-xs text-muted">{p.nextStepTitle}</p>
          <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-accent">
            Open <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
