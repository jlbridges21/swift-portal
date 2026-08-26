/**
 * Stripe error helpers for billing routes — log request ids, map safe client messages.
 */

import Stripe from "stripe";

export type StripeErrorDetails = {
  type: string;
  code: string | null;
  param: string | null;
  message: string;
  requestId: string | null;
  statusCode: number | null;
};

export function isStripeError(err: unknown): err is Stripe.StripeRawError | Stripe.errors.StripeError {
  if (!err || typeof err !== "object") return false;
  const e = err as { type?: string; rawType?: string };
  return Boolean(
    e.type?.startsWith("Stripe") ||
      e.rawType ||
      err instanceof Stripe.errors.StripeError
  );
}

export function extractStripeErrorDetails(err: unknown): StripeErrorDetails | null {
  if (!err || typeof err !== "object") return null;
  const e = err as Stripe.errors.StripeError & {
    rawType?: string;
    requestId?: string;
    headers?: { "request-id"?: string };
  };
  const looksStripe =
    err instanceof Stripe.errors.StripeError ||
    typeof e.type === "string" ||
    typeof e.rawType === "string" ||
    typeof e.requestId === "string";
  if (!looksStripe) return null;

  return {
    type: e.type || e.rawType || "StripeError",
    code: e.code ?? null,
    param: e.param ?? null,
    message: e.message || "Stripe request failed",
    requestId: e.requestId ?? e.headers?.["request-id"] ?? null,
    statusCode: typeof e.statusCode === "number" ? e.statusCode : null,
  };
}

/** True when Checkout rejected a pre-applied coupon / discount — safe to retry at list price. */
export function isStripeDiscountApplyError(err: unknown): boolean {
  const d = extractStripeErrorDetails(err);
  if (!d) return false;
  const msg = d.message.toLowerCase();
  const param = (d.param ?? "").toLowerCase();
  if (param.includes("discount") || param.includes("coupon") || param.includes("promotion")) {
    return true;
  }
  if (d.code === "resource_missing" && msg.includes("coupon")) return true;
  if (msg.includes("coupon") || msg.includes("discount") || msg.includes("promotion code")) {
    return true;
  }
  if (msg.includes("allow_promotion_codes") && msg.includes("discount")) return true;
  return false;
}

/**
 * Client-safe message for known Stripe failures. Sensitive details stay server-logged.
 */
export function clientMessageForStripeError(err: unknown): {
  status: number;
  error: string;
  code?: string;
} {
  const d = extractStripeErrorDetails(err);
  if (!d) {
    return { status: 500, error: "Billing request failed. Try again, or contact support." };
  }

  if (d.code === "resource_missing" && (d.param === "price" || d.message.toLowerCase().includes("price"))) {
    return {
      status: 400,
      error: "This plan is misconfigured for billing. Contact ShootPortal support.",
      code: "plan_misconfigured",
    };
  }
  if (d.code === "resource_missing" && d.message.toLowerCase().includes("customer")) {
    return {
      status: 400,
      error: "Billing customer could not be found. Refresh and try again.",
      code: "customer_missing",
    };
  }
  if (isStripeDiscountApplyError(err)) {
    return {
      status: 400,
      error: "The referral discount could not be applied. Try again, or continue without it.",
      code: "discount_unavailable",
    };
  }
  if (d.message.toLowerCase().includes("trial_end")) {
    return {
      status: 400,
      error: "Your trial window is too short to extend at checkout. Subscribe without extending the trial.",
      code: "trial_end_invalid",
    };
  }

  return {
    status: d.statusCode && d.statusCode >= 400 && d.statusCode < 500 ? d.statusCode : 500,
    error:
      "Billing request failed. If this continues, contact support with the time of the attempt.",
    code: d.code ?? undefined,
  };
}

export function logStripeError(context: string, err: unknown, extra?: Record<string, unknown>) {
  const details = extractStripeErrorDetails(err);
  if (details) {
    console.error(`[${context}] Stripe error`, {
      ...extra,
      stripeType: details.type,
      stripeCode: details.code,
      stripeParam: details.param,
      stripeMessage: details.message,
      stripeRequestId: details.requestId,
      stripeStatusCode: details.statusCode,
    });
    return;
  }
  console.error(`[${context}] failed`, {
    ...extra,
    error: err instanceof Error ? err.message : String(err),
  });
}
