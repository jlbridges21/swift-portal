/**
 * Diagnostic mode disables artificial timeouts so uploads fail only with real errors.
 * Enable in development or set NEXT_PUBLIC_UPLOAD_DIAGNOSTIC_MODE=true
 */
export const UPLOAD_DIAGNOSTIC_MODE =
  process.env.NEXT_PUBLIC_UPLOAD_DIAGNOSTIC_MODE === "true" ||
  process.env.NODE_ENV === "development";

export const SHOW_UPLOAD_TECHNICAL_DETAILS =
  UPLOAD_DIAGNOSTIC_MODE || process.env.NEXT_PUBLIC_UPLOAD_DEBUG_UI === "true";
