import { createServiceClient } from "@/lib/supabase/server";
import { getAppSettings } from "@/lib/app-settings";
import { listBusinessServices } from "@/lib/business-services";
import {
  ONBOARDING_VERSION,
  canCompleteStep,
  canFinishOnboarding,
  emptyOnboardingState,
  isOnboardingStepId,
  markStepComplete,
  markStepSkipped,
  parseOnboardingState,
  type OnboardingState,
  type OnboardingStepId,
} from "@/lib/onboarding";
import { invalidateHostLookupCache } from "@/lib/host-resolution";

export type BusinessOnboardingRow = {
  id: string;
  onboarding_completed_at: string | null;
  onboarding_state: unknown;
};

export async function loadBusinessOnboarding(
  businessId: string
): Promise<BusinessOnboardingRow | null> {
  const raw = await createServiceClient();
  const { data } = await raw
    .from("businesses")
    .select("id, onboarding_completed_at, onboarding_state")
    .eq("id", businessId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!data) return null;
  return data as BusinessOnboardingRow;
}

export async function getOnboardingSnapshot(businessId: string) {
  const [row, settings, services] = await Promise.all([
    loadBusinessOnboarding(businessId),
    getAppSettings(businessId),
    listBusinessServices(businessId, { activeOnly: false }),
  ]);
  if (!row) throw new Error("Business not found.");

  let state = parseOnboardingState(row.onboarding_state);
  if (
    !row.onboarding_completed_at &&
    (!row.onboarding_state ||
      (typeof row.onboarding_state === "object" &&
        row.onboarding_state !== null &&
        Object.keys(row.onboarding_state as object).length === 0))
  ) {
    state = emptyOnboardingState();
  }

  return {
    completedAt: row.onboarding_completed_at,
    state,
    settings,
    services,
  };
}

async function writeOnboardingState(
  businessId: string,
  state: OnboardingState,
  completedAt: string | null
) {
  const raw = await createServiceClient();
  const patch: Record<string, unknown> = {
    onboarding_state: state,
    updated_at: new Date().toISOString(),
  };
  if (completedAt) patch.onboarding_completed_at = completedAt;

  const { error } = await raw.from("businesses").update(patch).eq("id", businessId);
  if (error) throw new Error(error.message);
  // Middleware host cache can otherwise bounce /admin → /onboarding for ~30s.
  invalidateHostLookupCache();
}

export type OnboardingAction =
  | { type: "goto"; step: OnboardingStepId }
  | { type: "complete"; step: OnboardingStepId }
  | { type: "skip"; step: OnboardingStepId }
  | { type: "defer" }
  | { type: "resume" }
  | { type: "finish" };

export async function applyOnboardingAction(
  businessId: string,
  action: OnboardingAction
): Promise<{ state: OnboardingState; completedAt: string | null }> {
  const snap = await getOnboardingSnapshot(businessId);
  if (snap.completedAt) {
    return { state: snap.state, completedAt: snap.completedAt };
  }

  let state = { ...snap.state, version: ONBOARDING_VERSION, lastActiveAt: new Date().toISOString() };
  let completedAt: string | null = null;

  if (action.type === "goto") {
    if (!isOnboardingStepId(action.step)) throw new Error("Invalid step.");
    state = { ...state, currentStep: action.step, deferred: false };
  } else if (action.type === "complete") {
    const gate = canCompleteStep(action.step, {
      settings: snap.settings,
      services: snap.services,
    });
    if (!gate.ok) throw new Error(gate.reason || "Step is incomplete.");
    state = markStepComplete(state, action.step);
  } else if (action.type === "skip") {
    state = markStepSkipped(state, action.step);
  } else if (action.type === "defer") {
    state = { ...state, deferred: true, lastActiveAt: new Date().toISOString() };
  } else if (action.type === "resume") {
    state = { ...state, deferred: false, lastActiveAt: new Date().toISOString() };
  } else if (action.type === "finish") {
    const gate = canFinishOnboarding({
      settings: snap.settings,
      services: snap.services,
    });
    if (!gate.ok) throw new Error(gate.reason || "Required setup is incomplete.");
    state = markStepComplete(state, "finish", "finish");
    state = { ...state, deferred: false };
    completedAt = new Date().toISOString();
  }

  await writeOnboardingState(businessId, state, completedAt);
  return { state, completedAt };
}
