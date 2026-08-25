/**
 * Post-login / post-OAuth destination resolver.
 *
 * Order (strict):
 *   a) existing active business_id → own portal
 *   b) unique client match → ensureClientPortalLink → /dashboard
 *   c) partner (partners.user_id or email) → /partner
 *   d) OAuth + platform apex + no match → /finish-setup (never for unclassified password users)
 *   e) tenant host + no match → reject, create nothing
 *
 * Also detects failed automatic identity linking (another auth/profile user shares the email).
 */

import type { User } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/server";
import { getPublicHostContext, lookupBusinessById } from "@/lib/host-resolution";
import { getLoginRedirectOrigin, joinPortalPath } from "@/lib/portal-url";
import { needsOnboardingRedirect } from "@/lib/onboarding";
import { ensureClientPortalLink } from "@/lib/client-portal-link";
import { resolvePartnerAccess } from "@/lib/partner-dashboard";
import { getPartnerByUserId, normalizePartnerEmail } from "@/lib/partners";
import type { Profile } from "@/lib/types";

export type LoginResolveResult =
  | { kind: "redirect"; redirect: string }
  | { kind: "error"; error: string; status: number; signOut: boolean; code?: string };

function userHasOAuthIdentity(user: User): boolean {
  const providers = user.app_metadata?.providers;
  if (Array.isArray(providers) && providers.some((p) => p && p !== "email")) return true;
  const provider = user.app_metadata?.provider;
  if (typeof provider === "string" && provider !== "email") return true;
  const identities = user.identities;
  if (Array.isArray(identities) && identities.some((i) => i.provider && i.provider !== "email")) {
    return true;
  }
  return false;
}

async function findOtherProfileSameEmail(
  userId: string,
  email: string
): Promise<{ id: string; email: string } | null> {
  const raw = await createServiceClient();
  const { data } = await raw.from("profiles").select("id, email").ilike("email", email);
  const other = (data ?? []).find((row) => row.id !== userId);
  return other ? { id: other.id as string, email: String(other.email) } : null;
}

async function linkPartnerByEmailIfNeeded(userId: string, email: string) {
  const existing = await getPartnerByUserId(userId);
  if (existing) return existing;

  const raw = await createServiceClient();
  const normalized = normalizePartnerEmail(email);
  const { data } = await raw
    .from("partners")
    .select("*")
    .ilike("email", normalized)
    .maybeSingle();
  if (!data) return null;

  if (data.user_id && data.user_id !== userId) {
    console.warn("[auth] partner_email_owned_by_other_user", {
      email: normalized,
      partnerId: data.id,
      ownerUserId: data.user_id,
      attemptUserId: userId,
    });
    return null;
  }

  if (!data.user_id) {
    await raw.from("partners").update({ user_id: userId }).eq("id", data.id);
    return { ...data, user_id: userId };
  }
  return data;
}

async function tryResolveClient(
  userId: string,
  email: string | undefined,
  profile: Profile
): Promise<{ businessId: string; clientId: string } | null> {
  const raw = await createServiceClient();

  if (profile.client_id) {
    const { data: client } = await raw
      .from("clients")
      .select("id, business_id, user_id, deleted_at")
      .eq("id", profile.client_id)
      .maybeSingle();
    if (client && !client.deleted_at && client.business_id) {
      await ensureClientPortalLink(client.id, client.business_id);
      if (!profile.business_id) {
        await raw
          .from("profiles")
          .update({ business_id: client.business_id, role: profile.role === "admin" ? "admin" : "client" })
          .eq("id", userId);
      }
      return { businessId: client.business_id, clientId: client.id };
    }
  }

  const { data: byUser } = await raw
    .from("clients")
    .select("id, business_id")
    .eq("user_id", userId)
    .is("deleted_at", null);
  if ((byUser?.length ?? 0) > 1) {
    console.warn("[auth] user_id matches clients in multiple businesses; refusing client attach", {
      userId,
    });
    return null;
  }
  if (byUser?.length === 1 && byUser[0].business_id) {
    await ensureClientPortalLink(byUser[0].id, byUser[0].business_id);
    await raw
      .from("profiles")
      .update({
        business_id: byUser[0].business_id,
        client_id: byUser[0].id,
        role: profile.role === "admin" ? "admin" : "client",
      })
      .eq("id", userId);
    return { businessId: byUser[0].business_id, clientId: byUser[0].id };
  }

  if (!email) return null;

  const { data: byEmail } = await raw
    .from("clients")
    .select("id, business_id")
    .ilike("email", email)
    .is("deleted_at", null);
  const businessIds = new Set((byEmail ?? []).map((r) => r.business_id).filter(Boolean));
  if (businessIds.size > 1) {
    console.warn("[auth] email matches clients in multiple businesses; refusing client attach", {
      email,
      userId,
      businesses: [...businessIds],
    });
    return null;
  }
  if (byEmail?.length === 1 && byEmail[0].business_id) {
    await ensureClientPortalLink(byEmail[0].id, byEmail[0].business_id);
    await raw
      .from("profiles")
      .update({
        business_id: byEmail[0].business_id,
        client_id: byEmail[0].id,
        role: profile.role === "admin" ? "admin" : "client",
      })
      .eq("id", userId);
    return { businessId: byEmail[0].business_id, clientId: byEmail[0].id };
  }

  return null;
}

function portalUnavailableError(): LoginResolveResult {
  return {
    kind: "error",
    error:
      "This portal is unavailable. Your business is suspended or no longer active. Contact support if you need access restored.",
    status: 403,
    signOut: true,
    code: "portal_unavailable",
  };
}

/**
 * Resolve where a signed-in user should go after login / OAuth callback.
 * Caller is responsible for signing out when result.signOut is true.
 * Pass the authenticated `user` from the same client that established the session
 * (important on /auth/callback where cookies may not yet be visible to createClient).
 */
export async function resolveLoginDestination(
  profile: Profile,
  user: User,
  options?: { requestHost?: string; requestOrigin?: string }
): Promise<LoginResolveResult> {
  if (user.user_metadata?.must_change_password === true) {
    return { kind: "redirect", redirect: "/auth/update-password?reason=forced" };
  }

  if (profile.role === "super_admin") {
    return { kind: "redirect", redirect: "/platform" };
  }

  const publicHost = await getPublicHostContext();
  const h = await import("next/headers").then((m) => m.headers());
  const resolvedHost =
    (options?.requestHost ||
      h.get("x-forwarded-host") ||
      h.get("host") ||
      "").split(",")[0]?.trim() ?? "";
  const proto = h.get("x-forwarded-proto") || "https";
  const origin = options?.requestOrigin || `${proto}://${resolvedHost}`;
  const hostname = resolvedHost.split(":")[0] ?? "";

  // (a) Existing business
  if (profile.business_id) {
    const own = await lookupBusinessById(profile.business_id);
    if (!own || own.status !== "active") {
      return portalUnavailableError();
    }

    const needsWizard = needsOnboardingRedirect({
      onboardingCompletedAt: own.onboarding_completed_at,
      onboardingState: own.onboarding_state,
      role: profile.role,
    });
    const destPath =
      profile.role === "admin" ? (needsWizard ? "/onboarding" : "/admin") : "/dashboard";
    const onOwnTenant = publicHost.kind === "tenant" && publicHost.businessId === own.id;
    const destOrigin = getLoginRedirectOrigin(
      own,
      { hostname, origin },
      { foreignTenantHost: !onOwnTenant }
    );
    return { kind: "redirect", redirect: joinPortalPath(destOrigin, destPath) };
  }

  // (b) Client match (unique)
  const clientHit = await tryResolveClient(user.id, user.email ?? profile.email, profile);
  if (clientHit) {
    const own = await lookupBusinessById(clientHit.businessId);
    if (!own || own.status !== "active") {
      return portalUnavailableError();
    }
    const onOwnTenant = publicHost.kind === "tenant" && publicHost.businessId === own.id;
    const destOrigin = getLoginRedirectOrigin(
      own,
      { hostname, origin },
      { foreignTenantHost: !onOwnTenant }
    );
    return { kind: "redirect", redirect: joinPortalPath(destOrigin, "/dashboard") };
  }

  // (c) Partner — serve /partner on the CURRENT auth origin (relative path).
  // Partner-only users have no tenant host; relative /partner keeps them where they signed in.
  // Business+Partner never reach here (branch a returns first). Never force apex —
  // that would cross origins and drop the session cookie.
  const email = (user.email || profile.email || "").trim();
  if (email) {
    await linkPartnerByEmailIfNeeded(user.id, email);
  }
  const partnerAccess = await resolvePartnerAccess(user.id);
  if (partnerAccess.kind === "active") {
    return { kind: "redirect", redirect: "/partner/dashboard" };
  }
  if (partnerAccess.kind === "suspended") {
    return { kind: "redirect", redirect: "/partner" };
  }

  // Failed automatic identity linking (unverified password email → second auth user)
  if (email && userHasOAuthIdentity(user)) {
    const other = await findOtherProfileSameEmail(user.id, email);
    if (other) {
      console.error("[auth] oauth_link_conflict", {
        event: "oauth_link_conflict",
        oauthUserId: user.id,
        existingUserId: other.id,
        email,
        host: hostname,
      });
      return {
        kind: "error",
        error:
          "An account already exists for this email. Sign in with your password and verify your email before connecting Google.",
        status: 409,
        signOut: true,
        code: "oauth_link_conflict",
      };
    }
  }

  // (d) OAuth-only finish-setup on platform apex — never a fallback for password users
  if (userHasOAuthIdentity(user) && publicHost.kind !== "tenant") {
    return { kind: "redirect", redirect: "/finish-setup" };
  }

  // (e) Tenant host + no match (or password user with no match anywhere)
  if (publicHost.kind === "tenant") {
    console.warn("[auth] unresolved_on_tenant_host", {
      userId: user.id,
      email,
      businessId: publicHost.businessId,
    });
    return {
      kind: "error",
      error:
        "No portal account was found for this email on this business. Ask your studio to invite you, or sign in on shootportal.app if you are starting a new studio.",
      status: 403,
      signOut: true,
      code: "tenant_no_match",
    };
  }

  return portalUnavailableError();
}
