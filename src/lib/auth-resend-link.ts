import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getBusinessPortalOrigin, getPlatformApexOrigin } from "@/lib/portal-url";
import { authConfirmUrl } from "@/lib/auth-confirm";
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
 * Resend invite (unconfirmed) or password reset (confirmed).
 * - Tenant host: that business's admin, or shared viewer (project_shares).
 * - Platform apex: look up email globally; send to their own portal (or apex for super_admin).
 * Never enumerates accounts in error responses; reasons are logged server-side.
 *
 * RedirectTo is `{portal}/auth/confirm` so TokenHash email templates land on the interstitial.
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
      .select("id, slug, custom_domain")
      .eq("id", profile.business_id!)
      .maybeSingle();
    if (!business) {
      console.info("[auth-resend-link] no email sent", { email, reason: "business row missing" });
      return GENERIC;
    }
    portalUrl = getBusinessPortalOrigin({
      slug: business.slug,
      custom_domain: business.custom_domain,
    });
  }

  const confirmRedirect = authConfirmUrl(portalUrl);

  if (!user.email_confirmed_at && profile.role === "admin") {
    const invited = await raw.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "admin",
        business_id: profile.business_id,
        full_name: user.user_metadata?.full_name,
      },
      redirectTo: confirmRedirect,
    });
    if (invited.error) {
      console.error("[auth-resend-link] inviteUserByEmail failed", invited.error.message);
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { error: resendErr } = await anon.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: confirmRedirect },
      });
      if (resendErr) {
        console.error("[auth-resend-link] signup resend failed", resendErr.message);
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
