/**
 * Strict validator for user-supplied return paths (?redirect=, ?next=).
 *
 * Accepts only an application-relative path beginning with exactly one "/". Rejects
 * absolute URLs, protocol-relative ("//host"), backslashes ("/\host" — browsers treat "\" as
 * "/"), percent-encoded forms of those, ASCII control characters and whitespace (browsers strip
 * tab/newline, so "/\t/host" would become "//host"), and anything that resolves to another
 * origin. Safe for both the browser and the server.
 */
const MAX_LENGTH = 2048;
const PROBE_ORIGIN = "https://relative-path.invalid";

function looksExternal(value: string): boolean {
  return (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f\s]/.test(value) ||
    /^\/[a-z][a-z0-9+.-]*:/i.test(value)
  );
}

export function safeRelativePath(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  if (!raw || raw.length > MAX_LENGTH) return null;
  if (looksExternal(raw)) return null;

  // Encoded variants (%2F%2F, %5C, %09 …), up to three layers of encoding.
  let decoded = raw;
  for (let i = 0; i < 3; i++) {
    let next: string;
    try {
      next = decodeURIComponent(decoded);
    } catch {
      return null;
    }
    if (next === decoded) break;
    if (looksExternal(next)) return null;
    decoded = next;
  }

  try {
    const url = new URL(raw, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return null;
  } catch {
    return null;
  }
  return raw;
}

/**
 * A redirect (absolute or relative) as an app-relative path, but only when it points at
 * `origin` itself. Anything on another origin, or failing safeRelativePath, returns null.
 */
export function sameOriginRelativePath(redirect: string, origin: string): string | null {
  try {
    const url = new URL(redirect, origin);
    if (url.origin !== origin) return null;
    return safeRelativePath(`${url.pathname}${url.search}${url.hash}`);
  } catch {
    return null;
  }
}
