import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { loadPublicListingById } from "@/lib/marketing/public";
import { signUpload } from "@/lib/marketing/media";
import { loadTransparentLogo, loadTransparentLogoByKey, logoPngResponse } from "@/lib/website/logo-image";

export const dynamic = "force-dynamic";

/**
 * Published property website logo (business, realtor or brokerage) as a transparent PNG — the
 * same treatment the Business Website header uses. Only logos referenced by the published
 * snapshot, on the owning business's host. The stored file is never modified.
 */
export async function GET(request: Request, { params }: { params: Promise<{ kitId: string }> }) {
  const { kitId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return notFound();
  const listing = await loadPublicListingById(host.businessId, kitId);
  if (!listing) return notFound();
  const url = new URL(request.url);

  if (url.searchParams.get("ref") === "business") {
    if (!listing.businessLogoUrl) return notFound();
    const png = await loadTransparentLogo(host.businessId, listing.businessLogoUrl, request.url);
    return png ? logoPngResponse(png, "public") : notFound();
  }

  const path = url.searchParams.get("p") ?? "";
  if (!path || !listing.snapshot.uploads.includes(path)) return notFound();
  const db = await createTenantServiceClient(host.businessId);
  const signed = await signUpload(db, path, "medium");
  if (!signed) return notFound();
  const png = await loadTransparentLogoByKey(`${host.businessId}:upload:${path}`, signed);
  return png ? logoPngResponse(png, "public") : notFound();
}
