/**
 * ShootPortal Partner Program — platform-scoped account helpers.
 * Partners are NOT a profiles.role; link via partners.user_id.
 */

import { createServiceClient } from "@/lib/supabase/server";
import { writePlatformAudit } from "@/lib/platform-audit";
import { authConfirmUrl, buildAuthConfirmLink } from "@/lib/auth-confirm";
import { getPlatformApexOrigin } from "@/lib/portal-url";
import { sendPlatformEmail } from "@/lib/platform-email";
import {
  suggestReferralCodeFromBrand,
  validateReferralCode,
} from "@/lib/reserved-subdomains";

export type PartnerApplicationStatus = "pending" | "approved" | "declined" | "withdrawn";
export type PartnerStatus = "active" | "suspended";

export type PartnerApplicationRow = {
  id: string;
  name: string;
  email: string;
  brand_name: string;
  website: string | null;
  social_links: Record<string, unknown>;
  audience_size: string | null;
  promotion_plan: string | null;
  status: PartnerApplicationStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_note: string | null;
  created_at: string;
  updated_at: string;
};

export type PartnerRow = {
  id: string;
  user_id: string | null;
  application_id: string | null;
  name: string;
  email: string;
  brand_name: string;
  website: string | null;
  social_links: Record<string, unknown>;
  referral_code: string;
  commission_rate_pct: number;
  status: PartnerStatus;
  approved_by: string | null;
  approved_at: string | null;
  notes: string | null;
  referral_discount_enabled?: boolean | null;
  referral_discount_amount_cents?: number | null;
  referral_discount_duration_months?: number | null;
  created_at: string;
  updated_at: string;
  /** Phase 2: count of attributed businesses (read-only). */
  referred_business_count?: number;
};

export type PartnerActor = { id: string; email: string | null };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizePartnerEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidPartnerEmail(raw: string): boolean {
  return EMAIL_RE.test(normalizePartnerEmail(raw));
}

export async function getActivePartnerByUserId(userId: string): Promise<PartnerRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("partners")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  return (data as PartnerRow | null) ?? null;
}

export async function getPartnerByUserId(userId: string): Promise<PartnerRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw.from("partners").select("*").eq("user_id", userId).maybeSingle();
  return (data as PartnerRow | null) ?? null;
}

export async function listPartnerApplications(status?: PartnerApplicationStatus | "all") {
  const raw = await createServiceClient();
  let q = raw.from("partner_applications").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerApplicationRow[];
}

export async function listPartners(status?: PartnerStatus | "all") {
  const raw = await createServiceClient();
  let q = raw.from("partners").select("*").order("created_at", { ascending: false });
  if (status && status !== "all") q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  const partners = (data ?? []) as PartnerRow[];
  if (partners.length === 0) return partners;

  const { data: refs, error: refErr } = await raw
    .from("partner_referrals")
    .select("partner_id")
    .in(
      "partner_id",
      partners.map((p) => p.id)
    );
  if (refErr) throw new Error(refErr.message);

  const counts = new Map<string, number>();
  for (const row of refs ?? []) {
    const id = (row as { partner_id: string }).partner_id;
    counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  return partners.map((p) => ({
    ...p,
    referred_business_count: counts.get(p.id) ?? 0,
  }));
}

export async function listActivePartnersForSelect(): Promise<
  Array<{ id: string; brand_name: string; referral_code: string; email: string }>
> {
  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partners")
    .select("id, brand_name, referral_code, email")
    .eq("status", "active")
    .order("brand_name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Array<{
    id: string;
    brand_name: string;
    referral_code: string;
    email: string;
  }>;
}

export async function getPartnerById(id: string): Promise<PartnerRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw.from("partners").select("*").eq("id", id).maybeSingle();
  return (data as PartnerRow | null) ?? null;
}

export async function getApplicationById(id: string): Promise<PartnerApplicationRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw.from("partner_applications").select("*").eq("id", id).maybeSingle();
  return (data as PartnerApplicationRow | null) ?? null;
}

/** Ensure referral code is valid and unused (optionally excluding one partner id). */
export async function assertUniqueReferralCode(
  rawCode: unknown,
  excludePartnerId?: string | null
): Promise<string> {
  const validated = validateReferralCode(rawCode);
  if (!validated.ok) throw new Error(validated.error);

  const raw = await createServiceClient();
  let q = raw.from("partners").select("id").eq("referral_code", validated.code);
  if (excludePartnerId) q = q.neq("id", excludePartnerId);
  const { data } = await q.maybeSingle();
  if (data) throw new Error("That referral code is already in use.");
  return validated.code;
}

export async function allocateUniqueReferralCode(preferred: string): Promise<string> {
  const baseValidated = validateReferralCode(preferred);
  let candidate = baseValidated.ok ? baseValidated.code : suggestReferralCodeFromBrand(preferred);

  for (let i = 0; i < 25; i++) {
    try {
      return await assertUniqueReferralCode(candidate);
    } catch {
      candidate = `${suggestReferralCodeFromBrand(preferred)}-${(i + 2).toString(36)}`.slice(0, 48);
    }
  }
  return assertUniqueReferralCode(`ref-${Date.now().toString(36)}`);
}

export type SubmitApplicationInput = {
  name: string;
  email: string;
  brandName: string;
  website?: string | null;
  socialLinks?: Record<string, unknown> | null;
  audienceSize?: string | null;
  promotionPlan?: string | null;
};

/**
 * Authenticated in-app application. Email must match the signed-in profile.
 * Duplicate pending rows are suppressed (idempotent success).
 */
export async function submitAuthenticatedPartnerApplication(
  userId: string,
  profileEmail: string,
  input: SubmitApplicationInput
): Promise<void> {
  const email = normalizePartnerEmail(input.email);
  const authEmail = normalizePartnerEmail(profileEmail);
  if (!email || email !== authEmail) {
    throw new Error("Invalid application.");
  }
  await submitPartnerApplication({ ...input, email });
  void userId;
}

/**
 * Public application insert. Always returns a generic success shape to callers —
 * do not reveal whether the email already applied.
 */
export async function submitPartnerApplication(input: SubmitApplicationInput): Promise<void> {
  const name = input.name.trim();
  const email = normalizePartnerEmail(input.email);
  const brandName = input.brandName.trim();
  if (!name || name.length > 200) throw new Error("Invalid application.");
  if (!isValidPartnerEmail(email) || email.length > 320) throw new Error("Invalid application.");
  if (!brandName || brandName.length > 200) throw new Error("Invalid application.");

  const website = input.website?.trim() || null;
  if (website && website.length > 500) throw new Error("Invalid application.");

  const audienceSize = input.audienceSize?.trim() || null;
  const promotionPlan = input.promotionPlan?.trim() || null;
  if (audienceSize && audienceSize.length > 200) throw new Error("Invalid application.");
  if (promotionPlan && promotionPlan.length > 5000) throw new Error("Invalid application.");

  const socialLinks =
    input.socialLinks && typeof input.socialLinks === "object" && !Array.isArray(input.socialLinks)
      ? input.socialLinks
      : {};

  const raw = await createServiceClient();

  // Soft-dedupe pending apps for the same email — still return success either way.
  const { data: existing } = await raw
    .from("partner_applications")
    .select("id")
    .eq("email", email)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) return;

  const { error } = await raw.from("partner_applications").insert({
    name,
    email,
    brand_name: brandName,
    website,
    social_links: socialLinks,
    audience_size: audienceSize,
    promotion_plan: promotionPlan,
    status: "pending",
  });
  if (error) {
    console.error("[partners] application insert failed", error.message);
    throw new Error("Could not submit application.");
  }
}

export type CreatePartnerInput = {
  name: string;
  email: string;
  brandName: string;
  website?: string | null;
  socialLinks?: Record<string, unknown> | null;
  referralCode: string;
  commissionRatePct?: number;
  notes?: string | null;
  applicationId?: string | null;
  sendInvite?: boolean;
};

export type CreatePartnerResult = {
  partner: PartnerRow;
  inviteSent: boolean;
  inviteUrl: string | null;
  inviteError: string | null;
  /** True when an existing profile was linked — no invite / no password reset. */
  linkedExistingUser: boolean;
};

function parseCommissionRate(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error("Commission rate must be between 0 and 100.");
  }
  return Math.round(n * 100) / 100;
}

/**
 * Case-insensitive profile lookup by email. Used before any invite so we never
 * call generateLink({ type: "invite" }) against an existing auth user
 * (Supabase returns email_exists / 422 and partners.user_id would never be set).
 */
export async function findProfileIdByEmail(email: string): Promise<string | null> {
  const raw = await createServiceClient();
  const normalized = normalizePartnerEmail(email);
  if (!normalized) return null;
  const { data } = await raw.from("profiles").select("id, email").ilike("email", normalized);
  const match = (data ?? []).find(
    (row) => normalizePartnerEmail(String(row.email || "")) === normalized
  );
  return match?.id ?? null;
}

/**
 * Link partners.user_id to an existing profile and send a plain approval notice.
 * Does not touch password, session, or auth users.
 */
export async function linkPartnerToExistingUser(options: {
  partnerId: string;
  userId: string;
  email: string;
  fullName: string;
}): Promise<{ notified: boolean; notifyError: string | null }> {
  const raw = await createServiceClient();
  const { error } = await raw
    .from("partners")
    .update({ user_id: options.userId })
    .eq("id", options.partnerId);
  if (error) throw new Error(error.message || "Could not link partner to existing user.");

  const apex = getPlatformApexOrigin().replace(/\/$/, "");
  const emailResult = await sendPlatformEmail({
    to: normalizePartnerEmail(options.email),
    subject: "You're approved for the ShootPortal Partner Program",
    title: "Partner program approved",
    body: `Hi ${options.fullName},\n\nYou've been approved as a ShootPortal partner. Sign in with your existing ShootPortal account — no new password needed — and open Partner from your portal navigation, or visit ${apex}/partner.`,
    ctaLabel: "Open partner home",
    ctaUrl: `${apex}/partner`,
  });

  return {
    notified: Boolean(emailResult.sent),
    notifyError: emailResult.sent
      ? null
      : emailResult.error || emailResult.skipReason || null,
  };
}

/**
 * Invite a NEW auth user into the partner program (no existing profile).
 * Never call this when findProfileIdByEmail returns a match — generateLink
 * type=invite fails with email_exists for registered users.
 */
export async function invitePartnerUser(options: {
  email: string;
  fullName: string;
  partnerId: string;
}): Promise<{ userId: string | null; inviteSent: boolean; inviteUrl: string | null; inviteError: string | null }> {
  const existingProfileId = await findProfileIdByEmail(options.email);
  if (existingProfileId) {
    throw new Error(
      "Refusing generateLink invite: a profile already exists for this email. Link partners.user_id instead."
    );
  }

  const raw = await createServiceClient();
  const email = normalizePartnerEmail(options.email);
  const apex = getPlatformApexOrigin();
  const redirectTo = authConfirmUrl(apex);

  const { data: linkData, error: linkError } = await raw.auth.admin.generateLink({
    type: "invite",
    email,
    options: {
      data: {
        full_name: options.fullName,
        // Do NOT set role: partner — partners are linked via partners.user_id only.
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
      inviteError: linkError?.message || "Could not generate invite link.",
    };
  }

  if (userId) {
    await raw.from("partners").update({ user_id: userId }).eq("id", options.partnerId);
  }

  const inviteUrl = buildAuthConfirmLink({
    portalOrigin: apex,
    tokenHash: hashedToken,
    type: "invite",
    nextPath: "/partner",
  });

  const emailResult = await sendPlatformEmail({
    to: email,
    subject: "You're invited to the ShootPortal Partner Program",
    title: "Welcome to the Partner Program",
    body: `Hi ${options.fullName},\n\nYou've been approved as a ShootPortal partner. Click below to set your password and open your partner home.`,
    ctaLabel: "Accept invite",
    ctaUrl: inviteUrl,
  });

  return {
    userId,
    inviteSent: Boolean(emailResult.sent),
    inviteUrl,
    inviteError: emailResult.sent ? null : emailResult.error || emailResult.skipReason || null,
  };
}

/**
 * Repair partners.user_id when NULL but email matches a profile (case-insensitive).
 * Returns how many rows were updated.
 */
export async function repairPartnerUserIdLinks(): Promise<{
  before: number;
  repaired: number;
  after: number;
}> {
  const raw = await createServiceClient();
  const { data: orphans } = await raw
    .from("partners")
    .select("id, email, user_id")
    .is("user_id", null);

  const candidates: { id: string; email: string; profileId: string }[] = [];
  for (const row of orphans ?? []) {
    const profileId = await findProfileIdByEmail(String(row.email || ""));
    if (profileId) {
      candidates.push({ id: row.id as string, email: String(row.email), profileId });
    }
  }
  const before = candidates.length;
  let repaired = 0;
  for (const c of candidates) {
    const { error } = await raw
      .from("partners")
      .update({ user_id: c.profileId })
      .eq("id", c.id)
      .is("user_id", null);
    if (!error) repaired += 1;
    else console.error("[partners] repair user_id failed", { partnerId: c.id, error: error.message });
  }

  const { data: stillOrphan } = await raw
    .from("partners")
    .select("id, email")
    .is("user_id", null);
  let after = 0;
  for (const row of stillOrphan ?? []) {
    if (await findProfileIdByEmail(String(row.email || ""))) after += 1;
  }

  return { before, repaired, after };
}

export async function createPartner(
  input: CreatePartnerInput,
  actor: PartnerActor
): Promise<CreatePartnerResult> {
  const name = input.name.trim();
  const email = normalizePartnerEmail(input.email);
  const brandName = input.brandName.trim();
  if (!name) throw new Error("Name is required.");
  if (!isValidPartnerEmail(email)) throw new Error("A valid email is required.");
  if (!brandName) throw new Error("Brand name is required.");

  const referralCode = await assertUniqueReferralCode(input.referralCode);
  const commissionRatePct =
    input.commissionRatePct == null ? 30 : parseCommissionRate(input.commissionRatePct);

  const raw = await createServiceClient();
  const { data: existingEmail } = await raw
    .from("partners")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existingEmail) throw new Error("A partner with that email already exists.");

  const socialLinks =
    input.socialLinks && typeof input.socialLinks === "object" && !Array.isArray(input.socialLinks)
      ? input.socialLinks
      : {};

  const { data: partner, error } = await raw
    .from("partners")
    .insert({
      name,
      email,
      brand_name: brandName,
      website: input.website?.trim() || null,
      social_links: socialLinks,
      referral_code: referralCode,
      commission_rate_pct: commissionRatePct,
      status: "active",
      application_id: input.applicationId ?? null,
      approved_by: actor.id,
      approved_at: new Date().toISOString(),
      notes: input.notes?.trim() || null,
    })
    .select("*")
    .single();

  if (error || !partner) throw new Error(error?.message || "Could not create partner.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.create",
    targetType: "partner",
    targetId: partner.id,
    metadata: {
      email,
      referral_code: referralCode,
      commission_rate_pct: commissionRatePct,
      application_id: input.applicationId ?? null,
    },
  });

  let inviteSent = false;
  let inviteUrl: string | null = null;
  let inviteError: string | null = null;
  let linkedExistingUser = false;

  if (input.sendInvite !== false) {
    const existingUserId = await findProfileIdByEmail(email);
    if (existingUserId) {
      const link = await linkPartnerToExistingUser({
        partnerId: partner.id,
        userId: existingUserId,
        email,
        fullName: name,
      });
      linkedExistingUser = true;
      inviteSent = false;
      inviteUrl = null;
      inviteError = link.notifyError;

      await writePlatformAudit({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: "partner.link_existing_user",
        targetType: "partner",
        targetId: partner.id,
        metadata: {
          email,
          userId: existingUserId,
          notified: link.notified,
          notifyError: link.notifyError,
        },
      });
    } else {
      const invite = await invitePartnerUser({
        email,
        fullName: name,
        partnerId: partner.id,
      });
      inviteSent = invite.inviteSent;
      inviteUrl = invite.inviteUrl;
      inviteError = invite.inviteError;

      await writePlatformAudit({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: "partner.invite",
        targetType: "partner",
        targetId: partner.id,
        metadata: {
          email,
          inviteSent,
          inviteError,
          userId: invite.userId,
        },
      });
    }
  }

  const refreshed = (await getPartnerById(partner.id)) ?? (partner as PartnerRow);
  return { partner: refreshed, inviteSent, inviteUrl, inviteError, linkedExistingUser };
}

export async function approvePartnerApplication(
  applicationId: string,
  options: {
    referralCode: string;
    commissionRatePct?: number;
    reviewNote?: string | null;
  },
  actor: PartnerActor
): Promise<CreatePartnerResult> {
  const app = await getApplicationById(applicationId);
  if (!app) throw new Error("Application not found.");
  if (app.status !== "pending") throw new Error("Only pending applications can be approved.");

  const raw = await createServiceClient();
  const { error: updateErr } = await raw
    .from("partner_applications")
    .update({
      status: "approved",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      review_note: options.reviewNote?.trim() || null,
    })
    .eq("id", applicationId);
  if (updateErr) throw new Error(updateErr.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.application_approve",
    targetType: "partner_application",
    targetId: applicationId,
    metadata: { email: app.email, review_note: options.reviewNote?.trim() || null },
  });

  return createPartner(
    {
      name: app.name,
      email: app.email,
      brandName: app.brand_name,
      website: app.website,
      socialLinks: app.social_links,
      referralCode: options.referralCode,
      commissionRatePct: options.commissionRatePct,
      applicationId: app.id,
      sendInvite: true,
    },
    actor
  );
}

export async function declinePartnerApplication(
  applicationId: string,
  reviewNote: string | null,
  actor: PartnerActor
): Promise<PartnerApplicationRow> {
  const app = await getApplicationById(applicationId);
  if (!app) throw new Error("Application not found.");
  if (app.status !== "pending") throw new Error("Only pending applications can be declined.");

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partner_applications")
    .update({
      status: "declined",
      reviewed_by: actor.id,
      reviewed_at: new Date().toISOString(),
      review_note: reviewNote?.trim() || null,
    })
    .eq("id", applicationId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not decline application.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.application_decline",
    targetType: "partner_application",
    targetId: applicationId,
    metadata: { email: app.email, review_note: reviewNote?.trim() || null },
  });

  return data as PartnerApplicationRow;
}

export type UpdatePartnerInput = {
  name?: string;
  email?: string;
  brandName?: string;
  website?: string | null;
  referralCode?: string;
  commissionRatePct?: number;
  status?: PartnerStatus;
  notes?: string | null;
  referralDiscountEnabled?: boolean | null;
  referralDiscountAmountCents?: number | null;
  referralDiscountDurationMonths?: number | null;
  /** When true, clear all referral discount override fields. */
  clearReferralDiscountOverride?: boolean;
};

export type UpdatePartnerResult = PartnerRow & {
  referralDiscountCouponSyncOk?: boolean | null;
  referralDiscountCouponSyncMessage?: string | null;
};

export async function updatePartner(
  partnerId: string,
  input: UpdatePartnerInput,
  actor: PartnerActor
): Promise<UpdatePartnerResult> {
  const existing = await getPartnerById(partnerId);
  if (!existing) throw new Error("Partner not found.");

  const patch: Record<string, unknown> = {};
  if (input.name != null) {
    const name = input.name.trim();
    if (!name) throw new Error("Name is required.");
    patch.name = name;
  }
  if (input.brandName != null) {
    const brandName = input.brandName.trim();
    if (!brandName) throw new Error("Brand name is required.");
    patch.brand_name = brandName;
  }
  if (input.website !== undefined) {
    patch.website = input.website?.trim() || null;
  }
  if (input.notes !== undefined) {
    patch.notes = input.notes?.trim() || null;
  }
  if (input.email != null) {
    const email = normalizePartnerEmail(input.email);
    if (!isValidPartnerEmail(email)) throw new Error("A valid email is required.");
    const raw = await createServiceClient();
    const { data: clash } = await raw
      .from("partners")
      .select("id")
      .eq("email", email)
      .neq("id", partnerId)
      .maybeSingle();
    if (clash) throw new Error("A partner with that email already exists.");
    patch.email = email;
  }
  if (input.referralCode != null) {
    patch.referral_code = await assertUniqueReferralCode(input.referralCode, partnerId);
  }
  if (input.commissionRatePct != null) {
    patch.commission_rate_pct = parseCommissionRate(input.commissionRatePct);
  }
  if (input.status != null) {
    if (input.status !== "active" && input.status !== "suspended") {
      throw new Error("Invalid partner status.");
    }
    patch.status = input.status;
  }
  if (input.clearReferralDiscountOverride) {
    patch.referral_discount_enabled = null;
    patch.referral_discount_amount_cents = null;
    patch.referral_discount_duration_months = null;
  } else {
    if (input.referralDiscountEnabled !== undefined) {
      patch.referral_discount_enabled = input.referralDiscountEnabled;
    }
    if (input.referralDiscountAmountCents !== undefined) {
      const n = input.referralDiscountAmountCents;
      if (n != null && (n < 0 || !Number.isFinite(n))) {
        throw new Error("Referral discount amount must be a non-negative number.");
      }
      patch.referral_discount_amount_cents = n == null ? null : Math.round(n);
    }
    if (input.referralDiscountDurationMonths !== undefined) {
      const n = input.referralDiscountDurationMonths;
      if (n != null && (n < 0 || n > 36 || !Number.isFinite(n))) {
        throw new Error("Referral discount duration must be between 0 and 36 months.");
      }
      patch.referral_discount_duration_months = n == null ? null : Math.round(n);
    }
  }

  const discountFieldsChanging =
    input.clearReferralDiscountOverride ||
    input.referralDiscountEnabled !== undefined ||
    input.referralDiscountAmountCents !== undefined ||
    input.referralDiscountDurationMonths !== undefined;

  if (!Object.keys(patch).length) {
    return { ...existing, referralDiscountCouponSyncOk: null, referralDiscountCouponSyncMessage: null };
  }

  const raw = await createServiceClient();
  const { data, error } = await raw
    .from("partners")
    .update(patch)
    .eq("id", partnerId)
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message || "Could not update partner.");

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "partner.update",
    targetType: "partner",
    targetId: partnerId,
    metadata: { patch },
  });

  let referralDiscountCouponSyncOk: boolean | null = null;
  let referralDiscountCouponSyncMessage: string | null = null;

  if (discountFieldsChanging) {
    const { ensurePartnerReferralDiscountCoupon } = await import("@/lib/partner-referral-discount");
    const sync = await ensurePartnerReferralDiscountCoupon(partnerId);
    referralDiscountCouponSyncOk = sync.ok;
    referralDiscountCouponSyncMessage = sync.message ?? null;
    if (!sync.ok) {
      console.error("[partners] partner referral discount coupon ensure FAILED", {
        partnerId,
        message: sync.message,
      });
    }
  }

  return {
    ...(data as PartnerRow),
    referralDiscountCouponSyncOk,
    referralDiscountCouponSyncMessage,
  };
}
