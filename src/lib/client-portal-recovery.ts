/**
 * Business-owner client portal recovery — mirrors platform-admin-recovery.ts.
 *
 * Owners may RESTORE access (reset email or one-time temp password). They must not
 * gain standing access: temp passwords force must_change_password on next login.
 *
 * Multi-business note: Supabase Auth is one user per email globally. Resetting or
 * setting a password affects that auth user for every portal that shares the email,
 * even if CRM has separate client rows per business. Profile linking refuses
 * cross-tenant attachment; duplicate-email clients without a linked user get their
 * own invite path scoped to this business.
 */

import { randomInt } from "crypto";
import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { logProjectActivity } from "@/lib/activity";
import {
  authConfirmUrl,
  buildAuthConfirmLink,
} from "@/lib/auth-confirm";
import { ensureClientPortalLink, profileBelongsToBusiness } from "@/lib/client-portal-link";
import { sendBrandedEmail } from "@/lib/email";
import { getBusinessPortalOriginById } from "@/lib/portal-url";

export const TEMP_PASSWORD_CONFIRM = "SET TEMP PASSWORD";

/** No 0/O/o, 1/l/I or punctuation — the client may have to retype it from a message. */
const TEMP_PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
const TEMP_PASSWORD_LENGTH = 20; // ~115 bits

function generateTempPassword(): string {
  let out = "";
  for (let i = 0; i < TEMP_PASSWORD_LENGTH; i++) {
    out += TEMP_PASSWORD_ALPHABET[randomInt(TEMP_PASSWORD_ALPHABET.length)];
  }
  return out;
}

/** Shown to the owner when a temp password would not let this client sign in. */
export class TempPasswordUnavailableError extends Error {}

export type ClientPortalAccountStatus = {
  accountStatus: "no_account" | "invited_unconfirmed" | "has_account";
  userId: string | null;
  emailConfirmed: boolean | null;
  mustChangePassword: boolean;
  message: string;
};

type BusinessClient = {
  id: string;
  email: string;
  name: string;
  full_name: string | null;
  user_id: string | null;
  business_id: string;
  deleted_at: string | null;
};

async function assertBusinessClient(clientId: string, businessId: string) {
  const db = await createTenantServiceClient(businessId);
  const { data: client, error } = await db
    .from("clients")
    .select("id, email, name, full_name, user_id, business_id, deleted_at")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!client || client.deleted_at) throw new Error("Client not found.");
  if ((client.business_id as string) !== businessId) {
    throw new Error("Client not found.");
  }

  const email = (client.email as string)?.trim().toLowerCase();
  if (!email) throw new Error("Client has no email on file.");

  return { client: client as BusinessClient, db };
}

async function resolveAuthUserForClient(
  db: Awaited<ReturnType<typeof createTenantServiceClient>>,
  client: BusinessClient
): Promise<User | null> {
  if (client.user_id) {
    const { data } = await db.raw.auth.admin.getUserById(client.user_id);
    return data.user ?? null;
  }
  const email = client.email.trim().toLowerCase();
  const { data: listed } = await db.raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return listed.users.find((u) => u.email?.toLowerCase() === email) ?? null;
}

export async function getClientPortalAccountStatus(
  clientId: string,
  businessId: string
): Promise<ClientPortalAccountStatus | null> {
  const db = await createTenantServiceClient(businessId);
  const { data: client, error } = await db
    .from("clients")
    .select("id, email, name, full_name, user_id, business_id, deleted_at")
    .eq("id", clientId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!client || client.deleted_at || (client.business_id as string) !== businessId) {
    return null;
  }

  const email = (client.email as string)?.trim();
  if (!email) {
    return {
      accountStatus: "no_account",
      userId: null,
      emailConfirmed: null,
      mustChangePassword: false,
      message: "Add an email address before restoring portal access.",
    };
  }

  const businessClient = client as BusinessClient;
  await ensureClientPortalLink(clientId, businessId);

  const authUser = await resolveAuthUserForClient(db, businessClient);
  if (!authUser) {
    return {
      accountStatus: "no_account",
      userId: null,
      emailConfirmed: null,
      mustChangePassword: false,
      message: "No portal login yet — send a reset email to invite them.",
    };
  }

  if (businessClient.user_id) {
    const { data: profile } = await db.raw
      .from("profiles")
      .select("id, role, business_id, client_id")
      .eq("id", businessClient.user_id)
      .maybeSingle();
    if (profile && !profileBelongsToBusiness(profile, businessId)) {
      return {
        accountStatus: "no_account",
        userId: null,
        emailConfirmed: null,
        mustChangePassword: false,
        message: "This email is linked to another business and cannot be managed here.",
      };
    }
  }

  const confirmed = Boolean(authUser.email_confirmed_at);
  const mustChangePassword = authUser.user_metadata?.must_change_password === true;

  if (!confirmed) {
    return {
      accountStatus: "invited_unconfirmed",
      userId: authUser.id,
      emailConfirmed: false,
      mustChangePassword,
      message: "Portal invite sent but email not confirmed yet.",
    };
  }

  return {
    accountStatus: "has_account",
    userId: authUser.id,
    emailConfirmed: true,
    mustChangePassword,
    message: "Portal account is active.",
  };
}

async function sendPortalInviteEmail(args: {
  businessId: string;
  clientId: string;
  client: BusinessClient;
  db: Awaited<ReturnType<typeof createTenantServiceClient>>;
}): Promise<{ path: "portal_invite_email" }> {
  const portalOrigin = await getBusinessPortalOriginById(args.businessId);
  const redirectTo = authConfirmUrl(portalOrigin);
  const email = args.client.email.trim().toLowerCase();
  const displayName = args.client.full_name?.trim() || args.client.name;

  const { data: linkData, error: linkError } = await args.db.raw.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        role: "client",
        business_id: args.businessId,
        full_name: displayName,
      },
      redirectTo,
    },
  });

  const hashedToken = linkData?.properties?.hashed_token?.trim();
  if (linkError || !hashedToken) {
    throw new Error(linkError?.message || "Could not generate portal invite link.");
  }

  const userId = linkData.user?.id ?? null;
  if (userId) {
    await args.db.from("clients").update({ user_id: userId }).eq("id", args.clientId);
    await args.db.raw
      .from("profiles")
      .update({
        client_id: args.clientId,
        role: "client",
        full_name: displayName,
        email_notifications_enabled: true,
        in_app_notifications_enabled: true,
        business_id: args.businessId,
      })
      .eq("id", userId);
  }

  const ctaUrl = buildAuthConfirmLink({
    portalOrigin,
    tokenHash: hashedToken,
    type: "invite",
    nextPath: "/dashboard",
  });

  const emailResult = await sendBrandedEmail({
    businessId: args.businessId,
    to: email,
    subject: "Set up your client portal access",
    title: "Access your client portal",
    body: `${displayName}, use the button below to set your portal password and sign in. This link is prefetch-safe — open it once and click Continue.`,
    ctaLabel: "Set up portal access",
    ctaUrl,
    emailType: "client_portal_invite",
    analytics: { emailType: "client_portal_invite" },
  });

  if (!emailResult.sent && !emailResult.skipped) {
    throw new Error(emailResult.error || "Could not send portal invite email.");
  }

  return { path: "portal_invite_email" };
}

/** Primary recovery: client sets their own password; owner never learns it. */
export async function sendClientPortalPasswordReset(
  clientId: string,
  businessId: string,
  actor: { id: string; email: string | null }
): Promise<{ ok: true; path: "password_reset_email" | "portal_invite_email" }> {
  const { client, db } = await assertBusinessClient(clientId, businessId);
  await ensureClientPortalLink(clientId, businessId);

  const portalOrigin = await getBusinessPortalOriginById(businessId);
  const redirectTo = authConfirmUrl(portalOrigin);
  const authUser = await resolveAuthUserForClient(db, client);

  let path: "password_reset_email" | "portal_invite_email";

  if (authUser?.email_confirmed_at) {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error } = await anon.auth.resetPasswordForEmail(client.email, { redirectTo });
    if (error) throw new Error(error.message);
    path = "password_reset_email";
  } else {
    const invite = await sendPortalInviteEmail({ businessId, clientId, client, db });
    path = invite.path;
  }

  await logProjectActivity("client_portal_password_reset", `Portal password reset email sent`, {
    businessId,
    clientId,
    userId: actor.id,
    visibility: "admin",
    metadata: {
      path,
      targetEmail: client.email,
      portalOrigin,
    },
  });

  return { ok: true, path };
}

/**
 * Secondary recovery: strong random temp password, shown once, forced change on login.
 * Owner cannot choose the password (confirm phrase only).
 */
export async function setClientPortalTempPassword(
  clientId: string,
  businessId: string,
  actor: { id: string; email: string | null },
  confirm: string
): Promise<{ temporaryPassword: string; email: string }> {
  if (confirm !== TEMP_PASSWORD_CONFIRM) {
    throw new Error(`Type ${TEMP_PASSWORD_CONFIRM} to confirm.`);
  }

  const { client, db } = await assertBusinessClient(clientId, businessId);
  const linked = await ensureClientPortalLink(clientId, businessId);
  if (linked.message.includes("another business")) {
    throw new Error(linked.message);
  }

  const email = client.email.trim().toLowerCase();
  const temporaryPassword = generateTempPassword();
  const displayName = client.full_name?.trim() || client.name;
  // ensureClientPortalLink may have just linked an existing login by email; `client` predates that.
  let userId = linked.userId ?? client.user_id;

  if (userId) {
    const { data: profile } = await db.raw
      .from("profiles")
      .select("id, role, business_id")
      .eq("id", userId)
      .maybeSingle();
    if (!profile || !profileBelongsToBusiness(profile, businessId)) {
      throw new Error("This login belongs to another business and cannot be updated here.");
    }
    if (profile.role !== "client") {
      throw new TempPasswordUnavailableError(
        "This email belongs to a team login, not a client portal login. Use the password reset email instead."
      );
    }

    const { data: authData, error: getError } = await db.raw.auth.admin.getUserById(userId);
    if (getError || !authData.user) {
      throw new Error(getError?.message || "Portal login not found. Send a reset email instead.");
    }
    const authUser = authData.user;

    // The client signs in with the CRM email; a password on a differently-addressed login is useless.
    if (authUser.email?.trim().toLowerCase() !== email) {
      throw new TempPasswordUnavailableError(
        `This client's portal login uses ${authUser.email ?? "a different email"}, not ${client.email}. Fix the client's email or send a reset email instead.`
      );
    }
    const providers = new Set(
      (authUser.identities ?? []).map((identity) => identity.provider)
    );
    if (providers.size > 0 && !providers.has("email")) {
      throw new TempPasswordUnavailableError(
        `This client signs in with ${[...providers].map(providerLabel).join(" / ")}, so a password won't work for them. Ask them to use "Continue with Google" on the sign-in page, or send a password reset email so they can add a password themselves.`
      );
    }

    const bannedUntil = (authUser as { banned_until?: string | null }).banned_until;
    if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) {
      throw new TempPasswordUnavailableError(
        "This portal login is blocked in Supabase Auth, so no password will work until it's unblocked."
      );
    }

    const { data: updated, error } = await db.raw.auth.admin.updateUserById(userId, {
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        ...authUser.user_metadata,
        must_change_password: true,
      },
    });
    if (error) throw new Error(error.message);
    if (updated.user?.user_metadata?.must_change_password !== true) {
      throw new Error("Supabase did not save the temporary password. Send a reset email instead.");
    }
  } else {
    const { data: authUser, error: authError } = await db.raw.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
      user_metadata: {
        full_name: displayName,
        role: "client",
        business_id: businessId,
        must_change_password: true,
      },
    });
    if (authError) throw new Error(authError.message);
    if (!authUser.user) throw new Error("Failed to create portal user.");
    userId = authUser.user.id;
    await db.from("clients").update({ user_id: userId }).eq("id", client.id);
    await db.raw
      .from("profiles")
      .update({
        client_id: client.id,
        role: "client",
        full_name: displayName,
        email_notifications_enabled: true,
        in_app_notifications_enabled: true,
        business_id: businessId,
      })
      .eq("id", userId);
  }

  await logProjectActivity(
    "client_portal_temp_password",
    "Temporary portal password set — client must change it on first sign-in",
    {
      businessId,
      clientId,
      userId: actor.id,
      visibility: "admin",
      metadata: {
        targetEmail: client.email,
        forcedChange: true,
      },
    }
  );

  return { temporaryPassword, email };
}

function providerLabel(provider: string): string {
  if (provider === "google") return "Google";
  return provider.charAt(0).toUpperCase() + provider.slice(1);
}
