import { randomBytes } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { writePlatformAudit } from "@/lib/platform-audit";

function generateTempPassword(): string {
  // Strong random; shown once to super_admin. User must change on next login.
  return randomBytes(24).toString("base64url");
}

async function assertBusinessAdmin(businessId: string, userId: string) {
  const raw = await createServiceClient();
  const { data: profile } = await raw
    .from("profiles")
    .select("id, email, role, business_id, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (!profile || profile.role !== "admin" || profile.business_id !== businessId) {
    throw new Error("That user is not an admin of this business.");
  }
  const { data: business } = await raw
    .from("businesses")
    .select("id, slug, custom_domain, name")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new Error("Business not found.");
  const { data: auth } = await raw.auth.admin.getUserById(userId);
  if (!auth.user) throw new Error("Auth user not found.");
  return { profile, business, authUser: auth.user, raw };
}

/** Safe default: email a password-reset link to the admin’s own portal origin. */
export async function sendBusinessAdminPasswordReset(
  businessId: string,
  userId: string,
  actor: { id: string; email: string | null }
): Promise<{ ok: true }> {
  const { profile, business, authUser } = await assertBusinessAdmin(businessId, userId);
  const portalUrl = getBusinessPortalOrigin({
    slug: business.slug,
    custom_domain: business.custom_domain,
  });
  const redirectTo = `${portalUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}&sp_flow=recovery`;

  const anon = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await anon.auth.resetPasswordForEmail(profile.email, { redirectTo });
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "admin.password_reset_email",
    targetBusinessId: businessId,
    targetType: "profile",
    targetId: userId,
    metadata: {
      targetEmail: profile.email,
      portalUrl,
      emailConfirmed: Boolean(authUser.email_confirmed_at),
    },
  });

  return { ok: true };
}

/**
 * When the user cannot receive email: generate a strong temp password, show once,
 * force change on next login via user_metadata.must_change_password.
 * Super_admin never chooses the password.
 */
export async function setBusinessAdminTempPassword(
  businessId: string,
  userId: string,
  actor: { id: string; email: string | null },
  confirm: string
): Promise<{ temporaryPassword: string }> {
  if (confirm !== "SET TEMP PASSWORD") {
    throw new Error('Type SET TEMP PASSWORD to confirm.');
  }

  const { profile, business, authUser, raw } = await assertBusinessAdmin(businessId, userId);
  const temporaryPassword = generateTempPassword();

  const { error } = await raw.auth.admin.updateUserById(userId, {
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      ...authUser.user_metadata,
      must_change_password: true,
    },
  });
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "admin.temp_password_set",
    targetBusinessId: businessId,
    targetType: "profile",
    targetId: userId,
    metadata: {
      targetEmail: profile.email,
      businessSlug: business.slug,
      // Never log the password.
      forcedChange: true,
    },
  });

  return { temporaryPassword };
}
