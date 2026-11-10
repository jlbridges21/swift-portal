import { NextResponse } from "next/server";
import { getPublicHostContext } from "@/lib/host-resolution";
import { getAppSettings } from "@/lib/app-settings";
import { allowedLogoUrl, loadTransparentLogo } from "@/lib/website/logo-image";

export const dynamic = "force-dynamic";

/** Business Website logo with a transparent background (see websiteLogoSrc). */
export async function GET(request: Request) {
  const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });
  const host = await getPublicHostContext();
  if (host.kind !== "tenant" || !host.businessId) return notFound();
  const raw = new URL(request.url).searchParams.get("u") ?? "";
  const { business } = await getAppSettings(host.businessId);
  if (!raw || !allowedLogoUrl(raw, host.businessId, business.logoUrl)) return notFound();
  const png = await loadTransparentLogo(host.businessId, raw, request.url);
  if (!png) return notFound();
  return new Response(new Uint8Array(png), {
    headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, s-maxage=86400" },
  });
}
