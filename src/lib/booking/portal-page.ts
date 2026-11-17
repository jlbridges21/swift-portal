import { notFound, redirect } from "next/navigation";
import { getProfile } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant";
import { resolveProjectAccess } from "@/lib/project-access";
import { loadClientBookingView } from "@/lib/booking/client-view";

/** Signed-in client portal booking page: the client must have access to the project. */
export async function loadPortalBookingPage(projectId: string) {
  const profile = await getProfile();
  if (!profile) redirect(`/login?redirect=${encodeURIComponent(`/dashboard/projects/${projectId}/shoot`)}`);
  const tenant = await requireTenantContext();
  const access = await resolveProjectAccess(profile, projectId, { tenantBusinessId: tenant.businessId });
  if (!access.allowed || access.kind === "share") notFound();
  const loaded = await loadClientBookingView(tenant.businessId, projectId);
  if (!loaded) notFound();
  return { view: loaded.view, isClient: profile.role === "client" };
}
