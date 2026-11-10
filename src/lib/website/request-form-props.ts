import { getAppSettings } from "@/lib/app-settings";
import { getProfile } from "@/lib/auth";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

/** Same inputs /request has always used: estimate mode + a signed-in client's identity. */
export async function loadRequestFormProps(businessId: string): Promise<{
  instantPreliminaryEstimate: boolean;
  signedInClient: { name: string; email: string } | null;
}> {
  const settings = await getAppSettings(businessId);
  // Scenario D: a signed-in client of this business skips contact + account steps.
  const profile = await getProfile();
  let signedInClient: { name: string; email: string } | null = null;
  if (profile?.role === "client" && profile.client_id && (!profile.business_id || profile.business_id === businessId)) {
    const db = await createTenantServiceClient(businessId);
    const { data: client } = await db
      .from("clients")
      .select("id, name, full_name, email, deleted_at")
      .eq("id", profile.client_id)
      .maybeSingle();
    if (client && !client.deleted_at) {
      signedInClient = {
        name: client.full_name || client.name || profile.full_name || "",
        email: client.email || profile.email || "",
      };
    }
  }
  return { instantPreliminaryEstimate: settings.proposals.autoPreliminaryEstimate !== false, signedInClient };
}
