import { createClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getBusinessPortalOrigin } from "@/lib/portal-url";

/**
 * Resend invite (unconfirmed) or password reset (confirmed) for a tenant admin.
 * Caller must already verify the request is on that tenant host.
 * Returns a generic message — never enumerates accounts.
 */
export async function resendTenantAdminAuthLink(options: {
  businessId: string;
  email: string;
}): Promise<{ ok: true; message: string }> {
  const email = options.email.trim().toLowerCase();
  const generic = {
    ok: true as const,
    message: "If an account exists for that email on this portal, a new link was sent.",
  };

  const raw = await createServiceClient();
  const { data: business } = await raw
    .from("businesses")
    .select("id, slug, custom_domain")
    .eq("id", options.businessId)
    .maybeSingle();
  if (!business) return generic;

  const portalUrl = getBusinessPortalOrigin({
    slug: business.slug,
    custom_domain: business.custom_domain,
  });
  const inviteRedirect = `${portalUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}&sp_flow=invite`;
  const recoveryRedirect = `${portalUrl}/auth/callback?next=${encodeURIComponent("/auth/update-password")}&sp_flow=recovery`;

  const { data: listed } = await raw.auth.admin.listUsers({ page: 1, perPage: 1000 });
  const user = listed.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) return generic;

  const { data: profile } = await raw
    .from("profiles")
    .select("role, business_id")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.business_id !== options.businessId || profile.role !== "admin") {
    return generic;
  }

  if (!user.email_confirmed_at) {
    const invited = await raw.auth.admin.inviteUserByEmail(email, {
      data: {
        role: "admin",
        business_id: options.businessId,
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
    await anon.auth.resetPasswordForEmail(email, { redirectTo: recoveryRedirect });
  }

  return generic;
}
