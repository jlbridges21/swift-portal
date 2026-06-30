import Link from "next/link";
import { Header, PageHeader } from "@/components/layout/header";
import { Button } from "@/components/ui/button";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { ProjectPipeline } from "@/components/admin/project-pipeline";
import {
  loadPipelinePageProjects,
  parsePipelineStageParam,
  PIPELINE_STAGE_CONFIG,
  type PipelineStageParam,
} from "@/lib/admin-project-pipeline";

interface PageProps {
  searchParams: Promise<{ view?: string; stage?: string; status?: string }>;
}

const LEGACY_STATUS_TO_STAGE: Record<string, PipelineStageParam> = {
  new_request: "new_request",
  quote_sent: "quote",
  shoot_complete_editing: "editing",
  ready_for_review: "in_review",
  awaiting_payment: "awaiting_payment",
};

export default async function AdminProjectsPage({ searchParams }: PageProps) {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const { view, stage: stageParam, status: legacyStatus } = await searchParams;
  const showDeleted = view === "deleted";
  const stage =
    showDeleted
      ? null
      : parsePipelineStageParam(stageParam) ??
        (legacyStatus ? LEGACY_STATUS_TO_STAGE[legacyStatus] ?? null : null);

  const { projects, activeCount, hiddenCount, stageCounts } = await loadPipelinePageProjects({
    showDeleted,
    stage,
  });

  const stageConfig = stage ? PIPELINE_STAGE_CONFIG[stage] : null;
  const filteredCount = stage ? stageCounts[stage] : null;

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-[100vw] px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title={showDeleted ? "Hidden Projects" : "Project Pipeline"}
          description={
            showDeleted
              ? `${hiddenCount} hidden project${hiddenCount === 1 ? "" : "s"}`
              : `${activeCount} active project${activeCount === 1 ? "" : "s"}`
          }
        >
          <div className="flex flex-wrap gap-2">
            <Link href={showDeleted ? "/admin/projects" : "/admin/projects?view=deleted"}>
              <Button variant="outline" size="sm">
                {showDeleted ? `Active projects (${activeCount})` : `Hidden projects (${hiddenCount})`}
              </Button>
            </Link>
            {!showDeleted && (
              <Link href="/admin/projects/new">
                <Button variant="accent" size="sm">
                  <Plus className="h-4 w-4" />
                  New Project
                </Button>
              </Link>
            )}
          </div>
        </PageHeader>

        <ProjectPipeline
          projects={projects}
          stage={stage}
          stageLabel={stageConfig?.label}
          scrollToStatus={stageConfig?.scrollToStatus}
          filteredCount={filteredCount}
        />
      </main>
    </div>
  );
}
