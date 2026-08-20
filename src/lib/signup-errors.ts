import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

/** Stable, non-revealing codes returned to the signup client (except rate_limited). */
export type SignupErrorCode =
  | "rate_limited"
  | "email_exists"
  | "slug_taken"
  | "reserved_slug"
  | "disposable_email"
  | "validation_failed"
  | "auth_create_failed"
  | "provisioning_failed"
  | "rollback_failed"
  | "forbidden_host";

export const SIGNUP_GENERIC_ERROR =
  "We couldn’t create your account. Check your details and try again.";

export function newSignupRequestId(): string {
  return randomUUID().slice(0, 8);
}

/**
 * Greppable structured log for signup failures.
 * Never include passwords or full emails in logs beyond what operators need —
 * email domain only when useful; slug + requestId always.
 */
export function logSignupFailure(fields: {
  reason: SignupErrorCode;
  requestId: string;
  slug?: string | null;
  detail?: string;
  ip?: string;
}) {
  const line = {
    event: "signup_failure",
    reason: fields.reason,
    requestId: fields.requestId,
    slug: fields.slug ?? null,
    detail: fields.detail ?? null,
    ip: fields.ip ?? null,
  };
  console.error(`[signup] reason=${fields.reason} requestId=${fields.requestId} slug=${fields.slug ?? "-"}`, line);
}

export function signupErrorResponse(
  reason: SignupErrorCode,
  requestId: string,
  opts?: {
    status?: number;
    /** Override client-visible message (rate limits only). */
    message?: string;
    slug?: string | null;
    detail?: string;
    ip?: string;
    extra?: Record<string, unknown>;
  }
) {
  logSignupFailure({
    reason,
    requestId,
    slug: opts?.slug,
    detail: opts?.detail,
    ip: opts?.ip,
  });

  const message =
    opts?.message ??
    (reason === "rate_limited"
      ? "Too many signup attempts. Try again later."
      : SIGNUP_GENERIC_ERROR);

  return NextResponse.json(
    {
      error: message,
      code: reason,
      requestId,
      ...opts?.extra,
    },
    { status: opts?.status ?? (reason === "rate_limited" ? 429 : 400) }
  );
}
