/**
 * Optional client portal activation — pure logic (no Supabase I/O).
 *
 * A public /request submission never requires a password. Clients who want the
 * portal activate later with a sealed activation token:
 *
 * - "request" tokens are returned to the browser that just submitted a request
 *   (thank-you page). They may set a password ONLY when the request created a
 *   brand-new client record and that client still has exactly that one project.
 *   Someone typing another person's email can never use one to reach that
 *   person's existing projects.
 * - "invite" tokens are only ever delivered to the client's email on file
 *   (confirmation email, owner invite, self-service resend) — or copied by the
 *   business owner — so possession proves mailbox access.
 *
 * Tokens are AES-256-GCM sealed (purpose-keyed, see purpose-cipher.ts), carry
 * business + client + email, and expire. They are effectively single-use: once
 * the client's portal account is active, every outstanding token is refused.
 * Changing the client's email also invalidates outstanding tokens.
 *
 * No schema change: state comes from the linked auth user (email_confirmed_at)
 * and `portal_invite_sent` activity_logs rows (last invite time).
 */
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";

const TOKEN_PURPOSE = "client-portal-activation";
const TOKEN_WHAT = "portal activation token";

export const REQUEST_ACTIVATION_TTL_MS = 24 * 60 * 60 * 1000;
export const INVITE_ACTIVATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export const PORTAL_INVITE_SENT_ACTIVITY = "portal_invite_sent";
export const PORTAL_ACTIVATED_ACTIVITY = "portal_activated";

export const ACTIVATION_PATH = "/auth/activate";
export const THANK_YOU_PATH = "/request/thank-you";
export const MIN_PORTAL_PASSWORD_LENGTH = 8;

export type ActivationKind = "request" | "invite";

export interface ActivationPayload {
  v: 1;
  k: ActivationKind;
  /** business id */
  b: string;
  /** client id */
  c: string;
  /** client email (lowercase) at issue time */
  e: string;
  /** project the token was issued for, if any */
  p: string | null;
  /** safe portal path to land on after activation */
  n: string;
  /** request tokens: true only when the request created this client record */
  f: boolean;
  iat: number;
  exp: number;
}

export type OpenActivationResult =
  | { ok: true; payload: ActivationPayload; expired: boolean }
  | { ok: false; reason: "invalid" };

export function normalizeEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

/** Only same-origin client portal paths — never an absolute or protocol-relative URL. */
export function safeActivationNextPath(raw: string | null | undefined): string {
  const value = String(raw ?? "").trim();
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return "/dashboard";
  if (!(value === "/dashboard" || value.startsWith("/dashboard/") || value.startsWith("/dashboard?") || value.startsWith("/dashboard#"))) {
    return "/dashboard";
  }
  return value.slice(0, 300);
}

export function projectPortalPath(projectId: string, welcome = false): string {
  return `/dashboard/projects/${projectId}${welcome ? "?welcome=1" : ""}`;
}

export function sealActivationToken(
  input: {
    kind: ActivationKind;
    businessId: string;
    clientId: string;
    email: string;
    projectId?: string | null;
    nextPath?: string | null;
    freshClient?: boolean;
    ttlMs?: number;
  },
  now = Date.now()
): string {
  const ttl =
    input.ttlMs ?? (input.kind === "request" ? REQUEST_ACTIVATION_TTL_MS : INVITE_ACTIVATION_TTL_MS);
  const payload: ActivationPayload = {
    v: 1,
    k: input.kind,
    b: input.businessId,
    c: input.clientId,
    e: normalizeEmail(input.email),
    p: input.projectId ?? null,
    n: safeActivationNextPath(
      input.nextPath ?? (input.projectId ? projectPortalPath(input.projectId, true) : "/dashboard")
    ),
    f: input.kind === "request" ? Boolean(input.freshClient) : false,
    iat: now,
    exp: now + ttl,
  };
  return sealWithPurpose(TOKEN_PURPOSE, TOKEN_WHAT, Buffer.from(JSON.stringify(payload), "utf8"));
}

function isPayload(value: unknown): value is ActivationPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    p.v === 1 &&
    (p.k === "request" || p.k === "invite") &&
    typeof p.b === "string" && p.b.length > 0 &&
    typeof p.c === "string" && p.c.length > 0 &&
    typeof p.e === "string" && p.e.length > 0 &&
    (p.p === null || typeof p.p === "string") &&
    typeof p.n === "string" &&
    typeof p.f === "boolean" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number"
  );
}

/**
 * Decrypt + authenticate. Tampered, truncated, or other-purpose tokens are
 * "invalid". Expired tokens still open (expired: true) so the UI can offer a
 * resend to the email on file — callers must refuse them for activation.
 */
export function openActivationToken(token: string | null | undefined, now = Date.now()): OpenActivationResult {
  const raw = String(token ?? "").trim();
  if (!raw || raw.length > 2048) return { ok: false, reason: "invalid" };
  try {
    const parsed: unknown = JSON.parse(openWithPurpose(TOKEN_PURPOSE, TOKEN_WHAT, raw).toString("utf8"));
    if (!isPayload(parsed)) return { ok: false, reason: "invalid" };
    return { ok: true, payload: parsed, expired: parsed.exp <= now };
  } catch {
    return { ok: false, reason: "invalid" };
  }
}

export function buildActivationUrl(portalOrigin: string, token: string): string {
  return `${portalOrigin.replace(/\/$/, "")}${ACTIVATION_PATH}?token=${encodeURIComponent(token)}`;
}

export function isActivationUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes(`${ACTIVATION_PATH}?token=`));
}

// ── Portal access state ──────────────────────────────────────────────────────

export type PortalAccessState = "active" | "not_activated" | "invite_sent";

export interface PortalAccessFacts {
  /** Linked auth user, if any. */
  authUser: { emailConfirmedAt: string | null } | null;
  /** Most recent owner/self-service invite, ISO. */
  lastInviteSentAt: string | null;
}

/**
 * Active = a linked login whose email is confirmed (password set by the client
 * via activation, an accepted invite, or a legacy password signup). Request
 * submitters get an unconfirmed placeholder login so notifications keep
 * working; that is NOT active.
 */
export function derivePortalAccessState(facts: PortalAccessFacts): PortalAccessState {
  if (facts.authUser?.emailConfirmedAt) return "active";
  if (facts.lastInviteSentAt) return "invite_sent";
  return "not_activated";
}

// ── Public request scenarios ─────────────────────────────────────────────────

export type RequestScenario = "A" | "B" | "C" | "D";

export interface RequestScenarioInput {
  /** Signed-in client of THIS business (client id), if any. */
  sessionClientId: string | null;
  /** Same-business client already on file with the submitted email. */
  existingClient: { id: string; portalActive: boolean } | null;
  /** After linking a new client, whether an already-confirmed login was attached. */
  newClientPortalActive?: boolean;
}

/**
 * A: brand-new client · B: existing client, no active portal · C: existing
 * active portal, not signed in · D: signed in (attach to own account).
 */
export function resolveRequestScenario(input: RequestScenarioInput): RequestScenario {
  if (input.sessionClientId) return "D";
  if (input.existingClient) return input.existingClient.portalActive ? "C" : "B";
  return input.newClientPortalActive ? "C" : "A";
}

export type ThankYouMode =
  /** Show Create Password / Confirm Password / Create Account & View My Project. */
  | "create_password"
  /** Existing record without active portal — activation only via emailed link. */
  | "email_link"
  /** Has an active portal account — offer Log in, never register. */
  | "login"
  /** Already signed in as this client — go straight to the project. */
  | "signed_in"
  /** Nothing to offer (no email / login can't be linked). */
  | "none";

export interface ActivationEligibilityInput {
  payload: ActivationPayload;
  expired: boolean;
  /** Business resolved from the request host (tenant scoping). */
  hostBusinessId: string | null;
  client: { id: string; email: string | null; deleted: boolean } | null;
  portalActive: boolean;
  /** Login is linked to another business (cannot be managed here). */
  foreignLogin: boolean;
  /** All project ids this client is on (primary or project_clients). */
  clientProjectIds: string[];
}

export type ActivationRefusal =
  | "invalid"
  | "expired"
  | "wrong_business"
  | "client_missing"
  | "email_changed"
  | "already_active"
  | "foreign_login"
  | "requires_email_link";

export type ActivationEligibility = { ok: true } | { ok: false; reason: ActivationRefusal };

/** Can this token set a password right now? Order matters: most specific first. */
export function checkActivationEligibility(input: ActivationEligibilityInput): ActivationEligibility {
  const { payload } = input;
  if (input.hostBusinessId && input.hostBusinessId !== payload.b) return { ok: false, reason: "wrong_business" };
  if (!input.client || input.client.deleted || input.client.id !== payload.c) {
    return { ok: false, reason: "client_missing" };
  }
  if (normalizeEmail(input.client.email) !== payload.e) return { ok: false, reason: "email_changed" };
  if (input.portalActive) return { ok: false, reason: "already_active" };
  if (input.foreignLogin) return { ok: false, reason: "foreign_login" };
  if (input.expired) return { ok: false, reason: "expired" };
  if (payload.k === "request") {
    const onlyThisProject =
      payload.p !== null &&
      input.clientProjectIds.length === 1 &&
      input.clientProjectIds[0] === payload.p;
    if (!payload.f || !onlyThisProject) return { ok: false, reason: "requires_email_link" };
  }
  return { ok: true };
}

/** Thank-you page mode for the viewer holding a request token. */
export function resolveThankYouMode(input: {
  eligibility: ActivationEligibility;
  portalActive: boolean;
  /** Viewer is signed in as this same client. */
  signedInAsClient: boolean;
  hasEmail: boolean;
}): ThankYouMode {
  if (input.signedInAsClient) return "signed_in";
  if (input.portalActive) return "login";
  if (input.eligibility.ok) return "create_password";
  if (!input.hasEmail) return "none";
  const reason = input.eligibility.reason;
  if (reason === "foreign_login" || reason === "client_missing" || reason === "wrong_business") return "none";
  return "email_link";
}

export function validatePortalPassword(password: unknown, confirm: unknown): string | null {
  if (typeof password !== "string" || password.length < MIN_PORTAL_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PORTAL_PASSWORD_LENGTH} characters.`;
  }
  if (password.length > 128) return "Password is too long.";
  if (password !== confirm) return "Passwords do not match.";
  return null;
}

/** "jane@example.com" → "j***@example.com" for confirmation copy. */
export function maskEmail(email: string): string {
  const [local, domain] = normalizeEmail(email).split("@");
  if (!local || !domain) return "your email";
  return `${local[0]}${"*".repeat(Math.min(3, Math.max(1, local.length - 1)))}@${domain}`;
}
