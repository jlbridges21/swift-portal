import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { getAppSettings } from "@/lib/app-settings";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isUuid } from "@/lib/marketing/model";
import { businessLogoFromSettings, loadProjectRow, resolveMarketingActor, uploadAllowedForProject } from "@/lib/marketing/server";
import { signUpload } from "@/lib/marketing/media";
import { loadTransparentLogo, loadTransparentLogoByKey, logoPngResponse } from "@/lib/website/logo-image";

export const dynamic = "force-dynamic";

/** Editor preview of a property website logo, transparent (see the public logo route). */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isUuid(projectId)) return notFound();
  const profile = await getProfile();
  const tenant = await getTenantContext();
  if (!profile || !tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await resolveMarketingActor(profile, projectId, tenant.businessId))) return notFound();
  const url = new URL(request.url);

  if (url.searchParams.get("ref") === "business") {
    const logo = businessLogoFromSettings(await getAppSettings(tenant.businessId));
    if (!logo) return notFound();
    const png = await loadTransparentLogo(tenant.businessId, logo, request.url);
    return png ? logoPngResponse(png, "private") : notFound();
  }

  const path = url.searchParams.get("p") ?? "";
  const db = await createTenantServiceClient(tenant.businessId);
  const project = await loadProjectRow(db, projectId);
  if (!path || !project || !(await uploadAllowedForProject(db, projectId, project.client_id, path))) return notFound();
  const signed = await signUpload(db, path, "medium");
  if (!signed) return notFound();
  const png = await loadTransparentLogoByKey(`${tenant.businessId}:upload:${path}`, signed);
  return png ? logoPngResponse(png, "private") : notFound();
}
