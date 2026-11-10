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
import { clampText, type CarouselSlide, type DesignStyle, type SocialAssetKey } from "@/lib/marketing/model";
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

function Logo({ url, size }: { url: string | null; size: number }) {
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt="" height={size} style={{ height: size, maxWidth: size * 4, objectFit: "contain" }} />;
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
        <div style={flex({ position: "absolute", left: 48 * u, top: (tall ? 140 : 48) * u, padding: `${18 * u}px ${24 * u}px`, background: "rgba(255,255,255,0.94)", borderRadius: 18 * u })}>
          <Logo url={view.branding.logoUrl} size={54 * u} />
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
          <Logo url={view.branding.logoUrl} size={64 * u} />
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
        {!tall && view.branding.logoUrl ? <Logo url={view.branding.logoUrl} size={84 * u} /> : null}
      </div>
      {tall && view.branding.logoUrl ? (
        <div style={flex({ position: "absolute", top: 40 * u, left: 0, width, justifyContent: "center" })}>
          <Logo url={view.branding.logoUrl} size={60 * u} />
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
          <Logo url={view.agent.brokerageLogoUrl ?? view.branding.logoUrl} size={80 * u} />
        </div>
      ) : null}
      {input.slide ? <SlideCounter index={input.slide.index} total={input.slide.total} t={t} u={u} dark={style !== "coastal"} /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Flyer (US Letter, 2550 × 3300 at 300 dpi)
// ---------------------------------------------------------------------------

function Flyer(input: SocialRenderInput, t: Theme, u: number) {
  const { width, height, view, style } = input;
  const pad = 130 * u;
  const inner = width - pad * 2;
  const heroH = 1180 * u;
  const thumbs = input.supporting.slice(0, 3);
  const gap = 36 * u;
  const thumbW = (inner - gap * 2) / 3;
  const thumbH = 470 * u;
  const desc = clampText(view.property.description || "", 520);
  const highlights = view.property.highlights.slice(0, 6).map((h) => clampText(h, 44));
  const light = style !== "luxury";
  const accent = style === "modern" ? view.branding.primary : t.rule;
  return (
    <div style={col({ width, height, background: light ? "#FFFFFF" : t.bg })}>
      <div style={flex({ position: "relative", width, height: heroH + 110 * u })}>
        <Photo src={input.photo} width={width} height={heroH + 110 * u} />
        <div
          style={flex({
            position: "absolute",
            left: pad,
            bottom: 0,
            padding: `${34 * u}px ${54 * u}px`,
            background: style === "modern" ? view.branding.primary : style === "coastal" ? "#F4EEE3" : t.bg,
            borderTopLeftRadius: style === "coastal" ? 36 * u : 0,
            borderTopRightRadius: style === "coastal" ? 36 * u : 0,
            fontFamily: t.body,
            fontWeight: 700,
            fontSize: 44 * u,
            letterSpacing: 10 * u,
            textTransform: "uppercase",
            color: style === "modern" ? view.branding.onPrimary : t.rule,
          })}
        >
          {input.headline}
        </div>
        {view.branding.logoUrl ? (
          <div style={flex({ position: "absolute", right: pad, top: 90 * u, padding: `${28 * u}px ${36 * u}px`, background: "rgba(255,255,255,0.94)", borderRadius: 20 * u })}>
            <Logo url={view.branding.logoUrl} size={110 * u} />
          </div>
        ) : null}
      </div>
      <div style={col({ flex: 1, padding: `${80 * u}px ${pad}px ${70 * u}px`, gap: 48 * u })}>
        <div style={flex({ justifyContent: "space-between", alignItems: "flex-end", gap: 60 * u })}>
          <div style={col({ gap: 14 * u, flex: 1 })}>
            <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: (style === "luxury" ? 150 : 128) * u, color: light ? t.ink : t.ink, lineHeight: 1.0, letterSpacing: style === "modern" ? -3 * u : 0 }}>
              {clampText(view.property.address || "Your Listing", 30)}
            </Text>
            {view.property.locality ? (
              <Text style={{ fontFamily: t.body, fontSize: 56 * u, color: t.muted, lineHeight: 1.2, letterSpacing: style === "luxury" ? 6 * u : 0, textTransform: style === "luxury" ? "uppercase" : "none" }}>
                {clampText(view.property.locality, 48)}
              </Text>
            ) : null}
          </div>
          {view.priceText ? (
            <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 112 * u, color: accent, lineHeight: 1 }}>{view.priceText}</Text>
          ) : null}
        </div>
        {view.facts.length ? (
          <div style={flex({ gap: 0, borderTop: `${4 * u}px solid ${light ? "#E5E7EB" : "rgba(255,255,255,0.18)"}`, borderBottom: `${4 * u}px solid ${light ? "#E5E7EB" : "rgba(255,255,255,0.18)"}` })}>
            {view.facts.slice(0, 5).map((f, i) => (
              <div key={i} style={col({ flex: 1, alignItems: "center", padding: `${34 * u}px 0`, borderLeft: i ? `${4 * u}px solid ${light ? "#E5E7EB" : "rgba(255,255,255,0.18)"}` : "none" })}>
                <Text style={{ fontFamily: t.head, fontWeight: t.headWeight, fontSize: 84 * u, color: t.ink, lineHeight: 1.05 }}>{f.value}</Text>
                <Text style={{ fontFamily: t.body, fontSize: 38 * u, letterSpacing: 4 * u, textTransform: "uppercase", color: t.muted, lineHeight: 1.2 }}>{f.label}</Text>
              </div>
            ))}
          </div>
        ) : null}
        {thumbs.length ? (
          <div style={flex({ gap })}>
            {thumbs.map((src, i) => (
              <Photo key={i} src={src} width={thumbW} height={thumbH} radius={style === "coastal" ? 28 * u : style === "modern" ? 16 * u : 0} />
            ))}
          </div>
        ) : null}
        <div style={flex({ gap: 80 * u, flex: 1 })}>
          {desc ? (
            <Text style={{ flex: 1.4, fontFamily: t.body, fontSize: 44 * u, color: light ? "#374151" : t.muted, lineHeight: 1.5 }}>{desc}</Text>
          ) : null}
          {highlights.length ? (
            <div style={col({ flex: 1, gap: 22 * u })}>
              {highlights.map((h, i) => (
                <div key={i} style={flex({ alignItems: "center", gap: 24 * u })}>
                  <div style={flex({ width: 18 * u, height: 18 * u, borderRadius: style === "luxury" ? 0 : 9 * u, background: accent, ...(style === "luxury" ? { transform: "rotate(45deg)" } : {}) })} />
                  <Text style={{ fontFamily: t.body, fontSize: 42 * u, color: t.ink, lineHeight: 1.3 }}>{h}</Text>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <div style={flex({ justifyContent: "space-between", alignItems: "center", padding: `${56 * u}px ${pad}px`, background: style === "modern" ? "#F1F5F9" : style === "coastal" ? "#F4EEE3" : "#141416" })}>
        {view.showAgent ? <AgentRow view={view} t={t} u={u * 2.1} dark={!light} /> : <div style={flex({})} />}
        <div style={col({ alignItems: "flex-end", gap: 10 * u })}>
          {view.agent.brokerageLogoUrl && view.showAgent ? <Logo url={view.agent.brokerageLogoUrl} size={110 * u} /> : null}
          {view.photographerCredit && view.businessName ? (
            <Text style={{ fontFamily: t.body, fontSize: 30 * u, color: t.muted, lineHeight: 1.2 }}>{`Photography by ${clampText(view.businessName, 40)}`}</Text>
          ) : null}
        </div>
      </div>
    </div>
  );
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
