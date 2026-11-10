"use client";

import { useEffect } from "react";

const PUSH_WORKER = "/push-sw.js";

/** Installed Home Screen app (iOS) or installed PWA (Android / desktop). Never a UA sniff. */
export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Runs once per page in every surface but only acts in the installed app:
 *  - marks <html data-standalone> so app-only CSS (overscroll, keyboard handling) never touches
 *    the normal browser or desktop experience;
 *  - flags <html data-keyboard="open"> while the on-screen keyboard is up, so the fixed bottom
 *    tab bar steps aside instead of covering inputs and submit buttons;
 *  - registers the existing push/offline service worker (same script the notification card
 *    uses) so the installed app can show a reconnect screen when offline. A device still on the
 *    legacy OneSignal worker is left alone — replacing it would drop that push subscription.
 */
export function StandaloneAppBoot() {
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      if (isStandaloneDisplay()) root.setAttribute("data-standalone", "");
      else root.removeAttribute("data-standalone");
    };
    apply();
    if (isStandaloneDisplay()) {
      try {
        // This launch already reached the app; later visits to "/" may show the website.
        sessionStorage.setItem("sp-app-launched", "1");
      } catch {
        /* storage unavailable */
      }
    }
    const mq = window.matchMedia("(display-mode: standalone)");
    mq.addEventListener("change", apply);

    const vv = window.visualViewport;
    const onViewport = () => {
      if (!vv) return;
      const keyboard = window.innerHeight - vv.height > 140;
      if (keyboard) root.setAttribute("data-keyboard", "open");
      else root.removeAttribute("data-keyboard");
    };
    vv?.addEventListener("resize", onViewport);

    if (isStandaloneDisplay() && "serviceWorker" in navigator) {
      void (async () => {
        try {
          const existing = await navigator.serviceWorker.getRegistration("/");
          const script = existing?.active?.scriptURL ?? existing?.installing?.scriptURL ?? "";
          if (existing && !script.endsWith(PUSH_WORKER)) return;
          await navigator.serviceWorker.register(PUSH_WORKER, { scope: "/" });
        } catch {
          /* offline support is best-effort */
        }
      })();
    }

    return () => {
      mq.removeEventListener("change", apply);
      vv?.removeEventListener("resize", onViewport);
    };
  }, []);
  return null;
}
