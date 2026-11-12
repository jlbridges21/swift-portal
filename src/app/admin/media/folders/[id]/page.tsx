import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-access";
import { getUiExperience } from "@/lib/ui-rollout-server";
import { NewMediaLibraryPage } from "@/components/admin/media-library/new-media-library-page";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
}

/** One Media Library folder (New interface only). */
export default async function MediaFolderPage({ params, searchParams }: PageProps) {
  const { profile, tenant } = await requireAdminPage({ area: "media" });
  if ((await getUiExperience(profile)).mode !== "new") redirect("/admin/media");
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  return (
    <NewMediaLibraryPage profile={profile} businessId={tenant.businessId} view="folder" folderId={id} openUpload={sp.upload === "1"} />
  );
}
