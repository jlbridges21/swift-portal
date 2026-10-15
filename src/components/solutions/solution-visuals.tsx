import type { ReactNode } from "react";
import { Check, CreditCard, Download, Lock, MessageSquareText, Play } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Original illustrations for the Solutions pages. Scenes are vector art (no stock
 * photos); product states shown in chips and cards mirror real ShootPortal states
 * (estimate approval, proposed shoot time, pinned video comments, paid → downloads).
 */

export function BrowserFrame({ url, children, className }: { url: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_40px_90px_-50px_rgba(15,23,42,0.65)]", className)}>
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" />
        ))}
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-[11px] text-[#64748B] ring-1 ring-[#E2E8F0]">{url}</span>
      </div>
      {children}
    </div>
  );
}

const CHIP_TONES = {
  indigo: "bg-[#EEF2FF] text-[#4F46E5]",
  emerald: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  sky: "bg-sky-50 text-sky-600",
} as const;

/** Floating status card used around hero visuals. Decorative (aria-hidden); copy repeats in page text. */
export function FloatingChip({
  icon: Icon,
  title,
  detail,
  tone = "indigo",
  className,
  delayMs = 0,
}: {
  icon: LucideIcon;
  title: string;
  detail?: string;
  tone?: keyof typeof CHIP_TONES;
  className?: string;
  delayMs?: number;
}) {
  return (
    <div
      aria-hidden
      className={cn(
        "mk-float absolute z-10 flex items-center gap-3 rounded-2xl border border-white/70 bg-white/95 px-3.5 py-2.5 shadow-[0_20px_45px_-25px_rgba(15,23,42,0.55)] backdrop-blur",
        className
      )}
      style={{ animationDelay: `${delayMs}ms` }}
    >
      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-xl", CHIP_TONES[tone])}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block whitespace-nowrap text-xs font-semibold text-[#0F172A]">{title}</span>
        {detail ? <span className="block whitespace-nowrap text-[11px] text-[#64748B]">{detail}</span> : null}
      </span>
    </div>
  );
}

/** Dusk listing exterior (original vector art). */
export function PropertyArt({ className, idPrefix }: { className?: string; idPrefix: string }) {
  const p = idPrefix;
  return (
    <svg viewBox="0 0 640 400" className={cn("block h-auto w-full", className)} role="img" aria-label="Illustration of a two-story listing photographed at dusk">
      <defs>
        <linearGradient id={`${p}-sky`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#312E81" />
          <stop offset="0.55" stopColor="#7C3AED" />
          <stop offset="1" stopColor="#F59E0B" />
        </linearGradient>
        <linearGradient id={`${p}-lawn`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#14532D" />
          <stop offset="1" stopColor="#052E16" />
        </linearGradient>
        <radialGradient id={`${p}-glow`} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#FDE68A" stopOpacity="0.95" />
          <stop offset="1" stopColor="#FDE68A" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="640" height="400" fill={`url(#${p}-sky)`} />
      <circle cx="510" cy="250" r="70" fill="#FDE68A" opacity="0.25" />
      <path d="M0 300 C 120 280, 220 295, 320 288 S 520 270, 640 286 V400 H0Z" fill="#1E1B4B" opacity="0.6" />
      <rect y="318" width="640" height="82" fill={`url(#${p}-lawn)`} />
      <g transform="translate(150 120)">
        <path d="M0 110 L170 20 L340 110 Z" fill="#1F2937" />
        <rect x="20" y="110" width="300" height="100" fill="#E5E7EB" />
        <rect x="20" y="110" width="300" height="10" fill="#9CA3AF" opacity="0.6" />
        <path d="M170 40 L250 82 L90 82 Z" fill="#374151" />
        {[[45, 135], [115, 135], [205, 135], [275, 135]].map(([x, y]) => (
          <g key={`${x}${y}`}>
            <rect x={x} y={y} width="44" height="40" rx="3" fill="#FCD34D" />
            <rect x={x - 6} y={y - 6} width="56" height="52" fill={`url(#${p}-glow)`} opacity="0.7" />
          </g>
        ))}
        <rect x="150" y="160" width="40" height="50" rx="3" fill="#92400E" />
        <rect x="-60" y="150" width="80" height="60" fill="#D1D5DB" />
        <path d="M-70 150 L-20 120 L30 150 Z" fill="#1F2937" />
        <rect x="-48" y="168" width="56" height="42" rx="2" fill="#475569" />
      </g>
      {[60, 590].map((x) => (
        <g key={x} transform={`translate(${x} 250)`}>
          <rect x="-4" y="40" width="8" height="40" fill="#422006" />
          <circle cx="0" cy="30" r="34" fill="#14532D" />
        </g>
      ))}
      <path d="M270 400 L300 330 L340 330 L370 400 Z" fill="#6B7280" opacity="0.7" />
    </svg>
  );
}

/** Aerial survey scene: terrain contours, flight path, drone (original vector art). */
export function AerialArt({ className, idPrefix }: { className?: string; idPrefix: string }) {
  const p = idPrefix;
  return (
    <svg viewBox="0 0 640 420" className={cn("block h-auto w-full", className)} role="img" aria-label="Illustration of a drone flying a survey path over hills and a property">
      <defs>
        <linearGradient id={`${p}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B1124" />
          <stop offset="1" stopColor="#1E1B4B" />
        </linearGradient>
        <linearGradient id={`${p}-ridge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4338CA" stopOpacity="0.7" />
          <stop offset="1" stopColor="#0B1124" stopOpacity="0.2" />
        </linearGradient>
      </defs>
      <rect width="640" height="420" fill={`url(#${p}-bg)`} />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <path
          key={i}
          d={`M-20 ${250 + i * 26} C 120 ${210 + i * 26}, 230 ${290 + i * 22}, 360 ${245 + i * 24} S 560 ${215 + i * 28}, 660 ${255 + i * 24}`}
          fill="none"
          stroke="#A5B4FC"
          strokeOpacity={0.12 + i * 0.05}
          strokeWidth="1.5"
        />
      ))}
      <path d="M0 330 C 140 270, 260 340, 380 300 S 560 260, 640 300 V420 H0Z" fill={`url(#${p}-ridge)`} />
      <g transform="translate(400 300)" opacity="0.9">
        <rect x="0" y="0" width="90" height="46" rx="3" fill="#E0E7FF" opacity="0.85" />
        <path d="M-6 0 L45 -26 L96 0 Z" fill="#C7D2FE" />
        <rect x="36" y="20" width="18" height="26" fill="#6366F1" />
      </g>
      <path d="M80 360 C 160 200, 300 240, 340 170 S 470 90, 560 110" fill="none" stroke="#C7D2FE" strokeWidth="2.5" strokeDasharray="7 8" className="mk-flow-line" />
      {[[80, 360], [340, 170], [560, 110]].map(([x, y]) => (
        <circle key={`${x}${y}`} cx={x} cy={y} r="5" fill="#C7D2FE" />
      ))}
      <g transform="translate(300 120)" className="mk-float">
        {[[-44, -26], [44, -26], [-44, 26], [44, 26]].map(([x, y]) => (
          <g key={`${x}${y}`}>
            <line x1="0" y1="0" x2={x} y2={y} stroke="#E0E7FF" strokeWidth="6" strokeLinecap="round" />
            <ellipse cx={x} cy={y} rx="24" ry="6" fill="#C7D2FE" fillOpacity="0.35" />
          </g>
        ))}
        <rect x="-22" y="-14" width="44" height="28" rx="10" fill="#6366F1" />
        <circle cx="0" cy="18" r="6" fill="#0B1124" stroke="#E0E7FF" strokeWidth="2" />
      </g>
      <path d="M300 140 L240 290 L360 290 Z" fill="#A5B4FC" opacity="0.08" />
    </svg>
  );
}

/** Video card with time-stamped comment pins (mirrors ShootPortal video review). */
export function VideoReviewCard({ className }: { className?: string }) {
  const pins = [
    { at: 22, t: "0:14", text: "Hold on the front elevation a beat longer" },
    { at: 61, t: "0:38", text: "Swap this clip for the dusk pass" },
  ];
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-white/10 bg-[#0F172A] p-4 text-white shadow-[0_30px_70px_-40px_rgba(15,23,42,0.9)]", className)} aria-hidden>
      <div className="flex items-center justify-between text-[11px] text-slate-400">
        <span className="font-semibold text-slate-200">Property_Film.mp4</span>
        <span className="flex gap-1">
          <span className="rounded-full bg-white/10 px-2 py-0.5">v1</span>
          <span className="rounded-full bg-[#4F46E5] px-2 py-0.5 text-white">v2</span>
        </span>
      </div>
      <div className="relative mt-3 aspect-video rounded-xl bg-gradient-to-br from-[#1E293B] via-[#312E81] to-[#7C3AED]">
        <span className="absolute left-1/2 top-1/2 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-white/20 backdrop-blur">
          <Play className="h-5 w-5 fill-white" />
        </span>
        <span className="mk-pulse absolute left-[64%] top-[34%] h-4 w-4 rounded-full border-2 border-white bg-amber-400" />
      </div>
      <div className="relative mt-4 h-1.5 rounded-full bg-white/15">
        <div className="absolute inset-y-0 left-0 w-[45%] rounded-full bg-[#818CF8]" />
        {pins.map((p) => (
          <span key={p.t} className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#0F172A] bg-amber-300" style={{ left: `${p.at}%` }} />
        ))}
      </div>
      <ul className="mt-3 space-y-1.5">
        {pins.map((p) => (
          <li key={p.t} className="flex gap-2 rounded-lg bg-white/5 px-2.5 py-2 text-xs">
            <span className="shrink-0 rounded bg-amber-300/15 px-1.5 font-mono text-amber-200">{p.t}</span>
            <span className="text-slate-200">{p.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Gallery grid card with download options and payment lock (mirrors delivery settings). */
export function GalleryCard({ className, locked = false }: { className?: string; locked?: boolean }) {
  const swatches = [
    "linear-gradient(160deg,#312E81,#7C3AED 55%,#F59E0B)",
    "linear-gradient(145deg,#1E293B,#475569 50%,#CBD5E1)",
    "linear-gradient(150deg,#0F172A,#4338CA 60%,#A5B4FC)",
    "linear-gradient(140deg,#164E63,#0E7490 55%,#67E8F9)",
    "linear-gradient(155deg,#422006,#B45309 55%,#FDE68A)",
    "linear-gradient(135deg,#14532D,#16A34A 55%,#BBF7D0)",
  ];
  return (
    <div className={cn("rounded-2xl border border-[#E2E8F0] bg-white p-4 shadow-[0_30px_70px_-45px_rgba(15,23,42,0.6)]", className)} aria-hidden>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0F172A]">214 Oak Street</p>
          <p className="text-[11px] text-[#64748B]">24 photos · 1 video · 3D tour</p>
        </div>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold", locked ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
          {locked ? <Lock className="h-3 w-3" /> : <Check className="h-3 w-3" />}
          {locked ? "Downloads unlock after payment" : "Ready to download"}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {swatches.map((bg, i) => (
          <div key={i} className="relative aspect-[4/3] overflow-hidden rounded-lg" style={{ background: bg }}>
            {i === 1 ? (
              <span className="absolute inset-0 flex items-center justify-center">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/30 backdrop-blur">
                  <Play className="h-3.5 w-3.5 fill-white text-white" />
                </span>
              </span>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[11px]">
        {["Print (full-res)", "MLS (2048px)", "Download all (ZIP)"].map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2 py-1 text-[#334155]">
            <Download className="h-3 w-3 text-[#4F46E5]" />
            {t}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Compact "request → delivered" ribbon for heroes (real pipeline stages). */
export function StageRibbon({ active = 4, className }: { active?: number; className?: string }) {
  const stages = ["Request", "Estimate", "Schedule", "Shoot", "Review", "Pay", "Deliver"];
  return (
    <ol className={cn("flex flex-wrap gap-1.5", className)} aria-label="ShootPortal job stages">
      {stages.map((s, i) => (
        <li
          key={s}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-semibold",
            i < active ? "bg-emerald-50 text-emerald-700" : i === active ? "bg-[#4F46E5] text-white" : "bg-[#F1F5F9] text-[#64748B]"
          )}
        >
          {s}
        </li>
      ))}
    </ol>
  );
}

export const CHIP_ICONS = { Check, CreditCard, Download, Lock, MessageSquareText };
