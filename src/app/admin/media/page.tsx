import { Header, PageHeader } from "@/components/layout/header";
import { requireAdminPage } from "@/lib/admin-access";
import { MediaLibraryClient } from "@/components/admin/media-library-client";
import { getLibraryFilterOptions, queryMediaLibrary } from "@/lib/media-library";
import {
  isOwnerAdmin,
  visibleClientIdsFor,
  visibleProjectIdsFor,
} from "@/lib/staff-access";

interface PageProps {
  searchParams: Promise<{ upload?: string; q?: string }>;
}

export default async function AdminMediaPage({ searchParams }: PageProps) {
  const { profile, tenant } = await requireAdminPage({ area: "media" });
  const sp = await searchParams;
  const initialQuery = (sp.q ?? "").trim().slice(0, 80);
  const projectIds = isOwnerAdmin(profile)
    ? ("all" as const)
    : await visibleProjectIdsFor(tenant.businessId, profile);
  const clientIds = isOwnerAdmin(profile)
    ? ("all" as const)
    : await visibleClientIdsFor(tenant.businessId, profile);

  const [result, filterOptions] = await Promise.all([
    queryMediaLibrary(tenant.businessId, {
      page: 1,
      limit: 48,
      q: initialQuery || undefined,
      projectIds,
    }),
    getLibraryFilterOptions(tenant.businessId, { projectIds, clientIds }),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole={profile.role === "staff" ? "staff" : "admin"} />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Media Library"
          description={`${result.total} assets across ${projectIds === "all" ? "all" : "assigned"} projects`}
        />
        <MediaLibraryClient
          initialAssets={result.assets}
          initialTotal={result.total}
          filterOptions={filterOptions}
          openUploadOnMount={sp.upload === "1"}
          initialQuery={initialQuery}
        />
      </main>
    </div>
  );
}
