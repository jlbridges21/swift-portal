import { Header } from "@/components/layout/header";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { requireTenantContext } from "@/lib/tenant";
import { VideoReviewView } from "@/components/video-review/video-review-view";
import { getVideoReviewDetail } from "@/lib/video-reviews";
import { loadReviewForAccess } from "@/lib/video-review-access";
import { resolveProjectAccess } from "@/lib/project-access";
import {
  canReopenVideoReviewComments,
  canResolveVideoReviewComments,
} from "@/lib/project-page-access";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; reviewId: string }>;
}

export default async function ClientVideoReviewPage({ params }: PageProps) {
  const profile = await getProfile();
  if (!profile) redirect("/login");

  const { id: projectId, reviewId } = await params;
  const tenant = await requireTenantContext();
  const access = await resolveProjectAccess(profile, projectId, {
    tenantBusinessId: tenant.businessId,
  });
  if (!access.allowed) notFound();

  const db = await createTenantServiceClient(tenant.businessId);

  try {
    await loadReviewForAccess(db, profile, reviewId, projectId);
  } catch {
    notFound();
  }

  const detail = await getVideoReviewDetail(db, reviewId);
  if (!detail || detail.review.project_id !== projectId) notFound();

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Header variant="dashboard" userRole={profile.role === "admin" ? "admin" : "client"} />
      <VideoReviewView
        projectId={projectId}
        reviewId={reviewId}
        review={detail.review}
        versions={detail.versions}
        isAdmin={false}
        canResolveComments={canResolveVideoReviewComments(access.kind)}
        canReopenComments={canReopenVideoReviewComments(access.kind)}
        currentUserId={profile.id}
        backHref={`/dashboard/projects/${projectId}#video`}
        backLabel="Back to project"
      />
    </div>
  );
}
