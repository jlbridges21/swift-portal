/**
 * Public video embed options — shared by the Share modal (builds the embed code),
 * the /embed player (reads them from the query string) and the server (sanitizes
 * what the modal saves). Safe for client and server.
 *
 * Query string mirrors YouTube/Vimeo conventions so website builders that tweak
 * embed URLs by hand behave as expected: autoplay=1, muted=1, loop=1, controls=0,
 * title=0, branding=0, fit=cover.
 */

export type VideoEmbedOptions = {
  autoplay: boolean;
  muted: boolean;
  loop: boolean;
  controls: boolean;
  title: boolean;
  branding: boolean;
  /** "cover" fills the frame (crops); "contain" letterboxes. */
  fit: "contain" | "cover";
};

export const DEFAULT_EMBED_OPTIONS: VideoEmbedOptions = {
  autoplay: false,
  muted: false,
  loop: false,
  controls: true,
  title: true,
  branding: true,
  fit: "contain",
};

/** Seamless background section: silent, looping, chrome-free, edge to edge. */
export const BACKGROUND_EMBED_OPTIONS: VideoEmbedOptions = {
  autoplay: true,
  muted: true,
  loop: true,
  controls: false,
  title: false,
  branding: false,
  fit: "cover",
};

export type EmbedPresetKey = "standard" | "background" | "custom";

export function embedPresetFor(options: VideoEmbedOptions): EmbedPresetKey {
  const same = (a: VideoEmbedOptions, b: VideoEmbedOptions) =>
    (Object.keys(a) as (keyof VideoEmbedOptions)[]).every((k) => a[k] === b[k]);
  if (same(options, DEFAULT_EMBED_OPTIONS)) return "standard";
  if (same(options, BACKGROUND_EMBED_OPTIONS)) return "background";
  return "custom";
}

function bool(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "1" || value === "true") return true;
  if (value === "0" || value === "false") return false;
  return fallback;
}

/** Normalize anything (stored JSON, request body) into a complete options object. */
export function sanitizeEmbedOptions(input: unknown): VideoEmbedOptions {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    autoplay: bool(o.autoplay, DEFAULT_EMBED_OPTIONS.autoplay),
    muted: bool(o.muted, DEFAULT_EMBED_OPTIONS.muted),
    loop: bool(o.loop, DEFAULT_EMBED_OPTIONS.loop),
    controls: bool(o.controls, DEFAULT_EMBED_OPTIONS.controls),
    title: bool(o.title, DEFAULT_EMBED_OPTIONS.title),
    branding: bool(o.branding, DEFAULT_EMBED_OPTIONS.branding),
    fit: o.fit === "cover" ? "cover" : "contain",
  };
}

type QueryLike = { get(name: string): string | null } | Record<string, string | string[] | undefined>;

function readParam(q: QueryLike, key: string): string | undefined {
  if (typeof (q as { get?: unknown }).get === "function") {
    return (q as { get(name: string): string | null }).get(key) ?? undefined;
  }
  const v = (q as Record<string, string | string[] | undefined>)[key];
  return Array.isArray(v) ? v[0] : v;
}

/** Parse the /embed query string. Unknown or missing keys fall back to defaults. */
export function parseEmbedQuery(q: QueryLike): VideoEmbedOptions {
  const background = readParam(q, "background") === "1";
  const base = background ? BACKGROUND_EMBED_OPTIONS : DEFAULT_EMBED_OPTIONS;
  // YouTube uses `mute`, Vimeo `muted` — accept both.
  const muted = readParam(q, "muted") ?? readParam(q, "mute");
  return {
    autoplay: bool(readParam(q, "autoplay"), base.autoplay),
    muted: bool(muted, base.muted),
    loop: bool(readParam(q, "loop"), base.loop),
    controls: bool(readParam(q, "controls"), base.controls),
    title: bool(readParam(q, "title"), base.title),
    branding: bool(readParam(q, "branding"), base.branding),
    fit: readParam(q, "fit") === "cover" ? "cover" : readParam(q, "fit") === "contain" ? "contain" : base.fit,
  };
}

/** Only non-default values are written, so the default embed URL stays clean. */
export function embedQueryString(options: VideoEmbedOptions): string {
  const params = new URLSearchParams();
  const d = DEFAULT_EMBED_OPTIONS;
  if (options.autoplay !== d.autoplay) params.set("autoplay", options.autoplay ? "1" : "0");
  if (options.muted !== d.muted) params.set("muted", options.muted ? "1" : "0");
  if (options.loop !== d.loop) params.set("loop", options.loop ? "1" : "0");
  if (options.controls !== d.controls) params.set("controls", options.controls ? "1" : "0");
  if (options.title !== d.title) params.set("title", options.title ? "1" : "0");
  if (options.branding !== d.branding) params.set("branding", options.branding ? "1" : "0");
  if (options.fit !== d.fit) params.set("fit", options.fit);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function buildEmbedSrc(embedBaseUrl: string, options: VideoEmbedOptions): string {
  return `${embedBaseUrl}${embedQueryString(options)}`;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Aspect ratio as a CSS padding-top percentage (16:9 when unknown). */
export function aspectPaddingPercent(width?: number | null, height?: number | null): number {
  if (width && height && width > 0 && height > 0) {
    const pct = (height / width) * 100;
    if (pct >= 20 && pct <= 300) return Math.round(pct * 100) / 100;
  }
  return 56.25;
}

/**
 * Responsive iframe embed. The wrapper keeps the video's aspect ratio at any width,
 * works in plain HTML, WordPress, Squarespace, Wix, Webflow, Showit and similar
 * "embed / custom code" blocks, and needs no script.
 *
 * `fill` drops the aspect-ratio wrapper so the player fills whatever container the
 * site gives it — what a full-bleed background section wants.
 */
export function buildEmbedCode(input: {
  embedBaseUrl: string;
  options: VideoEmbedOptions;
  title: string;
  width?: number | null;
  height?: number | null;
  fill?: boolean;
}): string {
  const src = escapeAttr(buildEmbedSrc(input.embedBaseUrl, input.options));
  const title = escapeAttr(input.title || "Video");
  const allow = "autoplay; fullscreen; picture-in-picture; encrypted-media";
  // Lazy-load ordinary players below the fold; autoplaying hero/background videos load eagerly.
  const loading = input.options.autoplay ? "" : ' loading="lazy"';
  if (input.fill) {
    return `<iframe src="${src}" title="${title}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="${allow}" allowfullscreen${loading}></iframe>`;
  }
  const pad = aspectPaddingPercent(input.width, input.height);
  return `<div style="position:relative;width:100%;padding-top:${pad}%;overflow:hidden;"><iframe src="${src}" title="${title}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;" allow="${allow}" allowfullscreen${loading}></iframe></div>`;
}

/** public_id format (DB CHECK mirrors this). */
export const PUBLIC_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{16,32}$/;

export function isWellFormedPublicVideoId(id: string): boolean {
  return PUBLIC_VIDEO_ID_PATTERN.test(id);
}

// ── API shapes (owner/client Share modal) ──────────────────────────────────

export type VideoShareBlockedReason =
  | "client_sharing_disabled"
  | "not_delivered"
  | "no_permission"
  | null;

export type VideoPublicShareView = {
  enabled: boolean;
  publicId: string;
  watchUrl: string;
  embedBaseUrl: string;
  embedSettings: VideoEmbedOptions;
  enabledAt: string | null;
  enabledByRole: "business" | "client" | null;
  viewCount: number;
  playCount: number;
  estBytes: number;
  lastViewedAt: string | null;
};

export type VideoShareStateResponse = {
  /** False until migration v116 is applied. */
  available: boolean;
  share: VideoPublicShareView | null;
  permissions: {
    canManage: boolean;
    role: "business" | "client";
    blockedReason: VideoShareBlockedReason;
  };
  video: {
    title: string;
    width: number | null;
    height: number | null;
    durationSeconds: number | null;
  };
  businessName: string;
};
