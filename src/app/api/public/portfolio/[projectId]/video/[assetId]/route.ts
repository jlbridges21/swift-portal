import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { isUuid } from "@/lib/marketing/model";
import { redirectTo, signVideo } from "@/lib/marketing/media";
import { loadPublicPortfolioEntry } from "@/lib/website/portfolio-server";

export const dynamic = "force-dynamic";

/** Business Website portfolio video playback: only approved videos of published, still-Delivered projects. */
export async function GET(_request: Request, { params }: { params: Promise<{ projectId: string; assetId: string }> }) {
  const { projectId, assetId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isUuid(projectId) || !isUuid(assetId)) return notFound();
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return notFound();
  const resolved = await loadPublicPortfolioEntry(host.businessId, projectId);
  const row = resolved?.rows.find((r) => r.id === assetId && r.media_type === "video");
  if (!resolved || !row) return notFound();
  const db = await createTenantServiceClient(host.businessId);
  const signed = await signVideo(db, row);
  return signed ? redirectTo(signed, "private") : notFound();
}
