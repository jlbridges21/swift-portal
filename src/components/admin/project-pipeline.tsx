"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PROJECT_STATUSES, getStatusLabel, normalizeStatus, type ProjectStatus } from "@/lib/constants";
import { formatShootDateTime } from "@/lib/scheduling";
import { GripVertical, ExternalLink, Calendar, CreditCard } from "lucide-react";
import { toast } from "sonner";

interface PipelineProject {
  id: string;
  project_name: string;
  property_address: string;
  service_type: string;
  status: ProjectStatus;
  shoot_date: string | null;
  confirmedShootAt?: string | null;
  created_at: string;
  clients: { name: string; company: string | null } | null;
  pendingPayment?: boolean;
  recentActivity?: string;
}

interface ProjectPipelineProps {
  projects: PipelineProject[];
}

export function ProjectPipeline({ projects: initialProjects }: ProjectPipelineProps) {
  const router = useRouter();
  const [projects, setProjects] = useState(
    initialProjects.map((p) => ({ ...p, status: normalizeStatus(p.status) }))
  );
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);

  const columns = PROJECT_STATUSES;

  function projectsInColumn(status: string) {
    return projects.filter((p) => p.status === status);
  }

  async function updateStatus(projectId: string, newStatus: string) {
    const prev = projects;
    setProjects((list) =>
      list.map((p) => (p.id === projectId ? { ...p, status: newStatus as PipelineProject["status"] } : p))
    );

    const res = await fetch("/api/projects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ id: projectId, status: newStatus }),
    });

    if (!res.ok) {
      setProjects(prev);
      toast.error("Failed to update status");
      return;
    }

    toast.success(`Moved to ${getStatusLabel(newStatus)}`);
    router.refresh();
  }

  function handleDragStart(e: React.DragEvent, projectId: string) {
    e.dataTransfer.setData("projectId", projectId);
    e.dataTransfer.effectAllowed = "move";
    setDraggingId(projectId);
  }

  function handleDragEnd() {
    setDraggingId(null);
    setOverColumn(null);
  }

  function handleDragOver(e: React.DragEvent, status: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOverColumn(status);
  }

  function handleDrop(e: React.DragEvent, status: string) {
    e.preventDefault();
    const projectId = e.dataTransfer.getData("projectId");
    setOverColumn(null);
    setDraggingId(null);
    if (!projectId) return;

    const project = projects.find((p) => p.id === projectId);
    if (project && project.status !== status) {
      updateStatus(projectId, status);
    }
  }

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-3 min-w-max">
        {columns.map((col) => {
          const items = projectsInColumn(col.value);
          const isOver = overColumn === col.value;

          return (
            <div
              key={col.value}
              className={`flex w-64 shrink-0 flex-col rounded-xl border bg-slate-50/80 transition-colors ${
                isOver ? "border-accent bg-accent/5" : "border-border"
              }`}
              onDragOver={(e) => handleDragOver(e, col.value)}
              onDragLeave={() => setOverColumn(null)}
              onDrop={(e) => handleDrop(e, col.value)}
            >
              <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
                <h3 className="text-xs font-semibold text-primary leading-tight">{col.label}</h3>
                <span className="rounded-full bg-white px-2 py-0.5 text-xs font-medium text-muted shadow-sm">
                  {items.length}
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 p-2 min-h-[100px]">
                {items.map((project) => (
                  <div
                    key={project.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, project.id)}
                    onDragEnd={handleDragEnd}
                    className={`cursor-grab active:cursor-grabbing ${
                      draggingId === project.id ? "opacity-50" : ""
                    }`}
                  >
                    <Card className="shadow-sm hover:shadow-md transition-shadow">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex gap-1.5">
                          <GripVertical className="h-3.5 w-3.5 shrink-0 text-muted mt-0.5" />
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/admin/projects/${project.id}`}
                              className="font-medium text-xs text-primary hover:text-accent line-clamp-2"
                            >
                              {project.project_name}
                            </Link>
                            <p className="text-[10px] text-muted mt-0.5 line-clamp-1">{project.property_address}</p>
                            <p className="text-[10px] text-muted">{project.clients?.name}</p>
                            <p className="text-[10px] text-muted">{project.service_type}</p>
                          </div>
                        </div>
                        <StatusBadge status={project.status} className="text-[10px]" />
                        {(() => {
                          const shootWhen = project.confirmedShootAt
                            ?? (project.shoot_date ? `${project.shoot_date}T09:00:00.000Z` : null);
                          return shootWhen ? (
                          <p className="text-[10px] text-blue-600 flex items-center gap-1">
                            <Calendar className="h-3 w-3" /> {formatShootDateTime(shootWhen, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </p>
                          ) : null;
                        })()}
                        {project.pendingPayment && (
                          <p className="text-[10px] text-orange-600 flex items-center gap-1">
                            <CreditCard className="h-3 w-3" /> Invoice pending
                          </p>
                        )}
                        {project.recentActivity && (
                          <p className="text-[10px] text-muted line-clamp-2 border-t border-border pt-1.5">
                            {project.recentActivity}
                          </p>
                        )}
                        <Link href={`/admin/projects/${project.id}`}>
                          <Button variant="ghost" size="sm" className="h-6 w-full text-[10px]">
                            <ExternalLink className="h-3 w-3" /> Open
                          </Button>
                        </Link>
                      </CardContent>
                    </Card>
                  </div>
                ))}

                {items.length === 0 && (
                  <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-border py-6 text-[10px] text-muted">
                    Drop here
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
