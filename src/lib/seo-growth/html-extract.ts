/**
 * Dependency-free extraction of the SEO-relevant parts of a rendered HTML page. Pure and
 * deterministic so it can be unit tested (scripts/verify-seo-growth.ts). It reads the whole
 * document, not only <head>, because Next.js may stream metadata into <body>.
 */

export type ExtractedLink = { path: string; text: string };

export type ExtractedPage = {
  title: string | null;
  metaDescription: string | null;
  /** Lower-cased content of <meta name="robots"> / <meta name="googlebot">, joined. */
  metaRobots: string | null;
  canonical: string | null;
  h1: string[];
  h2Count: number;
  /** Internal links as normalized paths (no query/hash/trailing slash), in document order. */
  internalLinks: ExtractedLink[];
  /** Internal links outside <header>, <nav>, and <footer>: links placed in the page's own content. */
  contextualLinks: ExtractedLink[];
  /** Absolute external http(s) links, de-duplicated. */
  externalLinks: string[];
  images: number;
  /** <img> tags with no alt attribute at all (alt="" is a valid decorative image). */
  imagesMissingAlt: number;
  jsonLdTypes: string[];
  jsonLdErrors: number;
  hasOgImage: boolean;
  /** Approximate visible words, excluding scripts, styles, and template tags. */
  wordCount: number;
  /** Four-digit years (2015 → next year) found in the title and H1. */
  headlineYears: number[];
  /** Visible-text matches per WATCH_PHRASES key (product claims that need periodic verification). */
  mentions: Record<string, number>;
};

/**
 * Product claims whose truth depends on production configuration, not code. The content
 * audit lists pages that make them so they can be re-verified (docs/TECHNICAL-SEO-AUDIT.md).
 */
export const WATCH_PHRASES: Record<string, RegExp> = {
  reminders: /\b(reminder emails?|automatic reminders?|automated reminders?|payment reminders?)\b/gi,
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " " };

export function decodeEntities(s: string): string {
  return s
    .replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (_, e: string) => ENTITIES[e] ?? _)
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)));
}

function stripTags(s: string): string {
  return decodeEntities(s.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function attr(tag: string, name: string): string | null {
  const m = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  if (!m) return null;
  return decodeEntities(m[2] ?? m[3] ?? m[4] ?? "");
}

function hasAttr(tag: string, name: string): boolean {
  return new RegExp(`\\s${name}(\\s*=|[\\s/>])`, "i").test(tag);
}

/** Normalize an href to a site path when it points at one of `hosts`; null for external/non-http. */
export function toInternalPath(href: string, pageUrl: string, hosts: readonly string[]): string | null {
  if (!href || /^(mailto|tel|javascript|data|sms):/i.test(href) || href.startsWith("#")) return null;
  let u: URL;
  try {
    u = new URL(href, pageUrl);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  if (!hosts.includes(u.hostname.toLowerCase())) return null;
  return u.pathname.replace(/\/+$/, "") || "/";
}

export function extractPage(html: string, pageUrl: string, hosts: readonly string[], now = new Date(), watch = WATCH_PHRASES): ExtractedPage {
  const metas = html.match(/<meta\b[^>]*>/gi) ?? [];
  const metaBy = (key: "name" | "property", value: string) =>
    metas.filter((m) => (attr(m, key) ?? "").toLowerCase() === value).map((m) => attr(m, "content") ?? "");

  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const robots = [...metaBy("name", "robots"), ...metaBy("name", "googlebot")].map((s) => s.toLowerCase()).filter(Boolean);
  const canonicalTag = (html.match(/<link\b[^>]*>/gi) ?? []).find((l) => (attr(l, "rel") ?? "").toLowerCase().split(/\s+/).includes("canonical"));

  const h1 = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => stripTags(m[1] ?? ""));
  const h2Count = (html.match(/<h2\b/gi) ?? []).length;

  const external = new Set<string>();
  const linksIn = (doc: string, collectExternal: boolean) => {
    const out: ExtractedLink[] = [];
    for (const m of doc.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
      const href = attr(`<a ${m[1]}>`, "href");
      if (!href) continue;
      const path = toInternalPath(href, pageUrl, hosts);
      if (path) out.push({ path, text: stripTags(m[2] ?? "").slice(0, 120) });
      else if (collectExternal && /^https?:\/\//i.test(href)) {
        try {
          const u = new URL(href);
          u.hash = "";
          external.add(u.toString());
        } catch {
          /* ignore malformed */
        }
      }
    }
    return out;
  };
  const internalLinks = linksIn(html, true);
  const contextualLinks = linksIn(html.replace(/<(header|nav|footer)\b[\s\S]*?<\/\1>/gi, " "), false);

  const imgs = html.match(/<img\b[^>]*>/gi) ?? [];
  const jsonLdTypes: string[] = [];
  let jsonLdErrors = 0;
  for (const m of html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const data = JSON.parse(m[1] ?? "") as unknown;
      const collect = (node: unknown) => {
        if (Array.isArray(node)) return node.forEach(collect);
        if (!node || typeof node !== "object") return;
        const o = node as Record<string, unknown>;
        const t = o["@type"];
        if (typeof t === "string") jsonLdTypes.push(t);
        else if (Array.isArray(t)) t.forEach((x) => typeof x === "string" && jsonLdTypes.push(x));
        if (Array.isArray(o["@graph"])) collect(o["@graph"]);
      };
      collect(data);
    } catch {
      jsonLdErrors++;
    }
  }

  const body = html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<template\b[\s\S]*?<\/template>/gi, " ")
    .replace(/<noscript\b[\s\S]*?<\/noscript>/gi, " ");
  const text = stripTags(body);
  const wordCount = text ? text.split(" ").filter((w) => /[a-z0-9]/i.test(w)).length : 0;

  const title = titleMatch ? stripTags(titleMatch[1] ?? "") : null;
  const maxYear = now.getUTCFullYear() + 1;
  const headlineYears = [
    ...new Set(
      [...`${title ?? ""} ${h1.join(" ")}`.matchAll(/\b(20\d\d)\b/g)].map((m) => Number(m[1])).filter((y) => y >= 2015 && y <= maxYear)
    ),
  ];

  return {
    title,
    metaDescription: metaBy("name", "description")[0] ?? null,
    metaRobots: robots.length ? robots.join(", ") : null,
    canonical: canonicalTag ? attr(canonicalTag, "href") : null,
    h1,
    h2Count,
    internalLinks,
    contextualLinks,
    externalLinks: [...external],
    images: imgs.length,
    imagesMissingAlt: imgs.filter((i) => !hasAttr(i, "alt")).length,
    jsonLdTypes: [...new Set(jsonLdTypes)],
    jsonLdErrors,
    hasOgImage: metaBy("property", "og:image").length > 0,
    wordCount,
    headlineYears,
    mentions: Object.fromEntries(Object.entries(watch).map(([k, re]) => [k, (text.match(re) ?? []).length])),
  };
}

/** True when a robots directive string blocks indexing. */
export function isNoindex(directives: string | null | undefined): boolean {
  if (!directives) return false;
  return directives
    .toLowerCase()
    .split(/[,;]/)
    .map((d) => d.trim().replace(/^googlebot:\s*/, ""))
    .some((d) => d === "noindex" || d === "none");
}

/** URLs from a sitemap.xml (or sitemap index) body. */
export function parseSitemap(xml: string): string[] {
  return [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => decodeEntities(m[1]!));
}

export type RobotsGroup = { agents: string[]; allow: string[]; disallow: string[] };

export function parseRobots(txt: string): RobotsGroup[] {
  const groups: RobotsGroup[] = [];
  let cur: RobotsGroup | null = null;
  let lastWasAgent = false;
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, "").trim();
    const m = /^([a-z-]+)\s*:\s*(.*)$/i.exec(line);
    if (!m) continue;
    const key = m[1]!.toLowerCase();
    const value = m[2]!.trim();
    if (key === "user-agent") {
      if (!cur || !lastWasAgent) groups.push((cur = { agents: [], allow: [], disallow: [] }));
      cur.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === "allow" && value) cur.allow.push(value);
    if (key === "disallow" && value) cur.disallow.push(value);
  }
  return groups;
}

function robotsPatternMatches(pattern: string, path: string): boolean {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).replace(/[.+?^{}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`).test(path);
}

/**
 * Whether Googlebot may crawl `path` under these robots rules (longest match wins; allow wins
 * ties), following Google's documented precedence. Uses the googlebot group when present.
 */
export function robotsAllows(groups: RobotsGroup[], path: string): boolean {
  const g = groups.find((x) => x.agents.includes("googlebot")) ?? groups.find((x) => x.agents.includes("*"));
  if (!g) return true;
  let best: { len: number; allow: boolean } | null = null;
  for (const [list, allow] of [
    [g.allow, true],
    [g.disallow, false],
  ] as const) {
    for (const p of list) {
      if (!robotsPatternMatches(p, path)) continue;
      const len = p.length;
      if (!best || len > best.len || (len === best.len && allow)) best = { len, allow };
    }
  }
  return best ? best.allow : true;
}
