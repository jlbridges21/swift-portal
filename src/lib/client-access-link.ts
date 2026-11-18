/**
 * One-click client access links — pure logic (no Supabase I/O).
 *
 * The link in a client email IS the login: opening it signs the project's own
 * client in (no password, no account form) and lands them on their project.
 *
 * - Only ever delivered to the client's email on file (project emails, the
 *   "Deliver to client" email) or copied by the business, so possession proves
 *   mailbox access — the same trust model as password-reset and share invites.
 * - AES-256-GCM sealed (purpose-keyed, see purpose-cipher.ts). Carries business +
 *   client + email + project, and expires.
 * - Re-checked on every use: the client must still exist with the same email and
 *   still be on the project. Removing a client from the project, or changing the
 *   client's email, invalidates every outstanding link. No schema change.
 * - Never signs in a business owner or staff member (their login is never a
 *   "client" login) — those fall back to the normal login page.
 */
import { openWithPurpose, sealWithPurpose } from "@/lib/purpose-cipher";

const TOKEN_PURPOSE = "client-project-access";
const TOKEN_WHAT = "client access token";

/** Long enough that a client opening last month's delivery email still gets in. */
export const CLIENT_ACCESS_TTL_MS = 45 * 24 * 60 * 60 * 1000;

export const CLIENT_ACCESS_PATH = "/auth/client";
export const CLIENT_ACCESS_CONSUME_PATH = "/auth/client/consume";

export const CLIENT_LINK_OPENED_ACTIVITY = "client_link_opened";
export const PROJECT_DELIVERY_SENT_ACTIVITY = "project_delivery_sent";

export interface ClientAccessPayload {
  v: 1;
  /** business id */
  b: string;
  /** client id */
  c: string;
  /** client email (lowercase) at issue time */
  e: string;
  /** project the link opens */
  p: string;
  /** safe portal path inside that project */
  n: string;
  iat: number;
  exp: number;
}

export type OpenClientAccessResult =
  | { ok: true; payload: ClientAccessPayload; expired: boolean }
  | { ok: false; reason: "invalid" };

export function normalizeAccessEmail(email: string | null | undefined): string {
  return String(email ?? "").trim().toLowerCase();
}

export function projectPortalBasePath(projectId: string): string {
  return `/dashboard/projects/${projectId}`;
}

/**
 * Only a path inside this project's portal page (query/hash allowed) — never an
 * absolute, protocol-relative, or other-project URL.
 */
export function safeClientAccessPath(projectId: string, raw: string | null | undefined): string {
  const base = projectPortalBasePath(projectId);
  const value = String(raw ?? "").trim();
  if (!value || value.includes("\\") || value.startsWith("//")) return base;
  if (value === base) return base;
  const rest = value.startsWith(base) ? value.slice(base.length) : null;
  if (rest === null || !(rest.startsWith("?") || rest.startsWith("#"))) return base;
  return value.slice(0, 300);
}

/** "/dashboard/projects/{uuid}…" → uuid, else null. */
export function projectIdFromPortalPath(path: string | null | undefined): string | null {
  const match = /^\/dashboard\/projects\/([0-9a-f-]{36})(?:[/?#]|$)/i.exec(String(path ?? ""));
  return match ? match[1].toLowerCase() : null;
}

export function sealClientAccessToken(
  input: {
    businessId: string;
    clientId: string;
    email: string;
    projectId: string;
    nextPath?: string | null;
    ttlMs?: number;
  },
  now = Date.now()
): string {
  const payload: ClientAccessPayload = {
    v: 1,
    b: input.businessId,
    c: input.clientId,
    e: normalizeAccessEmail(input.email),
    p: input.projectId,
    n: safeClientAccessPath(input.projectId, input.nextPath),
    iat: now,
    exp: now + (input.ttlMs ?? CLIENT_ACCESS_TTL_MS),
  };
  return sealWithPurpose(TOKEN_PURPOSE, TOKEN_WHAT, Buffer.from(JSON.stringify(payload), "utf8"));
}

function isPayload(value: unknown): value is ClientAccessPayload {
  if (!value || typeof value !== "object") return false;
  const p = value as Record<string, unknown>;
  return (
    p.v === 1 &&
    typeof p.b === "string" && p.b.length > 0 &&
    typeof p.c === "string" && p.c.length > 0 &&
    typeof p.e === "string" && p.e.length > 0 &&
    typeof p.p === "string" && p.p.length > 0 &&
    typeof p.n === "string" &&
    typeof p.iat === "number" &&
    typeof p.exp === "number"
  );
}

/**
 * Decrypt + authenticate. Tampered, truncated, or other-purpose tokens are
 * "invalid". Expired tokens still open (expired: true) so the landing page can
 * offer a fresh link to the email on file — callers must refuse them for sign-in.
 */
export function openClientAccessToken(token: string | null | undefined, now = Date.now()): OpenClientAccessResult {
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

export function buildClientAccessUrl(portalOrigin: string, token: string): string {
  return `${portalOrigin.replace(/\/$/, "")}${CLIENT_ACCESS_PATH}?token=${encodeURIComponent(token)}`;
}

export function isClientAccessUrl(url: string | null | undefined): boolean {
  return Boolean(url && url.includes(`${CLIENT_ACCESS_PATH}?token=`));
}

/** Roles whose login must never be reachable through an emailed client link. */
export function isBusinessLoginRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "staff" || role === "super_admin";
}

export type ClientAccessRefusal =
  | "invalid"
  | "expired"
  | "wrong_business"
  | "client_missing"
  | "email_changed"
  | "not_on_project"
  | "business_login"
  | "foreign_login"
  | "rate_limited"
  | "sign_in_failed";

const REFUSAL_COPY: Record<ClientAccessRefusal, string> = {
  invalid: "This link isn't valid. It may be incomplete — try opening it from the email again.",
  expired: "This link has expired. We can email you a fresh one.",
  wrong_business: "This link belongs to a different portal.",
  client_missing: "This link is no longer active. Contact the business for a new one.",
  email_changed: "This link is no longer active. We can email a fresh one to the address on file.",
  not_on_project: "You no longer have access to this project. Contact the business if that's a mistake.",
  business_login: "This email belongs to a business account. Log in with your password to continue.",
  foreign_login: "This email can't be signed in here. Contact the business for help.",
  rate_limited: "Too many attempts. Please wait a few minutes and try again.",
  sign_in_failed: "We couldn't sign you in just now. Please try again.",
};

export function clientAccessRefusalMessage(reason: ClientAccessRefusal | string): string {
  return REFUSAL_COPY[reason as ClientAccessRefusal] ?? REFUSAL_COPY.invalid;
}

/** Refusals where emailing a fresh link to the address on file makes sense. */
export function canOfferFreshLink(reason: ClientAccessRefusal | string): boolean {
  return reason === "expired" || reason === "email_changed" || reason === "sign_in_failed";
}
