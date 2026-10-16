/**
 * Marketing engagement events (free tools, resource downloads).
 *
 * The analytics schema only allows pageview / cta_click / signup_start, so engagement is
 * recorded as cta_click with a namespaced id: "tool:<tool>:<action>" or
 * "resource:<resource>:<format>". MarketingAnalytics listens for this DOM event and sends
 * it through the same consent-aware path as every other event. Reports keep these apart
 * from signup CTAs via isEngagementCtaId().
 *
 * Only the action is recorded. Never put user-entered values (prices, names) in an id.
 */

export const ENGAGEMENT_EVENT = "sp-engagement";

const ENGAGEMENT_PREFIX = /^(tool|resource):/;

export function isEngagementCtaId(id: string | null | undefined): boolean {
  return !!id && ENGAGEMENT_PREFIX.test(id);
}

const sent = new Set<string>();

/** Fire once per id per page load (e.g. "calculated" shouldn't fire on every keystroke). */
export function trackEngagement(id: string, opts: { once?: boolean } = { once: true }) {
  if (typeof window === "undefined" || !/^[a-z0-9:_-]{1,80}$/i.test(id)) return;
  const key = `${location.pathname}|${id}`;
  if (opts.once !== false) {
    if (sent.has(key)) return;
    sent.add(key);
  }
  window.dispatchEvent(new CustomEvent(ENGAGEMENT_EVENT, { detail: { id } }));
}
