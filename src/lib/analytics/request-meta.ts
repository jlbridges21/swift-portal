/** Bot detection, device class, and path helpers for the analytics collector. */

const BOT_UA =
  /bot\b|bot\/|crawl|spider|slurp|archiver|facebookexternalhit|embedly|quora link preview|whatsapp|telegrambot|discordbot|slackbot|vkshare|w3c_validator|headlesschrome|phantomjs|lighthouse|pagespeed|gtmetrix|pingdom|uptime|statuscake|datadog|newrelic|preview|scrapy|python-requests|python-urllib|curl\/|wget\/|go-http-client|axios\/|node-fetch|okhttp|java\/|libwww|httpclient|monitor|checkly|vercel-(screenshot|favicon)/i;

export function isBotUserAgent(ua: string | null | undefined): boolean {
  if (!ua || ua.length < 12) return true;
  return BOT_UA.test(ua);
}

export function deviceClass(ua: string | null | undefined): "mobile" | "tablet" | "desktop" | "unknown" {
  if (!ua) return "unknown";
  if (/ipad|tablet|playbook|silk|(android(?!.*mobile))/i.test(ua)) return "tablet";
  if (/mobi|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) return "mobile";
  if (/windows|macintosh|x11|linux|cros/i.test(ua)) return "desktop";
  return "unknown";
}

/** Strip query/hash, collapse slashes, cap length. Query strings are never stored. */
export function normalizePath(path: string): string {
  let p = path.split(/[?#]/)[0] || "/";
  if (!p.startsWith("/")) p = `/${p}`;
  p = p.replace(/\/{2,}/g, "/");
  if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
  return p.slice(0, 300);
}

/** Blog slug for /blog/<slug> when the slug is a published article, else null. */
export function articleSlugForPath(path: string, knownSlugs: ReadonlySet<string>): string | null {
  const m = /^\/blog\/([a-z0-9-]{1,120})$/.exec(path);
  return m && knownSlugs.has(m[1]) ? m[1] : null;
}
