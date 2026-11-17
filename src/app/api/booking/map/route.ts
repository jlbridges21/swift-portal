import { resolveBookingAccess } from "@/lib/booking/access";
import { loadBookingContext, loadProjectBookingFacts } from "@/lib/booking/server";
import { loadRouteContext, propertyMapUrl, routeMapUrl } from "@/lib/booking/details";

/**
 * Route / location map image (Google Maps Static API), proxied so the API key never
 * reaches the browser. Business: the shoot's route (previous → this → next stop).
 * Client: the property location only.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const access = await resolveBookingAccess({ token: url.searchParams.get("b"), projectId: url.searchParams.get("projectId") });
  if (!access) return new Response("Not found", { status: 404 });
  const ctx = await loadBookingContext(access.businessId);
  const facts = await loadProjectBookingFacts(ctx, access.projectId);
  if (!facts) return new Response("Not found", { status: 404 });

  let imageUrl: string | null = null;
  if (access.role === "business" && facts.appointment?.status === "confirmed") {
    imageUrl = routeMapUrl(await loadRouteContext(ctx, facts, facts.appointment));
  } else {
    imageUrl = propertyMapUrl(facts.propertyAddress);
  }
  if (!imageUrl) return new Response("Map unavailable", { status: 404 });

  try {
    const res = await fetch(imageUrl, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return new Response("Map unavailable", { status: 502 });
    return new Response(await res.arrayBuffer(), {
      headers: {
        "Content-Type": res.headers.get("content-type") ?? "image/png",
        "Cache-Control": "private, max-age=600",
      },
    });
  } catch {
    return new Response("Map unavailable", { status: 502 });
  }
}
