import { getPublicHostContext, isActivePublicTenant } from "@/lib/host-resolution";
import { openBookingToken } from "@/lib/booking/token";
import { loadClientBookingView } from "@/lib/booking/client-view";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

/** Resolve a booking-link page: token must be valid, for this host's business and this project's client. */
export async function loadPublicBookingPage(token: string | undefined) {
  const host = await getPublicHostContext();
  if (!isActivePublicTenant(host)) return { state: "unavailable" as const };
  const payload = openBookingToken(token);
  if (!payload || payload.b !== host.businessId) return { state: "invalid" as const };
  const db = await createTenantServiceClient(payload.b);
  const { data: project } = await db.from("projects").select("client_id").eq("id", payload.p).maybeSingle();
  if (!project || project.client_id !== payload.c) return { state: "invalid" as const };
  const loaded = await loadClientBookingView(payload.b, payload.p);
  if (!loaded) return { state: "invalid" as const };
  return { state: "ok" as const, token: token!, view: loaded.view };
}
