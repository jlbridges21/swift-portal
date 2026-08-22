"use client";

import { GripVertical } from "lucide-react";
import { DEMO_PIPELINE_COLUMNS, DEMO_PROJECTS, type DemoProject } from "./demo-data";
import { getStatusColor } from "@/lib/constants";

function ProjectCard({
  project,
  highlight,
}: {
  project: DemoProject;
  highlight?: boolean;
}) {
  return (
    <div
      data-demo-target={highlight ? "project-card" : undefined}
      className={`rounded-lg border bg-white p-3 shadow-sm transition-shadow ${
        highlight ? "border-[#4F46E5] ring-2 ring-[#4F46E5]/25 shadow-md" : "border-[#E2E8F0]"
      }`}
    >
      <div className="flex gap-1.5">
        <GripVertical className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#94A3B8]" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-[#0F172A]">{project.name}</p>
          <p className="truncate text-xs text-[#64748B]">{project.client}</p>
          <p className="mt-1 truncate text-[11px] text-[#64748B]">{project.address}</p>
        </div>
      </div>
    </div>
  );
}

/** Faithful mini rebuild of ProjectPipeline kanban columns. */
export function DemoProjectsPanel({ highlightId }: { highlightId?: string }) {
  return (
    <div className="h-full overflow-hidden rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
      <div className="overflow-x-auto pb-3 pt-3 scroll-smooth">
        <div className="flex min-w-max gap-3 px-3">
          {DEMO_PIPELINE_COLUMNS.map((col) => {
            const items = DEMO_PROJECTS.filter((p) => p.status === col.value);
            return (
              <div
                key={col.value}
                className="flex w-52 shrink-0 flex-col rounded-xl border border-[#E2E8F0] bg-slate-50/80"
              >
                <div className="flex items-center justify-between gap-1 border-b border-[#E2E8F0] px-2 py-2.5">
                  <h3 className="min-w-0 flex-1 truncate text-xs font-semibold leading-tight text-[#0F172A]">
                    {col.label}
                  </h3>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-[#64748B] shadow-sm">
                    {items.length}
                  </span>
                </div>
                <div className="flex min-h-[88px] flex-1 flex-col gap-2 p-2">
                  {items.map((project) => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      highlight={highlightId === project.id}
                    />
                  ))}
                  {items.length === 0 ? (
                    <p className="px-1 py-4 text-center text-[11px] text-[#94A3B8]">Empty</p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <p className="sr-only">
        Pipeline uses the same stages as the live admin board:{" "}
        {DEMO_PIPELINE_COLUMNS.map((c) => c.label).join(", ")}.
      </p>
      {/* Status chip legend for fidelity */}
      <div className="hidden">
        {DEMO_PROJECTS.map((p) => (
          <span key={p.id} className={getStatusColor(p.status)} />
        ))}
      </div>
    </div>
  );
}
