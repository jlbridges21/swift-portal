import { Header } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AdminProjectDetail } from "@/components/admin/project-detail";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { listProjectVideoReviews } from "@/lib/video-reviews";
import { listProjectShares } from "@/lib/project-shares";
import { getProjectLinkAccessState } from "@/lib/project-link-access";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProjectPage({ params }: PageProps) {
  const { tenant } = await requireAdminPage();
  const { id } = await params;
  const supabase = await createClient();

  const [
    { data: project },
    { data: media },
    { data: tours },
    { data: payments },
    { data: shootProposals },
    { data: projectClients },
    { data: allClients },
    { data: activities },
    { data: revisions },
    { data: quotes },
    { data: assetReviews },
    { data: mediaFolders },
  ] = await Promise.all([
    supabase.from("projects").select("*, clients(*), properties(*)").eq("business_id", tenant.businessId).eq("id", id).single(),
    supabase
      .from("media_assets")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("display_order", { ascending: true }),
    supabase.from("tours").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("display_order"),
    supabase.from("payments").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("shoot_proposals").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("proposed_at", { ascending: true }),
    supabase.from("project_clients").select("*, clients(id, name, email, company, phone, full_name, user_id)").eq("business_id", tenant.businessId).eq("project_id", id),
    supabase.from("clients").select("id, name, email, company, phone, full_name, user_id").eq("business_id", tenant.businessId).is("deleted_at", null).order("name"),
    supabase.from("activity_logs").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("revisions").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("project_quotes").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("created_at", { ascending: false }),
    supabase.from("asset_reviews").select("*").eq("business_id", tenant.businessId).eq("project_id", id),
    supabase.from("media_folders").select("*").eq("business_id", tenant.businessId).eq("project_id", id).order("display_order", { ascending: true }),
  ]);

  if (!project) notFound();

  const db = await createTenantServiceClient(tenant.businessId);
  const videoReviews = await listProjectVideoReviews(db, id);
  const projectShares = await listProjectShares(tenant.businessId, id);
  const linkAccess = await getProjectLinkAccessState(tenant.businessId, id);

  const appUrl = getBusinessPortalOrigin(tenant.business);
  const portalUrl = `${appUrl}/dashboard/projects/${id}?preview=1`;

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-4xl px-4 py-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 md:pb-8">
        <AdminProjectDetail
          project={project}
          media={media ?? []}
          tours={tours ?? []}
          payments={payments ?? []}
          shootProposals={shootProposals ?? []}
          projectClients={projectClients ?? []}
          allClients={allClients ?? []}
          activities={activities ?? []}
          revisions={revisions ?? []}
          quotes={quotes ?? []}
          assetReviews={assetReviews ?? []}
          mediaFolders={mediaFolders ?? []}
          portalUrl={portalUrl}
          initialVideoReviews={videoReviews}
          projectShares={projectShares}
          linkAccessMode={linkAccess.mode}
          linkAccessPublicUrl={linkAccess.publicUrl}
          linkAccessViewCount={linkAccess.viewCount}
        />
      </main>
    </div>
  );
}
