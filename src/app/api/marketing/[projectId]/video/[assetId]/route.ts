import { NextResponse } from "next/server";
import { getProfile } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isUuid } from "@/lib/marketing/model";
import { loadEligibleAsset, resolveMarketingActor } from "@/lib/marketing/server";
import { redirectTo, signVideo } from "@/lib/marketing/media";

export const dynamic = "force-dynamic";

/** Editor preview playback for an approved uploaded video (short-lived signed URL). */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isUuid(projectId) || !isUuid(assetId)) return notFound();
  const profile = await getProfile();
  const tenant = await getTenantContext();
  if (!profile || !tenant) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await resolveMarketingActor(profile, projectId, tenant.businessId))) return notFound();
  const db = await createTenantServiceClient(tenant.businessId);
  const hit = await loadEligibleAsset(db, projectId, assetId);
  if (!hit) return notFound();
  const signed = await signVideo(db, hit.row);
  return signed ? redirectTo(signed, "private") : notFound();
}
