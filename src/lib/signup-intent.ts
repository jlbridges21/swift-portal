/**
 * Signup intent: "start a free trial" vs "subscribe now (monthly | annual)".
 *
 * Client-safe and edge-safe (middleware reads the cookie). The intent is a preference only —
 * it never grants access, discounts, or billing state. Paid access comes from Stripe via the
 * billing webhook / server-side Checkout Session verification.
 *
 * How it travels:
 * - /signup shows the plan picker (annual preselected); ?plan=monthly|annual preselects a plan.
 *   Free-trial CTAs link to /signup?intent=trial (TRIAL_SIGNUP_HREF).
 * - The signup form sends it in the POST body and also writes SIGNUP_INTENT_COOKIE so Google
 *   sign-up (OAuth → /finish-setup) and existing-user login keep it.
 * - Once the business exists, the choice is stored on business_billing_journey (server-side),
 *   so email verification, refreshes, other devices and returning later all keep it.
 */

export type SignupPath = "trial" | "subscribe";
export type SignupInterval = "monthly" | "annual";

export type SignupIntent = {
  path: SignupPath;
  /** Only set for the subscribe path. */
  interval: SignupInterval | null;
  /** Attribution only (e.g. "demo"). Never used for eligibility or pricing. */
  source: string | null;
};

export const SIGNUP_INTENT_COOKIE = "sp_signup_intent";
export const SIGNUP_INTENT_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

const SOURCE_RE = /^[a-z0-9_-]{1,40}$/;

export function parseSignupInterval(raw: unknown): SignupInterval | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  if (v === "monthly" || v === "month") return "monthly";
  if (v === "annual" || v === "annually" || v === "yearly" || v === "year") return "annual";
  return null;
}

export function parseSignupSource(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return SOURCE_RE.test(v) ? v : null;
}

/** From /signup query params. `plan` present (monthly|annual) ⇒ subscribe path. */
export function intentFromSearchParams(params: {
  plan?: string | string[] | null;
  source?: string | string[] | null;
  intent?: string | string[] | null;
}): SignupIntent {
  const first = (v: string | string[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const interval = parseSignupInterval(first(params.plan));
  const explicit = first(params.intent);
  const source = parseSignupSource(first(params.source));
  if (explicit === "trial") return { path: "trial", interval: null, source };
  // Default view is the plan picker (annual preselected); free-trial CTAs pass ?intent=trial.
  return { path: "subscribe", interval: interval ?? "annual", source };
}

/** Normalize a POST body / untrusted object into an intent. Unknown ⇒ trial (today's default). */
export function normalizeSignupIntent(raw: {
  signupPath?: unknown;
  interval?: unknown;
  source?: unknown;
} | null | undefined): SignupIntent {
  const path: SignupPath = raw?.signupPath === "subscribe" ? "subscribe" : "trial";
  return {
    path,
    interval: path === "subscribe" ? parseSignupInterval(raw?.interval) : null,
    source: parseSignupSource(raw?.source),
  };
}

/** Cookie value: v1.<path>.<interval|->.<source|-> */
export function serializeSignupIntent(intent: SignupIntent): string {
  return [
    "v1",
    intent.path,
    intent.path === "subscribe" ? intent.interval ?? "-" : "-",
    intent.source ?? "-",
  ].join(".");
}

export function parseSignupIntentCookie(raw: string | null | undefined): SignupIntent | null {
  const value = raw?.trim();
  if (!value) return null;
  const parts = decodeURIComponent(value).split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  if (parts[1] !== "trial" && parts[1] !== "subscribe") return null;
  const path = parts[1] as SignupPath;
  return {
    path,
    interval: path === "subscribe" ? parseSignupInterval(parts[2]) : null,
    source: parts[3] === "-" ? null : parseSignupSource(parts[3]),
  };
}

/**
 * Cookie Domain so the intent set on the marketing apex is readable on {slug}.<root> after login.
 * Returns null for localhost / IPs / hosts outside the platform root (cookie stays host-only).
 */
export function signupIntentCookieDomain(hostname: string, platformRootDomain: string): string | null {
  const host = hostname.toLowerCase().split(":")[0] ?? "";
  const root = platformRootDomain.toLowerCase().replace(/^www\./, "").split(":")[0] ?? "";
  if (!root || root === "localhost" || /^[\d.]+$/.test(root)) return null;
  if (host === root || host.endsWith(`.${root}`)) return `.${root}`;
  return null;
}

/** Free-trial CTA target (plain /signup opens the plan picker). */
export const TRIAL_SIGNUP_HREF = "/signup?intent=trial";

/** /signup link for a marketing CTA. No interval ⇒ the free-trial view. */
export function signupHref(intent: { interval?: SignupInterval | null; source?: string | null } = {}): string {
  const params = new URLSearchParams();
  if (intent.interval) params.set("plan", intent.interval);
  else params.set("intent", "trial");
  const source = parseSignupSource(intent.source);
  if (source) params.set("source", source);
  return `/signup?${params.toString()}`;
}
