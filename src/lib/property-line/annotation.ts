import type { ImagePoint } from "./types";

export interface PropertyLineAnnotation {
  points: ImagePoint[];
  lineColor: string;
  overlayAlpha: number;
}

const DEFAULT_LINE_COLOR = "#FF2222";
const DEFAULT_OVERLAY_ALPHA = 0.55;

export function parsePropertyLineAnnotation(raw: unknown): PropertyLineAnnotation | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.points) || data.points.length < 3) return null;

  const points: ImagePoint[] = [];
  for (const item of data.points) {
    if (!item || typeof item !== "object") return null;
    const p = item as Record<string, unknown>;
    if (typeof p.x !== "number" || typeof p.y !== "number") return null;
    points.push({ x: p.x, y: p.y });
  }

  return {
    points,
    lineColor: typeof data.lineColor === "string" ? data.lineColor : DEFAULT_LINE_COLOR,
    overlayAlpha:
      typeof data.overlayAlpha === "number" ? data.overlayAlpha : DEFAULT_OVERLAY_ALPHA,
  };
}

export function stripPropertyLineTitleSuffix(title: string): string {
  return title.replace(/\s*\(Property Line\)\s*$/i, "").trim();
}
