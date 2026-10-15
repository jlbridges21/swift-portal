import { cache } from "react";
import { assertActivePlanKey, resolvePlanTrialDays } from "@/lib/entitlements";
import { FALLBACK_TRIAL_DAYS, formatPlanPrice } from "@/lib/plan-catalog";
import type { BlogRenderContext } from "@/lib/blog/types";

/**
 * Trial length and Studio price from the live plan catalog (same source as
 * /how-it-works and /pricing), so article copy never quotes a stale offer.
 */
export const loadBlogRenderContext = cache(async (): Promise<BlogRenderContext> => {
  try {
    const studio = await assertActivePlanKey("studio");
    return {
      trialDays: resolvePlanTrialDays(studio, "blog"),
      studioMonthly: studio.price_monthly_cents != null ? formatPlanPrice(studio.price_monthly_cents) : null,
      studioAnnual: studio.price_annual_cents != null ? formatPlanPrice(studio.price_annual_cents) : null,
    };
  } catch {
    return { trialDays: FALLBACK_TRIAL_DAYS, studioMonthly: null, studioAnnual: null };
  }
});
