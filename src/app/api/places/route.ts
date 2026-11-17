import { NextResponse } from "next/server";
import { clientIp } from "@/lib/public-link-api";
import {
  addressDetails,
  allowPlacesRequest,
  autocompleteAddresses,
  cleanSessionToken,
  placesConfigured,
} from "@/lib/places";

/**
 * Address autocomplete proxy (public: the request form uses it before sign-in).
 * POST { action: "autocomplete", input, sessionToken } → { suggestions }
 * POST { action: "details", placeId, sessionToken }   → { address }
 * Same-origin only, rate limited per IP. Results are biased to the visitor's area (Vercel geo
 * headers), like Google's own browser widget.
 */
export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (!placesConfigured()) return NextResponse.json({ unavailable: true, suggestions: [] });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const action = body?.action;
  const ip = clientIp(request);
  const sessionToken = cleanSessionToken(body?.sessionToken);

  if (action === "autocomplete") {
    if (!allowPlacesRequest(ip, "autocomplete")) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const input = typeof body?.input === "string" ? body.input : "";
    const suggestions = await autocompleteAddresses(input, { sessionToken, bias: visitorLocation(request) });
    if (suggestions === null) return NextResponse.json({ unavailable: true, suggestions: [] });
    return NextResponse.json({ suggestions });
  }

  if (action === "details") {
    if (!allowPlacesRequest(ip, "details")) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    const placeId = typeof body?.placeId === "string" ? body.placeId : "";
    const address = await addressDetails(placeId, sessionToken);
    if (!address) return NextResponse.json({ error: "Couldn't load that address." }, { status: 502 });
    return NextResponse.json({ address });
  }

  return NextResponse.json({ error: "Unknown action." }, { status: 400 });
}

/** Browser calls from our own pages only (blocks other sites using us as a free Places proxy). */
function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = (request.headers.get("x-forwarded-host") || request.headers.get("host") || "").split(",")[0].trim().toLowerCase();
  try {
    return new URL(origin).host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function visitorLocation(request: Request): { lat: number; lng: number } | null {
  const lat = Number(request.headers.get("x-vercel-ip-latitude"));
  const lng = Number(request.headers.get("x-vercel-ip-longitude"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || (lat === 0 && lng === 0)) return null;
  if (!request.headers.get("x-vercel-ip-latitude")) return null;
  return { lat, lng };
}
