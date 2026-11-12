import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Signed, login-free pay links: `/pay/{paymentId}.{signature}`.
 *
 * The signature binds the payment id to its business, so a link can only ever open that
 * one payment, on that business's portal. Holding the link is the credential — the same
 * trust model as the Stripe Payment Link it sits beside — and the page shows only what the
 * client needs to pay (business, description, amount, due date), never other project data.
 * No database column is needed; the token is recomputed from the row.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SIGNATURE_HEX_LENGTH = 32;

function signingSecret(): string {
  const secret =
    process.env.PAY_LINK_SECRET?.trim() ||
    process.env.PLATFORM_SESSION_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    "";
  if (!secret) {
    throw new Error("PAY_LINK_SECRET (or PLATFORM_SESSION_SECRET) is required to sign pay links.");
  }
  return secret;
}

function signature(paymentId: string, businessId: string, secret = signingSecret()): string {
  return createHmac("sha256", secret)
    .update(`shootportal-pay-link:v1:${businessId.toLowerCase()}:${paymentId.toLowerCase()}`)
    .digest("hex")
    .slice(0, SIGNATURE_HEX_LENGTH);
}

export function hasPayLinkSecret(): boolean {
  try {
    return Boolean(signingSecret());
  } catch {
    return false;
  }
}

export function signPayLinkToken(paymentId: string, businessId: string): string {
  if (!UUID_RE.test(paymentId) || !UUID_RE.test(businessId)) throw new Error("Invalid pay link ids");
  return `${paymentId.toLowerCase()}.${signature(paymentId, businessId)}`;
}

/** Parse without trusting: callers load the row by id, then call verifyPayLinkToken with its business. */
export function parsePayLinkToken(token: string | null | undefined): { paymentId: string; sig: string } | null {
  if (!token || token.length > 120) return null;
  const [paymentId, sig, extra] = token.split(".");
  if (extra !== undefined || !paymentId || !sig) return null;
  if (!UUID_RE.test(paymentId) || !/^[0-9a-f]+$/.test(sig) || sig.length !== SIGNATURE_HEX_LENGTH) return null;
  return { paymentId: paymentId.toLowerCase(), sig };
}

export function verifyPayLinkToken(token: string, businessId: string | null | undefined): boolean {
  const parsed = parsePayLinkToken(token);
  if (!parsed || !businessId) return false;
  let expected: string;
  try {
    expected = signature(parsed.paymentId, businessId);
  } catch {
    return false;
  }
  const a = Buffer.from(parsed.sig, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export function payLinkPath(token: string): string {
  return `/pay/${token}`;
}
