import type { BlogCoverVariant } from "@/lib/blog/types";
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
}) {
  const p = idPrefix.replace(/[^a-zA-Z0-9_-]/g, "");
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
          <stop offset="0" stopColor="#6366F1" stopOpacity="0.55" />
          <stop offset="1" stopColor="#6366F1" stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`${p}-glow-b`} cx="0.12" cy="0.95" r="0.55">
          <stop offset="0" stopColor="#8B5CF6" stopOpacity="0.4" />
          <stop offset="1" stopColor="#8B5CF6" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${p}-brand`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6366F1" />
          <stop offset="1" stopColor="#A855F7" />
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
