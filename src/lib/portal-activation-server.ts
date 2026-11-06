/**
 * Optional client portal activation — server side (Supabase I/O).
 * Pure rules + token format live in portal-activation.ts.
 *
 * Tenant scoping: every query goes through createTenantServiceClient(businessId);
 * `.raw` is used only for auth.admin.* and the unscoped `profiles` table (same
 * pattern as client-portal-link.ts). A token's business must match the request
 * host's business before anything is read.
 */
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { ensureClientPortalLink, profileBelongsToBusiness } from "@/lib/client-portal-link";
import { logProjectActivity } from "@/lib/activity";
import { sendBrandedEmail } from "@/lib/email";
import { getAppSettings } from "@/lib/app-settings";
import { getBusinessPortalOriginById } from "@/lib/portal-url";
import {
  PORTAL_ACTIVATED_ACTIVITY,
  PORTAL_INVITE_SENT_ACTIVITY,
  buildActivationUrl,
  checkActivationEligibility,
  derivePortalAccessState,
  maskEmail,
  normalizeEmail,
  openActivationToken,
  safeActivationNextPath,
  sealActivationToken,
  validatePortalPassword,
  type ActivationEligibility,
  type ActivationPayload,
  type PortalAccessState,
} from "@/lib/portal-activation";

type TenantDb = Awaited<ReturnType<typeof createTenantServiceClient>>;

type ClientRow = {
  id: string;
  email: string | null;
  name: string | null;
  full_name: string | null;
  user_id: string | null;
  deleted_at: string | null;
};

export interface ClientLoginFacts {
  userId: string | null;
  emailConfirmedAt: string | null;
  /** Linked login belongs to another business — never manage it from here. */
  foreign: boolean;
}

async function loadClient(db: TenantDb, clientId: string): Promise<ClientRow | null> {
  const { data } = await db
    .from("clients")
    .select("id, email, name, full_name, user_id, deleted_at")
    .eq("id", clientId)
    .maybeSingle();
  return (data as ClientRow | null) ?? null;
}

async function loadLoginFacts(db: TenantDb, businessId: string, client: ClientRow): Promise<ClientLoginFacts> {
  if (!client.user_id) return { userId: null, emailConfirmedAt: null, foreign: false };
  const { data: profile } = await db.raw
    .from("profiles")
    .select("id, role, business_id")
    .eq("id", client.user_id)
    .maybeSingle();
  if (profile && !profileBelongsToBusiness(profile, businessId)) {
    return { userId: client.user_id, emailConfirmedAt: null, foreign: true };
  }
  const { data } = await db.raw.auth.admin.getUserById(client.user_id);
  return {
    userId: client.user_id,
    emailConfirmedAt: data.user?.email_confirmed_at ?? null,
    foreign: false,
  };
}

export async function getLastPortalInviteSentAt(db: TenantDb, clientId: string): Promise<string | null> {
  const { data } = await db
    .from("activity_logs")
    .select("created_at")
    .eq("client_id", clientId)
    .eq("activity_type", PORTAL_INVITE_SENT_ACTIVITY)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data?.created_at as string | undefined) ?? null;
}

export async function listClientProjectIds(db: TenantDb, clientId: string): Promise<string[]> {
  const ids = new Set<string>();
  const { data: primary } = await db.from("projects").select("id").eq("client_id", clientId);
  for (const row of primary ?? []) ids.add(row.id as string);
  const { data: junction } = await db.from("project_clients").select("project_id").eq("client_id", clientId);
  for (const row of junction ?? []) ids.add(row.project_id as string);
  return Array.from(ids);
}

export interface ClientPortalAccess {
  state: PortalAccessState;
  lastInviteSentAt: string | null;
  email: string | null;
  /** Login is linked to another business — invites are disabled. */
  foreign: boolean;
}

export async function getClientPortalAccess(
  clientId: string,
  businessId: string
): Promise<ClientPortalAccess | null> {
  const db = await createTenantServiceClient(businessId);
  const client = await loadClient(db, clientId);
  if (!client || client.deleted_at) return null;
  const login = await loadLoginFacts(db, businessId, client);
  const lastInviteSentAt = await getLastPortalInviteSentAt(db, clientId);
  return {
    state: derivePortalAccessState({
      authUser: login.userId && !login.foreign ? { emailConfirmedAt: login.emailConfirmedAt } : null,
      lastInviteSentAt,
    }),
    lastInviteSentAt,
    email: client.email,
    foreign: login.foreign,
  };
}

/** True when this client can sign in to the portal (confirmed, same-business login). */
export async function isClientPortalActive(clientId: string, businessId: string): Promise<boolean> {
  const db = await createTenantServiceClient(businessId);
  const client = await loadClient(db, clientId);
  if (!client || client.deleted_at) return false;
  const login = await loadLoginFacts(db, businessId, client);
  return Boolean(login.userId && !login.foreign && login.emailConfirmedAt);
}

/**
 * Make sure a request submitter has a linked login row so in-app/email
 * notifications keep working, WITHOUT a password and WITHOUT confirming the
 * email (so it does not count as an active portal). Reuses an existing
 * same-business login when one exists for the email.
 */
export async function ensureClientLoginPlaceholder(
  clientId: string,
  businessId: string
): Promise<ClientLoginFacts> {
  const db = await createTenantServiceClient(businessId);
  const linked = await ensureClientPortalLink(clientId, businessId);
  const client = await loadClient(db, clientId);
  if (!client) return { userId: null, emailConfirmedAt: null, foreign: false };
  if (linked.hasPortal && client.user_id) return loadLoginFacts(db, businessId, client);

  const email = normalizeEmail(client.email);
  if (!email) return { userId: null, emailConfirmedAt: null, foreign: false };

  const displayName = client.full_name?.trim() || client.name || "";
  const { data: created, error } = await db.raw.auth.admin.createUser({
    email,
    email_confirm: false,
    user_metadata: { full_name: displayName, role: "client", business_id: businessId },
  });
  if (error || !created.user) {
    // Email already registered but not linkable here (another business) — leave unlinked.
    return { userId: null, emailConfirmedAt: null, foreign: Boolean(error) };
  }

  await db.from("clients").update({ user_id: created.user.id }).eq("id", clientId);
  await db.raw
    .from("profiles")
    .update({
      client_id: clientId,
      role: "client",
      full_name: displayName,
      email_notifications_enabled: true,
      in_app_notifications_enabled: true,
      business_id: businessId,
    })
    .eq("id", created.user.id);

  return { userId: created.user.id, emailConfirmedAt: null, foreign: false };
}

export async function issueInviteActivationUrl(input: {
  businessId: string;
  clientId: string;
  email: string;
  projectId?: string | null;
  nextPath?: string | null;
}): Promise<string> {
  const token = sealActivationToken({
    kind: "invite",
    businessId: input.businessId,
    clientId: input.clientId,
    email: input.email,
    projectId: input.projectId ?? null,
    nextPath: input.nextPath ?? null,
  });
  return buildActivationUrl(await getBusinessPortalOriginById(input.businessId), token);
}

/**
 * Absolute CTA for a client email: the portal page for active clients, or a
 * one-step activation link (lands on the same page) for clients without one.
 * Never throws — falls back to the plain portal URL.
 */
export async function clientEmailCtaUrl(input: {
  businessId: string;
  clientId: string | null | undefined;
  path: string;
  projectId?: string | null;
}): Promise<string> {
  const origin = await getBusinessPortalOriginById(input.businessId);
  const plain = `${origin.replace(/\/$/, "")}${input.path.startsWith("/") ? input.path : `/${input.path}`}`;
  if (!input.clientId || !input.path.startsWith("/dashboard")) return plain;
  try {
    const db = await createTenantServiceClient(input.businessId);
    const client = await loadClient(db, input.clientId);
    if (!client || client.deleted_at || !normalizeEmail(client.email)) return plain;
    const login = await loadLoginFacts(db, input.businessId, client);
    if (login.foreign || (login.userId && login.emailConfirmedAt)) return plain;
    const token = sealActivationToken({
      kind: "invite",
      businessId: input.businessId,
      clientId: client.id,
      email: client.email!,
      projectId: input.projectId ?? null,
      nextPath: input.path,
    });
    return buildActivationUrl(origin, token);
  } catch (err) {
    console.warn("[portal-activation] CTA fallback to portal URL:", err instanceof Error ? err.message : err);
    return plain;
  }
}

export type PortalInviteResult =
  | { ok: true; url: string; sentTo?: string; sentAt?: string }
  | { ok: false; status: 400 | 404 | 409 | 502; error: string };

/**
 * Owner "Send Portal Invite" / "Resend Invite" / "Copy Invite Link", and the
 * self-service resend. Only ever emails the client's address on file.
 */
export async function createPortalInvite(input: {
  businessId: string;
  clientId: string;
  send: boolean;
  actorId: string | null;
  source: "owner" | "self_service";
  projectId?: string | null;
  nextPath?: string | null;
}): Promise<PortalInviteResult> {
  const db = await createTenantServiceClient(input.businessId);
  const client = await loadClient(db, input.clientId);
  if (!client || client.deleted_at) return { ok: false, status: 404, error: "Client not found." };
  const email = normalizeEmail(client.email);
  if (!email) return { ok: false, status: 400, error: "Add an email address for this client first." };

  const login = await loadLoginFacts(db, input.businessId, client);
  if (login.foreign) {
    return { ok: false, status: 409, error: "This email is linked to another business and can't be invited here." };
  }
  if (login.userId && login.emailConfirmedAt) {
    return { ok: false, status: 409, error: "This client already has an active portal account." };
  }

  // Only land on a project this client is actually on; otherwise the portal home.
  let projectId = input.projectId ?? null;
  let nextPath = input.nextPath ?? null;
  if (projectId && !(await listClientProjectIds(db, client.id)).includes(projectId)) {
    projectId = null;
    nextPath = null;
  }

  const url = await issueInviteActivationUrl({
    businessId: input.businessId,
    clientId: client.id,
    email,
    projectId,
    nextPath,
  });
  if (!input.send) return { ok: true, url };

  const settings = await getAppSettings(input.businessId);
  const businessName = settings.business.businessName;
  const portalName = settings.business.portalName;
  const firstName = (client.full_name || client.name || "").trim().split(/\s+/)[0];

  const result = await sendBrandedEmail({
    businessId: input.businessId,
    to: email,
    subject: `Activate your ${portalName} account`,
    title: "Your client portal is ready",
    body: `${firstName ? `Hi ${firstName}, ` : ""}${businessName} invited you to ${portalName}. Create a password to view your projects, approve proposals, message the team, and download your media in one place.`,
    secondaryInfo: "This secure link expires in 7 days and works once. You can always request a new one.",
    ctaLabel: "Create Account & View My Project",
    ctaUrl: url,
    emailType: "client_portal_invite",
    analytics: { emailType: "client_portal_invite" },
  });
  if (!result.sent && !result.skipped) {
    return { ok: false, status: 502, error: result.error || "Could not send the invite email." };
  }

  await logProjectActivity(PORTAL_INVITE_SENT_ACTIVITY, `Portal invite sent to ${email}`, {
    businessId: input.businessId,
    clientId: client.id,
    userId: input.actorId,
    visibility: "admin",
    metadata: { source: input.source, targetEmail: email, emailSkipped: Boolean(result.skipped) },
  });

  return { ok: true, url, sentTo: email, sentAt: new Date().toISOString() };
}

export interface ActivationContext {
  payload: ActivationPayload;
  expired: boolean;
  eligibility: ActivationEligibility;
  portalActive: boolean;
  client: ClientRow | null;
}

/** Decrypt a token and evaluate it against current state. null = invalid token. */
export async function loadActivationContext(
  token: string,
  hostBusinessId: string | null
): Promise<ActivationContext | null> {
  const opened = openActivationToken(token);
  if (!opened.ok) return null;
  const { payload, expired } = opened;
  if (hostBusinessId && hostBusinessId !== payload.b) {
    return {
      payload,
      expired,
      eligibility: { ok: false, reason: "wrong_business" },
      portalActive: false,
      client: null,
    };
  }

  const db = await createTenantServiceClient(payload.b);
  const client = await loadClient(db, payload.c);
  const login = client ? await loadLoginFacts(db, payload.b, client) : null;
  const portalActive = Boolean(login?.userId && !login.foreign && login.emailConfirmedAt);
  const clientProjectIds = client && payload.k === "request" ? await listClientProjectIds(db, client.id) : [];

  const eligibility = checkActivationEligibility({
    payload,
    expired,
    hostBusinessId,
    client: client ? { id: client.id, email: client.email, deleted: Boolean(client.deleted_at) } : null,
    portalActive,
    foreignLogin: Boolean(login?.foreign),
    clientProjectIds,
  });

  return { payload, expired, eligibility, portalActive, client };
}

export type ActivateResult =
  | { ok: true; email: string; nextPath: string }
  | { ok: false; status: number; reason: string; error: string };

const REFUSAL_COPY: Record<string, string> = {
  invalid: "This activation link isn't valid.",
  expired: "This activation link has expired. Request a new one below.",
  wrong_business: "This activation link isn't valid for this portal.",
  client_missing: "This activation link is no longer valid.",
  email_changed: "This activation link is no longer valid. Request a new one below.",
  already_active: "Your portal account is already active. Log in to continue.",
  foreign_login: "This email can't be activated here. Contact the business for help.",
  requires_email_link: "For your security, check your email for a link to activate your portal.",
};

export function activationRefusalMessage(reason: string): string {
  return REFUSAL_COPY[reason] ?? REFUSAL_COPY.invalid;
}

/** Set the client's own password from a valid token. Activates the existing login; never recreates records. */
export async function activatePortalWithToken(input: {
  token: string;
  password: unknown;
  confirmPassword: unknown;
  hostBusinessId: string | null;
}): Promise<ActivateResult> {
  const passwordError = validatePortalPassword(input.password, input.confirmPassword);
  if (passwordError) return { ok: false, status: 400, reason: "password", error: passwordError };
  const password = input.password as string;

  const ctx = await loadActivationContext(input.token, input.hostBusinessId);
  if (!ctx) return { ok: false, status: 400, reason: "invalid", error: activationRefusalMessage("invalid") };
  if (!ctx.eligibility.ok) {
    const reason = ctx.eligibility.reason;
    const status = reason === "already_active" ? 409 : reason === "expired" ? 410 : 403;
    return { ok: false, status, reason, error: activationRefusalMessage(reason) };
  }

  const { payload } = ctx;
  const client = ctx.client!;
  const db = await createTenantServiceClient(payload.b);
  const email = normalizeEmail(client.email);
  const displayName = client.full_name?.trim() || client.name || "";

  let userId = client.user_id;
  if (userId) {
    const { error } = await db.raw.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (error) return { ok: false, status: 500, reason: "auth", error: "Couldn't activate your account. Please try again." };
  } else {
    const { data, error } = await db.raw.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: displayName, role: "client", business_id: payload.b },
    });
    if (error || !data.user) {
      return { ok: false, status: 409, reason: "auth", error: "This email already has a login. Try logging in or resetting your password." };
    }
    userId = data.user.id;
    await db.from("clients").update({ user_id: userId }).eq("id", client.id);
  }

  const { data: profile } = await db.raw
    .from("profiles")
    .select("id, role")
    .eq("id", userId)
    .maybeSingle();
  await db.raw
    .from("profiles")
    .update({
      client_id: client.id,
      ...(profile?.role === "admin" ? {} : { role: "client" }),
      business_id: payload.b,
      ...(displayName ? { full_name: displayName } : {}),
    })
    .eq("id", userId);

  await logProjectActivity(PORTAL_ACTIVATED_ACTIVITY, `Client activated their portal account (${email})`, {
    businessId: payload.b,
    clientId: client.id,
    projectId: payload.p ?? undefined,
    userId,
    visibility: "admin",
    metadata: { via: payload.k === "request" ? "request_thank_you" : "activation_link" },
  });

  return { ok: true, email, nextPath: safeActivationNextPath(payload.n) };
}

/**
 * Expired / unusable link → email a fresh invite to the address on file.
 * The response never reveals more than a masked address.
 */
export async function resendActivationFromToken(
  token: string,
  hostBusinessId: string | null
): Promise<{ ok: true; maskedEmail: string } | { ok: false; status: number; error: string; reason?: string }> {
  const ctx = await loadActivationContext(token, hostBusinessId);
  if (!ctx) return { ok: false, status: 400, error: activationRefusalMessage("invalid") };
  const reason = ctx.eligibility.ok ? null : ctx.eligibility.reason;
  if (reason === "already_active") {
    return { ok: false, status: 409, reason, error: activationRefusalMessage(reason) };
  }
  if (reason && !["expired", "requires_email_link", "email_changed"].includes(reason)) {
    return { ok: false, status: 403, reason, error: activationRefusalMessage(reason) };
  }
  if (!ctx.client) return { ok: false, status: 404, error: activationRefusalMessage("client_missing") };

  const sent = await createPortalInvite({
    businessId: ctx.payload.b,
    clientId: ctx.client.id,
    send: true,
    actorId: null,
    source: "self_service",
    projectId: ctx.payload.p,
    nextPath: ctx.payload.n,
  });
  if (!sent.ok) return { ok: false, status: sent.status, error: sent.error };
  return { ok: true, maskedEmail: maskEmail(sent.sentTo ?? "") };
}
