import Link from "next/link";
import type { PlanRow } from "@/lib/plan-catalog";
import { formatPlanPrice, formatTrialDaysLabel } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

const INCLUDES = [
  "Unlimited access to ShootPortal",
  "Projects and pipeline",
  "Client management",
  "Scheduling and calendar",
  "Estimates and approvals",
  "Client portal",
  "Project messaging",
  "Photo and video delivery",
  "Media management",
  "Invoices",
  "Payment links",
  "Payment tracking",
  "Lead capture tools",
  "Client project history",
  "Full feature set",
  "Future product updates",
] as const;

export function MarketingHomePricing({
  plan,
  trialDays,
}: {
  plan: PlanRow | null;
  trialDays: number;
}) {
  const priceLabel = plan ? formatPlanPrice(plan.price_monthly_cents) : null;
  const planName = plan?.name ?? "ShootPortal";

  return (
    <div className="mx-auto max-w-lg">
      <article className="rounded-2xl border border-[#4F46E5] bg-white p-8 shadow-sm ring-2 ring-[#4F46E5]/10">
        <h3 className="text-lg font-semibold text-[#0F172A]">{planName}</h3>
        <div className="mt-4">
          {priceLabel ? (
            <p className="flex items-baseline gap-1">
              <span className="text-4xl font-bold tracking-tight text-[#0F172A]">
                {priceLabel}
              </span>
              <span className="text-base text-[#475569]">/ month</span>
            </p>
          ) : (
            <p className="text-sm text-[#475569]">Pricing loads from the live catalog.</p>
          )}
          {trialDays > 0 ? (
            <p className="mt-2 text-sm font-medium text-[#4F46E5]">
              {formatTrialDaysLabel(trialDays)} free trial
            </p>
          ) : null}
        </div>
        <p className="mt-6 text-sm font-semibold text-[#0F172A]">Includes</p>
        <ul className="mt-3 space-y-2">
          {INCLUDES.map((line) => (
            <li key={line} className="flex gap-2 text-sm text-[#475569]">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
              <span>{line}</span>
            </li>
          ))}
        </ul>
        <Link href="/signup" className="mt-8 block">
          <Button className="min-h-12 w-full bg-[#4F46E5] text-base font-semibold text-white hover:bg-[#4338CA]">
            Start your free trial
          </Button>
        </Link>
        <p className="mt-3 text-center text-sm text-[#475569]">No credit card required.</p>
      </article>
    </div>
  );
}
