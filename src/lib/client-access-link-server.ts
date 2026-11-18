/**
 * One-click client access links — server side (Supabase I/O).
 * Token format + rules live in client-access-link.ts.
 *
 * Tenant scoping: every client/project query goes through
 * createTenantServiceClient(businessId); `.raw` is used only for auth.admin.*
 * and the unscoped `profiles` table (same pattern as portal-activation-server).
 */
import { createClient } from "@supabase/supabase-js";
import { createTenantServiceClient } from "@/lib/supabase/tenant-service";
import { profileBelongsToBusiness } from "@/lib/client-portal-link";
import { ensureClientLoginPlaceholder, listClientProjectIds } from "@/lib/portal-activation-server";
import { getShareAccessPortalOrigin } from "@/lib/portal-url";
import { logProjectActivity } from "@/lib/activity";
import { sendBrandedEmail } from "@/lib/email";
import { getAppSettings } from "@/lib/app-settings";
import { maskEmail } from "@/lib/portal-activation";
import {
  CLIENT_LINK_OPENED_ACTIVITY,
  buildClientAccessUrl,
  isBusinessLoginRole,
  normalizeAccessEmail,
  openClientAccessToken,
  projectPortalBasePath,
  safeClientAccessPath,
  sealClientAccessToken,
  type ClientAccessPayload,
  type ClientAccessRefusal,
} from "@/lib/client-access-link";

type TenantDb = Awaited<ReturnType<typeof createTenantServiceClient>>;

type ClientRow = {
  id: string;
  email: string | null;
  name: string | null;
  full_name: string | null;
  user_id: string | null;
  deleted_at: string | null;
};

async function loadClient(db: TenantDb, clientId: string): Promise<ClientRow | null> {
  const { data } = await db
    .from("clients")
    .select("id, email, name, full_name, user_id, deleted_at")
    .eq("id", clientId)
    .maybeSingle();
  return (data as ClientRow | null) ?? null;
}

/**
 * Whether a client's linked login (if any) may be reached through an emailed link.
 * No login yet is fine — one is created (unconfirmed placeholder) on first use.
 */
async function linkedLoginEligibility(
  db: TenantDb,
  businessId: string,
  userId: string | null
): Promise<"ok" | "business_login" | "foreign_login"> {
  if (!userId) return "ok";
  const { data: profile } = await db.raw
    .from("profiles")
    .select("id, role, business_id")
    .eq("id", userId)
    .maybeSingle();
  if (!profile) return "ok";
  if (!profileBelongsToBusiness(profile, businessId)) return "foreign_login";
  if (isBusinessLoginRole(profile.role as string | null)) return "business_login";
  return "ok";
}

async function isClientOnProject(db: TenantDb, clientId: string, projectId: string): Promise<boolean> {
  return (await listClientProjectIds(db, clientId)).includes(projectId);
}

export type IssueClientAccessResult =
  | { ok: true; url: string; email: string }
  | { ok: false; reason: "client_missing" | "no_email" | "not_on_project" | "business_login" | "foreign_login" };

/**
 * One-click sign-in URL for a project's own client. Refuses (so callers fall
 * back to the plain portal URL) when the client has no email, isn't on the
 * project, or their email is a business/staff login or belongs elsewhere.
 */
export async function issueClientAccessUrl(input: {
  businessId: string;
  clientId: string;
  projectId: string;
  path?: string | null;
}): Promise<IssueClientAccessResult> {
  const db = await createTenantServiceClient(input.businessId);
  const client = await loadClient(db, input.clientId);
  if (!client || client.deleted_at) return { ok: false, reason: "client_missing" };
  const email = normalizeAccessEmail(client.email);
  if (!email) return { ok: false, reason: "no_email" };
  if (!(await isClientOnProject(db, client.id, input.projectId))) return { ok: false, reason: "not_on_project" };
  const login = await linkedLoginEligibility(db, input.businessId, client.user_id);
  if (login !== "ok") return { ok: false, reason: login };

  const token = sealClientAccessToken({
    businessId: input.businessId,
    clientId: client.id,
    email,
    projectId: input.projectId,
    nextPath: input.path ?? null,
  });
  const origin = await getShareAccessPortalOrigin(input.businessId);
  return { ok: true, url: buildClientAccessUrl(origin, token), email };
}

export interface ClientAccessContext {
  payload: ClientAccessPayload;
  client: ClientRow | null;
  /** null when the link may be used now. */
  refusal: ClientAccessRefusal | null;
}

/** Decrypt + evaluate a link against current state. null = not a valid link at all. */
export async function loadClientAccessContext(
  token: string,
  hostBusinessId: string | null
): Promise<ClientAccessContext | null> {
  const opened = openClientAccessToken(token);
  if (!opened.ok) return null;
  const { payload, expired } = opened;
  if (!hostBusinessId || hostBusinessId !== payload.b) {
    return { payload, client: null, refusal: "wrong_business" };
  }
  const db = await createTenantServiceClient(payload.b);
  const client = await loadClient(db, payload.c);
  if (!client || client.deleted_at) return { payload, client: null, refusal: "client_missing" };
  if (normalizeAccessEmail(client.email) !== payload.e) return { payload, client, refusal: "email_changed" };
  if (!(await isClientOnProject(db, client.id, payload.p))) return { payload, client, refusal: "not_on_project" };
  const login = await linkedLoginEligibility(db, payload.b, client.user_id);
  if (login !== "ok") return { payload, client, refusal: login };
  if (expired) return { payload, client, refusal: "expired" };
  return { payload, client, refusal: null };
}

/** Mint a Supabase session for an existing auth user (magic-link hash verified server side). */
async function mintSessionForUser(db: TenantDb, userId: string): Promise<{
  userId: string;
  accessToken: string;
  refreshToken: string;
}> {
  const { data: authUser, error: userError } = await db.raw.auth.admin.getUserById(userId);
  const email = authUser?.user?.email;
  if (userError || !email) throw new Error(userError?.message || "Login has no email");

  const { data: linkData, error: linkError } = await db.raw.auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (linkError || !linkData.properties?.hashed_token) {
    throw new Error(linkError?.message || "Could not mint session");
  }

  const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await anon.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: "email",
  });
  if (error || !data.session || !data.user) throw new Error(error?.message || "Could not verify session");
  if (data.user.id !== userId) throw new Error("Session user mismatch");
  return { userId: data.user.id, accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
}

export type ExchangeClientAccessResult =
  | {
      ok: true;
      userId: string;
      destinationPath: string;
      session: { access_token: string; refresh_token: string };
    }
  | { ok: false; reason: ClientAccessRefusal };

/**
 * Exchange a valid link for a fresh session as that client. Creates the
 * client's (passwordless) login on first use; never touches an existing
 * password.
 */
export async function exchangeClientAccessToken(
  token: string,
  hostBusinessId: string | null
): Promise<ExchangeClientAccessResult> {
  const ctx = await loadClientAccessContext(token, hostBusinessId);
  if (!ctx) return { ok: false, reason: "invalid" };
  if (ctx.refusal) return { ok: false, reason: ctx.refusal };
  const { payload } = ctx;
  const client = ctx.client!;

  const db = await createTenantServiceClient(payload.b);
  let userId = client.user_id;
  try {
    const facts = await ensureClientLoginPlaceholder(client.id, payload.b);
    if (facts.foreign) return { ok: false, reason: "foreign_login" };
    userId = facts.userId ?? userId;
  } catch (err) {
    console.error("[client-access] login setup failed", err instanceof Error ? err.message : err);
  }
  if (!userId) return { ok: false, reason: "sign_in_failed" };

  // The placeholder step may have linked an existing login by email — re-check its role.
  const login = await linkedLoginEligibility(db, payload.b, userId);
  if (login !== "ok") return { ok: false, reason: login };

  let session;
  try {
    session = await mintSessionForUser(db, userId);
  } catch (err) {
    console.error("[client-access] session mint failed", err instanceof Error ? err.message : err);
    return { ok: false, reason: "sign_in_failed" };
  }

  const day = new Date().toISOString().slice(0, 10);
  await logProjectActivity(CLIENT_LINK_OPENED_ACTIVITY, `${client.full_name || client.name || "Client"} opened their project link`, {
    businessId: payload.b,
    projectId: payload.p,
    clientId: client.id,
    userId,
    visibility: "admin",
    idempotencyKey: `client-link-opened:${payload.p}:${client.id}:${day}`,
    metadata: { email: payload.e },
  });

  return {
    ok: true,
    userId,
    destinationPath: safeClientAccessPath(payload.p, payload.n),
    session: { access_token: session.accessToken, refresh_token: session.refreshToken },
  };
}

/**
 * Expired / stale link → email a fresh one to the address on file (never to
 * an address from the request). Returns only a masked address.
 */
export async function sendFreshClientAccessLink(
  token: string,
  hostBusinessId: string | null
): Promise<{ ok: true; maskedEmail: string } | { ok: false; reason: ClientAccessRefusal | "send_failed" }> {
  const ctx = await loadClientAccessContext(token, hostBusinessId);
  if (!ctx) return { ok: false, reason: "invalid" };
  if (ctx.refusal && !["expired", "email_changed", "sign_in_failed"].includes(ctx.refusal)) {
    return { ok: false, reason: ctx.refusal };
  }
  if (!ctx.client) return { ok: false, reason: "client_missing" };
  const sent = await emailClientAccessLink({
    businessId: ctx.payload.b,
    clientId: ctx.client.id,
    projectId: ctx.payload.p,
    path: ctx.payload.n,
  });
  return sent.ok ? { ok: true, maskedEmail: maskEmail(sent.email) } : { ok: false, reason: "send_failed" };
}

/** Plain "here's your link" email (fresh-link requests from the landing or login page). */
async function emailClientAccessLink(input: {
  businessId: string;
  clientId: string;
  projectId: string;
  path?: string | null;
}): Promise<{ ok: true; email: string } | { ok: false }> {
  const issued = await issueClientAccessUrl(input);
  if (!issued.ok) return { ok: false };
  const db = await createTenantServiceClient(input.businessId);
  const client = await loadClient(db, input.clientId);
  const { data: project } = await db
    .from("projects")
    .select("project_name, property_address")
    .eq("id", input.projectId)
    .maybeSingle();
  const settings = await getAppSettings(input.businessId);
  const firstName = (client?.full_name || client?.name || "").trim().split(/\s+/)[0];
  const projectLabel =
    (project?.property_address as string | null)?.trim() || (project?.project_name as string | null)?.trim() || "your project";

  const result = await sendBrandedEmail({
    businessId: input.businessId,
    to: issued.email,
    subject: `Your link to ${projectLabel}`,
    title: "Here's your project link",
    body: `${firstName ? `Hi ${firstName}, ` : ""}use the button below to open ${projectLabel} with ${settings.business.businessName}. No password needed.`,
    secondaryInfo: "This button signs you in on any device. Don't forward this email — anyone with the link can open your project.",
    ctaLabel: "Open My Project",
    ctaUrl: issued.url,
    emailType: "client_access_link",
    analytics: { emailType: "client_access_link", projectId: input.projectId },
  });
  if (!result.sent && !result.skipped) return { ok: false };
  return { ok: true, email: issued.email };
}

/**
 * Login page "Email me a sign-in link". Always resolves without revealing
 * whether the address is a client here. Sends only to a client of this
 * business who is on at least one project, opening their most recent one.
 */
export async function requestClientSignInLink(input: { businessId: string; email: string }): Promise<void> {
  const email = normalizeAccessEmail(input.email);
  if (!email || !email.includes("@") || email.length > 254) return;
  try {
    const db = await createTenantServiceClient(input.businessId);
    const { data: clients } = await db
      .from("clients")
      .select("id, email, deleted_at")
      .ilike("email", email)
      .is("deleted_at", null)
      .limit(5);
    for (const row of clients ?? []) {
      if (normalizeAccessEmail(row.email as string | null) !== email) continue;
      const projectIds = await listClientProjectIds(db, row.id as string);
      if (projectIds.length === 0) continue;
      const { data: latest } = await db
        .from("projects")
        .select("id")
        .in("id", projectIds)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      const projectId = (latest?.id as string | undefined) ?? projectIds[0];
      const sent = await emailClientAccessLink({
        businessId: input.businessId,
        clientId: row.id as string,
        projectId,
        path: projectPortalBasePath(projectId),
      });
      if (sent.ok) return;
    }
  } catch (err) {
    console.error("[client-access] sign-in link request failed", err instanceof Error ? err.message : err);
  }
}
