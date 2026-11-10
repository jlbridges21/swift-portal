import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isUuid } from "@/lib/marketing/model";
import { parseImageSize, redirectTo, signMediaImage } from "@/lib/marketing/media";
import { loadPublicPortfolioEntry } from "@/lib/website/portfolio-server";

export const dynamic = "force-dynamic";

/**
 * Business Website portfolio image. Serves only media the business approved for a PUBLISHED
 * portfolio project that is still Delivered and still client-visible, on the owning business's
 * host, as a size-capped signed URL (never the original file).
 */
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isUuid(projectId) || !isUuid(assetId)) return notFound();
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return notFound();
  const resolved = await loadPublicPortfolioEntry(host.businessId, projectId);
  const row = resolved?.rows.find((r) => r.id === assetId);
  if (!resolved || !row) return notFound();
  const size = parseImageSize(new URL(request.url).searchParams.get("s"));
  const db = await createTenantServiceClient(host.businessId);
  const signed = await signMediaImage(db, row, size);
  return signed ? redirectTo(signed, "public") : notFound();
}
