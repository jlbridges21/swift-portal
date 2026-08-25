import { DEFAULT_APP_SETTINGS } from "@/lib/app-settings";
import { PLATFORM_EMAIL_SENDER_DEFAULTS } from "@/lib/email-sender-policy";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import { writePlatformAudit } from "@/lib/platform-audit";
import { isBusinessProtected } from "@/lib/business-protection";
import { validateBusinessSlug } from "@/lib/reserved-subdomains";
import { createServiceClient } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { getBusinessPortalOrigin } from "@/lib/portal-url";
import { authConfirmUrl } from "@/lib/auth-confirm";
import { FALLBACK_SERVICE_TEMPLATES } from "@/lib/service-templates";
import { invalidateHostLookupCache } from "@/lib/host-resolution";
import {
  assertActivePlanKey,
  planGrantsEntitlement,
  resolvePlanTrialDays,
} from "@/lib/entitlements";
import { isSubscriptionStatus } from "@/lib/subscription";
import {
  attributeBusinessToPartner,
  isSelfReferral,
  PARTNER_REF_COOKIE,
  partnerRefCookieOptions,
  resolveActivePartnerFromRefClaims,
  verifyPartnerRefCookie,
  type ActivePartnerRef,
  type PartnerReferralSource,
} from "@/lib/partner-referral";
import { cookies } from "next/headers";
import { getPartnerById } from "@/lib/partners";

const STARTER_SLUGS = [
  "aerial_photography",
  "aerial_videography",
  "drone_mapping",
  "custom_project",
] as const;

export type CreateBusinessSource = "platform" | "signup";

export type CreateBusinessInput = {
  name: string;
  slug: string;
  customDomain?: string | null;
  plan?: string;
  adminEmail: string;
  adminName?: string;
  /** Defaults to platform (super_admin console). */
  source?: CreateBusinessSource;
  /** Required when source is signup without existingUserId — password auth. */
  password?: string;
  /**
   * OAuth finish-setup: attach this already-authenticated user as admin instead
   * of creating a password account. Uses signup trial + sp_partner_ref attribution.
   */
  existingUserId?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
  /**
   * Platform console only: optional partner UUID for manual attribution
   * (source `manual`). Ignored on signup — signup uses the signed ref cookie.
   */
  referredByPartnerId?: string | null;
};

export type CreateBusinessResult = {
  businessId: string;
  slug: string;
  portalUrl: string;
  adminEmail: string;
  inviteSent: boolean;
  /** Set when the business was created but invite email did not send. */
  inviteError?: string | null;
  /** Existing auth user with no business was attached as admin. */
  attachedExisting?: boolean;
  stagesNote: string;
  /** Present for signup — user must confirm email before login. */
  requiresEmailConfirmation?: boolean;
};

export const SYSTEM_SIGNUP_ACTOR = {
  id: null as string | null,
  email: "system@signup.shootportal.app",
};

async function clearPartnerRefCookieBestEffort() {
  try {
    const jar = await cookies();
    jar.set(PARTNER_REF_COOKIE, "", { ...partnerRefCookieOptions(0), maxAge: 0 });
  } catch {
    /* non-mutable cookie store */
  }
}

/**
 * Attribution must never block business creation. Failures are logged and ignored.
 * Returns true only when partner_referrals + referred_by_partner_id were written.
 */
async function tryAttributeNewBusiness(args: {
  businessId: string;
  source: CreateBusinessSource;
  adminEmail: string;
  signupUserId?: string | null;
  referredByPartnerId?: string | null;
}): Promise<boolean> {
  try {
    let partner: ActivePartnerRef | null = null;
    let referralCodeUsed = "";
    let attrSource: PartnerReferralSource = "link";

    if (args.source === "signup") {
      let rawCookie: string | undefined;
      try {
        const jar = await cookies();
        rawCookie = jar.get(PARTNER_REF_COOKIE)?.value;
      } catch {
        rawCookie = undefined;
      }
      const claims = verifyPartnerRefCookie(rawCookie);
      partner = await resolveActivePartnerFromRefClaims(claims);
      if (!partner || !claims) return false;
      referralCodeUsed = claims.code;
      attrSource = claims.source === "landing_page" ? "landing_page" : "link";
    } else if (args.referredByPartnerId) {
      const row = await getPartnerById(args.referredByPartnerId);
      if (!row || row.status !== "active") return false;
      partner = {
        id: row.id,
        email: row.email,
        user_id: row.user_id,
        referral_code: row.referral_code,
        status: row.status,
      };
      referralCodeUsed = row.referral_code;
      attrSource = "manual";
    } else {
      return false;
    }

    if (
      isSelfReferral({
        partner,
        signupEmail: args.adminEmail,
        signupUserId: args.signupUserId,
      })
    ) {
      console.info("[partner-ref] self-referral skipped", {
        businessId: args.businessId,
        partnerId: partner.id,
      });
      return false;
    }

    const wrote = await attributeBusinessToPartner({
      businessId: args.businessId,
      partnerId: partner.id,
      referralCodeUsed,
      source: attrSource,
    });

    if (wrote && args.source === "signup") {
      await clearPartnerRefCookieBestEffort();
    }
    return wrote;
  } catch (err) {
    console.error("[partner-ref] attribution failed (signup continues)", {
      businessId: args.businessId,
      detail: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

function normalizeDomain(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") ?? "";
  return v || null;
}

/** Compute trial_ends_at from a day count. 0 → null (no trial clock). */
function trialEndsAtFromDays(days: number, from = new Date()): string | null {
  if (days <= 0) return null;
  return new Date(from.getTime() + days * 24 * 60 * 60 * 1000).toISOString();
}

async function rollbackBusinessProvision(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  businessId: string,
  userId?: string | null
) {
  try {
    if (userId) {
      try {
        await raw.auth.admin.deleteUser(userId);
      } catch {
        /* best-effort */
      }
      await raw.from("profiles").delete().eq("id", userId);
    }
    await raw.from("business_services").delete().eq("business_id", businessId);
    await raw.from("business_integrations").delete().eq("business_id", businessId);
    await raw.from("business_settings").delete().eq("business_id", businessId);
    await raw.from("businesses").delete().eq("id", businessId);
  } catch (err) {
    console.error("[signup] reason=rollback_failed", {
      event: "signup_failure",
      reason: "rollback_failed",
      businessId,
      userId: userId ?? null,
      detail: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Shared provisioning for platform console and self-serve /signup.
 * Platform path (default) is unchanged: invite email, no trial, actor audit.
 * Signup path: studio plan; trial length from plans.trial_days (0 → paywalled).
 * trial_ends_at is written only on INSERT — editing plans.trial_days later never
 * rewrites existing businesses.
 */
export async function createBusinessForPlatform(
  input: CreateBusinessInput,
  actor: { id: string | null; email: string | null }
): Promise<CreateBusinessResult> {
  const source: CreateBusinessSource = input.source ?? "platform";
  const name = input.name.trim();
  if (!name) throw new Error("Business name is required.");
  const slugCheck = validateBusinessSlug(input.slug);
  if (!slugCheck.ok) throw new Error(slugCheck.error);
  const customDomain = normalizeDomain(input.customDomain);
  const planRow = await assertActivePlanKey(
    input.plan || (source === "signup" ? "studio" : "studio")
  );
  const plan = planRow.key;
  const adminEmail = input.adminEmail.trim().toLowerCase();
  if (!adminEmail || !adminEmail.includes("@")) throw new Error("A valid admin email is required.");
  const adminName = (input.adminName || name).trim() || name;

  if (source === "signup" && !input.existingUserId) {
    const password = input.password ?? "";
    if (password.length < 8) throw new Error("Password must be at least 8 characters.");
  }
  if (source === "signup" && input.existingUserId) {
    const id = input.existingUserId.trim();
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid existing user.");
  }

  if (customDomain && !(await planGrantsEntitlement(plan, "custom_domain"))) {
    throw new Error(
      `Custom domain is not included on the ${planRow.name} plan. Choose a plan that includes custom domain (e.g. Studio).`
    );
  }

  const trialDays = resolvePlanTrialDays(planRow, `signup_plan:${plan}`);
  // Snapshot at create time only — never updated when plans.trial_days changes later.
  const defaultSignupStatus = trialDays > 0 ? "trialing" : "trial_expired";
  const subscriptionStatus =
    input.subscriptionStatus ?? (source === "signup" ? defaultSignupStatus : "active");
  if (!isSubscriptionStatus(subscriptionStatus)) {
    throw new Error("Invalid subscription_status.");
  }
  const trialEndsAt =
    input.trialEndsAt !== undefined
      ? input.trialEndsAt
      : source === "signup"
        ? trialEndsAtFromDays(trialDays)
        : null;

  const raw = await createServiceClient();

  const { data: slugTaken } = await raw.from("businesses").select("id").eq("slug", slugCheck.slug).maybeSingle();
  if (slugTaken) throw new Error("That slug is already in use.");
  if (customDomain) {
    const { data: domainTaken } = await raw
      .from("businesses")
      .select("id")
      .eq("custom_domain", customDomain)
      .maybeSingle();
    if (domainTaken) throw new Error("That custom domain is already in use.");
  }

  // 1–2. Create business + dependents BEFORE auth user (signup needs business_id in metadata)
  if (source === "signup" && !input.existingUserId) {
    const { data: listed } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listed.users.some((u) => u.email?.toLowerCase() === adminEmail)) {
      throw new Error("Could not create account.");
    }
  }
  if (source === "signup" && input.existingUserId) {
    const { data: existingAuth, error: existingErr } = await raw.auth.admin.getUserById(
      input.existingUserId
    );
    if (existingErr || !existingAuth.user) {
      throw new Error("Signed-in user was not found.");
    }
    if ((existingAuth.user.email || "").toLowerCase() !== adminEmail) {
      throw new Error("Signed-in email does not match.");
    }
    const { data: existingProfile } = await raw
      .from("profiles")
      .select("id, role, business_id")
      .eq("id", input.existingUserId)
      .maybeSingle();
    if (existingProfile?.role === "super_admin") {
      throw new Error("Super-admin accounts cannot create a studio this way.");
    }
    if (existingProfile?.business_id) {
      throw new Error("This account already belongs to a business.");
    }
  }

  const { data: business, error: bizErr } = await raw
    .from("businesses")
    .insert({
      name,
      slug: slugCheck.slug,
      custom_domain: customDomain,
      plan,
      status: "active",
      created_via: source,
      subscription_status: subscriptionStatus,
      trial_ends_at: trialEndsAt,
    })
    .select("id, slug, name, custom_domain")
    .single();
  if (bizErr || !business) throw new Error(bizErr?.message || "Failed to create business.");

  const businessId = business.id as string;
  let createdUserId: string | null = null;

  // Attribution is creation-only and must never block provisioning.
  await tryAttributeNewBusiness({
    businessId,
    source,
    adminEmail,
    signupUserId: input.existingUserId ?? null,
    referredByPartnerId: source === "platform" ? input.referredByPartnerId : null,
  });

  try {
    const settings = structuredClone(DEFAULT_APP_SETTINGS);
    settings.business = {
      ...PLATFORM_BUSINESS_DEFAULTS,
      businessName: name,
      portalName: name,
      legalName: name,
      adminDisplayName: adminName,
    };
    settings.email = {
      ...settings.email,
      ...PLATFORM_EMAIL_SENDER_DEFAULTS,
      fromName: name,
      senderEmail: "",
      senderMode: "platform",
      domainVerificationStatus: "unverified",
    };

    const { error: settingsErr } = await raw.from("business_settings").insert({
      business_id: businessId,
      settings,
      updated_by: actor.id,
    });
    if (settingsErr) throw new Error(settingsErr.message);

    const { error: integErr } = await raw.from("business_integrations").insert({
      business_id: businessId,
      stripe_account_status: "not_connected",
    });
    if (integErr) throw new Error(integErr.message);

    const starter = FALLBACK_SERVICE_TEMPLATES.filter((t) =>
      (STARTER_SLUGS as readonly string[]).includes(t.id)
    );
    const serviceRows = starter.map((t, i) => ({
      business_id: businessId,
      name: t.title,
      slug: t.id,
      description: (t.description ?? "").replaceAll("{{portalName}}", name).replaceAll("{{businessName}}", name),
      preliminary_estimate_cents: t.startingAtCents,
      starting_label: t.startingLabel,
      includes: t.includes.map((line) => line.replaceAll("{{portalName}}", name)),
      line_items: t.lineItems,
      notes: t.notes,
      hide_pricing: Boolean(t.hidePricing),
      is_recommended: Boolean(t.recommended),
      display_order: i,
      is_active: true,
      aliases: t.serviceNames,
    }));
    const { error: svcErr } = await raw.from("business_services").insert(serviceRows);
    if (svcErr) throw new Error(svcErr.message);

    const portalUrl = getBusinessPortalOrigin({
      slug: slugCheck.slug,
      custom_domain: customDomain,
    });

    let inviteSent = false;
    let inviteError: string | null = null;
    let attachedExisting = false;
    let requiresEmailConfirmation = false;

    // Verification hook: force failure after dependents exist, before auth user.
    if (source === "signup" && process.env.SIGNUP_FORCE_FAIL_AFTER_BUSINESS === "1") {
      throw new Error("Forced failure after business provision (verification).");
    }

    if (source === "platform") {
      if (!actor.id) throw new Error("Platform create requires a super_admin actor.");
      // Invite failure must NOT roll back the business — surface for Resend invite.
      const invite = await inviteBusinessAdmin(
        businessId,
        adminEmail,
        adminName,
        { id: actor.id, email: actor.email },
        { isCreate: true }
      );
      inviteSent = invite.inviteSent;
      inviteError = invite.inviteError ?? null;
      attachedExisting = Boolean(invite.attachedExisting);
      createdUserId = invite.userId;
      // Email already on another business / super_admin — roll back empty tenant.
      if (!createdUserId && inviteError && /already belongs|super-admin/i.test(inviteError)) {
        throw new Error(inviteError);
      }
      if (!inviteSent) {
        console.error("[platform-invite] reason=invite_failed_on_create", {
          event: "platform_invite_failure",
          businessId,
          slug: slugCheck.slug,
          adminEmail,
          detail: inviteError,
        });
      }

      await writePlatformAudit({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: "business.create",
        targetBusinessId: businessId,
        targetType: "business",
        targetId: businessId,
        metadata: {
          source,
          slug: slugCheck.slug,
          name,
          adminEmail,
          inviteSent,
          inviteError,
          attachedExisting,
          plan,
        },
      });
    } else if (input.existingUserId) {
      // OAuth finish-setup: attach the already-authenticated user as admin.
      const existingUserId = input.existingUserId;
      createdUserId = existingUserId;

      const { error: metaErr } = await raw.auth.admin.updateUserById(existingUserId, {
        user_metadata: {
          role: "admin",
          business_id: businessId,
          full_name: adminName,
        },
      });
      if (metaErr) throw new Error(metaErr.message || "Could not attach account.");

      const { error: profileErr } = await raw
        .from("profiles")
        .update({
          role: "admin",
          business_id: businessId,
          client_id: null,
          full_name: adminName,
          email: adminEmail,
        })
        .eq("id", existingUserId);
      if (profileErr) throw new Error(profileErr.message);

      requiresEmailConfirmation = false;

      await writePlatformAudit({
        actorUserId: existingUserId,
        actorEmail: adminEmail,
        action: "business.create",
        targetBusinessId: businessId,
        targetType: "business",
        targetId: businessId,
        metadata: {
          source: "oauth_signup",
          slug: slugCheck.slug,
          name,
          adminEmail,
          plan,
          subscription_status: subscriptionStatus,
          trial_ends_at: trialEndsAt,
          existingUserId,
        },
      });
    } else {
      // 3. Password signup. Prefer anon.signUp so Supabase sends confirmation mail.
      // SIGNUP_TEST_NO_EMAIL=1 uses admin.createUser (auto-confirm) for local verification
      // when Supabase email rate limits block signUp.
      let newUserId: string | null = null;
      if (process.env.SIGNUP_TEST_NO_EMAIL === "1") {
        const { data: created, error: createErr } = await raw.auth.admin.createUser({
          email: adminEmail,
          password: input.password!,
          email_confirm: true,
          user_metadata: {
            role: "admin",
            business_id: businessId,
            full_name: adminName,
          },
        });
        if (createErr || !created.user) {
          throw new Error(createErr?.message || "Could not create account.");
        }
        newUserId = created.user.id;
        requiresEmailConfirmation = false;
      } else {
        const anon = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );
        const { data: signedUp, error: signErr } = await anon.auth.signUp({
          email: adminEmail,
          password: input.password!,
          options: {
            data: {
              role: "admin",
              business_id: businessId,
              full_name: adminName,
            },
            emailRedirectTo: authConfirmUrl(portalUrl),
          },
        });
        if (signErr || !signedUp.user) {
          throw new Error(signErr?.message || "Could not create account.");
        }
        // Supabase returns a user with empty identities when the email already
        // exists (and confirmation is required) — treat as failure and roll back.
        if (!signedUp.user.identities || signedUp.user.identities.length === 0) {
          throw new Error("Could not create account.");
        }
        newUserId = signedUp.user.id;
        requiresEmailConfirmation = !signedUp.session;
      }
      createdUserId = newUserId;

      // Belt-and-suspenders: trigger should have set business_id; ensure role/name
      await raw
        .from("profiles")
        .update({
          role: "admin",
          business_id: businessId,
          client_id: null,
          full_name: adminName,
          email: adminEmail,
        })
        .eq("id", createdUserId);

      await writePlatformAudit({
        actorUserId: null,
        actorEmail: SYSTEM_SIGNUP_ACTOR.email,
        action: "business.create",
        targetBusinessId: businessId,
        targetType: "business",
        targetId: businessId,
        metadata: {
          source: "signup",
          slug: slugCheck.slug,
          name,
          adminEmail,
          plan,
          subscription_status: subscriptionStatus,
          trial_ends_at: trialEndsAt,
          requiresEmailConfirmation,
        },
      });
    }

    invalidateHostLookupCache();

    return {
      businessId,
      slug: slugCheck.slug,
      portalUrl,
      adminEmail,
      inviteSent,
      inviteError,
      attachedExisting,
      requiresEmailConfirmation,
      stagesNote:
        "business_stages does not exist yet — stage automation is still workflow settings JSON, not a table.",
    };
  } catch (error) {
    await rollbackBusinessProvision(raw, businessId, createdUserId);
    invalidateHostLookupCache();
    throw error;
  }
}

export async function inviteBusinessAdmin(
  businessId: string,
  email: string,
  fullName: string,
  actor: { id: string; email: string | null },
  options?: { isCreate?: boolean; resend?: boolean }
): Promise<{
  inviteSent: boolean;
  userId: string | null;
  inviteError?: string | null;
  alreadyExists?: boolean;
  attachedExisting?: boolean;
}> {
  const raw = await createServiceClient();
  const { data: business } = await raw
    .from("businesses")
    .select("id, slug, name, custom_domain")
    .eq("id", businessId)
    .maybeSingle();
  if (!business) throw new Error("Business not found.");

  const portalUrl = getBusinessPortalOrigin({
    slug: business.slug,
    custom_domain: business.custom_domain,
  });
  // Invite: RedirectTo = tenant /auth/confirm (TokenHash templates append ?token_hash=&type=invite).
  const redirectTo = authConfirmUrl(portalUrl);
  const normalizedEmail = email.trim().toLowerCase();

  // Look up existing auth user first so we can distinguish "already registered"
  // from a pure send failure.
  const users = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const existing = users.data.users.find((u) => u.email?.toLowerCase() === normalizedEmail);

  if (existing) {
    const { data: profile } = await raw
      .from("profiles")
      .select("id, role, business_id")
      .eq("id", existing.id)
      .maybeSingle();

    if (profile?.role === "super_admin") {
      const msg =
        "That email belongs to a platform super-admin and cannot be invited as a business admin.";
      if (!options?.isCreate) throw new Error(msg);
      return {
        inviteSent: false,
        userId: null,
        inviteError: msg,
        alreadyExists: true,
        attachedExisting: false,
      };
    }

    const existingBid = profile?.business_id ?? null;
    if (existingBid && existingBid !== businessId) {
      const { data: other } = await raw
        .from("businesses")
        .select("name, slug")
        .eq("id", existingBid)
        .maybeSingle();
      const label = other?.name || other?.slug || "another business";
      const msg = `That email already belongs to ${label}. One person can only administer one business — use a different email.`;
      console.error("[platform-invite] reason=email_belongs_other_business", {
        event: "platform_invite_failure",
        businessId,
        email: normalizedEmail,
        otherBusinessId: existingBid,
      });
      if (!options?.isCreate) throw new Error(msg);
      return {
        inviteSent: false,
        userId: null,
        inviteError: msg,
        alreadyExists: true,
        attachedExisting: false,
      };
    }

    // Exists with no business (or already this business) — attach as admin.
    // Orphan auth users may have no profiles row (trigger missed) — upsert.
    await raw.auth.admin.updateUserById(existing.id, {
      user_metadata: {
        ...existing.user_metadata,
        role: "admin",
        business_id: businessId,
        full_name: fullName,
      },
    });
    const { error: profileErr } = await raw.from("profiles").upsert(
      {
        id: existing.id,
        role: "admin",
        business_id: businessId,
        client_id: null,
        full_name: fullName,
        email: normalizedEmail,
      },
      { onConflict: "id" }
    );
    if (profileErr) {
      const msg = `Could not attach existing account as admin: ${profileErr.message}`;
      if (!options?.isCreate) throw new Error(msg);
      return {
        inviteSent: false,
        userId: null,
        inviteError: msg,
        alreadyExists: true,
        attachedExisting: false,
      };
    }

    // Prefer invite email when still unconfirmed; otherwise signup resend.
    let inviteSent = false;
    let inviteError: string | null = null;
    if (!existing.email_confirmed_at) {
      const invited = await raw.auth.admin.inviteUserByEmail(normalizedEmail, {
        data: { role: "admin", business_id: businessId, full_name: fullName },
        redirectTo,
      });
      if (!invited.error) {
        inviteSent = true;
      } else {
        const anon = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
          { auth: { persistSession: false, autoRefreshToken: false } }
        );
        const { error: resendErr } = await anon.auth.resend({
          type: "signup",
          email: normalizedEmail,
          options: { emailRedirectTo: redirectTo },
        });
        inviteSent = !resendErr;
        inviteError = resendErr?.message || invited.error.message || null;
      }
    } else {
      // Confirmed user attached — no invite email needed; they can sign in now.
      inviteSent = true;
      inviteError = null;
    }

    if (!options?.isCreate) {
      await writePlatformAudit({
        actorUserId: actor.id,
        actorEmail: actor.email,
        action: options?.resend ? "admin.invite_resend" : "admin.invite",
        targetBusinessId: businessId,
        targetType: "profile",
        targetId: existing.id,
        metadata: {
          email: normalizedEmail,
          inviteSent,
          inviteError,
          alreadyExists: true,
          attachedExisting: true,
        },
      });
    }

    return {
      inviteSent,
      userId: existing.id,
      inviteError: inviteSent
        ? null
        : inviteError ||
          "Attached existing account as admin, but the confirmation email failed to send — use Resend invite.",
      alreadyExists: true,
      attachedExisting: true,
    };
  }

  // Brand-new email — invite (or force-fail for verification).
  const invited =
    process.env.PLATFORM_FORCE_INVITE_FAIL === "1"
      ? {
          data: { user: null },
          error: { message: "Forced invite failure (verification)" },
        }
      : await raw.auth.admin.inviteUserByEmail(normalizedEmail, {
          data: {
            role: "admin",
            business_id: businessId,
            full_name: fullName,
          },
          redirectTo,
        });

  let userId = invited.data.user?.id ?? null;
  let inviteSent = !invited.error;
  let inviteError: string | null = invited.error?.message ?? null;

  if (invited.error) {
    console.error("[platform-invite] reason=invite_email_failed", {
      event: "platform_invite_failure",
      businessId,
      slug: business.slug,
      email: normalizedEmail,
      resend: Boolean(options?.resend),
      isCreate: Boolean(options?.isCreate),
      detail: invited.error.message,
    });

    // Send failure with no existing user — create unconfirmed so Resend has a target.
    const { data: created, error: createErr } = await raw.auth.admin.createUser({
      email: normalizedEmail,
      email_confirm: false,
      user_metadata: {
        role: "admin",
        business_id: businessId,
        full_name: fullName,
      },
    });
    if (createErr || !created.user) {
      inviteSent = false;
      inviteError = invited.error.message || createErr?.message || "Invite email failed.";
      if (!options?.isCreate) throw new Error(inviteError);
      console.error("[platform-invite] reason=user_create_after_invite_failed", {
        event: "platform_invite_failure",
        businessId,
        detail: inviteError,
      });
    } else {
      userId = created.user.id;
      inviteSent = false;
      inviteError =
        invited.error.message ||
        "Business created, but the invite email failed to send — resend it.";
    }
  }

  if (userId) {
    await raw
      .from("profiles")
      .update({
        role: "admin",
        business_id: businessId,
        client_id: null,
        full_name: fullName,
        email: normalizedEmail,
      })
      .eq("id", userId);
  }

  if (!options?.isCreate) {
    await writePlatformAudit({
      actorUserId: actor.id,
      actorEmail: actor.email,
      action: options?.resend ? "admin.invite_resend" : "admin.invite",
      targetBusinessId: businessId,
      targetType: "profile",
      targetId: userId,
      metadata: { email: normalizedEmail, inviteSent, inviteError, alreadyExists: false },
    });
  }

  return { inviteSent, userId, inviteError, alreadyExists: false, attachedExisting: false };
}

export async function hardDeleteBusiness(
  businessId: string,
  actor: { id: string; email: string | null }
): Promise<{ name: string; orphans: string[] }> {
  if (await isBusinessProtected(businessId)) {
    throw new Error("Protected production businesses cannot be hard-deleted.");
  }
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select(
      "id, name, slug, stripe_customer_id, stripe_customer_id_test, stripe_customer_id_live, stripe_subscription_id, stripe_subscription_id_test, stripe_subscription_id_live"
    )
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");
  const name = existing.name as string;
  const slug = existing.slug as string;
  const orphans: string[] = [];

  // partner_commissions.subscription_payment_id ON DELETE RESTRICT — ledger rows are
  // append-only and must survive. Hard-delete is blocked while commissions exist.
  const { count: commissionCount } = await raw
    .from("partner_commissions")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId);
  if ((commissionCount ?? 0) > 0) {
    throw new Error(
      "Cannot hard-delete a business with partner commission history. Soft-delete instead; the ledger must remain reconstructable."
    );
  }

  // Storage wipe (tenant paths). Legacy non-prefixed objects may remain — reported.
  const storageOrphans = await wipeBusinessStorage(raw, businessId);
  orphans.push(...storageOrphans);

  // Stripe Billing customer for the active mode (test or live key in this deploy).
  const stripeOrphans = await wipeBusinessStripeCustomer(existing);
  orphans.push(...stripeOrphans);

  const tables = [
    "platform_email_sends",
    "partner_referrals",
    "media_asset_events",
    "media_asset_tags",
    "media_downloads",
    "media_assets",
    "media_folders",
    "project_message_reads",
    "project_messages",
    "client_message_reads",
    "client_messages",
    "notifications",
    "email_events",
    "communications",
    "activity_logs",
    "client_notes",
    "asset_reviews",
    "revisions",
    "shoot_proposals",
    "payments",
    "project_quotes",
    "project_clients",
    "tours",
    "projects",
    "properties",
    "leads",
    "clients",
    "business_services",
    "business_settings",
    "business_integrations",
  ];

  const { data: profiles } = await raw.from("profiles").select("id").eq("business_id", businessId);
  for (const table of tables) {
    const { error } = await raw.from(table).delete().eq("business_id", businessId);
    if (error && !error.message.toLowerCase().includes("does not exist")) {
      throw new Error(`${table}: ${error.message}`);
    }
  }

  await raw.from("profiles").update({ business_id: null, client_id: null }).eq("business_id", businessId);

  const { error: bizErr } = await raw.from("businesses").delete().eq("id", businessId);
  if (bizErr) throw new Error(bizErr.message);

  const authFailures: string[] = [];
  for (const profile of profiles ?? []) {
    const { error } = await raw.auth.admin.deleteUser(profile.id);
    if (error) authFailures.push(`${profile.id}: ${error.message}`);
  }
  if (authFailures.length) {
    orphans.push(`auth_users_failed:${authFailures.join("; ")}`);
  }

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "business.hard_delete",
    targetBusinessId: null,
    targetType: "business",
    targetId: businessId,
    metadata: { slug, name, orphans },
  });
  invalidateHostLookupCache();
  return { name, orphans };
}

const STORAGE_BUCKETS = ["project-media", "project-documents", "avatars"] as const;

async function listStoragePathsRecursive(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  bucket: string,
  folder: string,
  depth = 0
): Promise<string[]> {
  if (depth > 12) return [];
  const { data, error } = await raw.storage.from(bucket).list(folder, { limit: 1000 });
  if (error || !data?.length) return [];
  const paths: string[] = [];
  for (const item of data) {
    const full = folder ? `${folder}/${item.name}` : item.name;
    // Files have an id; folders typically do not.
    if (item.id) {
      paths.push(full);
    } else {
      paths.push(...(await listStoragePathsRecursive(raw, bucket, full, depth + 1)));
    }
  }
  return paths;
}

async function wipeBusinessStorage(
  raw: Awaited<ReturnType<typeof createServiceClient>>,
  businessId: string
): Promise<string[]> {
  const notes: string[] = [];
  for (const bucket of STORAGE_BUCKETS) {
    try {
      const paths = await listStoragePathsRecursive(raw, bucket, businessId);
      for (let i = 0; i < paths.length; i += 100) {
        const chunk = paths.slice(i, i + 100);
        const { error } = await raw.storage.from(bucket).remove(chunk);
        if (error) notes.push(`${bucket}:remove:${error.message}`);
      }
    } catch (err) {
      notes.push(`${bucket}:${err instanceof Error ? err.message : String(err)}`);
    }
  }
  notes.push(
    "storage:legacy_unprefixed_objects_not_scanned — only {businessId}/… prefixes removed"
  );
  return notes;
}

async function wipeBusinessStripeCustomer(business: {
  stripe_customer_id: string | null;
  stripe_customer_id_test: string | null;
  stripe_customer_id_live: string | null;
}): Promise<string[]> {
  const notes: string[] = [];
  try {
    const { getStripe, getStripeMode } = await import("@/lib/stripe");
    const mode = getStripeMode();
    const { stripe } = getStripe();
    const customerId =
      (mode === "live" ? business.stripe_customer_id_live : business.stripe_customer_id_test) ||
      business.stripe_customer_id;
    const otherModeId =
      mode === "live" ? business.stripe_customer_id_test : business.stripe_customer_id_live;

    if (customerId) {
      try {
        await stripe.customers.del(customerId);
      } catch (err) {
        notes.push(
          `stripe_customer_delete_failed:${customerId}:${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
    if (otherModeId && otherModeId !== customerId) {
      notes.push(
        `stripe_customer_other_mode_orphaned:${otherModeId} — delete manually in Stripe ${mode === "live" ? "test" : "live"} Dashboard`
      );
    }
  } catch (err) {
    notes.push(`stripe_cleanup_skipped:${err instanceof Error ? err.message : String(err)}`);
  }
  return notes;
}

export type UpdateBusinessInput = {
  name?: string;
  slug?: string;
  customDomain?: string | null;
  plan?: string;
  subscriptionStatus?: string;
  trialEndsAt?: string | null;
};

export async function updateBusinessForPlatform(
  businessId: string,
  input: UpdateBusinessInput,
  actor: { id: string; email: string | null }
) {
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select(
      "id, name, slug, custom_domain, plan, status, deleted_at, subscription_status, trial_ends_at"
    )
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");

  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw new Error("Business name is required.");
    patch.name = name;
  }
  if (input.slug !== undefined) {
    const slugCheck = validateBusinessSlug(input.slug);
    if (!slugCheck.ok) throw new Error(slugCheck.error);
    const { data: taken } = await raw
      .from("businesses")
      .select("id")
      .eq("slug", slugCheck.slug)
      .neq("id", businessId)
      .maybeSingle();
    if (taken) throw new Error("That slug is already in use.");
    patch.slug = slugCheck.slug;
  }
  if (input.customDomain !== undefined) {
    const customDomain = normalizeDomain(input.customDomain);
    if (customDomain) {
      const effectivePlanKey =
        input.plan !== undefined ? (await assertActivePlanKey(input.plan)).key : existing.plan;
      if (!(await planGrantsEntitlement(effectivePlanKey, "custom_domain"))) {
        throw new Error(
          "Custom domain is not included on the selected plan. Choose Studio (or another plan that includes custom domain)."
        );
      }
      const { data: taken } = await raw
        .from("businesses")
        .select("id")
        .eq("custom_domain", customDomain)
        .neq("id", businessId)
        .maybeSingle();
      if (taken) throw new Error("That custom domain is already in use.");
    }
    patch.custom_domain = customDomain;
  }
  let planChanged = false;
  if (input.plan !== undefined) {
    const planRow = await assertActivePlanKey(input.plan);
    patch.plan = planRow.key;
    planChanged = planRow.key !== existing.plan;
  }

  let subscriptionChanged = false;
  if (input.subscriptionStatus !== undefined) {
    if (!isSubscriptionStatus(input.subscriptionStatus)) {
      throw new Error("Invalid subscription_status.");
    }
    if (input.subscriptionStatus === "comped") {
      throw new Error(
        "Use Grant comped access (platform console) instead of setting subscription_status to comped."
      );
    }
    if (existing.subscription_status === "comped") {
      throw new Error(
        "This business is comped. Revoke complimentary access before changing subscription status."
      );
    }
    patch.subscription_status = input.subscriptionStatus;
    if (input.subscriptionStatus !== existing.subscription_status) {
      subscriptionChanged = true;
    }
  }
  if (input.trialEndsAt !== undefined) {
    if (input.trialEndsAt === null || input.trialEndsAt === "") {
      patch.trial_ends_at = null;
    } else {
      const parsed = new Date(input.trialEndsAt);
      if (!Number.isFinite(parsed.getTime())) {
        throw new Error("Invalid trial_ends_at.");
      }
      patch.trial_ends_at = parsed.toISOString();
    }
    const prev = existing.trial_ends_at;
    const next = patch.trial_ends_at as string | null;
    if (prev !== next) subscriptionChanged = true;
  }

  if (Object.keys(patch).length === 0) return existing;

  const { data, error } = await raw
    .from("businesses")
    .update(patch)
    .eq("id", businessId)
    .select(
      "id, name, slug, custom_domain, plan, status, deleted_at, created_at, subscription_status, trial_ends_at"
    )
    .single();
  if (error || !data) throw new Error(error?.message || "Failed to update business.");

  const action = subscriptionChanged
    ? "business.subscription_change"
    : planChanged
      ? "business.plan_change"
      : "business.update";

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action,
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: {
      patch,
      previous: {
        name: existing.name,
        slug: existing.slug,
        plan: existing.plan,
        subscription_status: existing.subscription_status,
        trial_ends_at: existing.trial_ends_at,
      },
    },
  });
  invalidateHostLookupCache();
  return data;
}

export async function setBusinessStatus(
  businessId: string,
  status: "active" | "suspended",
  actor: { id: string; email: string | null }
): Promise<{ name: string }> {
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select("id, name, status, deleted_at")
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");
  if (existing.deleted_at) throw new Error("Restore this business before changing status.");

  const { error } = await raw.from("businesses").update({ status }).eq("id", businessId);
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: status === "suspended" ? "business.suspend" : "business.reactivate",
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: { previousStatus: existing.status, status },
  });
  invalidateHostLookupCache();
  return { name: existing.name as string };
}

export async function softDeleteBusiness(
  businessId: string,
  actor: { id: string; email: string | null }
): Promise<{ name: string }> {
  if (await isBusinessProtected(businessId)) {
    throw new Error("Protected production businesses cannot be deleted from the console.");
  }
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select("id, name, deleted_at")
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");
  if (existing.deleted_at) throw new Error("Business is already deleted.");

  const { error } = await raw
    .from("businesses")
    .update({ deleted_at: new Date().toISOString(), status: "cancelled" })
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "business.soft_delete",
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: { name: existing.name },
  });
  invalidateHostLookupCache();
  return { name: existing.name as string };
}

/** Undo soft-delete — clears deleted_at and sets status active. */
export async function restoreSoftDeletedBusiness(
  businessId: string,
  actor: { id: string; email: string | null }
): Promise<{ name: string }> {
  if (await isBusinessProtected(businessId)) {
    throw new Error("Protected production businesses cannot be restored this way.");
  }
  const raw = await createServiceClient();
  const { data: existing } = await raw
    .from("businesses")
    .select("id, name, deleted_at, status")
    .eq("id", businessId)
    .maybeSingle();
  if (!existing) throw new Error("Business not found.");
  if (!existing.deleted_at) throw new Error("Business is not soft-deleted.");

  const { error } = await raw
    .from("businesses")
    .update({ deleted_at: null, status: "active" })
    .eq("id", businessId);
  if (error) throw new Error(error.message);

  await writePlatformAudit({
    actorUserId: actor.id,
    actorEmail: actor.email,
    action: "business.restore",
    targetBusinessId: businessId,
    targetType: "business",
    targetId: businessId,
    metadata: { name: existing.name, previousStatus: existing.status },
  });
  invalidateHostLookupCache();
  return { name: existing.name as string };
}
