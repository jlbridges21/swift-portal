import { createTenantServiceClient } from "@/lib/supabase/tenant-service";

export interface PortalLinkResult {
  linked: boolean;
  hasPortal: boolean;
  userId: string | null;
  message: string;
}

/**
 * Ensure a CRM client row is linked to a portal auth user via
 * clients.user_id and profiles.client_id so RLS (get_user_client_id) works.
 *
 * profiles lookups use `.raw` — super_admin rows have NULL business_id, and
 * Auth-created profiles may not have business_id until handle_new_user stamps it.
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
      .select("id, client_id")
      .eq("id", client.user_id)
      .maybeSingle();

    if (profile) {
      if (profile.client_id !== client.id) {
        await db.raw.from("profiles").update({ client_id: client.id, role: "client" }).eq("id", profile.id);
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

  // Find existing profile by email. Global email match — Auth is one user pool.
  // TODO(tenant): constrain to this business once every client profile has business_id.
  const { data: profileByEmail } = await db.raw
    .from("profiles")
    .select("id, client_id, role, email")
    .ilike("email", email)
    .maybeSingle();

  if (profileByEmail) {
    await db
      .from("clients")
      .update({ user_id: profileByEmail.id })
      .eq("id", client.id);

    if (profileByEmail.role !== "admin") {
      await db.raw
        .from("profiles")
        .update({ client_id: client.id, role: "client" })
        .eq("id", profileByEmail.id);
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
    const { error } = await db.raw.auth.admin.updateUserById(client.user_id, {
      password,
      email_confirm: true,
    });
    if (error) {
      return { linked: false, hasPortal: false, userId: null, message: error.message };
    }
    await db.raw
      .from("profiles")
      .update({ client_id: client.id, role: "client" })
      .eq("id", client.user_id);
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
