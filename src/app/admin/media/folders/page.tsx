import { redirect } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-access";
import { getUiExperience } from "@/lib/ui-rollout-server";
import { NewMediaLibraryPage } from "@/components/admin/media-library/new-media-library-page";

export const dynamic = "force-dynamic";

/** Media Library → Folders (New interface only; Classic has no folders view). */
export default async function MediaFoldersPage() {
  const { profile, tenant } = await requireAdminPage({ area: "media" });
  if ((await getUiExperience(profile)).mode !== "new") redirect("/admin/media");
  return <NewMediaLibraryPage profile={profile} businessId={tenant.businessId} view="folders" />;
}
