/**
 * Social Media Kit templates — one definition, two renderers.
 *
 * These functions return plain JSX with inline styles only (flexbox + absolute positioning),
 * the subset both the browser and next/og (Satori) render the same way. The live preview
 * renders them at full pixel size and scales the box down with CSS; exports render the very
 * same tree on the server. That is what keeps downloads matching the preview.
 *
 * Rules for editing: every element with more than one child needs display:flex; put text in
 * its own element; give images explicit width/height; pre-truncate text (clampText) instead
 * of relying on CSS line clamping; only use fonts registered in lib/marketing/fonts.ts.
 */
import type { CSSProperties, ReactNode } from "react";
import { DEFAULT_FLYER, clampText, type CarouselSlide, type DesignStyle, type FlyerConfig, type SocialAssetKey } from "@/lib/marketing/model";
import type { ListingView } from "@/lib/marketing/view-model";

export type SocialFormat = "square" | "story" | "carousel" | "flyer";

export type SocialRenderInput = {
  asset: SocialAssetKey | "carousel";
  format: SocialFormat;
  width: number;
  height: number;
  style: DesignStyle;
  view: ListingView;
  headline: string;
  photo: string | null;
  supporting: string[];
  slide?: CarouselSlide & { index: number; total: number; photo: string | null };
  /** Flyer only: layout and sections. */
  flyer?: FlyerConfig;
  /** Flyer only: QR code image (SVG data URI) linking to the published property website. */
  qr?: string | null;
  websiteUrl?: string | null;
  /** Preview-only diagonal "PREVIEW" mark (never present in exports). */
  watermark?: boolean;
};

type Theme = {
  head: string;
  body: string;
  headWeight: number;
  bodyWeight: number;
  strongWeight: number;
  bg: string;
  ink: string;
  muted: string;
  panel: string;
  panelInk: string;
  rule: string;
  radius: number;
  upperHead: boolean;
};

function themeFor(style: DesignStyle, view: ListingView): Theme {
  if (style === "luxury") {
    return {
      head: "Cormorant",
      body: "Inter",
      headWeight: 600,
      bodyWeight: 400,
      strongWeight: 600,
      bg: "#0B0B0C",
      ink: "#F6F1E7",
      muted: "#BDB4A5",
      panel: "#0B0B0C",
      panelInk: "#F6F1E7",
      rule: view.branding.accent,
      radius: 0,
      upperHead: false,
    };
  }
  if (style === "coastal") {
    return {
      head: "DM Serif",
      body: "Nunito Sans",
      headWeight: 400,
      bodyWeight: 400,
      strongWeight: 700,
      bg: "#F4EEE3",
      ink: "#21343A",
      muted: "#5C6D71",
      panel: "#F4EEE3",
      panelInk: "#21343A",
      rule: view.branding.accent,
      radius: 40,
      upperHead: false,
    };
  }
  return {
    head: "Inter",
    body: "Inter",
    headWeight: 700,
    bodyWeight: 400,
    strongWeight: 600,
    bg: "#FFFFFF",
    ink: "#0F172A",
    muted: "#5B6475",
    panel: "#FFFFFF",
    panelInk: "#0F172A",
    rule: view.branding.primary,
    radius: 28,
    upperHead: true,
  };
}

const flex = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", ...s });
const col = (s: CSSProperties = {}): CSSProperties => ({ display: "flex", flexDirection: "column", ...s });

function Photo({ src, width, height, radius = 0, style }: { src: string | null; width: number; height: number; radius?: number; style?: CSSProperties }) {
  if (!src) {
    return (
      <div
        style={flex({
          width,
          height,
          borderRadius: radius,
          backgroundImage: "linear-gradient(135deg, #CBD5E1 0%, #94A3B8 100%)",
          ...style,
        })}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={width}
      height={height}
      style={{ width, height, objectFit: "cover", borderRadius: radius, ...style }}
    />
  );
}

function Text({ children, style }: { children: ReactNode; style: CSSProperties }) {
  return <div style={flex(style)}>{children}</div>;
}

function factsLine(view: ListingView, max = 4): string {
  return view.facts
    .slice(0, max)
    .map((f) => `${f.value} ${f.label}`)
    .join("  ·  ");
}

function detailLine(input: SocialRenderInput): string {
  const { asset, view } = input;
  if ((asset === "sq_open_house" || asset === "st_open_house") && view.openHouse) {
    return `${view.openHouse.day}  ·  ${view.openHouse.time}`;
  }
  if (asset === "sq_just_sold" && view.priceText) return `Sold for ${view.priceText}`;
  return view.priceText ?? "";
}

/** Transparent margin (× logo height) the export adds around logos so shadows aren't clipped. */
export const LOGO_PAD = 0.3;

/**
 * Soft shadow that follows the logo's visible (non-transparent) edges, scaled to its size:
 * a tight contact shadow for definition plus a softer ambient one. It reaches about 0.23 × the
 * logo height, inside the LOGO_PAD margin.
 */
function logoShadow(size: number): string {
  const px = (f: number) => `${Math.max(0.5, Math.round(f * size * 10) / 10)}px`;
  return `drop-shadow(0px ${px(0.02)} ${px(0.04)} rgba(0,0,0,0.35)) drop-shadow(0px ${px(0.05)} ${px(0.12)} rgba(0,0,0,0.22))`;
}

/**
 * A logo exactly as uploaded — transparent areas stay transparent, no box behind it — with a
 * shape-following drop shadow. Browsers draw the shadow beyond the image; the export renderer
 * clips filters to the image box, so exports use a padded copy and cancel the padding with a
 * negative margin: same size and position in both.
 */
function Logo({ url, size, view }: { url: string | null; size: number; view: ListingView }) {
  if (!url) return null;
  const pad = view.paddedLogos?.includes(url) ? LOGO_PAD * size : 0;
  const h = size + pad * 2;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={url} alt="" height={h} style={{ height: h, maxWidth: size * 4 + pad * 2, objectFit: "contain", margin: -pad, filter: logoShadow(size) }} />
  );
}

function AgentRow({ view, t, u, dark }: { view: ListingView; t: Theme; u: number; dark: boolean }) {
  if (!view.showAgent) return null;
  const ink = dark ? "#FFFFFF" : t.ink;
  const muted = dark ? "rgba(255,255,255,0.78)" : t.muted;
  const contact = [view.agent.phone, view.agent.email].filter(Boolean).join("  ·  ");
  return (
    <div style={flex({ alignItems: "center", gap: 22 * u })}>
      {view.agent.headshotUrl ? (
        <Photo src={view.agent.headshotUrl} width={92 * u} height={92 * u} radius={46 * u} style={{ border: `${3 * u}px solid ${dark ? "rgba(255,255,255,0.9)" : "#FFFFFF"}` }} />
      ) : null}
      <div style={col({ gap: 4 * u })}>
        <Text style={{ fontFamily: t.body, fontWeight: t.strongWeight, fontSize: 30 * u, color: ink, lineHeight: 1.15 }}>
          {clampText(view.agent.name, 34)}
        </Text>
        {view.agent.brokerage ? (
          <Text style={{ fontFamily: t.body, fontSize: 22 * u, color: muted, lineHeight: 1.2 }}>{clampText(view.agent.brokerage, 44)}</Text>
        ) : null}
        {contact ? <Text style={{ fontFamily: t.body, fontSize: 22 * u, color: muted, lineHeight: 1.2 }}>{clampText(contact, 52)}</Text> : null}
      </div>
    </div>
  );
}

function Watermark({ width, height }: { width: number; height: number }) {
  return (
    <div
      style={flex({
        position: "absolute",
        left: 0,
        top: 0,
        width,
        height,
        alignItems: "center",
        justifyContent: "center",
      })}
    >
      <div
        style={flex({
          fontFamily: "Inter",
          fontWeight: 700,
          fontSize: width / 7,
          letterSpacing: width / 60,
          color: "rgba(255,255,255,0.28)",
          transform: "rotate(-24deg)",
          textShadow: "0 2px 12px rgba(0,0,0,0.25)",
        })}
      >
        PREVIEW
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Feature layouts (square / story / carousel cover)
// ---------------------------------------------------------------------------

function ModernFeature(input: SocialRenderInput, t: Theme, u: number) {
  const { width, height, view } = input;
  const tall = height / width > 1.4;
  const cardH = tall ? 640 * u : 380 * u;
  const detail = detailLine(input);
  const facts = factsLine(view);
  return (
    <div style={flex({ position: "relative", width, height, background: t.bg })}>
      <Photo src={input.photo} width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }} />
      {view.branding.logoUrl ? (
        <div style={flex({ position: "absolute", left: 56 * u, top: (tall ? 150 : 56) * u })}>
          <Logo url={view.branding.logoUrl} size={64 * u} view={view} />
        </div>
      ) : null}
      <div
        style={col({
          position: "absolute",
          left: 48 * u,
          right: 48 * u,
          bottom: (tall ? 220 : 48) * u,
          minHeight: cardH,
          background: t.panel,
          borderRadius: t.radius * u,
          padding: `${44 * u}px ${48 * u}px`,
          boxShadow: "0 24px 60px rgba(15,23,42,0.28)",
          justifyContent: "center",
          gap: 14 * u,
        })}
      >
        <div style={flex({ alignItems: "center", gap: 16 * u })}>
          <div style={flex({ width: 44 * u, height: 8 * u, background: t.rule, borderRadius: 4 * u })} />
          <Text style={{ fontFamily: t.body, fontWeight: 700, fontSize: 26 * u, letterSpacing: 5 * u, color: t.rule, textTransform: "uppercase", lineHeight: 1 }}>
            {input.headline}
          </Text>
        </div>
        <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: (tall ? 88 : 64) * u, color: t.ink, lineHeight: 1.05, letterSpacing: -1.5 * u }}>
          {clampText(view.property.address || "Your Listing", tall ? 40 : 34)}
        </Text>
        {view.property.locality ? (
          <Text style={{ fontFamily: t.body, fontSize: (tall ? 36 : 30) * u, color: t.muted, lineHeight: 1.2 }}>{clampText(view.property.locality, 46)}</Text>
        ) : null}
        <div style={flex({ alignItems: "center", justifyContent: "space-between", marginTop: 10 * u, gap: 20 * u })}>
          {detail ? (
            <Text style={{ fontFamily: t.head, fontWeight: 700, fontSize: (detail.length > 22 ? (tall ? 44 : 36) : tall ? 58 : 46) * u, color: t.ink, lineHeight: 1.1 }}>{detail}</Text>
          ) : (
            <div style={flex({})} />
          )}
          {facts && !tall && detail.length <= 18 ? <Text style={{ fontFamily: t.body, fontWeight: 600, fontSize: 24 * u, color: t.muted, lineHeight: 1.2 }}>{facts}</Text> : null}
        </div>
        {facts && (tall || detail.length > 18) ? (
          <Text style={{ fontFamily: t.body, fontWeight: 600, fontSize: (tall ? 34 : 24) * u, color: t.muted, lineHeight: 1.3 }}>{facts}</Text>
        ) : null}
        {tall ? (
          <div style={flex({ marginTop: 26 * u, paddingTop: 26 * u, borderTop: `${2 * u}px solid #E2E8F0` })}>
            <AgentRow view={view} t={t} u={u * 1.3} dark={false} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function LuxuryFeature(input: SocialRenderInput, t: Theme, u: number) {
  const { width, height, view } = input;
  const tall = height / width > 1.4;
  const detail = detailLine(input);
  const facts = factsLine(view);
  return (
    <div style={flex({ position: "relative", width, height, background: t.bg })}>
      <Photo src={input.photo} width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }} />
      <div
        style={flex({
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          backgroundImage: "linear-gradient(180deg, rgba(6,6,7,0.35) 0%, rgba(6,6,7,0) 28%, rgba(6,6,7,0) 42%, rgba(6,6,7,0.86) 78%, rgba(6,6,7,0.95) 100%)",
        })}
      />
      <div style={flex({ position: "absolute", left: 36 * u, top: 36 * u, width: width - 72 * u, height: height - 72 * u, border: `${2 * u}px solid rgba(255,255,255,0.35)` })} />
      {view.branding.logoUrl ? (
        <div style={flex({ position: "absolute", left: 0, top: (tall ? 150 : 76) * u, width, justifyContent: "center" })}>
          <Logo url={view.branding.logoUrl} size={64 * u} view={view} />
        </div>
      ) : null}
      <div style={col({ position: "absolute", left: 90 * u, right: 90 * u, bottom: (tall ? 260 : 96) * u, alignItems: "center", gap: 18 * u })}>
        <div style={flex({ alignItems: "center", gap: 22 * u })}>
          <div style={flex({ width: 70 * u, height: 2 * u, background: t.rule })} />
          <Text style={{ fontFamily: t.body, fontSize: 22 * u, letterSpacing: 9 * u, color: t.rule, textTransform: "uppercase", lineHeight: 1 }}>{input.headline}</Text>
          <div style={flex({ width: 70 * u, height: 2 * u, background: t.rule })} />
        </div>
        <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: (tall ? 112 : 84) * u, color: t.ink, lineHeight: 1.02, textAlign: "center", justifyContent: "center" }}>
          {clampText(view.property.address || "Your Listing", tall ? 36 : 30)}
        </Text>
        {view.property.locality ? (
          <Text style={{ fontFamily: t.body, fontSize: 22 * u, letterSpacing: 6 * u, color: t.muted, textTransform: "uppercase", lineHeight: 1.3 }}>
            {clampText(view.property.locality, 42)}
          </Text>
        ) : null}
        {detail ? (
          <Text style={{ fontFamily: t.head, fontWeight: 500, fontSize: (detail.length > 22 ? (tall ? 50 : 40) : tall ? 66 : 54) * u, color: t.ink, lineHeight: 1.1, marginTop: 6 * u }}>{detail}</Text>
        ) : null}
        {facts ? <Text style={{ fontFamily: t.body, fontSize: (tall ? 28 : 22) * u, letterSpacing: 3 * u, color: t.muted, textTransform: "uppercase", lineHeight: 1.3 }}>{facts}</Text> : null}
        {tall && view.showAgent ? (
          <div style={flex({ marginTop: 44 * u })}>
            <AgentRow view={view} t={t} u={u * 1.3} dark />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function CoastalFeature(input: SocialRenderInput, t: Theme, u: number) {
  const { width, height, view } = input;
  const tall = height / width > 1.4;
  const pad = 44 * u;
  const photoH = tall ? height * 0.56 : height * 0.62;
  const detail = detailLine(input);
  const facts = factsLine(view, 3);
  return (
    <div style={col({ position: "relative", width, height, background: t.bg, padding: pad, paddingTop: (tall ? 130 : 44) * u })}>
      <div style={flex({ position: "relative", width: width - pad * 2, height: photoH })}>
        <Photo src={input.photo} width={width - pad * 2} height={photoH} radius={t.radius * u} />
        <div
          style={flex({
            position: "absolute",
            left: 28 * u,
            top: 28 * u,
            padding: `${14 * u}px ${26 * u}px`,
            background: "rgba(244,238,227,0.95)",
            borderRadius: 999,
            fontFamily: t.body,
            fontWeight: 700,
            fontSize: 24 * u,
            letterSpacing: 3 * u,
            color: t.rule,
            textTransform: "uppercase",
          })}
        >
          {input.headline}
        </div>
      </div>
      <div style={flex({ flex: 1, alignItems: "center", justifyContent: "space-between", paddingTop: 30 * u, gap: 24 * u })}>
        <div style={col({ gap: 10 * u, flex: 1 })}>
          <Text style={{ fontFamily: t.head, fontWeight: 400, fontSize: (tall ? 92 : 64) * u, color: t.ink, lineHeight: 1.04 }}>
            {clampText(view.property.address || "Your Listing", tall ? 36 : 30)}
          </Text>
          {view.property.locality ? <Text style={{ fontFamily: t.body, fontSize: (tall ? 34 : 28) * u, color: t.muted, lineHeight: 1.2 }}>{clampText(view.property.locality, 44)}</Text> : null}
          <div style={flex({ alignItems: "center", gap: 18 * u, marginTop: 8 * u })}>
            {detail ? <Text style={{ fontFamily: t.body, fontWeight: 700, fontSize: (detail.length > 22 ? (tall ? 38 : 30) : tall ? 50 : 38) * u, color: t.rule, lineHeight: 1.15 }}>{detail}</Text> : null}
          </div>
          {facts ? <Text style={{ fontFamily: t.body, fontSize: (tall ? 32 : 24) * u, color: t.muted, lineHeight: 1.3 }}>{facts}</Text> : null}
          {tall && view.showAgent ? (
            <div style={flex({ marginTop: 34 * u })}>
              <AgentRow view={view} t={t} u={u * 1.3} dark={false} />
            </div>
          ) : null}
        </div>
        {!tall && view.branding.logoUrl ? <Logo url={view.branding.logoUrl} size={84 * u} view={view} /> : null}
      </div>
      {tall && view.branding.logoUrl ? (
        <div style={flex({ position: "absolute", top: 40 * u, left: 0, width, justifyContent: "center" })}>
          <Logo url={view.branding.logoUrl} size={60 * u} view={view} />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Highlights (list) layouts
// ---------------------------------------------------------------------------

function highlightItems(view: ListingView, max: number): string[] {
  const items = view.property.highlights.map((h) => clampText(h, 46)).filter(Boolean);
  const facts = view.facts.map((f) => `${f.value} ${f.label}`);
  return (items.length ? items : facts).slice(0, max);
}

function HighlightsLayout(input: SocialRenderInput, t: Theme, u: number) {
  const { width, height, view, style } = input;
  const items = highlightItems(view, 6);
  const dark = style === "luxury";
  const panelBg = style === "modern" ? view.branding.primary : t.bg;
  const panelInk = style === "modern" ? view.branding.onPrimary : t.ink;
  const half = width * 0.5;
  const showPhoto = Boolean(input.photo) && input.format !== "carousel";
  return (
    <div style={flex({ width, height, background: panelBg })}>
      {showPhoto ? <Photo src={input.photo} width={half} height={height} /> : null}
      <div style={col({ width: showPhoto ? half : width, height, padding: `${70 * u}px ${60 * u}px`, justifyContent: "center", gap: 18 * u })}>
        <Text style={{ fontFamily: t.body, fontWeight: 700, fontSize: 22 * u, letterSpacing: 6 * u, color: style === "modern" ? panelInk : t.rule, textTransform: "uppercase", lineHeight: 1 }}>
          {input.headline}
        </Text>
        <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: (showPhoto ? 52 : 70) * u, color: panelInk, lineHeight: 1.05 }}>
          {clampText(view.property.address || "Your Listing", showPhoto ? 28 : 36)}
        </Text>
        <div style={col({ gap: 16 * u, marginTop: 20 * u })}>
          {items.length ? (
            items.map((item, i) => (
              <div key={i} style={flex({ alignItems: "center", gap: 18 * u })}>
                <div style={flex({ width: 14 * u, height: 14 * u, borderRadius: style === "luxury" ? 0 : 7 * u, background: style === "modern" ? view.branding.accent : t.rule, ...(style === "luxury" ? { transform: "rotate(45deg)" } : {}) })} />
                <Text style={{ fontFamily: t.body, fontSize: (showPhoto ? 28 : 36) * u, color: dark ? t.ink : panelInk, lineHeight: 1.25 }}>{item}</Text>
              </div>
            ))
          ) : (
            <Text style={{ fontFamily: t.body, fontSize: 28 * u, color: panelInk, lineHeight: 1.3 }}>Add highlights in Property details.</Text>
          )}
        </div>
        {view.priceText ? (
          <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 46 * u, color: panelInk, lineHeight: 1.1, marginTop: 24 * u }}>{view.priceText}</Text>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Carousel slides
// ---------------------------------------------------------------------------

function SlideCounter({ index, total, t, u, dark }: { index: number; total: number; t: Theme; u: number; dark: boolean }) {
  return (
    <div
      style={flex({
        position: "absolute",
        right: 40 * u,
        top: 40 * u,
        padding: `${10 * u}px ${20 * u}px`,
        borderRadius: 999,
        background: dark ? "rgba(0,0,0,0.45)" : "rgba(255,255,255,0.9)",
        fontFamily: t.body,
        fontWeight: 600,
        fontSize: 22 * u,
        color: dark ? "#FFFFFF" : t.ink,
      })}
    >
      {`${index + 1}/${total}`}
    </div>
  );
}

function PhotoSlide(input: SocialRenderInput, t: Theme, u: number) {
  const { width, height, slide, view, style } = input;
  const caption = slide?.caption?.trim();
  return (
    <div style={flex({ position: "relative", width, height, background: t.bg })}>
      <Photo src={slide?.photo ?? null} width={width} height={height} style={{ position: "absolute", left: 0, top: 0 }} />
      {caption ? (
        <div
          style={flex({
            position: "absolute",
            left: 48 * u,
            bottom: 56 * u,
            padding: `${18 * u}px ${30 * u}px`,
            background: style === "luxury" ? "rgba(8,8,9,0.78)" : style === "coastal" ? "rgba(244,238,227,0.95)" : "#FFFFFF",
            borderRadius: style === "luxury" ? 0 : style === "coastal" ? 999 : 16 * u,
            fontFamily: style === "luxury" ? t.head : t.body,
            fontWeight: style === "luxury" ? 600 : 700,
            fontSize: (style === "luxury" ? 40 : 30) * u,
            letterSpacing: style === "luxury" ? 1 * u : 2 * u,
            color: style === "luxury" ? t.ink : style === "modern" ? view.branding.primary : t.ink,
            textTransform: style === "luxury" ? "none" : "uppercase",
          })}
        >
          {clampText(caption, 30)}
        </div>
      ) : null}
      {slide ? <SlideCounter index={slide.index} total={slide.total} t={t} u={u} dark /> : null}
    </div>
  );
}

function AgentSlide(input: SocialRenderInput, t: Theme, u: number) {
  const { width, height, view, style } = input;
  const bg = style === "modern" ? view.branding.primary : t.bg;
  const ink = style === "modern" ? view.branding.onPrimary : t.ink;
  const muted = style === "modern" ? (view.branding.onPrimary === "#FFFFFF" ? "rgba(255,255,255,0.78)" : "rgba(0,0,0,0.65)") : t.muted;
  const lines = [view.agent.phone, view.agent.email, view.agent.website].filter(Boolean);
  return (
    <div style={col({ position: "relative", width, height, background: bg, alignItems: "center", justifyContent: "center", gap: 22 * u, padding: 80 * u })}>
      {view.agent.headshotUrl ? (
        <Photo src={view.agent.headshotUrl} width={300 * u} height={300 * u} radius={style === "luxury" ? 0 : 150 * u} style={{ border: `${6 * u}px solid ${style === "luxury" ? t.rule : "#FFFFFF"}` }} />
      ) : null}
      <Text style={{ fontFamily: t.body, fontWeight: 700, fontSize: 24 * u, letterSpacing: 6 * u, textTransform: "uppercase", color: style === "modern" ? ink : t.rule, lineHeight: 1 }}>
        Schedule a showing
      </Text>
      <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 76 * u, color: ink, lineHeight: 1.05, textAlign: "center", justifyContent: "center" }}>
        {clampText(view.agent.name || "Contact us", 28)}
      </Text>
      {view.agent.title || view.agent.brokerage ? (
        <Text style={{ fontFamily: t.body, fontSize: 30 * u, color: muted, lineHeight: 1.3 }}>
          {clampText([view.agent.title, view.agent.brokerage].filter(Boolean).join("  ·  "), 50)}
        </Text>
      ) : null}
      <div style={col({ alignItems: "center", gap: 8 * u, marginTop: 18 * u })}>
        {lines.map((l, i) => (
          <Text key={i} style={{ fontFamily: t.body, fontWeight: 600, fontSize: 34 * u, color: ink, lineHeight: 1.3 }}>
            {clampText(l, 40)}
          </Text>
        ))}
      </div>
      {view.agent.brokerageLogoUrl || view.branding.logoUrl ? (
        <div style={flex({ marginTop: 34 * u })}>
          <Logo url={view.agent.brokerageLogoUrl ?? view.branding.logoUrl} size={80 * u} view={view} />
        </div>
      ) : null}
      {input.slide ? <SlideCounter index={input.slide.index} total={input.slide.total} t={t} u={u} dark={style !== "coastal"} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flyer (US Letter, 2550 × 3300 at 300 dpi)
//
// Every block has a computed height, so nothing can spill off the page: photo tiles take the
// space the text doesn't need, and text is pre-trimmed to what fits its box. Missing facts,
// highlights, agent details or photos remove their block and the rest re-flows.
// ---------------------------------------------------------------------------

type FlyerKit = {
  t: Theme;
  u: number;
  light: boolean;
  accent: string;
  ink: string;
  muted: string;
  rule: string;
  radius: number;
  pageBg: string;
  bandBg: string;
};

function flyerKit(input: SocialRenderInput, t: Theme, u: number): FlyerKit {
  const { style, view } = input;
  const light = style !== "luxury";
  return {
    t,
    u,
    light,
    accent: style === "modern" ? view.branding.primary : t.rule,
    ink: t.ink,
    muted: light ? (style === "coastal" ? "#5C6D71" : "#4B5563") : t.muted,
    rule: light ? (style === "coastal" ? "#E3D8C6" : "#E5E7EB") : "rgba(255,255,255,0.16)",
    radius: (style === "coastal" ? 30 : style === "modern" ? 14 : 0) * u,
    pageBg: style === "luxury" ? t.bg : style === "coastal" ? "#FBF8F2" : "#FFFFFF",
    bandBg: style === "modern" ? "#F1F5F9" : style === "coastal" ? "#F1E9DC" : "#141416",
  };
}

/** Rough character budget for a text box (≈0.52 em per character). */
function textBudget(width: number, height: number, fontSize: number, lineHeight = 1.5): number {
  const perLine = Math.floor(width / (fontSize * 0.52));
  const lines = Math.floor(height / (fontSize * lineHeight));
  return Math.max(0, perLine * lines - 6);
}

function addressSize(text: string, base: number): number {
  const n = text.length;
  return n > 34 ? base * 0.68 : n > 26 ? base * 0.8 : base;
}

/** Rows of photos filling exactly `width` × `height`; the last row stretches to the full width. */
function PhotoGrid({ srcs, width, height, cols, gap, radius }: { srcs: string[]; width: number; height: number; cols: number; gap: number; radius: number }) {
  const rows: string[][] = [];
  for (let i = 0; i < srcs.length; i += cols) rows.push(srcs.slice(i, i + cols));
  const rowH = (height - gap * (rows.length - 1)) / Math.max(1, rows.length);
  return (
    <div style={col({ width, height, gap })}>
      {rows.map((row, r) => {
        const w = (width - gap * (row.length - 1)) / row.length;
        return (
          <div key={r} style={flex({ gap, width, height: rowH })}>
            {row.map((src, i) => (
              <Photo key={i} src={src} width={w} height={rowH} radius={radius} />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function HeadlineTab({ input, k }: { input: SocialRenderInput; k: FlyerKit }) {
  const { style, view } = input;
  const { u, t } = k;
  return (
    <div
      style={flex({
        padding: `${30 * u}px ${50 * u}px`,
        background: style === "modern" ? view.branding.primary : style === "coastal" ? "#FBF8F2" : t.bg,
        borderTopLeftRadius: style === "coastal" ? 30 * u : 0,
        borderTopRightRadius: style === "coastal" ? 30 * u : 0,
        fontFamily: t.body,
        fontWeight: 700,
        fontSize: 40 * u,
        letterSpacing: 9 * u,
        textTransform: "uppercase",
        color: style === "modern" ? view.branding.onPrimary : t.rule,
      })}
    >
      {input.headline}
    </div>
  );
}

function FlyerHero({ input, k, height, overlay }: { input: SocialRenderInput; k: FlyerKit; height: number; overlay?: ReactNode }) {
  const { width, view } = input;
  const { u } = k;
  const pad = 120 * u;
  return (
    <div style={flex({ position: "relative", width, height })}>
      <Photo src={input.photo} width={width} height={height} />
      {overlay ?? (
        <div style={flex({ position: "absolute", left: pad, bottom: 0 })}>
          <HeadlineTab input={input} k={k} />
        </div>
      )}
      {view.branding.logoUrl ? (
        <div style={flex({ position: "absolute", right: pad, top: 100 * u })}>
          <Logo url={view.branding.logoUrl} size={120 * u} view={view} />
        </div>
      ) : null}
    </div>
  );
}

function TitleBlock({ input, k, width, stacked }: { input: SocialRenderInput; k: FlyerKit; width: number; stacked?: boolean }) {
  const { view, style } = input;
  const { u, t } = k;
  const address = clampText(view.property.address || "Your Listing", stacked ? 48 : 36);
  const base = (stacked ? 96 : 116) * u;
  const price = view.priceText ? (
    <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: (stacked ? 84 : 100) * u, color: k.accent, lineHeight: 1 }}>{view.priceText}</Text>
  ) : null;
  return (
    <div style={stacked ? col({ width, gap: 18 * u }) : flex({ width, justifyContent: "space-between", alignItems: "flex-end", gap: 60 * u })}>
      <div style={col({ gap: 14 * u, ...(stacked ? {} : { flex: 1 }) })}>
        <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: addressSize(address, base), color: k.ink, lineHeight: 1.02, letterSpacing: style === "modern" ? -2.5 * u : 0 }}>
          {address}
        </Text>
        {view.property.locality ? (
          <Text style={{ fontFamily: t.body, fontSize: 48 * u, color: k.muted, lineHeight: 1.2, letterSpacing: style === "luxury" ? 6 * u : 0, textTransform: style === "luxury" ? "uppercase" : "none" }}>
            {clampText(view.property.locality, 48)}
          </Text>
        ) : null}
      </div>
      {stacked && price ? <div style={flex({ marginTop: 10 * u })}>{price}</div> : price}
    </div>
  );
}

function FactsBar({ input, k, width, height }: { input: SocialRenderInput; k: FlyerKit; width: number; height: number }) {
  const { u, t } = k;
  const facts = input.view.facts.slice(0, 5);
  return (
    <div style={flex({ width, height, borderTop: `${4 * u}px solid ${k.rule}`, borderBottom: `${4 * u}px solid ${k.rule}` })}>
      {facts.map((f, i) => (
        <div key={i} style={col({ flex: 1, alignItems: "center", justifyContent: "center", gap: 6 * u, borderLeft: i ? `${4 * u}px solid ${k.rule}` : "none" })}>
          <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 76 * u, color: k.ink, lineHeight: 1.05 }}>{f.value}</Text>
          <Text style={{ fontFamily: t.body, fontSize: 32 * u, letterSpacing: 4 * u, textTransform: "uppercase", color: k.muted, lineHeight: 1.2 }}>{f.label}</Text>
        </div>
      ))}
    </div>
  );
}

/** Facts as a 2-column stat list (narrow columns). */
function FactsList({ input, k, width }: { input: SocialRenderInput; k: FlyerKit; width: number }) {
  const { u, t } = k;
  const facts = input.view.facts.slice(0, 6);
  const cellW = (width - 30 * u) / 2;
  return (
    <div style={flex({ width, flexWrap: "wrap", gap: 30 * u, paddingTop: 34 * u, borderTop: `${4 * u}px solid ${k.rule}` })}>
      {facts.map((f, i) => (
        <div key={i} style={col({ width: cellW, gap: 4 * u })}>
          <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 70 * u, color: k.ink, lineHeight: 1.05 }}>{f.value}</Text>
          <Text style={{ fontFamily: t.body, fontSize: 30 * u, letterSpacing: 4 * u, textTransform: "uppercase", color: k.muted, lineHeight: 1.2 }}>{f.label}</Text>
        </div>
      ))}
    </div>
  );
}

/** Description + highlights, trimmed to fit `width` × `height`. */
function FlyerText({ input, k, width, height, stacked }: { input: SocialRenderInput; k: FlyerKit; width: number; height: number; stacked?: boolean }) {
  const { view, style } = input;
  const cfg = input.flyer ?? DEFAULT_FLYER;
  const { u, t } = k;
  const fs = 40 * u;
  const rowH = fs * 1.35 + 20 * u;
  const desc = cfg.showDescription ? view.property.description.trim() : "";
  const allHighlights = cfg.showHighlights ? view.property.highlights.map((h) => h.trim()).filter(Boolean) : [];
  if (!desc && !allHighlights.length) return null;
  const gap = 80 * u;
  const both = Boolean(desc && allHighlights.length);
  const descW = both && !stacked ? (width - gap) * 0.56 : width;
  const hiW = both && !stacked ? width - gap - descW : width;
  let descH = height;
  let hiH = height;
  if (both && stacked) {
    hiH = Math.min(height * 0.45, rowH * Math.min(allHighlights.length, 5) + 50 * u);
    descH = height - hiH - 40 * u;
  }
  const maxHi = Math.max(0, Math.floor((hiH - 50 * u) / rowH));
  const highlights = allHighlights.slice(0, maxHi).map((h) => clampText(h, Math.floor(hiW / (fs * 0.52)) - 4));
  const descText = desc ? clampText(desc, textBudget(descW, descH, fs)) : "";
  return (
    <div style={stacked ? col({ width, height, gap: 40 * u }) : flex({ width, height, gap })}>
      {descText ? (
        <div style={col({ width: descW, height: descH, overflow: "hidden" })}>
          <Text style={{ fontFamily: t.body, fontSize: fs, color: k.light ? "#374151" : k.muted, lineHeight: 1.5 }}>{descText}</Text>
        </div>
      ) : null}
      {highlights.length ? (
        <div style={col({ width: hiW, height: hiH, gap: 20 * u, overflow: "hidden" })}>
          <Text style={{ fontFamily: t.body, fontWeight: 700, fontSize: 30 * u, letterSpacing: 6 * u, textTransform: "uppercase", color: k.accent, lineHeight: 1, marginBottom: 10 * u }}>
            Highlights
          </Text>
          {highlights.map((h, i) => (
            <div key={i} style={flex({ alignItems: "center", gap: 24 * u })}>
              <div style={flex({ width: 16 * u, height: 16 * u, flexShrink: 0, borderRadius: style === "luxury" ? 0 : 8 * u, background: k.accent, ...(style === "luxury" ? { transform: "rotate(45deg)" } : {}) })} />
              <Text style={{ fontFamily: t.body, fontSize: fs, color: k.ink, lineHeight: 1.35 }}>{h}</Text>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function flyerFooterHeight(input: SocialRenderInput): number {
  const cfg = input.flyer ?? DEFAULT_FLYER;
  const agent = input.view.showAgent && cfg.showAgent;
  if (agent || input.qr) return 400;
  return input.view.photographerCredit && input.view.businessName ? 130 : 0;
}

function FlyerFooter({ input, k, height }: { input: SocialRenderInput; k: FlyerKit; height: number }) {
  const { view, width } = input;
  const cfg = input.flyer ?? DEFAULT_FLYER;
  const { u, t } = k;
  if (!height) return null;
  const pad = 120 * u;
  const agent = view.showAgent && cfg.showAgent;
  const ink = k.light ? k.ink : "#FFFFFF";
  const muted = k.light ? k.muted : "rgba(255,255,255,0.72)";
  const credit = view.photographerCredit && view.businessName ? `Photography by ${clampText(view.businessName, 40)}` : null;
  const contact = [view.agent.phone, view.agent.email].filter(Boolean);
  const qrSize = 260 * u;
  return (
    <div style={flex({ width, height, background: k.bandBg, padding: `0 ${pad}px`, alignItems: "center", justifyContent: "space-between", gap: 60 * u })}>
      {agent ? (
        <div style={flex({ alignItems: "center", gap: 50 * u, flex: 1 })}>
          {view.agent.headshotUrl ? (
            <Photo src={view.agent.headshotUrl} width={230 * u} height={230 * u} radius={k.t.radius === 0 && input.style === "luxury" ? 0 : 115 * u} style={{ border: `${6 * u}px solid ${k.light ? "#FFFFFF" : k.accent}` }} />
          ) : null}
          <div style={col({ gap: 10 * u, flex: 1 })}>
            {view.agent.name ? <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 68 * u, color: ink, lineHeight: 1.05 }}>{clampText(view.agent.name, 34)}</Text> : null}
            {view.agent.title || view.agent.brokerage ? (
              <Text style={{ fontFamily: t.body, fontSize: 38 * u, color: muted, lineHeight: 1.25 }}>{clampText([view.agent.title, view.agent.brokerage].filter(Boolean).join("  ·  "), 60)}</Text>
            ) : null}
            {contact.length ? (
              <Text style={{ fontFamily: t.body, fontWeight: 600, fontSize: 40 * u, color: ink, lineHeight: 1.3, marginTop: 6 * u }}>{clampText(contact.join("   ·   "), 64)}</Text>
            ) : null}
            {view.agent.website || view.agent.license ? (
              <Text style={{ fontFamily: t.body, fontSize: 32 * u, color: muted, lineHeight: 1.3 }}>
                {clampText([view.agent.website, view.agent.license ? `Lic. ${view.agent.license}` : ""].filter(Boolean).join("  ·  "), 72)}
              </Text>
            ) : null}
          </div>
        </div>
      ) : (
        <div style={col({ gap: 12 * u, flex: 1 })}>
          {input.qr ? (
            <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 64 * u, color: ink, lineHeight: 1.1 }}>See every photo online</Text>
          ) : null}
          {input.qr && input.websiteUrl ? (
            <Text style={{ fontFamily: t.body, fontSize: 36 * u, color: muted, lineHeight: 1.3 }}>{clampText(input.websiteUrl.replace(/^https?:\/\//, ""), 60)}</Text>
          ) : null}
          {credit && !input.qr ? <Text style={{ fontFamily: t.body, fontSize: 32 * u, color: muted, lineHeight: 1.2 }}>{credit}</Text> : null}
        </div>
      )}
      <div style={flex({ alignItems: "center", gap: 50 * u })}>
        {agent && (view.agent.brokerageLogoUrl || credit) ? (
          <div style={col({ alignItems: "flex-end", justifyContent: "center", gap: 18 * u })}>
            {view.agent.brokerageLogoUrl ? <Logo url={view.agent.brokerageLogoUrl} size={120 * u} view={view} /> : null}
            {credit ? <Text style={{ fontFamily: t.body, fontSize: 28 * u, color: muted, lineHeight: 1.2 }}>{credit}</Text> : null}
          </div>
        ) : !agent && credit && input.qr ? (
          <Text style={{ fontFamily: t.body, fontSize: 28 * u, color: muted, lineHeight: 1.2 }}>{credit}</Text>
        ) : null}
        {input.qr ? (
          <div style={col({ alignItems: "center", gap: 12 * u })}>
            <div style={flex({ padding: 14 * u, background: "#FFFFFF", borderRadius: 12 * u })}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={input.qr} alt="" width={qrSize} height={qrSize} style={{ width: qrSize, height: qrSize }} />
            </div>
            <Text style={{ fontFamily: t.body, fontWeight: 600, fontSize: 24 * u, letterSpacing: 3 * u, textTransform: "uppercase", color: muted, lineHeight: 1 }}>Scan for details</Text>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function hasFlyerText(input: SocialRenderInput): boolean {
  const cfg = input.flyer ?? DEFAULT_FLYER;
  return Boolean((cfg.showDescription && input.view.property.description.trim()) || (cfg.showHighlights && input.view.property.highlights.some((h) => h.trim())));
}

/** Classic Grid: cover photo, title, facts, a 3-column photo grid, then details. */
function FlyerGrid(input: SocialRenderInput, k: FlyerKit) {
  const { width, height, view } = input;
  const { u } = k;
  const pad = 120 * u;
  const inner = width - pad * 2;
  const gap = 56 * u;
  const footH = flyerFooterHeight(input) * u;
  const photos = input.supporting.slice(0, 6);
  const text = hasFlyerText(input);
  const heroH = (!photos.length ? 1400 : text ? 1000 : 1200) * u;
  const titleH = 236 * u;
  const factsH = view.facts.length ? 190 * u : 0;
  const body = height - heroH - footH - 76 * u - 70 * u;
  const blocks = [titleH, factsH, photos.length ? 1 : 0, text ? 1 : 0].filter(Boolean).length;
  const free = body - titleH - factsH - gap * (blocks - 1);
  const rows = Math.ceil(photos.length / 3);
  const gridH = photos.length ? Math.min(text ? free - 300 * u : free, rows * (text ? 600 : 900) * u) : 0;
  const textH = free - gridH;
  return (
    <div style={col({ width, height, background: k.pageBg })}>
      <FlyerHero input={input} k={k} height={heroH} />
      <div style={col({ width, height: height - heroH - footH, padding: `${76 * u}px ${pad}px ${70 * u}px`, gap, justifyContent: text ? "flex-start" : "center" })}>
        <TitleBlock input={input} k={k} width={inner} />
        {factsH ? <FactsBar input={input} k={k} width={inner} height={factsH} /> : null}
        {photos.length ? <PhotoGrid srcs={photos} width={inner} height={gridH} cols={Math.min(3, photos.length === 4 ? 2 : 3)} gap={28 * u} radius={k.radius} /> : null}
        {text && textH > 120 * u ? <FlyerText input={input} k={k} width={inner} height={textH} /> : null}
      </div>
      <FlyerFooter input={input} k={k} height={footH} />
    </div>
  );
}

/** Large + Grid: cover photo, details column beside a large photo and a 2 × 2 grid. */
function FlyerShowcase(input: SocialRenderInput, k: FlyerKit) {
  const { width, height } = input;
  const { u } = k;
  const pad = 120 * u;
  const inner = width - pad * 2;
  const footH = flyerFooterHeight(input) * u;
  const photos = input.supporting.slice(0, 5);
  // Nothing to put in the details column: the classic grid uses the page better.
  if (!input.view.facts.length && !hasFlyerText(input)) return FlyerGrid({ ...input, supporting: photos }, k);
  const heroH = 1180 * u;
  const bodyH = height - heroH - footH - 80 * u - 76 * u;
  const colGap = 80 * u;
  const infoW = photos.length ? 960 * u : inner;
  const photoW = inner - infoW - colGap;
  const g = 28 * u;
  const largeH = photos.length > 1 ? Math.round(bodyH * 0.5) : bodyH;
  const facts = input.view.facts.length;
  const factsH = facts ? (Math.ceil(Math.min(facts, 6) / 2) * 140 + 34) * u : 0;
  const v = input.view;
  const addrLines = clampText(v.property.address || "Your Listing", 48).length > 17 ? 2 : 1;
  const titleH = (addrLines * 104 + (v.property.locality ? 72 : 0) + (v.priceText ? 112 : 0) + 10) * u;
  const textH = bodyH - titleH - factsH - 50 * u * (facts ? 2 : 1);
  return (
    <div style={col({ width, height, background: k.pageBg })}>
      <FlyerHero input={input} k={k} height={heroH} />
      <div style={flex({ width, height: height - heroH - footH, padding: `${80 * u}px ${pad}px ${76 * u}px`, gap: colGap })}>
        <div style={col({ width: infoW, height: bodyH, gap: 50 * u })}>
          <div style={col({ height: titleH, justifyContent: "flex-start" })}>
            <TitleBlock input={input} k={k} width={infoW} stacked />
          </div>
          {facts ? <FactsList input={input} k={k} width={infoW} /> : null}
          {textH > 160 * u ? <FlyerText input={input} k={k} width={infoW} height={textH} stacked /> : null}
        </div>
        {photos.length ? (
          <div style={col({ width: photoW, height: bodyH, gap: g })}>
            <Photo src={photos[0]!} width={photoW} height={largeH} radius={k.radius} />
            {photos.length > 1 ? <PhotoGrid srcs={photos.slice(1)} width={photoW} height={bodyH - largeH - g} cols={2} gap={g} radius={k.radius} /> : null}
          </div>
        ) : null}
      </div>
      <FlyerFooter input={input} k={k} height={footH} />
    </div>
  );
}

/** Gallery: title over the cover photo, facts, then a 4-column photo wall. */
function FlyerGallery(input: SocialRenderInput, k: FlyerKit) {
  const { width, height, view, style } = input;
  const { u, t } = k;
  const pad = 120 * u;
  const inner = width - pad * 2;
  const gap = 50 * u;
  const footH = flyerFooterHeight(input) * u;
  const photos = input.supporting.slice(0, 8);
  const text = hasFlyerText(input);
  const heroH = (text ? 1260 : 1400) * u;
  const factsH = view.facts.length ? 180 * u : 0;
  const body = height - heroH - footH - 64 * u - 64 * u;
  const blocks = [factsH, photos.length ? 1 : 0, text ? 1 : 0].filter(Boolean).length;
  const free = body - factsH - gap * Math.max(0, blocks - 1);
  const cols = photos.length <= 4 ? Math.max(1, photos.length) : 4;
  const rows = Math.ceil(photos.length / cols);
  const gridH = photos.length ? Math.min(text ? free - 240 * u : free, rows * (text ? 640 : 820) * u) : 0;
  const textH = free - gridH;
  const address = clampText(view.property.address || "Your Listing", 40);
  const overlay = (
    <div
      style={col({
        position: "absolute",
        left: 0,
        bottom: 0,
        width,
        padding: `${200 * u}px ${pad}px ${80 * u}px`,
        gap: 16 * u,
        backgroundImage: "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 45%, rgba(0,0,0,0.78) 100%)",
      })}
    >
      <Text style={{ fontFamily: t.body, fontWeight: 700, fontSize: 36 * u, letterSpacing: 9 * u, textTransform: "uppercase", color: style === "modern" ? "#FFFFFF" : t.rule, lineHeight: 1 }}>{input.headline}</Text>
      <div style={flex({ justifyContent: "space-between", alignItems: "flex-end", gap: 60 * u })}>
        <div style={col({ gap: 12 * u, flex: 1 })}>
          <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: addressSize(address, 120 * u), color: "#FFFFFF", lineHeight: 1.02 }}>{address}</Text>
          {view.property.locality ? <Text style={{ fontFamily: t.body, fontSize: 46 * u, color: "rgba(255,255,255,0.85)", lineHeight: 1.2 }}>{clampText(view.property.locality, 48)}</Text> : null}
        </div>
        {view.priceText ? <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 100 * u, color: "#FFFFFF", lineHeight: 1 }}>{view.priceText}</Text> : null}
      </div>
    </div>
  );
  return (
    <div style={col({ width, height, background: k.pageBg })}>
      <FlyerHero input={input} k={k} height={heroH} overlay={overlay} />
      <div style={col({ width, height: height - heroH - footH, padding: `${64 * u}px ${pad}px ${64 * u}px`, gap, justifyContent: text ? "flex-start" : "center" })}>
        {factsH ? <FactsBar input={input} k={k} width={inner} height={factsH} /> : null}
        {photos.length ? <PhotoGrid srcs={photos} width={inner} height={gridH} cols={cols} gap={24 * u} radius={k.radius} /> : null}
        {text && textH > 120 * u ? <FlyerText input={input} k={k} width={inner} height={textH} /> : null}
      </div>
      <FlyerFooter input={input} k={k} height={footH} />
    </div>
  );
}

function Flyer(input: SocialRenderInput, t: Theme, u: number) {
  const k = flyerKit(input, t, u);
  const layout = (input.flyer ?? DEFAULT_FLYER).layout;
  if (layout === "showcase") return FlyerShowcase(input, k);
  if (layout === "gallery") return FlyerGallery(input, k);
  return FlyerGrid(input, k);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function renderSocialAsset(input: SocialRenderInput) {
  const t = themeFor(input.style, input.view);
  const u = input.width / 1080;
  let body;
  if (input.format === "flyer") {
    body = Flyer(input, t, input.width / 2550);
  } else if (input.format === "carousel" && input.slide) {
    const k = input.slide.kind;
    if (k === "photo") body = PhotoSlide(input, t, u);
    else if (k === "highlights") body = HighlightsLayout({ ...input, headline: "The Details" }, t, u);
    else if (k === "agent") body = AgentSlide(input, t, u);
    else body = feature(input, t, u);
  } else if (input.asset === "sq_highlights") {
    body = HighlightsLayout(input, t, u);
  } else {
    body = feature(input, t, u);
  }
  return (
    <div style={flex({ position: "relative", width: input.width, height: input.height, overflow: "hidden", background: t.bg })}>
      {body}
      {input.watermark ? <Watermark width={input.width} height={input.height} /> : null}
    </div>
  );
}

function feature(input: SocialRenderInput, t: Theme, u: number) {
  if (input.style === "luxury") return LuxuryFeature(input, t, u);
  if (input.style === "coastal") return CoastalFeature(input, t, u);
  return ModernFeature(input, t, u);
}
