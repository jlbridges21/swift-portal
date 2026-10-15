import type { BlogCoverTint, BlogCoverVariant } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

/**
 * Original vector cover art for blog articles. Shares one navy/indigo
 * backdrop so the set reads as a family, with a distinct motif per variant.
 * Pure SVG: no network requests, no layout shift (fixed aspect ratio).
 */
export function BlogCoverArt({
  variant,
  idPrefix,
  label,
  className,
  title,
  anchor = "center",
  tint = "indigo",
}: {
  variant: BlogCoverVariant;
  /** Unique per instance on a page; keeps gradient ids from colliding. */
  idPrefix: string;
  label?: string;
  className?: string;
  /** Accessible name. Omit for decorative usage (e.g. cards with their own title). */
  title?: string;
  /** Which edge to keep when the box is taller than 16:9 and the art is cropped. */
  anchor?: "center" | "left";
  /** Accent palette, so articles that share a motif still look distinct. */
  tint?: BlogCoverTint;
}) {
  const p = idPrefix.replace(/[^a-zA-Z0-9_-]/g, "");
  const c = TINTS[tint];
  return (
    <svg
      viewBox="0 0 1200 675"
      className={cn("block h-auto w-full", className)}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      preserveAspectRatio={anchor === "left" ? "xMinYMid slice" : "xMidYMid slice"}
    >
      <defs>
        <linearGradient id={`${p}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B1124" />
          <stop offset="1" stopColor="#151B3B" />
        </linearGradient>
        <radialGradient id={`${p}-glow-a`} cx="0.82" cy="0.18" r="0.6">
          <stop offset="0" stopColor={c.glowA} stopOpacity="0.55" />
          <stop offset="1" stopColor={c.glowA} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}-glow-b`} cx="0.12" cy="0.95" r="0.55">
          <stop offset="0" stopColor={c.glowB} stopOpacity="0.4" />
          <stop offset="1" stopColor={c.glowB} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}-brand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c.brandA} />
          <stop offset="1" stopColor={c.brandB} />
        </linearGradient>
        <linearGradient id={`${p}-card`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.14" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0.05" />
        </linearGradient>
        <pattern id={`${p}-grid`} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke="#FFFFFF" strokeOpacity="0.05" />
        </pattern>
      </defs>
      <rect width="1200" height="675" fill={`url(#${p}-bg)`} />
      <rect width="1200" height="675" fill={`url(#${p}-grid)`} />
      <rect width="1200" height="675" fill={`url(#${p}-glow-a)`} />
      <rect width="1200" height="675" fill={`url(#${p}-glow-b)`} />
      <Motif variant={variant} p={p} />
      {label ? (
        <g>
          <rect x="64" y="64" rx="20" height="40" width={label.length * 11.5 + 44} fill="#FFFFFF" fillOpacity="0.1" stroke="#FFFFFF" strokeOpacity="0.18" />
          <text x="86" y="90" fill="#E0E7FF" fontSize="18" fontWeight="600" fontFamily="Inter, ui-sans-serif, system-ui, sans-serif" letterSpacing="1.5">
            {label.toUpperCase()}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

const TINTS: Record<BlogCoverTint, { glowA: string; glowB: string; brandA: string; brandB: string }> = {
  indigo: { glowA: "#6366F1", glowB: "#8B5CF6", brandA: "#6366F1", brandB: "#A855F7" },
  teal: { glowA: "#14B8A6", glowB: "#6366F1", brandA: "#0EA5E9", brandB: "#6366F1" },
  amber: { glowA: "#F59E0B", glowB: "#8B5CF6", brandA: "#F59E0B", brandB: "#EC4899" },
  emerald: { glowA: "#10B981", glowB: "#6366F1", brandA: "#10B981", brandB: "#6366F1" },
  rose: { glowA: "#F43F5E", glowB: "#8B5CF6", brandA: "#F43F5E", brandB: "#A855F7" },
};

const card = (p: string) => ({ fill: `url(#${p}-card)`, stroke: "#FFFFFF", strokeOpacity: 0.16 });

function Motif({ variant, p }: { variant: BlogCoverVariant; p: string }) {
  switch (variant) {
    case "ranking":
      return (
        <g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i} transform={`translate(${300 + i * 26} ${170 + i * 104})`}>
              <rect width={600 - i * 52} height="84" rx="18" {...card(p)} />
              <circle cx="46" cy="42" r="22" fill={i === 0 ? `url(#${p}-brand)` : "#FFFFFF"} fillOpacity={i === 0 ? 1 : 0.12} />
              <text x="46" y="50" textAnchor="middle" fill="#FFFFFF" fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">
                {i + 1}
              </text>
              <rect x="92" y="26" width={260 - i * 30} height="12" rx="6" fill="#FFFFFF" fillOpacity="0.75" />
              <rect x="92" y="50" width={180 - i * 20} height="9" rx="4.5" fill="#FFFFFF" fillOpacity="0.3" />
              {[0, 1, 2, 3, 4].map((s) => (
                <rect key={s} x={420 - i * 52 + s * 24} y="34" width="16" height="16" rx="4" fill={s < 5 - i ? "#A5B4FC" : "#FFFFFF"} fillOpacity={s < 5 - i ? 0.9 : 0.12} />
              ))}
            </g>
          ))}
          <circle cx="960" cy="150" r="10" fill="#A5B4FC" className="mk-pulse" />
        </g>
      );
    case "drone":
      return (
        <g>
          <path d="M140 560 C 360 420, 560 600, 760 430 S 1060 300, 1100 220" fill="none" stroke="#A5B4FC" strokeOpacity="0.6" strokeWidth="3" className="mk-flow-line" />
          <g transform="translate(250 390)" opacity="0.9">
            <path d="M0 120 L120 40 L240 120 V230 H0 Z" {...card(p)} strokeWidth="2" />
            <rect x="96" y="150" width="48" height="80" rx="6" fill="#FFFFFF" fillOpacity="0.2" />
            <rect x="30" y="140" width="44" height="38" rx="6" fill="#A5B4FC" fillOpacity="0.35" />
            <rect x="166" y="140" width="44" height="38" rx="6" fill="#A5B4FC" fillOpacity="0.35" />
          </g>
          <g transform="translate(720 230)" className="mk-float">
            {[[-120, -70], [120, -70], [-120, 70], [120, 70]].map(([x, y]) => (
              <g key={`${x}${y}`}>
                <line x1="0" y1="0" x2={x} y2={y} stroke="#E0E7FF" strokeOpacity="0.8" strokeWidth="10" strokeLinecap="round" />
                <ellipse cx={x} cy={y} rx="62" ry="14" fill="#C7D2FE" fillOpacity="0.28" />
                <circle cx={x} cy={y} r="12" fill="#E0E7FF" />
              </g>
            ))}
            <rect x="-62" y="-40" width="124" height="80" rx="26" fill={`url(#${p}-brand)`} />
            <circle cx="0" cy="56" r="16" fill="#0B1124" stroke="#E0E7FF" strokeWidth="4" />
          </g>
          <path d="M720 300 L560 520 L880 520 Z" fill="#A5B4FC" fillOpacity="0.08" />
        </g>
      );
    case "swap":
      return (
        <g>
          <g transform="translate(220 200)">
            <rect width="300" height="300" rx="48" {...card(p)} strokeWidth="2" />
            <rect x="60" y="70" width="180" height="16" rx="8" fill="#FFFFFF" fillOpacity="0.5" />
            <rect x="60" y="110" width="120" height="12" rx="6" fill="#FFFFFF" fillOpacity="0.25" />
            <rect x="60" y="170" width="180" height="70" rx="14" fill="#FFFFFF" fillOpacity="0.1" />
          </g>
          <g transform="translate(680 200)">
            <rect width="300" height="300" rx="48" fill={`url(#${p}-brand)`} />
            <rect x="60" y="70" width="180" height="16" rx="8" fill="#FFFFFF" fillOpacity="0.9" />
            <rect x="60" y="110" width="120" height="12" rx="6" fill="#FFFFFF" fillOpacity="0.55" />
            <rect x="60" y="170" width="180" height="70" rx="14" fill="#FFFFFF" fillOpacity="0.2" />
          </g>
          <path d="M545 300 H 655" stroke="#E0E7FF" strokeWidth="6" strokeLinecap="round" className="mk-flow-line" />
          <path d="M640 284 L660 300 L640 316" fill="none" stroke="#E0E7FF" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M655 400 H 545" stroke="#A5B4FC" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" className="mk-flow-line" />
          <path d="M560 384 L540 400 L560 416" fill="none" stroke="#A5B4FC" strokeOpacity="0.6" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      );
    case "delivery":
      return (
        <g>
          <g transform="translate(250 150)">
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect key={`${r}-${c}`} x={c * 142} y={r * 112} width="128" height="98" rx="14" fill={(r + c) % 3 === 0 ? `url(#${p}-brand)` : "#FFFFFF"} fillOpacity={(r + c) % 3 === 0 ? 0.75 : 0.12} stroke="#FFFFFF" strokeOpacity="0.14" />
              ))
            )}
            <path d="M28 300 l30 -36 l24 24 l18 -20 l28 32 Z" fill="#FFFFFF" fillOpacity="0.4" transform="translate(142 -224)" />
          </g>
          <g transform="translate(900 380)" className="mk-float">
            <circle r="74" fill={`url(#${p}-brand)`} />
            <path d="M0 -32 V22 M-24 0 L0 24 L24 0" fill="none" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
            <path d="M-28 40 H28" stroke="#FFFFFF" strokeWidth="9" strokeLinecap="round" />
          </g>
        </g>
      );
    case "crm":
      return (
        <g>
          <g stroke="#A5B4FC" strokeOpacity="0.45" strokeWidth="3">
            <line x1="600" y1="340" x2="330" y2="200" className="mk-flow-line" />
            <line x1="600" y1="340" x2="330" y2="480" className="mk-flow-line" />
            <line x1="600" y1="340" x2="880" y2="200" className="mk-flow-line" />
            <line x1="600" y1="340" x2="880" y2="480" className="mk-flow-line" />
          </g>
          {[[330, 200], [330, 480], [880, 200], [880, 480]].map(([x, y]) => (
            <g key={`${x}${y}`} transform={`translate(${x - 120} ${y - 46})`}>
              <rect width="240" height="92" rx="20" {...card(p)} />
              <circle cx="46" cy="46" r="24" fill="#FFFFFF" fillOpacity="0.2" />
              <rect x="84" y="30" width="120" height="12" rx="6" fill="#FFFFFF" fillOpacity="0.7" />
              <rect x="84" y="52" width="80" height="9" rx="4.5" fill="#FFFFFF" fillOpacity="0.3" />
            </g>
          ))}
          <circle cx="600" cy="340" r="78" fill={`url(#${p}-brand)`} />
          <circle cx="600" cy="318" r="22" fill="#FFFFFF" fillOpacity="0.9" />
          <path d="M556 384 a44 34 0 0 1 88 0" fill="#FFFFFF" fillOpacity="0.9" />
        </g>
      );
    case "portal":
      return (
        <g>
          <g transform="translate(260 120)">
            <rect width="680" height="460" rx="28" {...card(p)} strokeWidth="2" />
            <rect width="680" height="56" rx="28" fill="#FFFFFF" fillOpacity="0.08" />
            {[0, 1, 2].map((i) => (
              <circle key={i} cx={36 + i * 26} cy="28" r="7" fill="#FFFFFF" fillOpacity="0.3" />
            ))}
            <rect x="150" y="18" width="380" height="20" rx="10" fill="#FFFFFF" fillOpacity="0.12" />
            {[0, 1, 2, 3, 4].map((i) => (
              <g key={i} transform={`translate(48 ${88 + i * 70})`}>
                <rect width="584" height="54" rx="14" fill={i < 3 ? "#22C55E" : "#FFFFFF"} fillOpacity={i < 3 ? 0.12 : 0.06} stroke={i === 3 ? "#A5B4FC" : "#FFFFFF"} strokeOpacity={i === 3 ? 0.9 : 0.1} strokeWidth={i === 3 ? 2 : 1} />
                <circle cx="30" cy="27" r="12" fill={i < 3 ? "#22C55E" : i === 3 ? "#818CF8" : "#FFFFFF"} fillOpacity={i < 4 ? 1 : 0.2} className={i === 3 ? "mk-pulse" : undefined} />
                <rect x="60" y="20" width={220 - i * 18} height="12" rx="6" fill="#FFFFFF" fillOpacity="0.6" />
              </g>
            ))}
          </g>
        </g>
      );
    case "media":
      return (
        <g>
          <g transform="translate(180 170) rotate(-6)">
            <rect width="420" height="300" rx="22" fill="#FFFFFF" fillOpacity="0.12" stroke="#FFFFFF" strokeOpacity="0.2" />
            <path d="M40 250 L150 130 L230 210 L290 150 L380 250 Z" fill="#A5B4FC" fillOpacity="0.35" />
            <circle cx="320" cy="80" r="26" fill="#FDE68A" fillOpacity="0.7" />
          </g>
          <g transform="translate(560 200)">
            <rect width="480" height="290" rx="22" fill={`url(#${p}-brand)`} />
            <circle cx="240" cy="132" r="48" fill="#FFFFFF" fillOpacity="0.25" />
            <path d="M226 108 L262 132 L226 156 Z" fill="#FFFFFF" />
            <rect x="32" y="240" width="416" height="8" rx="4" fill="#FFFFFF" fillOpacity="0.3" />
            <rect x="32" y="240" width="170" height="8" rx="4" fill="#FFFFFF" />
            {[90, 150, 300].map((x) => (
              <circle key={x} cx={32 + x} cy="244" r="9" fill="#FDE68A" stroke="#0B1124" strokeWidth="3" />
            ))}
          </g>
        </g>
      );
    case "calendar":
      return (
        <g>
          <g transform="translate(300 130)">
            <rect width="600" height="440" rx="30" {...card(p)} strokeWidth="2" />
            <rect width="600" height="80" rx="30" fill={`url(#${p}-brand)`} />
            <rect y="50" width="600" height="30" fill={`url(#${p}-brand)`} />
            {[0, 1, 2, 3, 4].map((r) =>
              [0, 1, 2, 3, 4, 5, 6].map((c) => {
                const booked = (r * 7 + c) % 5 === 2 || (r === 2 && c === 4);
                return (
                  <rect key={`${r}-${c}`} x={30 + c * 80} y={104 + r * 64} width="62" height="48" rx="10" fill={booked ? "#818CF8" : "#FFFFFF"} fillOpacity={booked ? 0.85 : 0.07} className={r === 2 && c === 4 ? "mk-pulse" : undefined} />
                );
              })
            )}
          </g>
        </g>
      );
    case "layers":
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(600 ${430 - i * 110})`}>
              <path
                d="M0 -90 L300 0 L0 90 L-300 0 Z"
                fill={i === 2 ? `url(#${p}-brand)` : "#FFFFFF"}
                fillOpacity={i === 2 ? 0.9 : 0.08 + i * 0.05}
                stroke="#FFFFFF"
                strokeOpacity="0.22"
                strokeWidth="2"
                className={i === 2 ? "mk-float" : undefined}
              />
            </g>
          ))}
          {[[-170, 350], [170, 350], [0, 300]].map(([x, y]) => (
            <rect key={`${x}${y}`} x={600 + x - 34} y={y - 22} width="68" height="44" rx="8" fill="#A5B4FC" fillOpacity="0.45" />
          ))}
          <circle cx="600" cy="210" r="16" fill="#FFFFFF" className="mk-pulse" />
        </g>
      );
    case "automation":
      return (
        <g>
          {[[300, 230], [600, 160], [900, 230], [300, 470], [600, 540], [900, 470]].map(([x, y], i, arr) => {
            const [nx, ny] = arr[(i + 1) % arr.length]!;
            return <line key={i} x1={x} y1={y} x2={nx} y2={ny} stroke="#A5B4FC" strokeOpacity="0.5" strokeWidth="4" className="mk-flow-line" />;
          })}
          {[[300, 230], [600, 160], [900, 230], [300, 470], [600, 540], [900, 470]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle r="46" fill={i === 1 ? `url(#${p}-brand)` : `url(#${p}-card)`} stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="2" />
              <circle r="12" fill="#FFFFFF" fillOpacity={i === 1 ? 0.95 : 0.45} className={i === 4 ? "mk-pulse" : undefined} />
            </g>
          ))}
          <g transform="translate(600 350)">
            <circle r="92" fill="none" stroke={`url(#${p}-brand)`} strokeWidth="18" strokeDasharray="34 20" />
            <circle r="52" fill={`url(#${p}-brand)`} />
            <path d="M-14 -22 L22 0 L-14 22 Z" fill="#FFFFFF" />
          </g>
        </g>
      );
    case "bigfile":
      return (
        <g>
          <g transform="translate(260 150)">
            <path d="M0 0 H260 L340 80 V380 H0 Z" {...card(p)} strokeWidth="2" />
            <path d="M260 0 V80 H340" fill="none" stroke="#FFFFFF" strokeOpacity="0.25" strokeWidth="2" />
            <rect x="40" y="130" width="260" height="150" rx="16" fill={`url(#${p}-brand)`} />
            <path d="M150 175 L195 205 L150 235 Z" fill="#FFFFFF" />
            <rect x="40" y="310" width="180" height="14" rx="7" fill="#FFFFFF" fillOpacity="0.6" />
          </g>
          <g transform="translate(680 300)">
            <text x="0" y="0" fill="#FFFFFF" fontSize="96" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="-3">48 GB</text>
            <rect x="0" y="50" width="420" height="22" rx="11" fill="#FFFFFF" fillOpacity="0.12" />
            <rect x="0" y="50" width="290" height="22" rx="11" fill={`url(#${p}-brand)`} className="mk-pulse" />
            <text x="0" y="120" fill="#C7D2FE" fontSize="26" fontFamily="Inter, sans-serif">4K master · uploading</text>
          </g>
        </g>
      );
    case "folders":
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${190 + i * 290} ${210 + (i === 2 ? -40 : 0)})`}>
              <path d="M0 40 Q0 20 20 20 H95 L125 50 H230 Q250 50 250 70 V250 Q250 270 230 270 H20 Q0 270 0 250 Z" fill={i === 2 ? `url(#${p}-brand)` : `url(#${p}-card)`} stroke="#FFFFFF" strokeOpacity="0.2" strokeWidth="2" />
              {i === 2 ? (
                <g>
                  <rect x="40" y="100" width="70" height="56" rx="8" fill="#FFFFFF" fillOpacity="0.85" />
                  <rect x="122" y="100" width="70" height="56" rx="8" fill="#FFFFFF" fillOpacity="0.6" />
                  <rect x="40" y="170" width="152" height="14" rx="7" fill="#FFFFFF" fillOpacity="0.8" />
                  <circle cx="210" cy="230" r="18" fill="#FFFFFF" className="mk-pulse" />
                </g>
              ) : (
                <g>
                  {[0, 1, 2].map((r) => (
                    <rect key={r} x="40" y={100 + r * 40} width={170 - r * 30} height="14" rx="7" fill="#FFFFFF" fillOpacity="0.3" />
                  ))}
                </g>
              )}
            </g>
          ))}
        </g>
      );
    case "invoice":
      return (
        <g>
          <g transform="translate(330 110)">
            <rect width="380" height="470" rx="26" fill="#FFFFFF" fillOpacity="0.95" />
            <rect x="36" y="40" width="140" height="18" rx="9" fill="#0F172A" fillOpacity="0.85" />
            <rect x="36" y="72" width="90" height="12" rx="6" fill="#64748B" fillOpacity="0.6" />
            {[0, 1, 2, 3].map((r) => (
              <g key={r} transform={`translate(36 ${140 + r * 52})`}>
                <rect width="190" height="12" rx="6" fill="#94A3B8" fillOpacity="0.7" />
                <rect x="250" width="58" height="12" rx="6" fill="#475569" fillOpacity="0.7" />
              </g>
            ))}
            <rect x="36" y="370" width="308" height="2" fill="#E2E8F0" />
            <rect x="36" y="396" width="110" height="18" rx="9" fill="#0F172A" />
            <rect x="234" y="390" width="110" height="30" rx="10" fill={`url(#${p}-brand)`} />
          </g>
          <g transform="translate(800 400)" className="mk-float">
            <circle r="86" fill={`url(#${p}-brand)`} />
            <path d="M-34 2 L-8 28 L38 -26" fill="none" stroke="#FFFFFF" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
          </g>
        </g>
      );
    case "timeline":
      return (
        <g>
          {[0, 1, 2, 3].map((col) => (
            <g key={col} transform={`translate(${190 + col * 220} 140)`}>
              <rect width="190" height="420" rx="22" fill="#FFFFFF" fillOpacity="0.05" stroke="#FFFFFF" strokeOpacity="0.12" />
              <rect x="22" y="24" width="90" height="12" rx="6" fill="#C7D2FE" fillOpacity="0.7" />
              {Array.from({ length: 3 - (col % 2) }).map((_, r) => (
                <rect key={r} x="16" y={62 + r * 94} width="158" height="78" rx="14" fill={col === 2 && r === 0 ? `url(#${p}-brand)` : "#FFFFFF"} fillOpacity={col === 2 && r === 0 ? 1 : 0.12} className={col === 2 && r === 0 ? "mk-float" : undefined} />
              ))}
            </g>
          ))}
        </g>
      );
    case "review":
      return (
        <g>
          <g transform="translate(200 130)">
            <rect width="800" height="380" rx="26" fill={`url(#${p}-brand)`} fillOpacity="0.9" />
            <circle cx="400" cy="190" r="56" fill="#FFFFFF" fillOpacity="0.25" />
            <path d="M384 162 L426 190 L384 218 Z" fill="#FFFFFF" />
            <circle cx="560" cy="130" r="16" fill="#FDE68A" stroke="#0B1124" strokeWidth="4" className="mk-pulse" />
          </g>
          <rect x="200" y="550" width="800" height="12" rx="6" fill="#FFFFFF" fillOpacity="0.15" />
          <rect x="200" y="550" width="380" height="12" rx="6" fill="#C7D2FE" />
          {[260, 470, 760].map((x) => (
            <g key={x}>
              <circle cx={x} cy="556" r="14" fill="#FDE68A" stroke="#0B1124" strokeWidth="4" />
              <rect x={x - 70} y="590" width="140" height="34" rx="10" fill="#FFFFFF" fillOpacity="0.1" />
            </g>
          ))}
        </g>
      );
    case "pricetag":
      return (
        <g>
          <g transform="translate(330 150) rotate(-12 260 190)">
            <path d="M0 40 Q0 0 40 0 H420 L540 190 L420 380 H40 Q0 380 0 340 Z" fill={`url(#${p}-brand)`} />
            <circle cx="440" cy="190" r="26" fill="#0B1124" />
            <text x="70" y="230" fill="#FFFFFF" fontSize="140" fontWeight="700" fontFamily="Inter, sans-serif" letterSpacing="-6">$$$</text>
          </g>
          {[[230, 520], [960, 180], [1000, 520]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={22 - i * 4} fill="#FFFFFF" fillOpacity="0.25" className="mk-pulse" />
          ))}
        </g>
      );
    case "checklist":
      return (
        <g>
          <g transform="translate(350 110)">
            <rect width="500" height="470" rx="28" {...card(p)} strokeWidth="2" />
            {[0, 1, 2, 3, 4].map((r) => (
              <g key={r} transform={`translate(44 ${48 + r * 82})`}>
                <rect width="46" height="46" rx="12" fill={r < 3 ? `url(#${p}-brand)` : "#FFFFFF"} fillOpacity={r < 3 ? 1 : 0.12} stroke="#FFFFFF" strokeOpacity="0.25" />
                {r < 3 ? <path d="M12 24 L20 32 L35 15" fill="none" stroke="#FFFFFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" /> : null}
                <rect x="70" y="16" width={300 - r * 34} height="14" rx="7" fill="#FFFFFF" fillOpacity={r < 3 ? 0.75 : 0.3} />
              </g>
            ))}
          </g>
          <g transform="translate(930 200)" className="mk-float">
            <line x1="-60" y1="-34" x2="60" y2="34" stroke="#E0E7FF" strokeWidth="8" strokeLinecap="round" />
            <line x1="60" y1="-34" x2="-60" y2="34" stroke="#E0E7FF" strokeWidth="8" strokeLinecap="round" />
            <rect x="-30" y="-20" width="60" height="40" rx="14" fill={`url(#${p}-brand)`} />
          </g>
        </g>
      );
    case "roadmap":
      return (
        <g>
          <path d="M150 560 C 350 560, 330 360, 560 360 S 820 170, 1060 170" fill="none" stroke={`url(#${p}-brand)`} strokeWidth="14" strokeLinecap="round" />
          <path d="M150 560 C 350 560, 330 360, 560 360 S 820 170, 1060 170" fill="none" stroke="#FFFFFF" strokeOpacity="0.5" strokeWidth="3" className="mk-flow-line" />
          {[[150, 560], [420, 420], [700, 290], [1060, 170]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle r="34" fill="#0B1124" stroke="#C7D2FE" strokeWidth="5" />
              <text y="11" textAnchor="middle" fill="#FFFFFF" fontSize="30" fontWeight="700" fontFamily="Inter, sans-serif">{i + 1}</text>
            </g>
          ))}
          <g transform="translate(1060 100)">
            <line x1="0" y1="36" x2="0" y2="-40" stroke="#E0E7FF" strokeWidth="5" />
            <path d="M0 -40 H56 L44 -24 L56 -8 H0 Z" fill="#FDE68A" />
          </g>
        </g>
      );
    case "funnel":
      return (
        <g>
          {[0, 1, 2, 3].map((i) => {
            const w = 640 - i * 140;
            return (
              <g key={i} transform={`translate(${600 - w / 2} ${140 + i * 110})`}>
                <path d={`M0 0 H${w} L${w - 60} 92 H60 Z`} fill={i === 3 ? `url(#${p}-brand)` : "#FFFFFF"} fillOpacity={i === 3 ? 1 : 0.08 + i * 0.05} stroke="#FFFFFF" strokeOpacity="0.2" />
              </g>
            );
          })}
          {[[380, 110], [520, 90], [700, 100], [820, 120]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="12" fill="#C7D2FE" className="mk-pulse" style={{ animationDelay: `${i * 300}ms` }} />
          ))}
          <circle cx="600" cy="600" r="20" fill="#FDE68A" />
        </g>
      );
    case "versus":
      return (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${170 + i * 300} ${150 + (i === 0 ? -20 : 0)})`}>
              <rect width="260" height="400" rx="26" fill={i === 0 ? `url(#${p}-brand)` : `url(#${p}-card)`} stroke="#FFFFFF" strokeOpacity="0.18" />
              <rect x="40" y="48" width="140" height="16" rx="8" fill="#FFFFFF" fillOpacity={i === 0 ? 0.95 : 0.6} />
              {[0, 1, 2, 3, 4].map((r) => (
                <g key={r} transform={`translate(40 ${110 + r * 52})`}>
                  <circle cx="10" cy="10" r="10" fill="#FFFFFF" fillOpacity={i === 0 ? 0.9 : 0.35} />
                  <rect x="32" y="4" width={130 - ((r + i) % 3) * 24} height="12" rx="6" fill="#FFFFFF" fillOpacity={i === 0 ? 0.5 : 0.22} />
                </g>
              ))}
            </g>
          ))}
          {[440, 740].map((x) => (
            <g key={x} transform={`translate(${x} 350)`}>
              <circle r="30" fill="#0B1124" stroke="#A5B4FC" strokeWidth="3" />
              <text y="8" textAnchor="middle" fill="#E0E7FF" fontSize="22" fontWeight="700" fontFamily="Inter, sans-serif">
                VS
              </text>
            </g>
          ))}
        </g>
      );
  }
}
