"use client";

import Link from "next/link";
import type { NextStepInfo } from "@/lib/journey";
import { cn } from "@/lib/utils";
import { ArrowRight, Info, CheckCircle, AlertTriangle, Sparkles } from "lucide-react";

const variantStyles = {
  info: "border-blue-200 bg-blue-50/80 text-blue-900",
  success: "border-emerald-200 bg-emerald-50/80 text-emerald-900",
  warning: "border-amber-200 bg-amber-50/80 text-amber-900",
  accent: "border-sky-200 bg-sky-50/80 text-sky-900",
};

const variantIcons = {
  info: Info,
  success: CheckCircle,
  warning: AlertTriangle,
  accent: Sparkles,
};

interface NextStepBannerProps {
  step: NextStepInfo;
}

export function NextStepBanner({ step }: NextStepBannerProps) {
  const Icon = variantIcons[step.variant];

  return (
    <div className={cn("rounded-xl border p-5", variantStyles[step.variant])}>
      <div className="flex gap-4">
        <Icon className="h-5 w-5 shrink-0 mt-0.5 opacity-80" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{step.title}</p>
          <p className="text-sm mt-1 opacity-90 leading-relaxed">{step.description}</p>
          {step.actionLabel && step.actionHref && (
            step.actionHref.startsWith("#") ? (
              <a
                href={step.actionHref}
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium underline underline-offset-2 hover:opacity-80"
              >
                {step.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
              </a>
            ) : (
              <Link
                href={step.actionHref}
                className="inline-flex items-center gap-1 mt-3 text-sm font-medium underline underline-offset-2 hover:opacity-80"
              >
                {step.actionLabel} <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )
          )}
        </div>
      </div>
    </div>
  );
}
