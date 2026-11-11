"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { Sparkles, X } from "lucide-react";
import type { RolloutBanner, UiExperience, UiInterface } from "@/lib/ui-rollout";

/**
 * Interface-rollout state for the current business user, resolved on the server per request
 * (so the right layout renders first, with no flash). Outside the business app there is no
 * provider: Classic, no banner, no switcher.
 */
const UiRolloutContext = createContext<UiExperience>({
  mode: "classic",
  phase: "classic_only",
  canSwitch: false,
  banner: null,
});

export function UiRolloutProvider({ value, children }: { value: UiExperience; children: React.ReactNode }) {
  return <UiRolloutContext.Provider value={value}>{children}</UiRolloutContext.Provider>;
}

export function useUiRollout(): UiExperience {
  return useContext(UiRolloutContext);
}

/**
 * Switch interface by submitting a real form POST that saves the choice and redirects back to
 * the same URL. A full navigation (not a client-side refresh) means:
 *   - pages that guard unsaved work with `beforeunload` (settings, editors, uploads) still prompt,
 *     and if the user stays, nothing is saved;
 *   - the server renders the chosen layout directly — no flash of the other interface;
 *   - the session cookie is reused, so nobody signs in again.
 */
export function useSwitchInterface() {
  return useCallback((to: UiInterface) => {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = "/api/ui-preference/switch";
    form.style.display = "none";
    const add = (name: string, value: string) => {
      const input = document.createElement("input");
      input.type = "hidden";
      input.name = name;
      input.value = value;
      form.appendChild(input);
    };
    add("interface", to);
    add("next", `${window.location.pathname}${window.location.search}${window.location.hash}`);
    document.body.appendChild(form);
    form.submit();
  }, []);
}

const COPY: Record<RolloutBanner, { heading: string; body: string; cta: string; to: UiInterface }> = {
  try_new: {
    heading: "✨ Meet the New ShootPortal!",
    body: "We've redesigned ShootPortal to make managing your business easier. Explore the new experience and switch back anytime.",
    cta: "Try New Experience",
    to: "new",
  },
  welcome_new: {
    heading: "🎉 Welcome to the New ShootPortal!",
    body: "You're exploring our redesigned experience. Prefer the familiar layout? You can switch back anytime during the rollout.",
    cta: "Switch to Classic",
    to: "classic",
  },
};

/** Announcement banner shown under the app header during the optional rollout. */
export function UiRolloutBanner({ className }: { className?: string }) {
  const { banner } = useUiRollout();
  const switchTo = useSwitchInterface();
  const [hidden, setHidden] = useState(false);
  const [switching, setSwitching] = useState(false);
  if (!banner || hidden) return null;
  const copy = COPY[banner];

  const dismiss = () => {
    setHidden(true);
    // Remembered per user on the server, so it stays hidden on every device.
    void fetch("/api/ui-preference/dismiss", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ banner }),
    }).catch(() => undefined);
  };

  return (
    <div className={className} data-ui-rollout-banner={banner}>
      <div className="app-safe-x border-b border-accent/15 bg-gradient-to-r from-accent-subtle via-card to-accent-subtle">
        <div className="mx-auto flex w-full max-w-7xl items-start gap-3 px-4 py-3 sm:items-center sm:px-6 lg:px-8">
          <span className="mt-0.5 hidden h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card text-accent shadow-sm ring-1 ring-accent/15 sm:mt-0 sm:flex">
            <Sparkles className="h-4 w-4" aria-hidden />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-heading">{copy.heading}</p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted sm:text-[13px]">{copy.body}</p>
            </div>
            <button
              type="button"
              disabled={switching}
              onClick={() => {
                setSwitching(true);
                switchTo(copy.to);
                // If the page asks to keep unsaved work and the user stays, re-enable the button.
                window.setTimeout(() => setSwitching(false), 1500);
              }}
              className="inline-flex h-9 w-fit shrink-0 items-center justify-center rounded-lg bg-accent px-3.5 text-sm font-semibold text-accent-foreground shadow-sm transition hover:bg-accent-hover disabled:opacity-60"
            >
              {copy.cta}
            </button>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Dismiss announcement"
            className="-mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition hover:bg-card hover:text-heading"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
    </div>
  );
}
