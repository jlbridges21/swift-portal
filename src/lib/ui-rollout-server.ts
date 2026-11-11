import { cache } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";
import {
  DEFAULT_ROLLOUT_CONFIG,
  EMPTY_USER_UI_PREFERENCE,
  effectivePhase,
  resolveUiExperience,
  transitionAtFrom,
  type RolloutBanner,
  type RolloutConfig,
  type RolloutStatus,
  type UiExperience,
  type UiInterface,
  type UserUiPreference,
} from "@/lib/ui-rollout";

/**
 * Server side of the interface rollout (migration v121). Every reader fails safe: a missing
 * table or a query error means "Classic Only", so deploying never changes what customers see.
 */

function isMissingRelation(message: string | undefined): boolean {
  return Boolean(message && /does not exist|schema cache|PGRST205|42P01/i.test(message));
}

const ROLLOUT_STATUSES: RolloutStatus[] = ["classic_only", "optional", "new_default", "classic_rollback"];

export type RolloutConfigState = RolloutConfig & { setupRequired: boolean; updatedAt: string | null };

export const loadRolloutConfig = cache(async (): Promise<RolloutConfigState> => {
  try {
    const raw = await createServiceClient();
    const { data, error } = await raw
      .from("platform_ui_rollout")
      .select("status, activated_at, transition_at, updated_at")
      .eq("id", true)
      .maybeSingle();
    if (error) {
      if (!isMissingRelation(error.message)) console.error("[ui-rollout] config read failed", error.message);
      return { ...DEFAULT_ROLLOUT_CONFIG, setupRequired: isMissingRelation(error.message), updatedAt: null };
    }
    const status = ROLLOUT_STATUSES.includes(data?.status as RolloutStatus) ? (data!.status as RolloutStatus) : "classic_only";
    return {
      status,
      activatedAt: (data?.activated_at as string | null) ?? null,
      transitionAt: (data?.transition_at as string | null) ?? null,
      updatedAt: (data?.updated_at as string | null) ?? null,
      setupRequired: false,
    };
  } catch (err) {
    console.error("[ui-rollout] config read failed", err);
    return { ...DEFAULT_ROLLOUT_CONFIG, setupRequired: false, updatedAt: null };
  }
});

export const loadUserUiPreference = cache(async (userId: string): Promise<UserUiPreference> => {
  try {
    const raw = await createServiceClient();
    const { data, error } = await raw
      .from("user_ui_preferences")
      .select("interface, try_new_banner_dismissed_at, welcome_new_banner_dismissed_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error || !data) {
      if (error && !isMissingRelation(error.message)) console.error("[ui-rollout] preference read failed", error.message);
      return EMPTY_USER_UI_PREFERENCE;
    }
    return {
      interface: data.interface === "new" || data.interface === "classic" ? data.interface : null,
      tryNewBannerDismissed: Boolean(data.try_new_banner_dismissed_at),
      welcomeNewBannerDismissed: Boolean(data.welcome_new_banner_dismissed_at),
    };
  } catch (err) {
    console.error("[ui-rollout] preference read failed", err);
    return EMPTY_USER_UI_PREFERENCE;
  }
});

/** The interface this signed-in business user gets on this request. */
export async function getUiExperience(profile: Pick<Profile, "id" | "role">): Promise<UiExperience> {
  const [config, pref] = await Promise.all([loadRolloutConfig(), loadUserUiPreference(profile.id)]);
  return resolveUiExperience(config, pref, { isSuperAdmin: profile.role === "super_admin" });
}

// ---------------------------------------------------------------------------
// Writes (callers authorize first)
// ---------------------------------------------------------------------------

export class RolloutSetupRequiredError extends Error {
  constructor() {
    super("The interface rollout tables are not set up yet (run supabase/migration-v121-ui-rollout.sql).");
  }
}

/** Save a user's interface choice and the first-try / first-switch-back adoption markers. */
export async function saveUserInterface(userId: string, next: UiInterface): Promise<void> {
  const raw = await createServiceClient();
  const { data: existing, error: readErr } = await raw
    .from("user_ui_preferences")
    .select("interface, first_tried_new_at, first_switched_back_at, switch_count")
    .eq("user_id", userId)
    .maybeSingle();
  if (readErr) {
    if (isMissingRelation(readErr.message)) throw new RolloutSetupRequiredError();
    throw new Error(readErr.message);
  }
  const now = new Date().toISOString();
  const previous = (existing?.interface as UiInterface | null) ?? "classic";
  const changed = previous !== next;
  const row: Record<string, unknown> = {
    user_id: userId,
    interface: next,
    updated_at: now,
    switch_count: (Number(existing?.switch_count) || 0) + (changed ? 1 : 0),
  };
  if (next === "new" && !existing?.first_tried_new_at) row.first_tried_new_at = now;
  if (next === "classic" && previous === "new" && !existing?.first_switched_back_at) row.first_switched_back_at = now;
  const { error } = await raw.from("user_ui_preferences").upsert(row, { onConflict: "user_id" });
  if (error) {
    if (isMissingRelation(error.message)) throw new RolloutSetupRequiredError();
    throw new Error(error.message);
  }
}

export async function dismissRolloutBanner(userId: string, banner: RolloutBanner): Promise<void> {
  const raw = await createServiceClient();
  const column = banner === "try_new" ? "try_new_banner_dismissed_at" : "welcome_new_banner_dismissed_at";
  const now = new Date().toISOString();
  const { error } = await raw
    .from("user_ui_preferences")
    .upsert({ user_id: userId, [column]: now, updated_at: now }, { onConflict: "user_id" });
  if (error) {
    if (isMissingRelation(error.message)) throw new RolloutSetupRequiredError();
    throw new Error(error.message);
  }
}

export type RolloutAction =
  | { action: "activate" }
  | { action: "delay"; days: number }
  | { action: "set_transition"; transitionAt: string }
  | { action: "new_only" }
  | { action: "rollback" }
  | { action: "resume_optional" }
  | { action: "reset_classic" };

/** Apply a super-admin rollout action. Returns the config before and after (for the audit log). */
export async function applyRolloutAction(
  input: RolloutAction,
  actorUserId: string
): Promise<{ before: RolloutConfig; after: RolloutConfig }> {
  const before = await loadRolloutConfig();
  if (before.setupRequired) throw new RolloutSetupRequiredError();
  const now = new Date();
  let patch: { status: RolloutStatus; activated_at: string | null; transition_at: string | null };
  const cur = { status: before.status, activated_at: before.activatedAt, transition_at: before.transitionAt };

  switch (input.action) {
    case "activate":
      // Starts the 14-day clock now. Re-activating restarts it.
      patch = { status: "optional", activated_at: now.toISOString(), transition_at: transitionAtFrom(now).toISOString() };
      break;
    case "delay": {
      if (!Number.isInteger(input.days) || input.days < 1 || input.days > 90) throw new Error("Delay must be 1–90 days.");
      // Delaying after the automatic switch reopens the optional period from now.
      const base = Math.max(before.transitionAt ? Date.parse(before.transitionAt) : now.getTime(), now.getTime());
      patch = {
        status: "optional",
        activated_at: before.activatedAt ?? now.toISOString(),
        transition_at: new Date(base + input.days * 86_400_000).toISOString(),
      };
      break;
    }
    case "set_transition": {
      const t = Date.parse(input.transitionAt);
      if (!Number.isFinite(t) || t <= now.getTime()) throw new Error("Choose a transition time in the future.");
      patch = { status: "optional", activated_at: before.activatedAt ?? now.toISOString(), transition_at: new Date(t).toISOString() };
      break;
    }
    case "new_only":
      patch = { ...cur, status: "new_default" };
      break;
    case "rollback":
      patch = { ...cur, status: "classic_rollback" };
      break;
    case "resume_optional": {
      // Back to the optional period; needs a future transition time.
      const t = before.transitionAt ? Date.parse(before.transitionAt) : NaN;
      if (!Number.isFinite(t) || t <= now.getTime()) throw new Error("Set a future transition date (use Delay) to resume the optional rollout.");
      patch = { ...cur, status: "optional" };
      break;
    }
    case "reset_classic":
      patch = { status: "classic_only", activated_at: null, transition_at: null };
      break;
    default:
      throw new Error("Unknown action.");
  }

  const raw = await createServiceClient();
  const { error } = await raw
    .from("platform_ui_rollout")
    .upsert({ id: true, ...patch, updated_at: now.toISOString(), updated_by: actorUserId }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return {
    before: { status: before.status, activatedAt: before.activatedAt, transitionAt: before.transitionAt },
    after: { status: patch.status, activatedAt: patch.activated_at, transitionAt: patch.transition_at },
  };
}

// ---------------------------------------------------------------------------
// Adoption analytics (super-admin)
// ---------------------------------------------------------------------------

export type RolloutAnalytics = {
  eligibleUsers: number;
  preferNew: number;
  preferClassic: number;
  explicitlyChoseClassic: number;
  triedNew: number;
  switchedBack: number;
  triedNewPct: number | null;
};

/**
 * Eligible = business owners/admins and active staff (super-admins excluded). Counts come from
 * saved choices only, so page views and refreshes never inflate them.
 */
export async function loadRolloutAnalytics(): Promise<RolloutAnalytics | null> {
  try {
    const raw = await createServiceClient();
    const eligible = new Set<string>();
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await raw
        .from("profiles")
        .select("id, role, disabled_at, business_id")
        .in("role", ["admin", "staff"])
        .not("business_id", "is", null)
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw new Error(error.message);
      for (const p of data ?? []) {
        if (p.role === "staff" && p.disabled_at) continue;
        eligible.add(p.id as string);
      }
      if (!data || data.length < PAGE) break;
    }

    const prefs: { user_id: string; interface: string | null; first_tried_new_at: string | null; first_switched_back_at: string | null }[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await raw
        .from("user_ui_preferences")
        .select("user_id, interface, first_tried_new_at, first_switched_back_at")
        .order("user_id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        if (isMissingRelation(error.message)) return null;
        throw new Error(error.message);
      }
      prefs.push(...((data ?? []) as typeof prefs));
      if (!data || data.length < PAGE) break;
    }

    let preferNew = 0;
    let explicitlyChoseClassic = 0;
    let triedNew = 0;
    let switchedBack = 0;
    for (const p of prefs) {
      if (!eligible.has(p.user_id)) continue;
      if (p.interface === "new") preferNew++;
      if (p.interface === "classic") explicitlyChoseClassic++;
      if (p.first_tried_new_at) triedNew++;
      if (p.first_switched_back_at) switchedBack++;
    }
    const n = eligible.size;
    return {
      eligibleUsers: n,
      preferNew,
      preferClassic: n - preferNew,
      explicitlyChoseClassic,
      triedNew,
      switchedBack,
      triedNewPct: n ? Math.round((triedNew / n) * 1000) / 10 : null,
    };
  } catch (err) {
    console.error("[ui-rollout] analytics failed", err);
    return null;
  }
}

export { effectivePhase };
