import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isUuid } from "@/lib/marketing/model";
import { loadPublicListingById } from "@/lib/marketing/public";
import { redirectTo, signVideo } from "@/lib/marketing/media";

export const dynamic = "force-dynamic";

/** Public website video playback: only videos in the published snapshot that are still approved. */
export async function GET(_request: Request, { params }: { params: Promise<{ kitId: string; assetId: string }> }) {
  const { kitId, assetId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isUuid(assetId)) return notFound();
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return notFound();
  const listing = await loadPublicListingById(host.businessId, kitId);
  const row = listing?.mediaRows.find((r) => r.id === assetId);
  if (!listing || !row) return notFound();
  const db = await createTenantServiceClient(host.businessId);
  const signed = await signVideo(db, row);
  return signed ? redirectTo(signed, "private") : notFound();
}
