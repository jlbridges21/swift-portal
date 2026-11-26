"use client";

import Link from "next/link";
import { Award, GraduationCap } from "lucide-react";
import { useAcademy } from "@/components/academy/academy-progress";
import { cn } from "@/lib/utils";

/** Small progress ring with "7/18" inside; becomes a certificate badge once earned. */
export function AcademyRing({ className }: { className?: string }) {
  const a = useAcademy();
  if (!a.ready) return null;
  if (a.certified) {
    return (
      <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white", className)} title="ShootPortal Certified">
        <Award className="h-3.5 w-3.5" aria-hidden />
      </span>
    );
  }
  const size = 26;
  const stroke = 3;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={cn("relative inline-flex h-[26px] w-[26px] items-center justify-center", className)} title={`${a.completed} of ${a.total} lessons`}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 block h-full w-full" aria-hidden>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-border" />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${(c * a.percent) / 100} ${c}`}
            className="stroke-accent"
          />
        </g>
      </svg>
      <span className="relative text-[8px] font-bold leading-none text-accent tabular-nums">
        {a.completed}/{a.total}
      </span>
    </span>
  );
}

/** Sidebar row for the New interface (bottom group, above Settings). */
export function AcademyNavLink({
  active,
  full,
  rowCls,
  labelCls,
}: {
  active: boolean;
  full: boolean;
  rowCls: string;
  labelCls: string;
}) {
  return (
    <Link
      href="/admin/academy"
      aria-current={active ? "page" : undefined}
      title={full ? undefined : "Academy"}
      className={cn(
        "group relative flex h-10 items-center gap-3 rounded-lg text-sm font-medium transition-colors",
        rowCls,
        active ? "bg-accent-subtle text-accent" : "text-foreground hover:bg-subtle hover:text-heading"
      )}
    >
      <GraduationCap
        className={cn("h-[18px] w-[18px] shrink-0", active ? "text-accent" : "text-muted group-hover:text-heading")}
        aria-hidden
      />
      <span className={labelCls}>Academy</span>
      <AcademyRing className={cn("ml-auto", !full && "hidden lg:inline-flex")} />
    </Link>
  );
}
