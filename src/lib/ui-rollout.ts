/**
 * Classic / New business-interface rollout — pure rules (no I/O), shared by server and client.
 *
 * Phases (platform_ui_rollout.status + the clock):
 *   classic_only      before activation — everyone Classic, no banners. Super-admins may preview New.
 *   optional          days 1–14 — Classic by default, users opt in/out freely, banners + switcher.
 *   new_default       after transition_at (automatic) or forced by the super-admin — everyone New.
 *   classic_rollback  emergency rollback — everyone Classic, no banners.
 *
 * The interface is presentation only. Permissions are enforced by the same page/API guards in
 * both interfaces; nothing here grants access to anything.
 */

export type UiInterface = "classic" | "new";
export type RolloutStatus = "classic_only" | "optional" | "new_default" | "classic_rollback";
export type RolloutBanner = "try_new" | "welcome_new";

export const UI_ROLLOUT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

export const ROLLOUT_STATUS_LABEL: Record<RolloutStatus, string> = {
  classic_only: "Classic Only",
  optional: "Optional Rollout",
  new_default: "New Interface Default",
  classic_rollback: "Classic Rollback",
};

export type RolloutConfig = {
  status: RolloutStatus;
  activatedAt: string | null;
  transitionAt: string | null;
};

export const DEFAULT_ROLLOUT_CONFIG: RolloutConfig = { status: "classic_only", activatedAt: null, transitionAt: null };

export type UserUiPreference = {
  interface: UiInterface | null;
  tryNewBannerDismissed: boolean;
  welcomeNewBannerDismissed: boolean;
};

export const EMPTY_USER_UI_PREFERENCE: UserUiPreference = {
  interface: null,
  tryNewBannerDismissed: false,
  welcomeNewBannerDismissed: false,
};

export type UiExperience = {
  mode: UiInterface;
  phase: RolloutStatus;
  /** Show "Switch to … Experience" in the account menu. */
  canSwitch: boolean;
  banner: RolloutBanner | null;
};

export function transitionAtFrom(activatedAt: Date): Date {
  return new Date(activatedAt.getTime() + UI_ROLLOUT_DAYS * DAY_MS);
}

/** The phase in force right now. An optional rollout past its transition time is New Default. */
export function effectivePhase(config: RolloutConfig, now: Date = new Date()): RolloutStatus {
  if (config.status === "optional") {
    const t = config.transitionAt ? Date.parse(config.transitionAt) : NaN;
    if (Number.isFinite(t) && now.getTime() >= t) return "new_default";
  }
  return config.status;
}

export function resolveUiExperience(
  config: RolloutConfig,
  pref: UserUiPreference,
  viewer: { isSuperAdmin: boolean },
  now: Date = new Date()
): UiExperience {
  const phase = effectivePhase(config, now);
  // Super-admins can always preview either interface (internal testing, rollback checks).
  // Their choice is stored like anyone else's but never shows a banner.
  const preview = viewer.isSuperAdmin ? pref.interface : null;

  switch (phase) {
    case "optional": {
      const mode: UiInterface = pref.interface ?? "classic";
      const dismissed = mode === "classic" ? pref.tryNewBannerDismissed : pref.welcomeNewBannerDismissed;
      return {
        mode,
        phase,
        canSwitch: true,
        banner: viewer.isSuperAdmin || dismissed ? null : mode === "classic" ? "try_new" : "welcome_new",
      };
    }
    case "new_default":
      return { mode: preview ?? "new", phase, canSwitch: viewer.isSuperAdmin, banner: null };
    case "classic_rollback":
    case "classic_only":
    default:
      return { mode: preview ?? "classic", phase, canSwitch: viewer.isSuperAdmin, banner: null };
  }
}

/** Same-origin path to return to after a switch; anything else falls back to `fallback`. */
export function safeReturnPath(raw: unknown, fallback = "/admin"): string {
  if (typeof raw !== "string") return fallback;
  const v = raw.trim();
  if (!v.startsWith("/") || v.startsWith("//") || v.includes("\\") || v.length > 2000) return fallback;
  return v;
}
