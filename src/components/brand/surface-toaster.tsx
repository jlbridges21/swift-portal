"use client";

import { useEffect, useState } from "react";
import { Toaster } from "sonner";

/**
 * Follows the portal surface painted by BrandProvider.
 * Light is the default, including admin, so an unset attribute matches today.
 */
export function SurfaceToaster() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const read = () => setDark(document.querySelector("[data-surface='dark']") != null);
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-surface"],
    });
    return () => observer.disconnect();
  }, []);

  return (
    <Toaster
      theme={dark ? "dark" : "light"}
      position="top-center"
      richColors
      offset={{ top: "max(1rem, env(safe-area-inset-top))" }}
      mobileOffset={{ top: "max(1rem, env(safe-area-inset-top))" }}
    />
  );
}
