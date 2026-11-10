import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isUuid } from "@/lib/marketing/model";
import { loadEligibleAsset, loadProjectRow, resolveMarketingActor, uploadAllowedForProject } from "@/lib/marketing/server";
import { parseImageSize, redirectTo, signMediaImage, signUpload } from "@/lib/marketing/media";

export const dynamic = "force-dynamic";

/**
 * Editor/preview image: authorizes the viewer for this project, checks the photo is eligible
 * marketing media (client-visible), then redirects to a short-lived, size-capped signed URL.
 * `assetId = "u"` with `?p=` serves a marketing upload (logo / headshot) for this project.
 */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isUuid(projectId)) return notFound();
  const profile = await getProfile();
  const tenant = await getTenantContext();
  if (!profile || !tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const actor = await resolveMarketingActor(profile, projectId, tenant.businessId);
  if (!actor) return notFound();

  const url = new URL(request.url);
  const size = parseImageSize(url.searchParams.get("s"));
  const db = await createTenantServiceClient(tenant.businessId);

  if (assetId === "u") {
    const path = url.searchParams.get("p") ?? "";
    const project = await loadProjectRow(db, projectId);
    if (!project || !(await uploadAllowedForProject(db, projectId, project.client_id, path))) return notFound();
    const signed = await signUpload(db, path, size);
    return signed ? redirectTo(signed, "private") : notFound();
  }

  if (!isUuid(assetId)) return notFound();
  const hit = await loadEligibleAsset(db, projectId, assetId);
  if (!hit) return notFound();
  const signed = await signMediaImage(db, hit.row, size);
  return signed ? redirectTo(signed, "private") : notFound();
}
