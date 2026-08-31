/**
 * Shared parsers for Supabase auth URL fragments / query errors.
 * Used by /login and public landing pages (apex + tenant).
 *
 * Implicit-flow emails (e.g. Dashboard password recovery) land on Site URL with:
 *   #access_token=…&refresh_token=…&type=recovery
 * or errors:
 *   #error=access_denied&error_code=otp_expired&error_description=…
 */

export type AuthLinkErrorKind =
  | "otp_expired"
  | "access_denied"
  | "generic"
  | "share_expired"
  | "share_one_time_used"
  | "share_revoked"
  | "share_not_started"
  | "share_rate_limited";

export type ParsedAuthFragment =
  | { kind: "none" }
  | { kind: "error"; errorKind: AuthLinkErrorKind; description: string | null }
  | {
      kind: "tokens";
      accessToken: string;
      refreshToken: string;
      type: string | null;
    }
  | { kind: "code"; code: string };

export function messageForAuthLinkError(
  kind: AuthLinkErrorKind,
  description: string | null
): string {
  if (kind === "share_expired") {
    return (
      "This project share link has expired. " +
      "Ask the studio to extend access, or request a fresh sign-in link below."
    );
  }
  if (kind === "share_one_time_used") {
    return (
      "This one-time share link was already used. " +
      "Request a new sign-in link below to open the project again."
    );
  }
  if (kind === "share_revoked") {
    return "This project share was revoked. Contact the studio if you still need access.";
  }
  if (kind === "share_not_started") {
    return "This share link is not active yet. Try again after the access window starts.";
  }
  if (kind === "share_rate_limited") {
    return description || "Too many sign-in attempts. Wait a few minutes and try again.";
  }
  if (kind === "otp_expired") {
    return (
      "That invite or reset link expired or was already used. " +
      (description ? `(${description.replace(/\+/g, " ")}) ` : "") +
      "Request a new link below."
    );
  }
  if (kind === "access_denied") {
    return (
      "Access was denied for that email link — it may have expired, already been used, or been blocked. " +
      "Request a new link below."
    );
  }
  return "That email link didn’t work. Request a new one below.";
}

export function classifyAuthErrorParams(params: URLSearchParams): {
  kind: AuthLinkErrorKind;
  description: string | null;
} | null {
  const error = params.get("error");
  const code = params.get("error_code");
  const description = params.get("error_description");
  if (!error && !code) return null;

  if (code === "otp_expired" || /otp_expired|expired|invalid/i.test(description || "")) {
    return { kind: "otp_expired", description };
  }
  if (error === "access_denied" || code === "access_denied") {
    return { kind: "access_denied", description };
  }
  return { kind: "generic", description };
}

/** Parse hash + search once. Safe to call only in the browser. */
export function parseAuthFragment(
  hash: string,
  search: string
): ParsedAuthFragment {
  const hashRaw = hash.replace(/^#/, "");
  if (hashRaw) {
    const params = new URLSearchParams(hashRaw);
    const err = classifyAuthErrorParams(params);
    if (err) {
      return { kind: "error", errorKind: err.kind, description: err.description };
    }
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    if (accessToken && refreshToken) {
      return {
        kind: "tokens",
        accessToken,
        refreshToken,
        type: params.get("type"),
      };
    }
  }

  const query = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  const code = query.get("code");
  if (code) {
    return { kind: "code", code };
  }
  const qErr = classifyAuthErrorParams(query);
  if (qErr) {
    return { kind: "error", errorKind: qErr.kind, description: qErr.description };
  }

  return { kind: "none" };
}

export function clearAuthFragmentFromUrl(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", path);
}
