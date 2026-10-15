"use client";

import { useLayoutEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Marketing-site scroll fix. Next's App Router scrolls a new page into view by
 * measuring the page's first DOM element, but every marketing page starts with
 * BrandProvider's <style> + `display: contents` wrapper, which measure 0×0, so Next
 * gives up and the new page keeps the previous scroll position.
 *
 * On a forward navigation to a different path we reset to the top. We leave alone:
 * the first load/reload (browser restoration) and Back/Forward (popstate). For URLs
 * with a #hash we scroll to the anchor, waiting briefly when its section is lazily
 * rendered (e.g. /#product-demo) and so did not exist when Next/the browser looked.
 * Mounted only by marketing surfaces.
 */

let lastPath: string | null = null;
let poppedAt = 0;
// The router updates location.hash after React commits, so remember the hash of the
// link that started the navigation instead of reading the URL during the effect.
let pendingHash: { hash: string; at: number } | null = null;

if (typeof window !== "undefined") {
  window.addEventListener("popstate", () => {
    poppedAt = Date.now();
  });
  document.addEventListener(
    "click",
    (e) => {
      const a = e.target instanceof Element ? e.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!a) return;
      try {
        const url = new URL(a.href, window.location.href);
        if (url.origin === window.location.origin) pendingHash = { hash: url.hash.slice(1), at: Date.now() };
      } catch {
        /* ignore malformed hrefs */
      }
    },
    { capture: true }
  );
}

/** Scroll to #id once it exists (up to ~3s); no-op if it is already in view. */
function scrollToLateAnchor(id: string): () => void {
  let tries = 0;
  let timer: number | undefined;
  const attempt = () => {
    const el = document.getElementById(id);
    if (el) {
      const top = el.getBoundingClientRect().top;
      if (top < 0 || top > window.innerHeight * 0.5) el.scrollIntoView({ behavior: "instant", block: "start" });
      return;
    }
    if (++tries < 30) timer = window.setTimeout(attempt, 100);
  };
  attempt();
  return () => window.clearTimeout(timer);
}

export function MarketingScrollReset() {
  const pathname = usePathname();

  useLayoutEffect(() => {
    const previous = lastPath;
    lastPath = pathname;
    if (Date.now() - poppedAt < 1000) return;
    const clicked = pendingHash && Date.now() - pendingHash.at < 5000 ? pendingHash.hash : null;
    pendingHash = null;
    const hash = clicked ?? (previous === null ? window.location.hash.slice(1) : "");
    if (hash) return scrollToLateAnchor(decodeURIComponent(hash));
    if (previous === null || previous === pathname) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
