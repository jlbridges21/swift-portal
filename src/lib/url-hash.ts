/**
 * Next.js 16 (seen on 16.2.9) can stack fragments on a client navigation: open
 * /admin/settings#settings-landing, leave, then router.push("/admin/settings#settings-staff")
 * and the URL becomes /admin/settings#settings-landing#settings-staff. The router caches the
 * route's canonical URL with the first hash and appends the new one to it.
 *
 * The last fragment is the one the navigation asked for. This returns it (without "#") and,
 * when the URL had stacked fragments, rewrites the address bar to the single clean hash.
 * The history state is passed without Next's __NA marker on purpose, so the App Router
 * picks up the corrected URL too (it would otherwise put the stacked one back).
 */
export function readCleanHash(): string {
  if (typeof window === "undefined") return "";
  const raw = window.location.hash;
  if (!raw) return "";
  const parts = raw.split("#").filter(Boolean);
  const last = parts[parts.length - 1] ?? "";
  if (parts.length > 1) {
    const { pathname, search } = window.location;
    window.history.replaceState({}, "", `${pathname}${search}#${last}`);
  }
  return last;
}
