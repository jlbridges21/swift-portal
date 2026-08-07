import { createClient, createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { touchClientLogin } from "@/lib/clients-crm";
import { ensureClientPortalLink } from "@/lib/client-portal-link";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  let { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  // Auto-link CRM client ↔ portal profile so multi-client project RLS works
  if (profile.role === "client" && !profile.client_id) {
    const service = await createServiceClient();
    const { data: byUser } = await service
      .from("clients")
      .select("id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .maybeSingle();

    let clientId = byUser?.id ?? null;
    if (!clientId && user.email) {
      const { data: byEmail } = await service
        .from("clients")
        .select("id")
        .ilike("email", user.email)
        .is("deleted_at", null)
        .maybeSingle();
      clientId = byEmail?.id ?? null;
      if (clientId) {
        await service.from("clients").update({ user_id: user.id }).eq("id", clientId);
      }
    }

    if (clientId) {
      await service
        .from("profiles")
        .update({ client_id: clientId, role: "client" })
        .eq("id", user.id);
      profile = { ...profile, client_id: clientId };
      void ensureClientPortalLink(clientId);
    }
  }

  if (profile.role === "client" && profile.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("last_login_at")
      .eq("id", profile.client_id)
      .maybeSingle();
    void touchClientLogin(profile.client_id, client?.last_login_at ?? null);
  }

  return profile as Profile | null;
}

export async function requireAuth(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) {
    throw new Error("Unauthorized");
  }
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireAuth();
  if (profile.role !== "admin") {
    throw new Error("Forbidden");
  }
  return profile;
}

import { logProjectActivity } from "@/lib/activity";

export async function logActivity(
  activityType: string,
  description: string,
  options?: {
    projectId?: string;
    leadId?: string;
    metadata?: Record<string, unknown>;
  }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await logProjectActivity(activityType, description, {
    ...options,
    userId: user?.id ?? null,
  });
}
