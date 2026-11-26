"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { lessonsForLocation, type PageLessons } from "@/lib/academy/page-lessons";
import { academyLessonByKey } from "@/lib/academy/catalog";

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
    window.addEventListener("sp:location", read);
    document.addEventListener("click", later, true);
    return () => {
      window.removeEventListener("hashchange", read);
      window.removeEventListener("popstate", read);
      window.removeEventListener("sp:location", read);
      document.removeEventListener("click", later, true);
    };
  }, [pathname]);

  // A lesson that isn't in the catalog yet (e.g. a video still being published) falls back to
  // the next related lesson, so the help menu never ends up empty.
  const raw = lessonsForLocation(pathname, loc.search, loc.hash);
  const keys = [raw.primary, ...raw.related].filter((k): k is string => Boolean(k && academyLessonByKey(k)));
  return { primary: keys[0] ?? null, related: keys.slice(1) };
}
