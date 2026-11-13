import { ShellPageTitle } from "@/components/admin/app-shell/shell-page-title";
import { Header } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { preload } from "react-dom";
import type { ActivityLog } from "@/lib/types";
import { AdminProjectDetail } from "@/components/admin/project-detail";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { listProjectVideoReviews } from "@/lib/video-reviews";
import { listProjectShares } from "@/lib/project-shares";
import { getProjectLinkAccessState } from "@/lib/project-link-access";
import { canAccessProject, staffCan, isOwnerAdmin, visibleClientIdsFor } from "@/lib/staff-access";
import { getAppSettings } from "@/lib/app-settings";
import { photoSharePermissions } from "@/lib/media-share-api";
import { getProjectFolderShareSummary, getProjectPhotoShareSummary } from "@/lib/media-shares";
import { getProjectPublicVideoIds } from "@/lib/video-public-shares";
import { loadKitSummary } from "@/lib/marketing/server";
import { getProjectHeroBannerUrl } from "@/lib/cover";
import { listBusinessServices } from "@/lib/business-services";
import { loadProjectServiceLinks } from "@/lib/project-services";
import { listProjectClientFavorites } from "@/lib/client-favorites";
import { perfSpan, perfStart } from "@/lib/perf/trace";
import { PerfTraceScript } from "@/components/perf/perf-trace-script";
import { ProjectPrefetchFreshness } from "@/components/admin/projects-workspace/project-prefetch";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminProjectPage({ params }: PageProps) {
  await perfStart();
  const { profile, tenant } = await perfSpan("page:auth+tenant", requireAdminPage({ area: "projects" }));
  const { id } = await params;
  const supabase = await createClient();

  // Staff: 404 (not 403) when not assigned / no view_all — do not confirm existence.
  // The access check and the client-picker scope are independent, so they run together;
  // nothing project-specific loads until access is decided.
  const [allowed, clientPickerIds] = await Promise.all([
    profile.role === "staff" ? perfSpan("access:canAccessProject", canAccessProject(tenant.businessId, profile, id)) : Promise.resolve(true),
    isOwnerAdmin(profile)
      ? Promise.resolve("all" as const)
      : perfSpan("access:visibleClientIds", visibleClientIdsFor(tenant.businessId, profile)),
  ]);
  if (!allowed) notFound();

  const db = await createTenantServiceClient(tenant.businessId);
  const photoSharing = photoSharePermissions(profile);
  const canSharePhotos = photoSharing.email || photoSharing.link;
  // Secondary panels need only the project id: start them alongside the main batch below
  // instead of awaiting them one by one after it.
  const secondaryLoad = Promise.all([
    perfSpan("sec:videoReviews", listProjectVideoReviews(db, id)),
    perfSpan("sec:projectShares", listProjectShares(tenant.businessId, id)),
    perfSpan("sec:linkAccess", getProjectLinkAccessState(tenant.businessId, id)),
    perfSpan("sec:photoShareSummary", canSharePhotos ? getProjectPhotoShareSummary(tenant.businessId, id) : Promise.resolve({})),
    perfSpan("sec:folderShareSummary", canSharePhotos ? getProjectFolderShareSummary(tenant.businessId, id) : Promise.resolve({})),
    perfSpan("sec:publicVideoIds", getProjectPublicVideoIds(tenant.businessId, id)),
    perfSpan("sec:marketingKit", loadKitSummary(tenant.businessId, id).catch((e) => {
      console.warn("[marketing] summary failed", e instanceof Error ? e.message : e);
      return null;
    })),
    perfSpan("sec:appSettings", getAppSettings(tenant.businessId)),
    perfSpan("sec:businessServices", listBusinessServices(tenant.businessId).catch(() => [])),
    perfSpan("sec:clientFavorites", listProjectClientFavorites(tenant.businessId, id).catch(() => ({ available: false, rows: [] }))),
    perfSpan("sec:serviceLinks", loadProjectServiceLinks(db, [id])),
  ]);
  // Rethrown at the await below; this only keeps an early notFound() from leaving it unhandled.
  secondaryLoad.catch(() => {});

  let clientsQuery = supabase
    .from("clients")
    .select("id, name, email, company, phone, full_name, user_id")
    .eq("business_id", tenant.businessId)
    .is("deleted_at", null)
    .order("name");
  if (clientPickerIds !== "all") {
    if (clientPickerIds.length === 0) {
      clientsQuery = clientsQuery.in("id", ["00000000-0000-0000-0000-000000000000"]);
    } else {
      clientsQuery = clientsQuery.in("id", clientPickerIds);
    }
  }

  // Primary: the project row decides existence/visibility and feeds the cover. Started first.
  const projectLoad = perfSpan("main:project", supabase
      .from("projects")
      .select("*, clients(*), properties(*)")
      .eq("business_id", tenant.businessId)
      .eq("id", id)
      .single());
  // Secondary: the full activity history (hundreds of rows) is only shown in the sidebar
  // preview and the "View all" modal, which stream it in. It never blocks the page.
  const activitiesLoad = perfSpan("main:activities", supabase
      .from("activity_logs")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("created_at", { ascending: false })).then(({ data }) => (data ?? []) as ActivityLog[]);
  // The cover is signed as soon as the project row arrives (not after every other query).
  const heroLoad = projectLoad.then(({ data }) =>
    data ? perfSpan("media:heroBannerSignedUrl", getProjectHeroBannerUrl(data, tenant.businessId).catch(() => null)) : null
  );
  // Rethrown where awaited; these only keep an early notFound() from leaving them unhandled.
  activitiesLoad.then(undefined, () => {});
  heroLoad.then(undefined, () => {});

  const mainLoad = Promise.all([
    perfSpan("main:media", supabase
      .from("media_assets")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("display_order", { ascending: true })),
    perfSpan("main:tours", supabase
      .from("tours")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("display_order")),
    perfSpan("main:models", supabase
      .from("project_3d_models")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("display_order")),
    perfSpan("main:payments", supabase
      .from("payments")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("created_at", { ascending: false })),
    perfSpan("main:shootProposals", supabase
      .from("shoot_proposals")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("proposed_at", { ascending: true })),
    perfSpan("main:projectClients", supabase
      .from("project_clients")
      .select("*, clients(id, name, email, company, phone, full_name, user_id)")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)),
    perfSpan("main:allClients", clientsQuery),
    perfSpan("main:revisions", supabase
      .from("revisions")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("created_at", { ascending: false })),
    perfSpan("main:quotes", supabase
      .from("project_quotes")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("created_at", { ascending: false })),
    perfSpan("main:assetReviews", supabase
      .from("asset_reviews")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)),
    perfSpan("main:mediaFolders", supabase
      .from("media_folders")
      .select("*")
      .eq("business_id", tenant.businessId)
      .eq("project_id", id)
      .order("display_order", { ascending: true })),
  ]);
  mainLoad.catch(() => {});

  const { data: project } = await projectLoad;
  if (!project) notFound();
  // Owner/admin may open a hidden project to restore it. Staff RLS does not
  // filter deleted_at, so refuse that row here.
  if (project.deleted_at && profile.role === "staff") notFound();

  // Start the cover download now, in parallel with the remaining queries.
  const heroBannerUrl = await heroLoad;
  if (heroBannerUrl) preload(heroBannerUrl, { as: "image", fetchPriority: "high" });

  const [
    { data: media },
    { data: tours },
    { data: models },
    { data: payments },
    { data: shootProposals },
    { data: projectClients },
    { data: allClients },
    { data: revisions },
    { data: quotes },
    { data: assetReviews },
    { data: mediaFolders },
  ] = await mainLoad;

  const canViewMoney = staffCan(profile, "money.view");

  const [
    videoReviews,
    projectShares,
    linkAccess,
    photoShareSummary,
    folderShareSummary,
    publicVideoIds,
    marketingKit,
    appSettings,
    serviceRows,
    clientFavorites,
    serviceLinkMap,
  ] = await secondaryLoad;
  const canEditMarketing = isOwnerAdmin(profile) || staffCan(profile, "projects.edit");
  const canManageMarketingOffers = isOwnerAdmin(profile) || staffCan(profile, "money.send_payment_links");
  const appUrl = getBusinessPortalOrigin(tenant.business);
  const clientProjectUrl = `${appUrl}/dashboard/projects/${id}`;
  const portalUrl = `${clientProjectUrl}?preview=1`;
  const isStaff = profile.role === "staff";
  // Project Type picker degrades quietly to free text when services fail to load.
  const serviceOptions = serviceRows.filter((s) => s.is_active).map((s) => s.name).filter(Boolean);
  // Multi-service picker: active services, plus inactive ones only while linked to this project.
  const serviceLinks = serviceLinkMap.get(id) ?? [];
  const serviceIds = serviceLinks.length
    ? serviceLinks.map((l) => l.service_id)
    : project.service_id
      ? [project.service_id as string]
      : [];
  const serviceCatalog = serviceRows
    .filter((s) => s.is_active || serviceIds.includes(s.id))
    .map((s) => {
      const linkedName = serviceLinks.find((l) => l.service_id === s.id)?.service_name;
      return { id: s.id, name: !s.is_active && linkedName ? linkedName : s.name, inactive: !s.is_active };
    });

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={isStaff ? "staff" : "admin"} />
      <ShellPageTitle title={project.project_name} crumbs={[{ label: "Projects", href: "/admin/projects" }]} />
      <main className="app-page app-page-table mx-auto w-full max-w-7xl min-w-0 overflow-x-clip px-4 py-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 md:pb-8">
        <AdminProjectDetail
          project={project}
          media={media ?? []}
          tours={tours ?? []}
          models={models ?? []}
          payments={canViewMoney ? (payments ?? []) : []}
          shootProposals={shootProposals ?? []}
          projectClients={projectClients ?? []}
          allClients={allClients ?? []}
          activities={activitiesLoad}
          revisions={revisions ?? []}
          quotes={canViewMoney ? (quotes ?? []) : []}
          assetReviews={assetReviews ?? []}
          mediaFolders={mediaFolders ?? []}
          portalUrl={portalUrl}
          clientProjectUrl={clientProjectUrl}
          initialVideoReviews={videoReviews}
          projectShares={projectShares}
          linkAccessMode={linkAccess.mode}
          linkAccessPublicUrl={linkAccess.publicUrl}
          linkAccessViewCount={linkAccess.viewCount}
          photoSharing={photoSharing}
          photoShareSummary={photoShareSummary}
          folderShareSummary={folderShareSummary}
          publicVideoIds={publicVideoIds}
          canViewMoney={canViewMoney}
          depositMode={appSettings.workflow.payments.depositMode}
          depositPercent={appSettings.workflow.payments.depositPercent}
          depositAmountCents={appSettings.workflow.payments.depositAmountCents}
          travel={appSettings.travel}
          proposalExpiration={{
            autoSetOnSend: appSettings.workflow.proposals.autoSetExpiration,
            defaultDays: appSettings.proposals.defaultProposalExpirationDays,
          }}
          marketingKit={marketingKit}
          canEditMarketing={canEditMarketing}
          canManageMarketingOffers={canManageMarketingOffers}
          heroBannerUrl={heroBannerUrl}
          serviceOptions={serviceOptions}
          /* A historical free-text service that matches no catalog entry keeps the legacy picker. */
          serviceCatalog={serviceIds.length || !project.service_type ? serviceCatalog : []}
          serviceIds={serviceIds}
          clientFavorites={clientFavorites}
          businessRequiresDeliveredForDownloads={appSettings.payments.requireDeliveredForDownloads}
        />
      </main>
      <ProjectPrefetchFreshness projectId={id} />
      <PerfTraceScript segment="project-page" />
    </div>
  );
}
