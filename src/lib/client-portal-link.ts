import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { authConfirmUrl } from "@/lib/auth-confirm";
import { getBusinessPortalOriginById, joinPortalPath } from "@/lib/portal-url";

export interface PortalLinkResult {
  linked: boolean;
  hasPortal: boolean;
  userId: string | null;
  message: string;
}

function profileBelongsToBusiness(
  profile: { business_id?: string | null; role?: string | null },
  businessId: string
): boolean {
  if (profile.role === "super_admin") return false;
  if (profile.role === "admin") return profile.business_id === businessId;
  if (profile.business_id && profile.business_id !== businessId) return false;
  return true;
}

/**
 * Ensure a CRM client row is linked to a portal auth user via
 * clients.user_id and profiles.client_id so RLS (get_user_client_id) works.
 *
 * profiles lookups use `.raw` — super_admin rows have NULL business_id, and
 * Auth-created profiles may not have business_id until handle_new_user stamps it.
 * Auth is one user pool (one email). Never attach a profile that already belongs
 * to another business. Same-business admins may keep role=admin (dual-hat).
 */
export async function ensureClientPortalLink(
  clientId: string,
  businessId: string
): Promise<PortalLinkResult> {
  const db = await createTenantServiceClient(businessId);

  const { data: client, error } = await db
    .from("clients")
    .select("id, email, user_id, name, deleted_at")
    .eq("id", clientId)
    .maybeSingle();

  if (error || !client || client.deleted_at) {
    return { linked: false, hasPortal: false, userId: null, message: "Client not found" };
  }

  // Already fully linked
  if (client.user_id) {
    const { data: profile } = await db.raw
      .from("profiles")
      .select("id, client_id, role, business_id")
      .eq("id", client.user_id)
      .maybeSingle();

    if (profile) {
      if (!profileBelongsToBusiness(profile, businessId)) {
        return {
          linked: false,
          hasPortal: false,
          userId: null,
          message: "This login belongs to another business and cannot be linked here.",
        };
      }
      if (profile.role !== "admin" && profile.client_id !== client.id) {
        await db.raw.from("profiles").update({ client_id: client.id, role: "client" }).eq("id", profile.id);
      } else if (profile.role === "admin" && profile.client_id !== client.id) {
        await db.raw.from("profiles").update({ client_id: client.id }).eq("id", profile.id);
      }
      return {
        linked: true,
        hasPortal: true,
        userId: profile.id,
        message: "Portal access linked",
      };
    }
  }

  const email = client.email?.trim().toLowerCase();
  if (!email) {
    return {
      linked: false,
      hasPortal: false,
      userId: null,
      message: "Client has no email — cannot link portal login",
    };
  }

  const { data: profileByEmail } = await db.raw
    .from("profiles")
    .select("id, client_id, role, email, business_id")
    .ilike("email", email)
    .maybeSingle();

  if (profileByEmail) {
    if (!profileBelongsToBusiness(profileByEmail, businessId)) {
      return {
        linked: false,
        hasPortal: false,
        userId: null,
        message: "This email belongs to another business and cannot be linked here.",
      };
    }

    await db
      .from("clients")
      .update({ user_id: profileByEmail.id })
      .eq("id", client.id);

    if (profileByEmail.role !== "admin") {
      await db.raw
        .from("profiles")
        .update({ client_id: client.id, role: "client" })
        .eq("id", profileByEmail.id);
    } else if (profileByEmail.client_id !== client.id) {
      await db.raw.from("profiles").update({ client_id: client.id }).eq("id", profileByEmail.id);
    }

    return {
      linked: true,
      hasPortal: true,
      userId: profileByEmail.id,
      message: "Linked existing portal account by email",
    };
  }

  return {
    linked: false,
    hasPortal: false,
    userId: null,
    message:
      "No portal login found for this email. Enable portal access (set a password) so they can see assigned projects.",
  };
}

/**
 * Create or reset a portal login for a CRM client.
 */
export async function enableClientPortalAccess(
  clientId: string,
  password: string,
  businessId: string
): Promise<PortalLinkResult & { created?: boolean }> {
  const db = await createTenantServiceClient(businessId);

  const { data: client } = await db
    .from("clients")
    .select("id, email, user_id, name")
    .eq("id", clientId)
    .maybeSingle();

  if (!client?.email) {
    return { linked: false, hasPortal: false, userId: null, message: "Client email required" };
  }

  if (client.user_id) {
    const { data: existingProfile } = await db.raw
      .from("profiles")
      .select("id, role, business_id")
      .eq("id", client.user_id)
      .maybeSingle();
    if (!existingProfile || !profileBelongsToBusiness(existingProfile, businessId)) {
      return {
        linked: false,
        hasPortal: false,
        userId: null,
        message: "This login belongs to another business and cannot be updated here.",
      };
    }
    const { error } = await db.raw.auth.admin.updateUserById(client.user_id, {
      password,
      email_confirm: true,
    });
    if (error) {
      return { linked: false, hasPortal: false, userId: null, message: error.message };
    }
    if (existingProfile.role !== "admin") {
      await db.raw
        .from("profiles")
        .update({ client_id: client.id, role: "client" })
        .eq("id", client.user_id);
    } else {
      await db.raw.from("profiles").update({ client_id: client.id }).eq("id", client.user_id);
    }
    return {
      linked: true,
      hasPortal: true,
      userId: client.user_id,
      created: false,
      message: "Portal password updated",
    };
  }

  const { data: authUser, error: authError } = await db.raw.auth.admin.createUser({
    email: client.email,
    password,
    email_confirm: true,
    user_metadata: { full_name: client.name, role: "client", business_id: businessId },
  });

  if (authError) {
    const linked = await ensureClientPortalLink(clientId, businessId);
    if (linked.hasPortal) {
      if (linked.userId) {
        await db.raw.auth.admin.updateUserById(linked.userId, { password, email_confirm: true });
      }
      return { ...linked, created: false, message: "Linked existing account and set password" };
    }
    return { linked: false, hasPortal: false, userId: null, message: authError.message };
  }

  if (!authUser.user) {
    return { linked: false, hasPortal: false, userId: null, message: "Failed to create portal user" };
  }

  await db.from("clients").update({ user_id: authUser.user.id }).eq("id", client.id);
  await db.raw
    .from("profiles")
    .update({
      client_id: client.id,
      role: "client",
      full_name: client.name,
      email_notifications_enabled: true,
      in_app_notifications_enabled: true,
      business_id: businessId,
    })
    .eq("id", authUser.user.id);

  return {
    linked: true,
    hasPortal: true,
    userId: authUser.user.id,
    created: true,
    message: "Portal access enabled",
  };
}

export async function getClientPortalStatus(
  clientIds: string[],
  businessId: string
): Promise<Map<string, { hasPortal: boolean; userId: string | null }>> {
  const map = new Map<string, { hasPortal: boolean; userId: string | null }>();
  if (!clientIds.length) return map;

  const db = await createTenantServiceClient(businessId);
  const { data } = await db
    .from("clients")
    .select("id, user_id")
    .in("id", clientIds);

  for (const row of data ?? []) {
    map.set(row.id, { hasPortal: !!row.user_id, userId: row.user_id });
  }
  return map;
}

export type ClientPortalAccessForEmail = {
  hasPortal: boolean;
  userId: string | null;
  /** Absolute URL for the email CTA (project page, or invite action_link). */
  ctaUrl: string;
  /** Which existing mechanism produced the CTA. */
  mechanism: "existing_portal_link" | "supabase_invite_generate_link" | "login_fallback";
  message: string;
};

/**
 * Ensure the client can open the portal from a branded email CTA.
 * Reuses ensureClientPortalLink when they already have an account; otherwise
 * uses auth.admin.generateLink({ type: "invite" }) (same invite flow as admin
 * invites, without Supabase's own email — we put action_link in sendBrandedEmail).
 */
export async function ensureClientPortalAccessForEmail(
  clientId: string,
  businessId: string,
  nextPath: string
): Promise<ClientPortalAccessForEmail> {
  const portalOrigin = await getBusinessPortalOriginById(businessId);
  const projectUrl = joinPortalPath(portalOrigin, nextPath);

  const linked = await ensureClientPortalLink(clientId, businessId);
  if (linked.hasPortal && linked.userId) {
    return {
      hasPortal: true,
      userId: linked.userId,
      ctaUrl: projectUrl,
      mechanism: "existing_portal_link",
      message: linked.message,
    };
  }

  const db = await createTenantServiceClient(businessId);
  const { data: client } = await db
    .from("clients")
    .select("id, email, name, user_id")
    .eq("id", clientId)
    .maybeSingle();

  const email = client?.email?.trim().toLowerCase();
  if (!client || !email) {
    return {
      hasPortal: false,
      userId: null,
      ctaUrl: joinPortalPath(portalOrigin, "/login"),
      mechanism: "login_fallback",
      message: "Client has no email — cannot invite",
    };
  }

  const redirectTo = authConfirmUrl(portalOrigin);
  const { data: linkData, error: linkError } = await db.raw.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        role: "client",
        business_id: businessId,
        full_name: client.name,
      },
      redirectTo,
    },
  });

  if (linkError || !linkData?.properties?.action_link) {
    console.warn("[client-portal] invite generateLink failed:", linkError?.message);
    return {
      hasPortal: false,
      userId: client.user_id,
      ctaUrl: joinPortalPath(portalOrigin, `/login?next=${encodeURIComponent(nextPath)}`),
      mechanism: "login_fallback",
      message: linkError?.message || "Invite link generation failed",
    };
  }

  const userId = linkData.user?.id ?? null;
  if (userId) {
    await db.from("clients").update({ user_id: userId }).eq("id", client.id);
    await db.raw
      .from("profiles")
      .update({
        client_id: client.id,
        role: "client",
        full_name: client.name,
        email_notifications_enabled: true,
        in_app_notifications_enabled: true,
        business_id: businessId,
      })
      .eq("id", userId);
  }

  return {
    hasPortal: Boolean(userId),
    userId,
    ctaUrl: linkData.properties.action_link,
    mechanism: "supabase_invite_generate_link",
    message: "Portal invite link generated for branded email",
  };
}
