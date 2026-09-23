/**
 * Read-only impersonation: which non-GET requests may still run.
 *
 * Super-admin impersonation defaults to read-only so a platform operator cannot
 * accidentally mutate a customer’s data. Middleware treats every non-GET/HEAD/OPTIONS
 * as a write unless the path is listed here (or under /api/platform|/api/auth).
 *
 * QUALIFIES for this allowlist:
 *   - Exact pathnames only (no prefixes / globs) so a later nested mutate route
 *     cannot inherit an exemption.
 *   - Handlers that only READ: select rows, sign storage URLs, compute previews.
 *   - No INSERT / UPDATE / DELETE, no storage uploads, no email/SMS, no Stripe
 *     charges or Checkout sessions, no attribution writes, no settings changes.
 *   - POST (or similar) is used only because the request body is too large or
 *     structured for a query string (e.g. up to 48 UUIDs).
 *
 * DOES NOT QUALIFY:
 *   - Anything that creates/updates/deletes business data
 *   - Upload / sign-upload / complete-upload
 *   - Email send / domain verify that persists config
 *   - Promo *apply* / checkout / portal session creation
 *   - Comment create, payment create, project PATCH, etc.
 */

/** Stable API code for clients to detect the guard without string-matching copy. */
export const IMPERSONATION_READONLY_CODE = "impersonation_readonly" as const;

export const IMPERSONATION_READONLY_MESSAGE =
  "Impersonation is read-only. Confirm “allow writes” on the platform banner to change this business.";

/**
 * Exact pathnames exempt from the read-only write guard.
 * Keep this list short and re-audit when adding POST “loader” routes.
 */
export const READ_ONLY_POST_EXEMPT_PATHS: ReadonlySet<string> = new Set([
  /** Batch-sign grid/lightbox thumbs — body is `{ ids: string[] }` (≤48). */
  "/api/media/thumbnails",
  /** Live promo price preview on /billing — previewPromoCodeDiscount does not write. */
  "/api/billing/promo-preview",
]);

export function isReadOnlyPostExemptPath(pathname: string): boolean {
  return READ_ONLY_POST_EXEMPT_PATHS.has(pathname);
}

/** Browser event name — ImpersonationBanner listens and shows a notice. */
export const IMPERSONATION_READONLY_EVENT = "impersonation-readonly-blocked";

export type ImpersonationReadonlyBlockedDetail = {
  message: string;
  endpoint?: string;
  status?: number;
};

/** Fire from clients that would otherwise swallow a 403 into an empty UI. */
export function notifyImpersonationReadonlyBlocked(
  detail: ImpersonationReadonlyBlockedDetail
): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent<ImpersonationReadonlyBlockedDetail>(IMPERSONATION_READONLY_EVENT, {
      detail,
    })
  );
}

export function isImpersonationReadonlyPayload(data: unknown): data is {
  code?: string;
  error?: string;
} {
  if (!data || typeof data !== "object") return false;
  const o = data as { code?: unknown; error?: unknown };
  if (o.code === IMPERSONATION_READONLY_CODE) return true;
  return typeof o.error === "string" && o.error.includes("read-only");
}
