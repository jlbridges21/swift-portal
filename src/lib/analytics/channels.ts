/**
 * Acquisition channel classification. Evidence order: UTM parameters, then the
 * referrer host, then "direct" (no referrer and no UTMs). "unknown" is reserved
 * for traffic we could not measure — never a fallback for missing referrers.
 * Search keywords are never inferred here (Search Console only).
 */

export const CHANNELS = [
  "google_organic",
  "bing_organic",
  "other_search",
  "instagram",
  "facebook",
  "tiktok",
  "other_social",
  "email",
  "paid",
  "referral",
  "direct",
  "unknown",
] as const;

export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABELS: Record<Channel, string> = {
  google_organic: "Google organic",
  bing_organic: "Bing organic",
  other_search: "Other organic search",
  instagram: "Instagram",
  facebook: "Facebook",
  tiktok: "TikTok",
  other_social: "Other social",
  email: "Email",
  paid: "Paid campaigns",
  referral: "Referral",
  direct: "Direct",
  unknown: "Unknown",
};

export type UtmParams = {
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_content?: string | null;
  utm_term?: string | null;
};

const PAID_MEDIUMS = /^(cpc|ppc|paid|paidsearch|paid[-_ ]?social|display|cpm|cpv|banner|affiliate|retargeting)$/;
const EMAIL_MEDIUMS = /^(e-?mail|newsletter)$/;
const SOCIAL_MEDIUMS = /^(social|social[-_ ]?network|social[-_ ]?media|sm|organic[-_ ]?social)$/;

const SEARCH_ENGINES: { re: RegExp; channel: Channel }[] = [
  { re: /(^|\.)google\.[a-z.]+$/, channel: "google_organic" },
  { re: /(^|\.)bing\.com$/, channel: "bing_organic" },
  { re: /(^|\.)(duckduckgo\.com|search\.yahoo\.com|yahoo\.com|ecosia\.org|search\.brave\.com|yandex\.[a-z.]+|baidu\.com|startpage\.com|qwant\.com|perplexity\.ai)$/, channel: "other_search" },
];

const SOCIAL_HOSTS: { re: RegExp; channel: Channel }[] = [
  { re: /(^|\.)(instagram\.com|l\.instagram\.com)$/, channel: "instagram" },
  { re: /(^|\.)(facebook\.com|fb\.com|fb\.me|m\.facebook\.com|l\.facebook\.com|lm\.facebook\.com)$/, channel: "facebook" },
  { re: /(^|\.)tiktok\.com$/, channel: "tiktok" },
  { re: /(^|\.)(linkedin\.com|lnkd\.in|x\.com|twitter\.com|t\.co|youtube\.com|youtu\.be|pinterest\.[a-z.]+|reddit\.com|threads\.net|nextdoor\.com|bsky\.app)$/, channel: "other_social" },
];

const SOCIAL_SOURCES: { re: RegExp; channel: Channel }[] = [
  { re: /^(ig|instagram)$/, channel: "instagram" },
  { re: /^(fb|facebook|meta)$/, channel: "facebook" },
  { re: /^(tiktok|tt)$/, channel: "tiktok" },
  { re: /^(linkedin|twitter|x|youtube|pinterest|reddit|threads|nextdoor|bluesky)$/, channel: "other_social" },
];

const EMAIL_HOSTS = /(^|\.)(mail\.google\.com|outlook\.live\.com|outlook\.office\.com|mail\.yahoo\.com)$/;

function clean(v: string | null | undefined): string {
  return (v ?? "").trim().toLowerCase();
}

/** Lower-cased host from a referrer URL, or null when absent/invalid. */
export function referrerHostFrom(referrer: string | null | undefined): string | null {
  if (!referrer) return null;
  try {
    const u = new URL(referrer);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.hostname.toLowerCase().replace(/^www\./, "") || null;
  } catch {
    return null;
  }
}

/** True when the host is the platform site itself (internal navigation, not a source). */
export function isOwnHost(host: string | null, platformRootDomain: string): boolean {
  if (!host) return false;
  const root = platformRootDomain.toLowerCase().replace(/^www\./, "");
  return host === root || host === `www.${root}`;
}

export function classifyChannel(input: {
  referrerHost: string | null;
  utm: UtmParams;
}): Channel {
  const source = clean(input.utm.utm_source);
  const medium = clean(input.utm.utm_medium);
  const host = input.referrerHost;

  if (source || medium) {
    if (PAID_MEDIUMS.test(medium)) return "paid";
    if (EMAIL_MEDIUMS.test(medium) || /^(e-?mail|newsletter)$/.test(source)) return "email";
    for (const s of SOCIAL_SOURCES) if (s.re.test(source)) return s.channel;
    if (SOCIAL_MEDIUMS.test(medium)) return "other_social";
    if (/^(google|bing)$/.test(source) && medium === "organic") {
      return source === "google" ? "google_organic" : "bing_organic";
    }
    if (medium === "organic") return "other_search";
    if (medium === "referral") return "referral";
    // Tagged but unrecognized: fall through to referrer evidence, else referral.
  }

  if (host) {
    for (const e of SEARCH_ENGINES) if (e.re.test(host)) return e.channel;
    for (const s of SOCIAL_HOSTS) if (s.re.test(host)) return s.channel;
    if (EMAIL_HOSTS.test(host)) return "email";
    return "referral";
  }

  if (source || medium) return "referral";
  return "direct";
}
