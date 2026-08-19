"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function scrollToHash() {
  const hash = window.location.hash.replace("#", "");
  if (!hash) return;

  window.dispatchEvent(new Event("portal:hash-target"));

  const attempt = (tries: number) => {
    const el = document.getElementById(hash);
    if (!el) {
      if (tries > 0) window.setTimeout(() => attempt(tries - 1), 80);
      return;
    }
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
    el.classList.add("ring-2", "ring-accent/40", "ring-offset-2");
    window.setTimeout(() => el.classList.remove("ring-2", "ring-accent/40", "ring-offset-2"), 2000);
  };

  window.setTimeout(() => attempt(8), 150);
}

export function HashScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    scrollToHash();
    window.addEventListener("hashchange", scrollToHash);
    return () => window.removeEventListener("hashchange", scrollToHash);
  }, [pathname]);

  return null;
}
