"use client";

import Link, { useLinkStatus } from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, type MouseEventHandler, type ReactNode } from "react";
import { prefetchProject } from "./project-prefetch";

/**
 * Project card / row link on the Projects page.
 *
 * - No viewport prefetch: a Projects page shows dozens of cards and prefetching each one
 *   costs a server render (measured: ~32 RSC requests and ~480 DB statements per visit).
 * - Hover intent (pointer rests ~60 ms) or keyboard focus issues a FULL prefetch of that one
 *   project, so by the click its data is already in the client cache and the page appears with
 *   no server round trip (see project-prefetch.ts for freshness).
 * - Not on mouse-down / touch / mouse-caused focus: the click follows within ~100 ms and its own
 *   navigation request would race the prefetch — measured as two full server renders per click.
 * - An inline pending bar shows the instant the link is clicked (useLinkStatus).
 */
const HOVER_INTENT_MS = 60;

export function ProjectLink({
  href,
  className,
  children,
  onClick,
}: {
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: MouseEventHandler<HTMLAnchorElement>;
}) {
  const router = useRouter();
  const projectId = href.split("/").pop() ?? href;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warm = useCallback(() => prefetchProject(router, href, projectId), [router, href, projectId]);
  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const intend = useCallback(() => {
    cancel();
    timer.current = setTimeout(warm, HOVER_INTENT_MS);
  }, [cancel, warm]);
  useEffect(() => cancel, [cancel]);

  return (
    <Link
      href={href}
      className={className}
      onClick={onClick}
      prefetch={false}
      onMouseEnter={intend}
      onMouseLeave={cancel}
      onMouseDown={cancel}
      onFocus={(e) => {
        if (e.currentTarget.matches(":focus-visible")) warm();
      }}
    >
      {children}
      <LinkPendingBar />
    </Link>
  );
}

function LinkPendingBar() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span role="status" aria-busy="true" className="pointer-events-none absolute inset-x-0 top-0 z-10 block h-0.5 overflow-hidden bg-accent/20">
      <span className="block h-full w-1/3 animate-pulse bg-accent" />
      <span className="sr-only">Opening project…</span>
    </span>
  );
}
