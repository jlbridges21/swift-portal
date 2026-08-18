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

  // Auto-link CRM client ↔ portal profile so multi-client project RLS works.
  // Supabase Auth is a single global user pool (one auth user per email). The
  // product rule is one person = one business — never attach by email across tenants.
  //
  // Identity bootstrap: cannot call getTenantContext() (that would recurse).
  // Lookups are business-scoped when profiles.business_id is set (prompt 7 Part C).
  // When it is not, a multi-business match aborts rather than attaching.
  // Portal-link uses the matched client's business_id (NOT NULL since v30).
  if (profile.role === "client" && !profile.client_id) {
    const service = await createServiceClient();
    const businessId = profile.business_id ?? null;

    let userQuery = service
      .from("clients")
      .select("id, business_id")
      .eq("user_id", user.id)
      .is("deleted_at", null);
    if (businessId) userQuery = userQuery.eq("business_id", businessId);
    const { data: byUserRows } = await userQuery;
    if ((byUserRows?.length ?? 0) > 1 && !businessId) {
      console.warn(
        "[auth] user_id matches clients in multiple businesses; leaving client_id null",
        { userId: user.id }
      );
      return profile as Profile;
    }
    let clientId = byUserRows?.[0]?.id ?? null;
    let matchedBusinessId = byUserRows?.[0]?.business_id ?? businessId;
    if (!clientId && user.email) {
      if (businessId) {
        const { data: byEmail } = await service
          .from("clients")
          .select("id, business_id")
          .ilike("email", user.email)
          .eq("business_id", businessId)
          .is("deleted_at", null)
          .maybeSingle();
        clientId = byEmail?.id ?? null;
        matchedBusinessId = byEmail?.business_id ?? businessId;
      } else {
        const { data: matches } = await service
          .from("clients")
          .select("id, business_id")
          .ilike("email", user.email)
          .is("deleted_at", null);

        const businessIds = new Set(
          (matches ?? []).map((row) => row.business_id).filter(Boolean)
        );
        if (businessIds.size > 1) {
          console.warn(
            "[auth] email matches clients in multiple businesses; leaving client_id null",
            { email: user.email, userId: user.id, businesses: [...businessIds] }
          );
          return profile as Profile;
        }
        if (matches?.length === 1) {
          clientId = matches[0].id;
          matchedBusinessId = matches[0].business_id;
        }
      }
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
      if (matchedBusinessId) {
        void ensureClientPortalLink(clientId, matchedBusinessId);
      }
    }
  }

  if (profile.role === "client" && profile.client_id) {
    const { data: client } = await supabase
      .from("clients")
      .select("last_login_at, business_id")
      .eq("id", profile.client_id)
      .maybeSingle();
    // Missing/invisible client row: do not guess a business.
    if (client?.business_id) {
      void touchClientLogin(
        profile.client_id,
        client.business_id,
        client.last_login_at ?? null
      );
    }
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
  if (profile.role !== "admin" && profile.role !== "super_admin") {
    throw new Error("Forbidden");
  }
  return profile;
}

export async function requireSuperAdmin(): Promise<Profile> {
  const profile = await requireAuth();
  if (profile.role !== "super_admin") {
    throw new Error("Forbidden");
  }
  return profile;
}

import { logProjectActivity } from "@/lib/activity";

export async function logActivity(
  activityType: string,
  description: string,
  options: {
    businessId: string;
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
