"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { ProjectCoverImage } from "@/components/projects/project-cover-image";
import { projectShootAt } from "@/lib/client-view";
import {
  StagePill,
  type ClientViewProjectRow,
} from "@/components/admin/client-view/client-view-shared";
import { ClientViewEmpty } from "@/components/admin/client-view/client-view-list";

type Dated = { project: ClientViewProjectRow; at: Date };

function monthKey(d: Date) {
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** Shoot dates for the selected client, grouped by month. */
export function ClientViewCalendar({
  projects,
  heroUrls,
  showClientName,
  canOpenCalendar,
}: {
  projects: ClientViewProjectRow[];
  heroUrls: Record<string, string | null> | null;
  showClientName: boolean;
  canOpenCalendar: boolean;
}) {
  const [showPast, setShowPast] = useState(false);

  const { upcoming, past, unscheduled } = useMemo(() => {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const dated: Dated[] = [];
    let unscheduledCount = 0;
    for (const project of projects) {
      const when = projectShootAt(project);
      if (when) dated.push({ project, at: new Date(when) });
      else unscheduledCount++;
    }
    return {
      upcoming: dated.filter((d) => d.at >= startOfToday).sort((a, b) => +a.at - +b.at),
      past: dated.filter((d) => d.at < startOfToday).sort((a, b) => +b.at - +a.at),
      unscheduled: unscheduledCount,
    };
  }, [projects]);

  const fullCalendarLink = canOpenCalendar ? (
    <Link href="/admin/calendar" className="text-sm font-medium text-accent hover:underline">
      Open full calendar
    </Link>
  ) : null;

  if (upcoming.length === 0 && past.length === 0) {
    return (
      <ClientViewEmpty message="No shoot dates yet.">
        <p className="mt-1 text-xs text-muted">Projects show up here once a shoot is scheduled.</p>
        {fullCalendarLink ? <div className="mt-3">{fullCalendarLink}</div> : null}
      </ClientViewEmpty>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {upcoming.length} upcoming shoot{upcoming.length === 1 ? "" : "s"}
          {unscheduled > 0 ? ` · ${unscheduled} not scheduled yet` : ""}
        </p>
        {fullCalendarLink}
      </div>

      {upcoming.length > 0 ? (
        <Agenda items={upcoming} heroUrls={heroUrls} showClientName={showClientName} />
      ) : (
        <ClientViewEmpty message="No upcoming shoots." />
      )}

      {past.length > 0 ? (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            className="text-sm font-medium text-muted hover:text-heading"
          >
            {showPast ? "Hide past shoots" : `Show past shoots (${past.length})`}
          </button>
          {showPast ? <Agenda items={past} heroUrls={heroUrls} showClientName={showClientName} /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Agenda({
  items,
  heroUrls,
  showClientName,
}: {
  items: Dated[];
  heroUrls: Record<string, string | null> | null;
  showClientName: boolean;
}) {
  const groups: { month: string; items: Dated[] }[] = [];
  for (const item of items) {
    const key = monthKey(item.at);
    const last = groups[groups.length - 1];
    if (last?.month === key) last.items.push(item);
    else groups.push({ month: key, items: [item] });
  }

  return (
    <div className="space-y-5">
      {groups.map((group) => (
        <section key={group.month}>
          <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden /> {group.month}
          </h3>
          <ul className="space-y-2">
            {group.items.map(({ project, at }) => (
              <li key={project.id}>
                <Link
                  href={`/admin/projects/${project.id}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="flex w-12 shrink-0 flex-col items-center rounded-lg bg-accent-subtle py-1.5 text-accent">
                    <span className="text-[10px] font-semibold uppercase">
                      {at.toLocaleDateString("en-US", { weekday: "short" })}
                    </span>
                    <span className="text-lg font-bold leading-none">{at.getDate()}</span>
                  </div>
                  {heroUrls ? (
                    <ProjectCoverImage src={heroUrls[project.id]} sizes="80px" className="hidden h-12 w-20 shrink-0 rounded-md sm:block" />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-heading">{project.project_name}</p>
                    <p className="truncate text-xs text-muted">
                      {[
                        // Only a confirmed shoot has a real time; shoot_date alone is a day.
                        project.confirmedShootAt
                          ? at.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
                          : null,
                        showClientName ? project.clients?.name : null,
                        project.property_address,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                  </div>
                  <StagePill status={project.status} className="hidden shrink-0 sm:inline-flex" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
