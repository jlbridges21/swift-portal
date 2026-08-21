/**
 * Self-serve onboarding wizard state.
 *
 * VERSIONING
 * ----------
 * `ONBOARDING_VERSION` is stored on every businesses.onboarding_state row.
 * When we bump the version:
 *   - Businesses with onboarding_completed_at set are NEVER re-prompted.
 *     Their wizard is done for life (unless we add an explicit re-open tool).
 *   - Incomplete businesses: parseOnboardingState migrates unknown step ids
 *     out of completed/skipped, clamps currentStep to a known step, and
 *     stamps the new version on the next save. They are not reset to welcome.
 */

import type { AppSettings } from "@/lib/app-settings";
import {
  hasActivePricedService,
  isBusinessNameConfigured,
  isContactEmailConfigured,
  requiredSetupComplete,
  type ServiceCompletenessRow,
} from "@/lib/setup-completeness";

/** Bump when adding/removing/renaming wizard steps. See file header. */
export const ONBOARDING_VERSION = 1;

export const ONBOARDING_STEP_IDS = [
  "welcome",
  "identity",
  "branding",
  "services",
  "payments",
  "landing",
  "finish",
] as const;

export type OnboardingStepId = (typeof ONBOARDING_STEP_IDS)[number];

/** Steps that cannot be marked complete without valid input. */
export const ONBOARDING_REQUIRED_STEPS: OnboardingStepId[] = ["identity", "services"];

export type OnboardingState = {
  version: number;
  currentStep: OnboardingStepId;
  completedSteps: OnboardingStepId[];
  skippedSteps: OnboardingStepId[];
  startedAt: string;
  lastActiveAt: string;
  /** Set when the admin chooses "I'll do this later" — allows /admin without trapping. */
  deferred?: boolean;
  /** Migration / backfill marker (optional). */
  backfilled?: boolean;
};

export function isOnboardingStepId(value: unknown): value is OnboardingStepId {
  return typeof value === "string" && (ONBOARDING_STEP_IDS as readonly string[]).includes(value);
}

export function emptyOnboardingState(now = new Date()): OnboardingState {
  const iso = now.toISOString();
  return {
    version: ONBOARDING_VERSION,
    currentStep: "welcome",
    completedSteps: [],
    skippedSteps: [],
    startedAt: iso,
    lastActiveAt: iso,
    deferred: false,
  };
}

export function parseOnboardingState(raw: unknown): OnboardingState {
  const base = emptyOnboardingState();
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return base;
  const o = raw as Record<string, unknown>;

  const completed = Array.isArray(o.completedSteps)
    ? o.completedSteps.filter(isOnboardingStepId)
    : [];
  const skipped = Array.isArray(o.skippedSteps)
    ? o.skippedSteps.filter(isOnboardingStepId)
    : [];
  const current = isOnboardingStepId(o.currentStep) ? o.currentStep : "welcome";

  return {
    version: typeof o.version === "number" && Number.isFinite(o.version) ? Math.trunc(o.version) : 1,
    currentStep: current,
    completedSteps: [...new Set(completed)],
    skippedSteps: [...new Set(skipped)],
    startedAt: typeof o.startedAt === "string" && o.startedAt ? o.startedAt : base.startedAt,
    lastActiveAt:
      typeof o.lastActiveAt === "string" && o.lastActiveAt ? o.lastActiveAt : base.lastActiveAt,
    deferred: o.deferred === true,
    backfilled: o.backfilled === true,
  };
}

export function stepIndex(step: OnboardingStepId): number {
  return ONBOARDING_STEP_IDS.indexOf(step);
}

export function canCompleteStep(
  step: OnboardingStepId,
  input: { settings: AppSettings; services: ServiceCompletenessRow[] }
): { ok: boolean; reason?: string } {
  if (step === "identity") {
    if (!isBusinessNameConfigured(input.settings)) {
      return { ok: false, reason: "Enter your business name (not the platform default)." };
    }
    if (!isContactEmailConfigured(input.settings)) {
      return {
        ok: false,
        reason: "Add a contact email — clients and reply-to need it.",
      };
    }
    return { ok: true };
  }
  if (step === "services") {
    if (!hasActivePricedService(input.services)) {
      return {
        ok: false,
        reason:
          "Keep at least one active service with a price (or mark it as custom / hide pricing). Without that, the client request form has nothing to offer.",
      };
    }
    return { ok: true };
  }
  return { ok: true };
}

export function canFinishOnboarding(input: {
  settings: AppSettings;
  services: ServiceCompletenessRow[];
}): { ok: boolean; reason?: string } {
  if (!requiredSetupComplete(input)) {
    return {
      ok: false,
      reason:
        "Finish business name, contact email, and at least one active priced service before completing setup.",
    };
  }
  return { ok: true };
}

/**
 * Admin should see the wizard (not an empty dashboard) when incomplete and not deferred.
 * Completed businesses (onboarding_completed_at set) never see it — including version bumps.
 */
export function needsOnboardingRedirect(input: {
  onboardingCompletedAt: string | null | undefined;
  onboardingState: unknown;
  role: string;
  impersonating?: boolean;
}): boolean {
  if (input.role !== "admin") return false;
  if (input.impersonating) return false;
  if (input.onboardingCompletedAt) return false;
  const state = parseOnboardingState(input.onboardingState);
  if (state.deferred) return false;
  return true;
}

/** Post-auth destination for an admin (wizard vs dashboard). */
export function adminHomePath(input: {
  onboardingCompletedAt: string | null | undefined;
  onboardingState: unknown;
}): "/onboarding" | "/admin" {
  return needsOnboardingRedirect({
    onboardingCompletedAt: input.onboardingCompletedAt,
    onboardingState: input.onboardingState,
    role: "admin",
  })
    ? "/onboarding"
    : "/admin";
}

export function showFinishSetupBanner(input: {
  onboardingCompletedAt: string | null | undefined;
  onboardingState: unknown;
  role: string;
  impersonating?: boolean;
}): boolean {
  if (input.role !== "admin") return false;
  if (input.impersonating) return false;
  if (input.onboardingCompletedAt) return false;
  const state = parseOnboardingState(input.onboardingState);
  return state.deferred === true;
}

export function markStepComplete(
  state: OnboardingState,
  step: OnboardingStepId,
  nextStep?: OnboardingStepId
): OnboardingState {
  const completed = [...new Set([...state.completedSteps, step])];
  const skipped = state.skippedSteps.filter((s) => s !== step);
  const idx = stepIndex(step);
  const fallbackNext =
    idx >= 0 && idx < ONBOARDING_STEP_IDS.length - 1
      ? ONBOARDING_STEP_IDS[idx + 1]
      : step;
  return {
    ...state,
    version: ONBOARDING_VERSION,
    completedSteps: completed,
    skippedSteps: skipped,
    currentStep: nextStep ?? fallbackNext,
    lastActiveAt: new Date().toISOString(),
    deferred: false,
  };
}

export function markStepSkipped(
  state: OnboardingState,
  step: OnboardingStepId,
  nextStep?: OnboardingStepId
): OnboardingState {
  if (ONBOARDING_REQUIRED_STEPS.includes(step)) {
    throw new Error("This step is required and cannot be skipped.");
  }
  const skipped = [...new Set([...state.skippedSteps, step])];
  const completed = state.completedSteps.filter((s) => s !== step);
  const idx = stepIndex(step);
  const fallbackNext =
    idx >= 0 && idx < ONBOARDING_STEP_IDS.length - 1
      ? ONBOARDING_STEP_IDS[idx + 1]
      : step;
  return {
    ...state,
    version: ONBOARDING_VERSION,
    skippedSteps: skipped,
    completedSteps: completed,
    currentStep: nextStep ?? fallbackNext,
    lastActiveAt: new Date().toISOString(),
  };
}
