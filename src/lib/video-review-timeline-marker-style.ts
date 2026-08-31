import type { VideoReviewAuthorKind } from "@/lib/types";
import {
  contrastRatio,
  deriveBrandTheme,
  relativeLuminance,
  sanitizeCssColor,
} from "@/lib/brand-color";
import { PLATFORM_BUSINESS_DEFAULTS } from "@/lib/portal-brand";
import type { VideoReviewCommentEnriched } from "@/lib/video-review-comment-model";
import type { TimelineMarkerCluster } from "@/lib/video-review-timeline-markers";

/** Scrub bar track (`bg-slate-100`). */
const SCRUB_TRACK_RGB: [number, number, number] = [241, 245, 249];
const INK_RGB: [number, number, number] = [15, 23, 42];

/** Primary vs accent below this contrast ratio → border pair falls back to distinct defaults. */
export const MARKER_COLOR_SIMILARITY_THRESHOLD = 1.45;
/** Minimum fill contrast against the scrub track. */
export const MARKER_TRACK_MIN_CONTRAST = 2.5;

const FALLBACK_PRIMARY = PLATFORM_BUSINESS_DEFAULTS.brandPrimaryColor;
const FALLBACK_ACCENT = PLATFORM_BUSINESS_DEFAULTS.brandAccentColor;
const DISTINCT_BORDER_PRIMARY = "#0F172A";
const DISTINCT_BORDER_ACCENT = "#2563EB";

const RGB_RE =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/;

type Rgb = [number, number, number];

function parseCssRgb(value: string): Rgb | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h.split("").map((c) => c + c).join("");
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgb = v.match(RGB_RE);
  if (!rgb) return null;
  const r = Number(rgb[1]);
  const g = Number(rgb[2]);
  const b = Number(rgb[3]);
  if (r > 255 || g > 255 || b > 255) return null;
  return [r, g, b];
}

function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

function toCss(rgb: Rgb): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export type TimelineMarkerAppearance = {
  fill: string;
  border: string | null;
  boxShadow: string;
};

export function resolveMarkerBrandColors(primaryRaw: string, accentRaw: string): {
  primary: string;
  accent: string;
} {
  const primarySafe = sanitizeCssColor(primaryRaw, FALLBACK_PRIMARY);
  const accentSafe = sanitizeCssColor(accentRaw, FALLBACK_ACCENT);
  const theme = deriveBrandTheme(primarySafe, accentSafe);
  return { primary: theme.primary, accent: theme.accent };
}

function colorsTooSimilar(primary: string, accent: string): boolean {
  const p = parseCssRgb(primary);
  const a = parseCssRgb(accent);
  if (!p || !a) return false;
  return contrastRatio(p, a) < MARKER_COLOR_SIMILARITY_THRESHOLD;
}

function distinctBorderPair(primary: string, accent: string): { primary: string; accent: string } {
  if (!colorsTooSimilar(primary, accent)) {
    return {
      primary: ensureVisibleOnScrubTrack(primary),
      accent: ensureVisibleOnScrubTrack(accent),
    };
  }
  return {
    primary: ensureVisibleOnScrubTrack(DISTINCT_BORDER_PRIMARY),
    accent: ensureVisibleOnScrubTrack(DISTINCT_BORDER_ACCENT),
  };
}

/** Darken pale fills until they meet minimum contrast on the scrub track; reuse brand luminance math. */
export function ensureVisibleOnScrubTrack(color: string): string {
  const parsed = parseCssRgb(color);
  if (!parsed) return sanitizeCssColor(color, FALLBACK_PRIMARY);
  if (contrastRatio(parsed, SCRUB_TRACK_RGB) >= MARKER_TRACK_MIN_CONTRAST) {
    return color;
  }
  let current = parsed;
  for (let i = 0; i < 24; i++) {
    if (contrastRatio(current, SCRUB_TRACK_RGB) >= MARKER_TRACK_MIN_CONTRAST) {
      return toCss(current);
    }
    current = mixRgb(current, INK_RGB, 0.12);
  }
  return toCss(INK_RGB);
}

export function hasOppositeSideReply(
  comment: Pick<VideoReviewCommentEnriched, "author_kind">,
  replies: Pick<VideoReviewCommentEnriched, "author_kind">[]
): boolean {
  return replies.some((reply) => reply.author_kind !== comment.author_kind);
}

export function sideFillColor(
  authorKind: VideoReviewAuthorKind,
  primary: string,
  accent: string
): string {
  const raw = authorKind === "admin" ? primary : accent;
  return ensureVisibleOnScrubTrack(raw);
}

export function computeTimelineMarkerAppearance(
  comment: VideoReviewCommentEnriched,
  replies: VideoReviewCommentEnriched[],
  primaryRaw: string,
  accentRaw: string
): TimelineMarkerAppearance {
  const brand = resolveMarkerBrandColors(primaryRaw, accentRaw);
  const borders = distinctBorderPair(brand.primary, brand.accent);
  const fill = sideFillColor(comment.author_kind, brand.primary, brand.accent);
  const oppositeReplied = hasOppositeSideReply(comment, replies);
  const border =
    oppositeReplied && comment.author_kind === "admin"
      ? borders.accent
      : oppositeReplied && comment.author_kind === "client"
        ? borders.primary
        : null;

  return {
    fill,
    border,
    boxShadow: markerBoxShadow(fill, border),
  };
}

export function computeClusterMarkerAppearance(
  cluster: TimelineMarkerCluster,
  repliesByCommentId: Map<string, VideoReviewCommentEnriched[]>,
  primaryRaw: string,
  accentRaw: string
): TimelineMarkerAppearance {
  const primaryComment = cluster.comments[0];
  const replies = repliesByCommentId.get(primaryComment.id) ?? [];
  return computeTimelineMarkerAppearance(primaryComment, replies, primaryRaw, accentRaw);
}

function markerBoxShadow(fill: string, border: string | null): string {
  const halo = relativeLuminance(parseCssRgb(fill) ?? INK_RGB) > 0.72 ? "0 0 0 1px rgba(15,23,42,0.35)" : "0 0 0 1px #ffffff";
  const depth = "0 1px 2px rgba(15, 23, 42, 0.22)";
  if (!border) {
    return `${halo}, ${depth}`;
  }
  return `${halo}, 0 0 0 2px ${border}, ${depth}`;
}

/** @internal Test helper — all four marker states for verification scripts. */
export function markerStateSamples(primaryRaw: string, accentRaw: string) {
  const brand = resolveMarkerBrandColors(primaryRaw, accentRaw);
  const borders = distinctBorderPair(brand.primary, brand.accent);
  const adminFill = sideFillColor("admin", brand.primary, brand.accent);
  const clientFill = sideFillColor("client", brand.primary, brand.accent);
  return {
    adminSolid: { fill: adminFill, border: null as string | null },
    clientSolid: { fill: clientFill, border: null as string | null },
    adminClientReplied: { fill: adminFill, border: borders.accent },
    clientAdminReplied: { fill: clientFill, border: borders.primary },
  };
}
