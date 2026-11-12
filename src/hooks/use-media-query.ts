"use client";

import { useEffect, useState } from "react";

/** Phone widths — below Tailwind's `sm` breakpoint. Matches ActionMenu's sheet switch. */
export const PHONE_QUERY = "(max-width: 639px)";

/**
 * Live `matchMedia` result. Always false on the server and the first client render, so markup
 * hydrates identically and phone-only UI switches in right after mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const update = () => setMatches(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, [query]);
  return matches;
}
