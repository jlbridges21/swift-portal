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
};

function parseCommissionRate(raw: unknown): number {
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100) {
    throw new Error("Commission rate must be between 0 and 100.");
  }
  return Math.round(n * 100) / 100;
}

/**
 * Invite (or notify) a partner using generateLink hashed_token → /auth/confirm.
 * Never uses action_link.
 */
export async function invitePartnerUser(options: {
  email: string;
  fullName: string;
  partnerId: string;
}): Promise<{ userId: string | null; inviteSent: boolean; inviteUrl: string | null; inviteError: string | null }> {
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

  if (input.sendInvite !== false) {
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

  const refreshed = (await getPartnerById(partner.id)) ?? (partner as PartnerRow);
  return { partner: refreshed, inviteSent, inviteUrl, inviteError };
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
