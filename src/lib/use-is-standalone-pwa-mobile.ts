"use client";

import { useEffect, useState } from "react";

/** True when on a mobile viewport AND running as an installed PWA (iOS Home Screen or display-mode: standalone). */
export function useIsStandalonePwaMobile(): boolean {
  const [isStandalonePwaMobile, setIsStandalonePwaMobile] = useState(false);

  useEffect(() => {
    function check() {
      if (typeof window === "undefined") return;
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone =
        typeof navigator !== "undefined" &&
        "standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsStandalonePwaMobile(mobile && (standalone || iosStandalone));
    }

    check();

    const standaloneMq = window.matchMedia("(display-mode: standalone)");
    const mobileMq = window.matchMedia("(max-width: 767px)");
    standaloneMq.addEventListener("change", check);
    mobileMq.addEventListener("change", check);
    return () => {
      standaloneMq.removeEventListener("change", check);
      mobileMq.removeEventListener("change", check);
    };
  }, []);

  return isStandalonePwaMobile;
}
