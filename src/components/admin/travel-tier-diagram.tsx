"use client";

import { Component, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { travelTierError, type TravelTier } from "@/lib/travel-fee";

/**
 * Presentational mileage bands. Reads tiers and draws them.
 * It does not price anything and it does not validate rules of its own.
 */

const SIZE = 280;
const CENTER = 140;
const OUTER_RADIUS = 140;
const DISC_RADIUS = 44;
const BAND_GAP = 2;

/** Light at the center, dark on the outside. Ink flips to white at step 6. */
export const TRAVEL_TIER_RAMP = [
  { fill: "#F0EEFD", ink: "#0F172A" },
  { fill: "#DCDAFB", ink: "#0F172A" },
  { fill: "#C2BCF7", ink: "#0F172A" },
  { fill: "#A39BF3", ink: "#0F172A" },
  { fill: "#8278EF", ink: "#0F172A" },
  { fill: "#6254EB", ink: "#FFFFFF" },
  { fill: "#3F2FE7", ink: "#FFFFFF" },
  { fill: "#3427BD", ink: "#FFFFFF" },
] as const;

/** Indexes into TRAVEL_TIER_RAMP. Innermost tier is the lightest selected step. */
export function travelTierRampIndexes(count: number): number[] {
  if (count <= 1) return [0];
  const last = TRAVEL_TIER_RAMP.length - 1;
  return Array.from({ length: count }, (_, index) => Math.round((index * last) / (count - 1)));
}

type Band = { inner: number; outer: number };

function bandsFor(count: number): Band[] {
  if (count <= 0) return [];
  if (count === 1) return [{ inner: 0, outer: DISC_RADIUS }];
  const gaps = count - 1;
  const thickness = (OUTER_RADIUS - DISC_RADIUS - gaps * BAND_GAP) / gaps;
  const bands: Band[] = [{ inner: 0, outer: DISC_RADIUS }];
  let cursor = DISC_RADIUS;
  for (let index = 0; index < gaps; index += 1) {
    const inner = cursor + BAND_GAP;
    const outer = inner + thickness;
    bands.push({ inner, outer });
    cursor = outer;
  }
  return bands;
}

function formatMiles(miles: number): string {
  if (!Number.isFinite(miles)) return "—";
  if (Number.isInteger(miles)) return String(miles);
  return String(Math.round(miles * 100) / 100);
}

function rangeLabel(tier: TravelTier, compact: boolean): string {
  const unit = compact ? "mi" : "miles";
  const start = formatMiles(tier.fromMiles);
  if (tier.toMiles == null) return `${start}+ ${unit}`;
  return `${start}–${formatMiles(tier.toMiles)} ${unit}`;
}

function feeLabel(cents: number, compact: boolean): string {
  const amount = Number.isFinite(cents) ? Math.round(cents) : 0;
  if (amount === 0) return "$0";
  if (compact && amount % 100 === 0) return `$${amount / 100}`;
  return (amount / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function accessibleRange(tier: TravelTier): string {
  if (tier.toMiles == null) return `${formatMiles(tier.fromMiles)}+ miles`;
  return `${formatMiles(tier.fromMiles)} to ${formatMiles(tier.toMiles)} miles`;
}

function bandName(index: number, tier: TravelTier): string {
  return `Tier ${index + 1}, ${accessibleRange(tier)}, ${feeLabel(tier.feeCents, false)}`;
}

function tierSummary(tiers: TravelTier[]): string {
  return `Travel fee tiers. ${tiers.map((tier, index) => bandName(index, tier)).join(". ")}.`;
}

function anchorY(band: Band): number {
  if (band.inner === 0) return CENTER;
  return CENTER - (band.inner + band.outer) / 2;
}

/** Prefer above the label. Flip below when that would leave the diagram or the viewport. */
function placeTooltip(anchorYPos: number, tipW: number, tipH: number, frameRect: DOMRect) {
  const gap = 8;
  const above = anchorYPos - tipH - gap;
  const below = anchorYPos + gap;
  const inFrame = (top: number) => top >= 4 && top + tipH <= frameRect.height - 4;
  const inView = (top: number) =>
    frameRect.top + top >= 8 && frameRect.top + top + tipH <= window.innerHeight - 8;

  let top = above;
  if (!inFrame(top) || !inView(top)) {
    if (inFrame(below) && inView(below)) top = below;
    else if (inFrame(below)) top = below;
    else top = Math.max(4, Math.min(top, frameRect.height - tipH - 4));
  }

  const left = Math.max(4, Math.min((frameRect.width - tipW) / 2, frameRect.width - tipW - 4));
  return { top: Math.round(top), left: Math.round(left) };
}

function ringPath(outer: number, inner: number): string {
  return [
    `M ${CENTER - outer} ${CENTER}`,
    `a ${outer} ${outer} 0 1 0 ${outer * 2} 0`,
    `a ${outer} ${outer} 0 1 0 ${-outer * 2} 0`,
    `M ${CENTER - inner} ${CENTER}`,
    `a ${inner} ${inner} 0 1 1 ${inner * 2} 0`,
    `a ${inner} ${inner} 0 1 1 ${-inner * 2} 0`,
  ].join(" ");
}

function DiagramFrame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-[280px] max-w-full">{children}</div>;
}

function Rings({ tiers }: { tiers: TravelTier[] }) {
  const colors = travelTierRampIndexes(tiers.length).map((index) => TRAVEL_TIER_RAMP[index]);
  const bands = bandsFor(tiers.length);
  const rootRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef(0);
  const [hovered, setHovered] = useState<number | null>(null);
  const [pinned, setPinned] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [tipPos, setTipPos] = useState({ top: 0, left: 0 });
  const shown = focused ?? hovered ?? pinned;
  const shownTier = shown == null ? null : tiers[shown];

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target;
      if (target instanceof Element && target.closest("[data-tier-band]")) return;
      setPinned(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setPinned(null);
      setHovered(null);
      setFocused(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.clearTimeout(hoverTimer.current);
    };
  }, []);

  useLayoutEffect(() => {
    const frame = rootRef.current;
    const tip = tipRef.current;
    if (!frame || !tip || shown == null) return;
    const band = bands[shown];
    if (!band) return;
    const frameRect = frame.getBoundingClientRect();
    const scale = frameRect.width / SIZE;
    const next = placeTooltip(anchorY(band) * scale, tip.offsetWidth, tip.offsetHeight, frameRect);
    setTipPos((current) => (current.top === next.top && current.left === next.left ? current : next));
  }, [shown, bands, tiers]);

  return (
    <div ref={rootRef} className="relative mx-auto aspect-square w-full max-w-[280px]">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="block h-full w-full overflow-visible"
      >
        {bands.map((band, index) => {
          const color = colors[index];
          const tier = tiers[index];
          const y = anchorY(band);
          return (
            <g
              key={index}
              data-tier-band={index}
              role="button"
              tabIndex={0}
              aria-label={bandName(index, tier)}
              className="cursor-pointer outline-none"
              onPointerEnter={(event) => {
                if (event.pointerType !== "mouse") return;
                window.clearTimeout(hoverTimer.current);
                setHovered(index);
              }}
              onPointerLeave={(event) => {
                if (event.pointerType !== "mouse") return;
                window.clearTimeout(hoverTimer.current);
                hoverTimer.current = window.setTimeout(() => {
                  setHovered((current) => (current === index ? null : current));
                }, 80);
              }}
              onPointerUp={(event) => {
                if (event.pointerType !== "touch") return;
                setPinned((current) => (current === index ? null : index));
              }}
              onFocus={(event) => {
                if (event.currentTarget.matches(":focus-visible")) setFocused(index);
              }}
              onBlur={() => setFocused((current) => (current === index ? null : current))}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                setPinned(null);
                setHovered(null);
                setFocused(null);
                event.currentTarget.blur();
              }}
            >
              {band.inner === 0 ? (
                <circle cx={CENTER} cy={CENTER} r={band.outer} fill={color.fill} />
              ) : (
                <path fill={color.fill} fillRule="evenodd" d={ringPath(band.outer, band.inner)} />
              )}
              <text
                x={CENTER}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fill={color.ink}
                fontSize={11}
                fontFamily="inherit"
                aria-hidden="true"
                className="pointer-events-none"
              >
                {`Tier ${index + 1}`}
              </text>
            </g>
          );
        })}
      </svg>
      {shown != null && shownTier ? (
        <div
          ref={tipRef}
          aria-hidden="true"
          className="pointer-events-none absolute z-20 w-max max-w-[220px] rounded-md border border-border bg-white px-2.5 py-1.5 text-left shadow-md"
          style={{ top: tipPos.top, left: tipPos.left }}
        >
          <p className="text-xs font-semibold text-foreground">{`Tier ${shown + 1}`}</p>
          <p className="text-xs text-foreground">
            {`${rangeLabel(shownTier, false)} · ${feeLabel(shownTier.feeCents, false)}`}
          </p>
        </div>
      ) : null}
    </div>
  );
}

function Legend({ tiers }: { tiers: TravelTier[] }) {
  const colors = travelTierRampIndexes(tiers.length).map((index) => TRAVEL_TIER_RAMP[index]);
  return (
    <ul className="space-y-2" aria-label={tierSummary(tiers)}>
      {tiers.map((tier, index) => (
        <li key={`${tier.fromMiles}-${index}`} className="flex items-center gap-2 text-sm text-foreground">
          <span
            className="h-3 w-3 shrink-0 rounded-sm"
            style={{ backgroundColor: colors[index].fill }}
            aria-hidden="true"
          />
          <span className="shrink-0 font-medium">{`Tier ${index + 1}`}</span>
          <span className="min-w-0 flex-1">{rangeLabel(tier, false)}</span>
          <span className="shrink-0 tabular-nums">{feeLabel(tier.feeCents, false)}</span>
        </li>
      ))}
    </ul>
  );
}

export function TravelTierDiagram({ tiers }: { tiers: TravelTier[] }) {
  if (travelTierError(tiers)) {
    return (
      <DiagramFrame>
        <div className="flex h-[280px] items-center justify-center px-6 text-center text-sm text-muted">
          The mileage bands appear when the tiers form one continuous range.
        </div>
      </DiagramFrame>
    );
  }

  return (
    <DiagramFrame>
      {tiers.length >= 7 ? <Legend tiers={tiers} /> : <Rings tiers={tiers} />}
    </DiagramFrame>
  );
}

class TravelTierDiagramBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  render() {
    if (this.state.failed) return null;
    return this.props.children;
  }
}

/** Keeps a drawing failure from taking down the tier form. */
export function TravelTierDiagramSlot({ tiers }: { tiers: TravelTier[] }) {
  return (
    <TravelTierDiagramBoundary>
      <TravelTierDiagram tiers={tiers} />
    </TravelTierDiagramBoundary>
  );
}
