import { Header, PageHeader } from "@/components/layout/header";
import { getProfile } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MediaLibraryClient } from "@/components/admin/media-library-client";
import { getLibraryFilterOptions, queryMediaLibrary } from "@/lib/media-library";

export default async function AdminMediaPage() {
  const profile = await getProfile();
  if (!profile || profile.role !== "admin") redirect("/dashboard");

  const [result, filterOptions] = await Promise.all([
    queryMediaLibrary({ page: 1, limit: 48 }),
    getLibraryFilterOptions(),
  ]);

  return (
    <div className="min-h-screen bg-background">
      <Header variant="dashboard" userRole="admin" />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <PageHeader
          title="Media Library"
          description={`${result.total} assets across all projects`}
        />
        <MediaLibraryClient
          initialAssets={result.assets}
          initialTotal={result.total}
          filterOptions={filterOptions}
        />
      </main>
    </div>
  );
}
