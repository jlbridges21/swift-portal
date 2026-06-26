"use client";

import { useEffect, useState } from "react";

/** True on narrow viewports or when running as an installed PWA (Home Screen). */
export function useIsMobileOrPwa(): boolean {
  const [isMobileOrPwa, setIsMobileOrPwa] = useState(false);

  useEffect(() => {
    function check() {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const standalone = window.matchMedia("(display-mode: standalone)").matches;
      const iosStandalone =
        typeof navigator !== "undefined" &&
        "standalone" in navigator &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
      setIsMobileOrPwa(mobile || standalone || iosStandalone);
    }

    check();
    const mobileQuery = window.matchMedia("(max-width: 767px)");
    const standaloneQuery = window.matchMedia("(display-mode: standalone)");
    mobileQuery.addEventListener("change", check);
    standaloneQuery.addEventListener("change", check);
    return () => {
      mobileQuery.removeEventListener("change", check);
      standaloneQuery.removeEventListener("change", check);
    };
  }, []);

  return isMobileOrPwa;
}
