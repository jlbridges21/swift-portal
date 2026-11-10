import { NextResponse } from "next/server";
import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { getAppSettings } from "@/lib/app-settings";
import { isUuidLike } from "@/lib/website/settings";
import { serveHeroMedia } from "@/lib/website/hero-media";

export const dynamic = "force-dynamic";

/** Business Website hero photo/video: only the media saved as this business's hero is served. */
export async function GET(request: Request, { params }: { params: Promise<{ assetId: string }> }) {
  const { assetId } = await params;
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!isUuidLike(assetId)) return notFound();
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return notFound();
  const { website } = await getAppSettings(host.businessId);
  // Hero photo/video, or the About Us photo while that page is on — nothing else.
  const allowed = [website.heroImageMedia?.id, website.heroVideoMedia?.id, website.about.enabled ? website.about.imageMedia?.id : undefined].includes(assetId);
  if (!allowed) return notFound();
  return serveHeroMedia(host.businessId, assetId, request, "public");
}
