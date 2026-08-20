import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getBusinessPortalOrigin, getPlatformApexOrigin } from "@/lib/portal-url";

const GENERIC = {
  ok: true as const,
  message: "If an account exists for that email, a new link was sent.",
};

/**
 * Resend invite (unconfirmed) or password reset (confirmed).
 * - Tenant host: only that business's admin.
 * - Platform apex: look up email globally; send to their own portal (or apex for super_admin).
 * Never enumerates accounts.
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
  if (!user) return GENERIC;

  const { data: profile } = await raw
    .from("profiles")
    .select("role, business_id")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile) return GENERIC;

  if (options.businessId) {
    if (profile.business_id !== options.businessId || profile.role !== "admin") {
      return GENERIC;
    }
  } else {
    // Apex: allow admin (any business) or super_admin.
    if (profile.role !== "admin" && profile.role !== "super_admin") {
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
    if (!business) return GENERIC;
    portalUrl = getBusinessPortalOrigin({
      slug: business.slug,
      custom_domain: business.custom_domain,
    });
  }

  const inviteRedirect = `${portalUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}&sp_flow=invite`;
  const recoveryRedirect = `${portalUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}&sp_flow=recovery`;

  // Dashboard-style recoveries that bounce to apex: prefer recovery to their portal.
  // Unconfirmed → invite/resend.
  if (!user.email_confirmed_at && profile.role === "admin") {
    const invited = await raw.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "admin",
        business_id: profile.business_id,
        full_name: user.user_metadata?.full_name,
      },
      redirectTo: inviteRedirect,
    });
    if (invited.error) {
      const anon = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      await anon.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: inviteRedirect },
      });
    }
  } else {
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    // Apex destination for super_admin; tenant portal for business admins.
    const redirectTo =
      profile.role === "super_admin"
        ? `${portalUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}&sp_flow=recovery`
        : recoveryRedirect;
    await anon.auth.resetPasswordForEmail(email, { redirectTo });
  }

  return GENERIC;
}

/** @deprecated Prefer resendAuthLinkForEmail — kept for call-site clarity. */
export async function resendTenantAdminAuthLink(options: {
  businessId: string;
  email: string;
}): Promise<{ ok: true; message: string }> {
  return resendAuthLinkForEmail({ email: options.email, businessId: options.businessId });
}
