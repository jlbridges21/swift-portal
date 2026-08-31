import { Header } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { mediaDisplayName } from "@/lib/media-display-name";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { VideoReviewView } from "@/components/video-review/video-review-view";
import { getVideoReviewVersionLink } from "@/lib/video-reviews";
import type { VideoReview, VideoReviewVersionRow } from "@/lib/video-reviews";
import { notFound, redirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string; assetId: string }>;
}

export default async function AdminLazyVideoReviewPage({ params }: PageProps) {
  const { tenant, profile } = await requireAdminPage();
  const { id: projectId, assetId } = await params;
  const db = await createTenantServiceClient(tenant.businessId);

  const { data: asset, error: assetError } = await db
    .from("media_assets")
    .select("id, business_id, project_id, media_type, title, file_name, duration_seconds")
    .eq("id", assetId)
    .maybeSingle();

  if (assetError || !asset || asset.project_id !== projectId || asset.media_type !== "video") {
    notFound();
  }

  const existing = await getVideoReviewVersionLink(db, assetId);
  if (existing) {
    redirect(`/admin/projects/${projectId}/reviews/${existing.reviewId}`);
  }

  const now = new Date().toISOString();
  const stubReview: VideoReview = {
    id: "__lazy__",
    business_id: tenant.businessId,
    project_id: projectId,
    title: mediaDisplayName(asset),
    created_by: null,
    created_at: now,
    updated_at: now,
  };
  const stubVersion: VideoReviewVersionRow = {
    id: "__lazy__",
    business_id: tenant.businessId,
    review_id: "__lazy__",
    media_asset_id: assetId,
    version_number: 1,
    uploaded_by: null,
    notes: null,
    created_at: now,
    media_assets: {
      id: asset.id as string,
      title: asset.title as string | null,
      file_name: asset.file_name as string | null,
      media_type: asset.media_type as string,
      duration_seconds: asset.duration_seconds as number | null,
    },
  };

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <VideoReviewView
        projectId={projectId}
        reviewId="__lazy__"
        review={stubReview}
        versions={[stubVersion]}
        isAdmin
        currentUserId={profile.id}
        backHref={`/admin/projects/${projectId}`}
        backLabel="Back to project"
        lazyMode={{
          mediaAssetId: assetId,
          reviewPathPrefix: "/admin/projects",
        }}
      />
    </div>
  );
}
