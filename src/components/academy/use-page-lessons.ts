"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { lessonsForLocation, type PageLessons } from "@/lib/academy/page-lessons";

/**
 * The Academy lesson(s) for the page on screen. Project tabs and Settings sections change the
 * URL with history.replaceState / hashes (no navigation event), so this re-reads the location
 * after clicks too.
 */
export function usePageLessons(): PageLessons {
  const pathname = usePathname() ?? "";
  const [loc, setLoc] = useState({ search: "", hash: "" });

  useEffect(() => {
    const read = () =>
      setLoc((cur) =>
        cur.search === window.location.search && cur.hash === window.location.hash
          ? cur
          : { search: window.location.search, hash: window.location.hash }
      );
    read();
    const later = () => window.setTimeout(read, 60);
    window.addEventListener("hashchange", read);
    window.addEventListener("popstate", read);
    document.addEventListener("click", later, true);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
      document.removeEventListener("click", later, true);
    };
  }, [pathname]);

  return lessonsForLocation(pathname, loc.search, loc.hash);
}
