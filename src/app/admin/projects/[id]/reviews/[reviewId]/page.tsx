import { Header } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { VideoReviewView } from "@/components/video-review/video-review-view";
import { getVideoReviewDetail } from "@/lib/video-reviews";
import { loadReviewForAccess } from "@/lib/video-review-access";
import { notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; reviewId: string }>;
}

export default async function AdminVideoReviewPage({ params }: PageProps) {
  const { tenant, profile } = await requireAdminPage();
  const { id: projectId, reviewId } = await params;
  const db = await createTenantServiceClient(tenant.businessId);

  try {
    await loadReviewForAccess(db, profile, reviewId, projectId);
  } catch {
    notFound();
  }

  const detail = await getVideoReviewDetail(db, reviewId);
  if (!detail || detail.review.project_id !== projectId) notFound();

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <VideoReviewView
        projectId={projectId}
        reviewId={reviewId}
        review={detail.review}
        versions={detail.versions}
        isAdmin
        backHref={`/admin/projects/${projectId}`}
        backLabel="Back to project"
      />
    </div>
  );
}
