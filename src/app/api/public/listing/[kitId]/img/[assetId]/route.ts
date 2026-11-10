import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isUuid } from "@/lib/marketing/model";
import { loadPublicListingById } from "@/lib/marketing/public";
import { parseImageSize, redirectTo, signMediaImage, signUpload } from "@/lib/marketing/media";

export const dynamic = "force-dynamic";

/**
 * Public website image. Serves only media referenced by the PUBLISHED snapshot that is still
 * eligible, on the owning business's host, as a size-capped signed URL (never the original).
 */
export async function GET(request: Request, { params }: { params: Promise<{ kitId: string; assetId: string }> }) {
  const { kitId, assetId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return notFound();
  const listing = await loadPublicListingById(host.businessId, kitId);
  if (!listing) return notFound();
  const url = new URL(request.url);
  const size = parseImageSize(url.searchParams.get("s"));
  const db = await createTenantServiceClient(host.businessId);

  if (assetId === "u") {
    const path = url.searchParams.get("p") ?? "";
    if (!listing.snapshot.uploads.includes(path)) return notFound();
    const signed = await signUpload(db, path, size);
    return signed ? redirectTo(signed, "public") : notFound();
  }
  if (!isUuid(assetId)) return notFound();
  const row = listing.mediaRows.find((r) => r.id === assetId);
  if (!row) return notFound();
  const signed = await signMediaImage(db, row, size);
  return signed ? redirectTo(signed, "public") : notFound();
}
