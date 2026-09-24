/**
 * Staff accounts — seats, invites, soft-disable, permissions store, project assignment.
 *
 * Phase 2: admins can DEFINE permissions and project_staff assignments.
 * Nothing here grants staff access — enforcement is Phase 3. Stored permissions
 * are inert until then.
 */

import { createClient as createSupabaseJsClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { authConfirmUrl, buildAuthConfirmLink } from "@/lib/auth-confirm";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { sendBrandedEmail } from "@/lib/email";
import { writePlatformAudit } from "@/lib/platform-audit";
import {
  emptyStaffPermissions,
  sanitizeStaffPermissions,
  type StaffPermissions,
} from "@/lib/staff-permissions";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type StaffSeatSnapshot = {
  used: number;
  limit: number | null;
  remaining: number | null;
  planKey: string | null;
  planName: string | null;
  /** True when used > limit (grandfathered after downgrade). */
  overLimit: boolean;
};

export function normalizeStaffEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Active admin seats: role=admin on this business, not disabled. Staff are unlimited / uncounted. */
export async function countBusinessSeatsUsed(businessId: string): Promise<number> {
  const raw = await createServiceClient();
  const { count, error } = await raw
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("role", "admin")
    .is("disabled_at", null);
  if (error) throw new Error(error.message);
  return count ?? 0;
}

function asSeatLimit(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  return null;
}

/**
 * Live seat snapshot — reads plan.limits directly (not request-cached entitlements)
 * so platform seat edits take effect immediately and inactive-plan grandfathers still
 * keep their configured admin_seats.
 */
export async function getBusinessSeatSnapshot(businessId: string): Promise<StaffSeatSnapshot> {
  const raw = await createServiceClient();
  const { data: business } = await raw
    .from("businesses")
    .select("id, plan")
    .eq("id", businessId)
    .maybeSingle();
  const planKey: string | null =
    typeof business?.plan === "string" ? business.plan.trim() : null;
  let planName: string | null = null;
  let limit: number | null = 0;
  if (planKey) {
    const { data: plan } = await raw
      .from("plans")
      .select("key, name, limits")
      .eq("key", planKey)
      .maybeSingle();
    planName = (plan?.name as string | undefined) ?? null;
    const limits = (plan?.limits ?? {}) as Record<string, unknown>;
    // Missing plan row → fail closed (0). Explicit null admin_seats → unlimited.
    limit = plan ? asSeatLimit(limits.admin_seats) : 0;
  }
  const used = await countBusinessSeatsUsed(businessId);
  const remaining =
    typeof limit === "number" ? Math.max(0, limit - used) : null;
  return {
    used,
    limit: typeof limit === "number" ? limit : null,
    remaining,
    planKey,
    planName,
    overLimit: typeof limit === "number" ? used > limit : false,
  };
}

export function seatLimitUpgradeMessage(seats: StaffSeatSnapshot): string {
  const plan = seats.planName || seats.planKey || "your plan";
  const lim = seats.limit ?? 0;
  return `You've used all ${lim} admin seat${lim === 1 ? "" : "s"} on the ${plan} plan (including the owner). Demote or remove an admin, or raise the admin seat limit, to add another.`;
}

/**
 * Downgrade policy (phase 1): do NOT delete staff when seats used > new limit.
 * Existing members keep access; new invites are refused until usage ≤ limit.
 */
export function mayAddSeat(seats: StaffSeatSnapshot): boolean {
  if (seats.limit == null) return true;
  return seats.used < seats.limit;
}

/**
 * Prefetch-safe staff invite: generateLink creates the auth user (or refreshes
 * the invite token) WITHOUT sending Supabase's default email. We email a
 * hashed_token → /auth/confirm CTA via the business sender.
 * Never use inviteUserByEmail or action_link here.
 */
async function generateAndSendStaffInviteEmail(args: {
  businessId: string;
  email: string;
  fullName: string;
  portalOrigin: string;
}): Promise<{
  userId: string | null;
  inviteSent: boolean;
  inviteUrl: string | null;
  error: string | null;
}> {
  const raw = await createServiceClient();
  const redirectTo = authConfirmUrl(args.portalOrigin);
  const { data: linkData, error: linkError } = await raw.auth.admin.generateLink({
    type: "invite",
    email: args.email,
    options: {
      data: {
        role: "staff",
        business_id: args.businessId,
        full_name: args.fullName,
      },
      redirectTo,
    },
  });

  const hashedToken = linkData?.properties?.hashed_token?.trim() ?? null;
  const userId = linkData?.user?.id ?? null;
  if (linkError || !hashedToken) {
    return {
      userId,
      inviteSent: false,
      inviteUrl: null,
      error: linkError?.message || "Could not generate staff invite link.",
    };
  }

  const inviteUrl = staffInviteConfirmLink({
    portalOrigin: args.portalOrigin,
    tokenHash: hashedToken,
  });

  const emailResult = await sendBrandedEmail({
    businessId: args.businessId,
    to: args.email,
    subject: "You're invited to join the team",
    title: "Join your studio team",
    body: `${args.fullName}, you've been invited as staff on ShootPortal. Use the button below to create your password and sign in. This link is prefetch-safe — email scanners will not consume it.`,
    ctaLabel: "Set up your staff account",
    ctaUrl: inviteUrl,
    emailType: "staff_invite",
    analytics: { emailType: "staff_invite" },
  });

  if (!emailResult.sent) {
    return {
      userId,
      inviteSent: false,
      inviteUrl,
      error:
        emailResult.error ||
        emailResult.skipReason ||
        "Invite link generated but the branded email failed to send.",
    };
  }

  return { userId, inviteSent: true, inviteUrl, error: null };
}

async function findAuthUserByEmail(email: string) {
  const raw = await createServiceClient();
  const normalized = normalizeStaffEmail(email);
  // Prefer profiles lookup (indexed) then auth id.
  const { data: profile } = await raw
    .from("profiles")
    .select("id, email, role, business_id, disabled_at")
    .ilike("email", normalized)
    .maybeSingle();
  if (profile) {
    const { data: userData } = await raw.auth.admin.getUserById(profile.id);
    return { profile, user: userData.user ?? null };
  }
  const users = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = users.data.users.find((u) => u.email?.toLowerCase() === normalized) ?? null;
  return { profile: null, user };
}

export type InviteStaffResult =
  | {
      ok: true;
      userId: string;
      inviteSent: boolean;
      attachedExisting: boolean;
      reinvited: boolean;
      seats: StaffSeatSnapshot;
      /** Prefetch-safe /auth/confirm?token_hash= URL when an invite email was generated. */
      inviteUrl?: string | null;
    }
  | { ok: false; error: string; code?: string; seats?: StaffSeatSnapshot };

export async function inviteStaffMember(args: {
  businessId: string;
  email: string;
  fullName?: string;
  actor: { id: string; email: string | null };
}): Promise<InviteStaffResult> {
  const raw = await createServiceClient();
  const normalizedEmail = normalizeStaffEmail(args.email);
  if (!EMAIL_RE.test(normalizedEmail)) {
    return { ok: false, error: "Enter a valid email address." };
  }

  const { data: business } = await raw
    .from("businesses")
    .select(
      "id, slug, name, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured, plan"
    )
    .eq("id", args.businessId)
    .maybeSingle();
  if (!business) return { ok: false, error: "Business not found." };

  const { profile: existingProfile, user: existingUser } = await findAuthUserByEmail(
    normalizedEmail
  );

  // Re-invite existing staff on THIS business — reactivate if disabled; no seat consume.
  if (
    existingProfile &&
    existingProfile.role === "staff" &&
    existingProfile.business_id === args.businessId
  ) {
    if (existingProfile.disabled_at) {
      await raw
        .from("profiles")
        .update({
          disabled_at: null,
          role: "staff",
          business_id: args.businessId,
          client_id: null,
          full_name: args.fullName?.trim() || existingProfile.email,
          staff_permissions: emptyStaffPermissions(),
        })
        .eq("id", existingProfile.id);
    }
    // Resend invite email if unconfirmed (prefetch-safe hashed_token path).
    let inviteSent = false;
    let inviteUrl: string | null = null;
    if (existingUser && !existingUser.email_confirmed_at) {
      const portalUrl = getBusinessPortalOrigin({
        slug: business.slug,
        custom_domain: business.custom_domain,
        custom_domain_status: business.custom_domain_status,
        custom_domain_vercel_verified: business.custom_domain_vercel_verified,
        custom_domain_misconfigured: business.custom_domain_misconfigured,
      });
      const sent = await generateAndSendStaffInviteEmail({
        businessId: args.businessId,
        email: normalizedEmail,
        fullName: args.fullName?.trim() || existingProfile.email || normalizedEmail,
        portalOrigin: portalUrl,
      });
      inviteSent = sent.inviteSent;
      inviteUrl = sent.inviteUrl;
    }
    return {
      ok: true,
      userId: existingProfile.id,
      inviteSent,
      inviteUrl,
      attachedExisting: true,
      reinvited: true,
      seats: await getBusinessSeatSnapshot(args.businessId),
    };
  }

  if (existingProfile?.role === "super_admin") {
    return {
      ok: false,
      error: "That email belongs to a platform super-admin and cannot be invited as staff.",
    };
  }

  if (existingProfile?.role === "admin" && existingProfile.business_id === args.businessId) {
    return {
      ok: false,
      error: "That email is already an admin on this business.",
    };
  }

  // Staff (or admin) at another business — one person = one business.
  if (
    existingProfile?.business_id &&
    existingProfile.business_id !== args.businessId &&
    (existingProfile.role === "staff" || existingProfile.role === "admin")
  ) {
    const { data: other } = await raw
      .from("businesses")
      .select("name, slug")
      .eq("id", existingProfile.business_id)
      .maybeSingle();
    const label = other?.name || other?.slug || "another business";
    return {
      ok: false,
      error: `That email is already staffed at ${label}. A staff member belongs to exactly one business — use a different email.`,
      code: "other_business",
    };
  }

  // Staff seats are unlimited — only admin promotions consume admin_seats.
  const portalUrl = getBusinessPortalOrigin({
    slug: business.slug,
    custom_domain: business.custom_domain,
    custom_domain_status: business.custom_domain_status,
    custom_domain_vercel_verified: business.custom_domain_vercel_verified,
    custom_domain_misconfigured: business.custom_domain_misconfigured,
  });
  const fullName = args.fullName?.trim() || normalizedEmail.split("@")[0] || "Staff";

  // Existing auth/profile (e.g. client or orphan) — attach as staff. Never generateLink invite.
  if (existingUser || existingProfile) {
    const userId = existingUser?.id ?? existingProfile!.id;
    await raw.auth.admin.updateUserById(userId, {
      user_metadata: {
        ...(existingUser?.user_metadata ?? {}),
        role: "staff",
        business_id: args.businessId,
        full_name: fullName,
      },
    });
    await raw.from("profiles").upsert({
      id: userId,
      email: normalizedEmail,
      role: "staff",
      business_id: args.businessId,
      client_id: null,
      full_name: fullName,
      staff_permissions: emptyStaffPermissions(),
      disabled_at: null,
    });

    let inviteSent = false;
    let inviteUrl: string | null = null;
    if (existingUser && !existingUser.email_confirmed_at) {
      const sent = await generateAndSendStaffInviteEmail({
        businessId: args.businessId,
        email: normalizedEmail,
        fullName,
        portalOrigin: portalUrl,
      });
      inviteSent = sent.inviteSent;
      inviteUrl = sent.inviteUrl;
    }

    void writePlatformAudit({
      actorUserId: args.actor.id,
      actorEmail: args.actor.email,
      action: "staff.invite_attached",
      targetBusinessId: args.businessId,
      targetType: "profile",
      targetId: userId,
      metadata: { email: normalizedEmail, inviteSent },
    });

    return {
      ok: true,
      userId,
      inviteSent,
      inviteUrl,
      attachedExisting: true,
      reinvited: false,
      seats: await getBusinessSeatSnapshot(args.businessId),
    };
  }

  // Brand-new email — generateLink invite (creates auth user, no Supabase email)
  // then branded /auth/confirm?token_hash= CTA. Never inviteUserByEmail / action_link.
  const sent = await generateAndSendStaffInviteEmail({
    businessId: args.businessId,
    email: normalizedEmail,
    fullName,
    portalOrigin: portalUrl,
  });

  if (!sent.userId) {
    return {
      ok: false,
      error: sent.error || "Could not create staff invite.",
    };
  }

  const userId = sent.userId;
  await raw
    .from("profiles")
    .upsert({
      id: userId,
      email: normalizedEmail,
      role: "staff",
      business_id: args.businessId,
      client_id: null,
      full_name: fullName,
      staff_permissions: emptyStaffPermissions(),
      disabled_at: null,
    });

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "staff.invite_sent",
    targetBusinessId: args.businessId,
    targetType: "profile",
    targetId: userId,
    metadata: {
      email: normalizedEmail,
      portalOrigin: portalUrl,
      inviteSent: sent.inviteSent,
    },
  });

  if (!sent.inviteSent) {
    return {
      ok: false,
      error: sent.error || "Staff user created but invite email failed to send.",
    };
  }

  return {
    ok: true,
    userId,
    inviteSent: true,
    inviteUrl: sent.inviteUrl,
    attachedExisting: false,
    reinvited: false,
    seats: await getBusinessSeatSnapshot(args.businessId),
  };
}

/** Soft-disable staff — releases nothing for staff (unlimited). Does not delete auth user. */
export async function disableStaffMember(args: {
  businessId: string;
  userId: string;
  actor: { id: string; email: string | null };
}): Promise<{ ok: true; seats: StaffSeatSnapshot } | { ok: false; error: string; code?: string }> {
  const raw = await createServiceClient();

  if (await isBusinessOwner(args.businessId, args.userId)) {
    return {
      ok: false,
      error: "The original business owner cannot be removed.",
      code: "owner_protected",
    };
  }

  const { data: profile } = await raw
    .from("profiles")
    .select("id, role, business_id, disabled_at")
    .eq("id", args.userId)
    .maybeSingle();
  if (!profile || profile.business_id !== args.businessId) {
    return { ok: false, error: "Team member not found." };
  }
  if (profile.role !== "staff" && profile.role !== "admin") {
    return { ok: false, error: "Only staff or admins can be removed from the team." };
  }
  if (profile.disabled_at) {
    return { ok: true, seats: await getBusinessSeatSnapshot(args.businessId) };
  }

  // Admins: demote to staff when removing so the admin seat is freed, then soft-disable.
  const patch: Record<string, unknown> = {
    disabled_at: new Date().toISOString(),
  };
  if (profile.role === "admin") {
    patch.role = "staff";
    patch.staff_permissions = emptyStaffPermissions();
  }

  await raw.from("profiles").update(patch).eq("id", args.userId);
  // Drop project assignments so a re-enable starts clean.
  await raw.from("project_staff").delete().eq("user_id", args.userId).eq("business_id", args.businessId);

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: profile.role === "admin" ? "admin.removed" : "staff.disabled",
    targetBusinessId: args.businessId,
    targetType: "profile",
    targetId: args.userId,
    metadata: { demotedFromAdmin: profile.role === "admin" },
  });

  return { ok: true, seats: await getBusinessSeatSnapshot(args.businessId) };
}

export async function listStaffMembers(
  businessId: string,
  options?: { includeDisabled?: boolean }
) {
  const raw = await createServiceClient();
  let query = raw
    .from("profiles")
    .select("id, email, full_name, role, disabled_at, created_at, staff_permissions")
    .eq("business_id", businessId)
    .eq("role", "staff")
    .order("created_at", { ascending: true });
  if (!options?.includeDisabled) {
    query = query.is("disabled_at", null);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** Active staff + admins for the team UI (excludes disabled unless includeDisabled). */
export async function listTeamMembers(
  businessId: string,
  options?: { includeDisabled?: boolean }
) {
  const raw = await createServiceClient();
  let query = raw
    .from("profiles")
    .select("id, email, full_name, role, disabled_at, created_at, staff_permissions")
    .eq("business_id", businessId)
    .in("role", ["staff", "admin"])
    .order("created_at", { ascending: true });
  if (!options?.includeDisabled) {
    query = query.is("disabled_at", null);
  }
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getBusinessOwnerUserId(businessId: string): Promise<string | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("businesses")
    .select("owner_user_id")
    .eq("id", businessId)
    .maybeSingle();
  return (data?.owner_user_id as string | null) ?? null;
}

export async function isBusinessOwner(
  businessId: string,
  userId: string
): Promise<boolean> {
  const ownerId = await getBusinessOwnerUserId(businessId);
  return Boolean(ownerId && ownerId === userId);
}

/**
 * Promote staff → role=admin. Consumes an admin seat.
 * Project assignments are kept (harmless; admin sees all projects via role).
 * This is NOT a staff permission — the Admin preset must call this.
 */
export async function promoteStaffToAdmin(args: {
  businessId: string;
  userId: string;
  actor: { id: string; email: string | null };
}): Promise<
  | { ok: true; seats: StaffSeatSnapshot }
  | { ok: false; error: string; code?: string; seats?: StaffSeatSnapshot }
> {
  const raw = await createServiceClient();
  const seats = await getBusinessSeatSnapshot(args.businessId);
  if (!mayAddSeat(seats)) {
    return {
      ok: false,
      error: seatLimitUpgradeMessage(seats),
      code: "seat_limit",
      seats,
    };
  }

  const { data: profile } = await raw
    .from("profiles")
    .select("id, role, business_id, disabled_at, email, full_name")
    .eq("id", args.userId)
    .maybeSingle();
  if (!profile || profile.business_id !== args.businessId) {
    return { ok: false, error: "Team member not found." };
  }
  if (profile.disabled_at) {
    return { ok: false, error: "Reactivate this person before promoting them to admin." };
  }
  if (profile.role === "admin") {
    return { ok: true, seats };
  }
  if (profile.role !== "staff") {
    return { ok: false, error: "Only staff can be promoted to admin." };
  }

  await raw.auth.admin.updateUserById(args.userId, {
    user_metadata: {
      role: "admin",
      business_id: args.businessId,
      full_name: profile.full_name,
    },
  });
  await raw
    .from("profiles")
    .update({
      role: "admin",
      staff_permissions: emptyStaffPermissions(),
      client_id: null,
      disabled_at: null,
    })
    .eq("id", args.userId);

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "staff.promoted_to_admin",
    targetBusinessId: args.businessId,
    targetType: "profile",
    targetId: args.userId,
    metadata: { email: profile.email },
  });

  return { ok: true, seats: await getBusinessSeatSnapshot(args.businessId) };
}

/**
 * Demote admin → staff with an empty permission matrix (frees an admin seat).
 * Project assignments are kept if any existed; otherwise the person starts with
 * no assignments until an admin assigns projects. Owner cannot be demoted.
 */
export async function demoteAdminToStaff(args: {
  businessId: string;
  userId: string;
  actor: { id: string; email: string | null };
  permissions?: unknown;
}): Promise<
  | {
      ok: true;
      seats: StaffSeatSnapshot;
      profile: {
        id: string;
        email: string;
        full_name: string | null;
        role: string;
        staff_permissions: StaffPermissions;
      };
    }
  | { ok: false; error: string; code?: string; seats?: StaffSeatSnapshot }
> {
  if (await isBusinessOwner(args.businessId, args.userId)) {
    return {
      ok: false,
      error: "The original business owner cannot be demoted.",
      code: "owner_protected",
    };
  }

  const raw = await createServiceClient();
  const { data: profile } = await raw
    .from("profiles")
    .select("id, email, full_name, role, business_id, disabled_at")
    .eq("id", args.userId)
    .maybeSingle();
  if (!profile || profile.business_id !== args.businessId) {
    return { ok: false, error: "Team member not found." };
  }
  if (profile.role !== "admin") {
    return { ok: false, error: "Only admins can be demoted to staff." };
  }
  if (profile.disabled_at) {
    return { ok: false, error: "This admin is already removed." };
  }

  const perms =
    args.permissions != null
      ? sanitizeStaffPermissions(args.permissions)
      : { ok: true as const, permissions: emptyStaffPermissions() };
  if (!perms.ok) {
    return { ok: false, error: perms.error || "Invalid permissions." };
  }

  await raw.auth.admin.updateUserById(args.userId, {
    user_metadata: {
      role: "staff",
      business_id: args.businessId,
      full_name: profile.full_name,
    },
  });
  await raw
    .from("profiles")
    .update({
      role: "staff",
      staff_permissions: perms.permissions,
      client_id: null,
      disabled_at: null,
    })
    .eq("id", args.userId);

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "admin.demoted_to_staff",
    targetBusinessId: args.businessId,
    targetType: "profile",
    targetId: args.userId,
    metadata: { email: profile.email },
  });

  return {
    ok: true,
    seats: await getBusinessSeatSnapshot(args.businessId),
    profile: {
      id: profile.id,
      email: profile.email,
      full_name: profile.full_name,
      role: "staff",
      staff_permissions: perms.permissions,
    },
  };
}

/** Exported for tests — builds the invite confirm URL with business return_to. */
export function staffInviteRedirectTo(portalOrigin: string): string {
  return `${authConfirmUrl(portalOrigin)}?${new URLSearchParams({
    next: "/staff",
    return_to: portalOrigin,
  }).toString()}`;
}

/** Prefetch-safe confirm URL: hashed_token → /auth/confirm (never action_link). */
export function staffInviteConfirmLink(opts: {
  portalOrigin: string;
  tokenHash: string;
}): string {
  return buildAuthConfirmLink({
    portalOrigin: opts.portalOrigin,
    tokenHash: opts.tokenHash,
    type: "invite",
    nextPath: "/staff",
  });
}

async function assertActiveTeamMemberOnBusiness(businessId: string, userId: string) {
  const raw = await createServiceClient();
  const { data: profile } = await raw
    .from("profiles")
    .select("id, email, full_name, role, business_id, disabled_at, staff_permissions")
    .eq("id", userId)
    .maybeSingle();
  if (
    !profile ||
    profile.business_id !== businessId ||
    (profile.role !== "staff" && profile.role !== "admin") ||
    profile.disabled_at
  ) {
    return null;
  }
  return profile;
}

async function assertActiveStaffOnBusiness(businessId: string, userId: string) {
  const profile = await assertActiveTeamMemberOnBusiness(businessId, userId);
  if (!profile || profile.role !== "staff") return null;
  return profile;
}

export async function updateStaffMember(args: {
  businessId: string;
  userId: string;
  fullName?: string;
  email?: string;
  permissions?: unknown;
  actor: { id: string; email: string | null };
}): Promise<
  | {
      ok: true;
      profile: {
        id: string;
        email: string;
        full_name: string | null;
        staff_permissions: StaffPermissions;
      };
    }
  | { ok: false; error: string; code?: string; refusedKeys?: string[] }
> {
  const raw = await createServiceClient();
  const profile = await assertActiveTeamMemberOnBusiness(args.businessId, args.userId);
  if (!profile) return { ok: false, error: "Team member not found." };

  const patch: Record<string, unknown> = {};
  let nextEmail = profile.email as string;
  let authEmailChanged = false;

  if (typeof args.fullName === "string") {
    const name = args.fullName.trim();
    if (!name) return { ok: false, error: "Name cannot be empty." };
    patch.full_name = name;
  }

  if (typeof args.email === "string") {
    const normalized = normalizeStaffEmail(args.email);
    if (!EMAIL_RE.test(normalized)) {
      return { ok: false, error: "Enter a valid email address." };
    }
    if (normalized !== normalizeStaffEmail(profile.email)) {
      // Conflict: another profile or auth user already owns this email.
      const { profile: otherProfile, user: otherUser } = await findAuthUserByEmail(normalized);
      if (otherProfile && otherProfile.id !== args.userId) {
        return {
          ok: false,
          error: "That email is already used by another account.",
          code: "email_in_use",
        };
      }
      if (otherUser && otherUser.id !== args.userId) {
        return {
          ok: false,
          error: "That email is already used by another account.",
          code: "email_in_use",
        };
      }

      const { error: authErr } = await raw.auth.admin.updateUserById(args.userId, {
        email: normalized,
        email_confirm: true,
      });
      if (authErr) {
        return { ok: false, error: authErr.message || "Could not update email on auth identity." };
      }
      patch.email = normalized;
      nextEmail = normalized;
      authEmailChanged = true;
    }
  }

  if (args.permissions !== undefined) {
    if (profile.role !== "staff") {
      return {
        ok: false,
        error: "Admins do not use a staff permission matrix. Demote to staff first.",
      };
    }
    const sanitized = sanitizeStaffPermissions(args.permissions);
    if (!sanitized.ok) {
      return {
        ok: false,
        error: sanitized.error,
        code: "never_delegable",
        refusedKeys: sanitized.refusedKeys,
      };
    }
    patch.staff_permissions = sanitized.permissions;
  }

  if (Object.keys(patch).length === 0) {
    const current = sanitizeStaffPermissions(profile.staff_permissions);
    return {
      ok: true,
      profile: {
        id: profile.id,
        email: profile.email,
        full_name: profile.full_name,
        staff_permissions: current.ok ? current.permissions : emptyStaffPermissions(),
      },
    };
  }

  const { data: updated, error } = await raw
    .from("profiles")
    .update(patch)
    .eq("id", args.userId)
    .eq("business_id", args.businessId)
    .select("id, email, full_name, staff_permissions")
    .single();

  if (error || !updated) {
    return { ok: false, error: error?.message || "Could not update staff member." };
  }

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "staff.updated",
    targetBusinessId: args.businessId,
    targetType: "profile",
    targetId: args.userId,
    metadata: {
      fields: Object.keys(patch),
      authEmailChanged,
      nextEmail,
    },
  });

  const perms = sanitizeStaffPermissions(updated.staff_permissions);
  return {
    ok: true,
    profile: {
      id: updated.id,
      email: updated.email,
      full_name: updated.full_name,
      staff_permissions: perms.ok ? perms.permissions : emptyStaffPermissions(),
    },
  };
}

/** Send a password-reset email to the staff member (same auth identity). */
export async function resetStaffPassword(args: {
  businessId: string;
  userId: string;
  actor: { id: string; email: string | null };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = await createServiceClient();
  const profile = await assertActiveStaffOnBusiness(args.businessId, args.userId);
  if (!profile) return { ok: false, error: "Staff member not found." };

  const { data: business } = await raw
    .from("businesses")
    .select(
      "id, slug, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured"
    )
    .eq("id", args.businessId)
    .maybeSingle();
  if (!business) return { ok: false, error: "Business not found." };

  const portalUrl = getBusinessPortalOrigin({
    slug: business.slug,
    custom_domain: business.custom_domain,
    custom_domain_status: business.custom_domain_status,
    custom_domain_vercel_verified: business.custom_domain_vercel_verified,
    custom_domain_misconfigured: business.custom_domain_misconfigured,
  });
  const redirectTo = `${authConfirmUrl(portalUrl)}?${new URLSearchParams({
    next: "/staff",
    return_to: portalUrl,
  }).toString()}`;

  const anon = createSupabaseJsClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
  const { error } = await anon.auth.resetPasswordForEmail(profile.email, { redirectTo });
  if (error) return { ok: false, error: error.message };

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "staff.password_reset_sent",
    targetBusinessId: args.businessId,
    targetType: "profile",
    targetId: args.userId,
    metadata: { email: profile.email },
  });

  return { ok: true };
}

// ---------------------------------------------------------------------------
// project_staff assignment (Phase 2 store; Phase 3 enforcement)
// ---------------------------------------------------------------------------

export type ProjectStaffRow = {
  id: string;
  project_id: string;
  user_id: string;
  business_id: string;
  added_by: string | null;
  added_at: string;
  profiles?: { id: string; email: string; full_name: string | null } | null;
};

export async function listProjectStaff(businessId: string, projectId: string) {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("project_staff")
    .select(
      "id, project_id, user_id, business_id, added_by, added_at, profiles!project_staff_user_id_fkey(id, email, full_name)"
    )
    .eq("business_id", businessId)
    .eq("project_id", projectId)
    .order("added_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as ProjectStaffRow[];
}

export async function listAssignableStaff(businessId: string) {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("profiles")
    .select("id, email, full_name")
    .eq("business_id", businessId)
    .eq("role", "staff")
    .is("disabled_at", null)
    .order("full_name", { ascending: true });
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function assignProjectStaff(args: {
  businessId: string;
  projectId: string;
  userId: string;
  actor: { id: string; email: string | null };
}): Promise<{ ok: true; row: ProjectStaffRow } | { ok: false; error: string }> {
  const raw = await createServiceClient();

  const { data: project } = await raw
    .from("projects")
    .select("id, business_id")
    .eq("id", args.projectId)
    .eq("business_id", args.businessId)
    .maybeSingle();
  if (!project) return { ok: false, error: "Project not found." };

  const staff = await assertActiveStaffOnBusiness(args.businessId, args.userId);
  if (!staff) return { ok: false, error: "Staff member not found on this business." };

  const { data: existing } = await raw
    .from("project_staff")
    .select("id, project_id, user_id, business_id, added_by, added_at")
    .eq("project_id", args.projectId)
    .eq("user_id", args.userId)
    .maybeSingle();
  if (existing) {
    return {
      ok: true,
      row: {
        ...existing,
        profiles: { id: staff.id, email: staff.email, full_name: staff.full_name },
      },
    };
  }

  const { data: inserted, error } = await raw
    .from("project_staff")
    .insert({
      business_id: args.businessId,
      project_id: args.projectId,
      user_id: args.userId,
      added_by: args.actor.id,
    })
    .select("id, project_id, user_id, business_id, added_by, added_at")
    .single();

  if (error || !inserted) {
    return { ok: false, error: error?.message || "Could not assign staff." };
  }

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "staff.project_assigned",
    targetBusinessId: args.businessId,
    targetType: "project_staff",
    targetId: inserted.id,
    metadata: { projectId: args.projectId, userId: args.userId },
  });

  return {
    ok: true,
    row: {
      ...inserted,
      profiles: { id: staff.id, email: staff.email, full_name: staff.full_name },
    },
  };
}

export async function removeProjectStaff(args: {
  businessId: string;
  projectId: string;
  userId: string;
  actor: { id: string; email: string | null };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = await createServiceClient();
  const { error } = await raw
    .from("project_staff")
    .delete()
    .eq("business_id", args.businessId)
    .eq("project_id", args.projectId)
    .eq("user_id", args.userId);
  if (error) return { ok: false, error: error.message };

  void writePlatformAudit({
    actorUserId: args.actor.id,
    actorEmail: args.actor.email,
    action: "staff.project_unassigned",
    targetBusinessId: args.businessId,
    targetType: "project_staff",
    targetId: args.userId,
    metadata: { projectId: args.projectId, userId: args.userId },
  });

  return { ok: true };
}

/**
 * Phase 3 behavior, modeled now: when a staff member creates a project,
 * auto-assign them. Safe to call today — staff cannot create projects yet
 * (Phase 1 denials still apply), so this is inert until Phase 3.
 */
export async function autoAssignCreatorToProject(args: {
  businessId: string;
  projectId: string;
  creatorUserId: string;
  creatorRole: string;
}): Promise<void> {
  if (args.creatorRole !== "staff") return;
  await assignProjectStaff({
    businessId: args.businessId,
    projectId: args.projectId,
    userId: args.creatorUserId,
    actor: { id: args.creatorUserId, email: null },
  });
}

/** Map of project_id → staff user ids (for admin pipeline filter). */
export async function listProjectStaffUserIdsByBusiness(
  businessId: string
): Promise<Map<string, string[]>> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("project_staff")
    .select("project_id, user_id")
    .eq("business_id", businessId);
  if (error) throw new Error(error.message);
  const map = new Map<string, string[]>();
  for (const row of data ?? []) {
    const list = map.get(row.project_id) ?? [];
    list.push(row.user_id);
    map.set(row.project_id, list);
  }
  return map;
}
