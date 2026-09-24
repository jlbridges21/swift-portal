import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getBusinessPortalOrigin, getPlatformApexOrigin } from "@/lib/portal-url";
import { authConfirmUrl, buildAuthConfirmLink } from "@/lib/auth-confirm";
import { sendBrandedEmail } from "@/lib/email";
import { sendPlatformEmail } from "@/lib/platform-email";
import { resendProjectShareAuthLink } from "@/lib/project-shares";

const GENERIC = {
  ok: true as const,
  message: "If an account exists for that email, a new link was sent.",
};

const SHARE_RESENT = {
  ok: true as const,
  message: "A new project sign-in link was sent to your email.",
};

/**
 * Prefetch-safe re-invite for unconfirmed admins: generateLink + branded
 * /auth/confirm?token_hash= CTA. Never inviteUserByEmail or action_link.
 */
async function resendUnconfirmedAdminInvite(args: {
  email: string;
  businessId: string;
  fullName: string;
  portalOrigin: string;
}): Promise<boolean> {
  const raw = await createServiceClient();
  const redirectTo = authConfirmUrl(args.portalOrigin);
  const { data: linkData, error: linkError } = await raw.auth.admin.generateLink({
    type: "invite",
    email: args.email,
    options: {
      data: {
        role: "admin",
        business_id: args.businessId,
        full_name: args.fullName,
      },
      redirectTo,
    },
  });

  const hashedToken = linkData?.properties?.hashed_token?.trim() ?? null;
  if (linkError || !hashedToken) {
    console.error(
      "[auth-resend-link] generateLink invite failed",
      linkError?.message || "missing hashed_token"
    );
    return false;
  }

  const ctaUrl = buildAuthConfirmLink({
    portalOrigin: args.portalOrigin,
    tokenHash: hashedToken,
    type: "invite",
    nextPath: "/admin",
  });

  const emailResult = await sendBrandedEmail({
    businessId: args.businessId,
    to: args.email,
    subject: "Your admin invite link",
    title: "Finish setting up your admin account",
    body: "Use the button below to create your password and sign in. This link is prefetch-safe — email scanners will not consume it.",
    ctaLabel: "Set up your admin account",
    ctaUrl,
    emailType: "admin_invite_resend",
    analytics: { emailType: "admin_invite_resend" },
  });

  if (!emailResult.sent) {
    console.error(
      "[auth-resend-link] branded invite email failed",
      emailResult.error || emailResult.skipReason
    );
    return false;
  }
  return true;
}

/**
 * Resend invite (unconfirmed) or password reset (confirmed).
 * - Tenant host: that business's admin, or shared viewer (project_shares).
 * - Platform apex: look up email globally; send to their own portal (or apex for super_admin).
 * Never enumerates accounts in error responses; reasons are logged server-side.
 *
 * RedirectTo is the canonical www `/auth/confirm` (permanently allowlisted).
 * After verify, v68 handoff continues to the tenant portal origin.
 */
export async function resendAuthLinkForEmail(options: {
  email: string;
  /** When set, restrict to this business's admins (tenant host). */
  businessId?: string | null;
}): Promise<{ ok: true; message: string }> {
  const email = options.email.trim().toLowerCase();
  const raw = await createServiceClient();

  const { data: listed } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = listed.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) {
    console.info("[auth-resend-link] no email sent", { email, reason: "no auth user" });
    return GENERIC;
  }

  const { data: profile } = await raw
    .from("profiles")
    .select("role, business_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) {
    console.info("[auth-resend-link] no email sent", { email, reason: "no profile row" });
    return GENERIC;
  }

  if (options.businessId) {
    if (profile.business_id !== options.businessId || profile.role !== "admin") {
      if (profile.role === "client" && !profile.business_id) {
        const shared = await resendProjectShareAuthLink({
          email,
          businessId: options.businessId,
        });
        if (shared.sent) {
          console.info("[auth-resend-link] shared viewer link resent", {
            email,
            businessId: options.businessId,
            projectId: shared.projectId,
          });
          return SHARE_RESENT;
        }
        console.info("[auth-resend-link] no email sent", {
          email,
          reason: shared.error ?? "no active project share on tenant",
          businessId: options.businessId,
        });
      } else {
        console.info("[auth-resend-link] no email sent", {
          email,
          reason: "not tenant admin or shared viewer",
          businessId: options.businessId,
          role: profile.role,
          profileBusinessId: profile.business_id,
        });
      }
      return GENERIC;
    }
  } else {
    if (profile.role !== "admin" && profile.role !== "super_admin") {
      console.info("[auth-resend-link] no email sent", {
        email,
        reason: "not admin on platform apex",
        role: profile.role,
      });
      return GENERIC;
    }
  }

  let portalUrl: string;
  if (profile.role === "super_admin") {
    portalUrl = getPlatformApexOrigin();
  } else {
    const { data: business } = await raw
      .from("businesses")
      .select(
        "id, slug, custom_domain, custom_domain_status, custom_domain_vercel_verified, custom_domain_misconfigured"
      )
      .eq("id", profile.business_id!)
      .maybeSingle();
    if (!business) {
      console.info("[auth-resend-link] no email sent", { email, reason: "business row missing" });
      return GENERIC;
    }
    portalUrl = getBusinessPortalOrigin({
      slug: business.slug,
      custom_domain: business.custom_domain,
      custom_domain_status: business.custom_domain_status,
      custom_domain_vercel_verified: business.custom_domain_vercel_verified,
      custom_domain_misconfigured: business.custom_domain_misconfigured,
    });
  }

  const confirmRedirect = authConfirmUrl(portalUrl);

  if (!user.email_confirmed_at && profile.role === "admin" && profile.business_id) {
    await resendUnconfirmedAdminInvite({
      email,
      businessId: profile.business_id,
      fullName: String(user.user_metadata?.full_name || email),
      portalOrigin: portalUrl,
    });
  } else if (!user.email_confirmed_at && profile.role === "super_admin") {
    // Rare: unconfirmed platform super-admin — generateLink + platform email.
    const { data: linkData, error: linkError } = await raw.auth.admin.generateLink({
      type: "invite",
      email,
      options: {
        data: {
          role: "super_admin",
          full_name: user.user_metadata?.full_name,
        },
        redirectTo: confirmRedirect,
      },
    });
    const hashedToken = linkData?.properties?.hashed_token?.trim() ?? null;
    if (linkError || !hashedToken) {
      console.error(
        "[auth-resend-link] super_admin generateLink failed",
        linkError?.message || "missing hashed_token"
      );
    } else {
      const ctaUrl = buildAuthConfirmLink({
        portalOrigin: portalUrl,
        tokenHash: hashedToken,
        type: "invite",
        nextPath: "/platform",
      });
      const result = await sendPlatformEmail({
        to: email,
        subject: "Your ShootPortal invite",
        title: "Finish setting up your account",
        body: "Use the button below to create your password and sign in. This link is prefetch-safe — email scanners will not consume it.",
        ctaLabel: "Set up your account",
        ctaUrl,
      });
      if (!result.sent) {
        console.error("[auth-resend-link] platform invite email failed", result.error);
      }
    }
  } else {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: resetErr } = await anon.auth.resetPasswordForEmail(email, {
      redirectTo: confirmRedirect,
    });
    if (resetErr) {
      console.error("[auth-resend-link] resetPasswordForEmail failed", resetErr.message);
    }
  }

  return GENERIC;
}

/** @deprecated Prefer resendAuthLinkForEmail */
export async function resendTenantAdminAuthLink(options: {
  businessId: string;
  email: string;
}): Promise<{ ok: true; message: string }> {
  return resendAuthLinkForEmail({ email: options.email, businessId: options.businessId });
}
