import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin-access";
import { staffCan, isOwnerAdmin } from "@/lib/staff-access";
import { PhotoEditorWorkspace } from "@/components/photo-editor/photo-editor-workspace";

export const metadata: Metadata = { title: "Photo Editor", robots: { index: false } };

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

/** Full-screen Photo Editor. Session + photo access is enforced again by every API call. */
export default async function PhotoEditorPage({ params }: PageProps) {
  const { profile } = await requireAdminPage({ area: "media" });
  const { sessionId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(sessionId)) notFound();
  const canEdit = isOwnerAdmin(profile) || staffCan(profile, "media.organize");
  return <PhotoEditorWorkspace sessionId={sessionId} canEdit={canEdit} />;
}
