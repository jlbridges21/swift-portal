import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import { touchClientLogin } from "@/lib/clients-crm";

export async function getProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (profile?.role === "client" && profile.client_id) {
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
