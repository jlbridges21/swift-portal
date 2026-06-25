"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function HashScrollHandler() {
  const pathname = usePathname();

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;

    const scrollToTarget = () => {
      const el = document.getElementById(hash);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
        el.classList.add("ring-2", "ring-accent/40", "ring-offset-2");
        setTimeout(() => el.classList.remove("ring-2", "ring-accent/40", "ring-offset-2"), 2000);
      }
    };

    const timer = setTimeout(scrollToTarget, 150);
    return () => clearTimeout(timer);
  }, [pathname]);

  return null;
}
