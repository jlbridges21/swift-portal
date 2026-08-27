import type { PlanRow } from "@/lib/plan-catalog";
import {
  ENFORCED_ENTITLEMENTS,
  ENTITLEMENT_LABELS,
  formatPlanPrice,
  formatTrialDaysLabel,
  isEnforcedEntitlement,
} from "@/lib/plan-catalog";
import { MARKETING_BRAND } from "@/lib/marketing";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/** Capabilities that exist in the product today — never list FUTURE_ENTITLEMENTS as shipping. */
const BASE_CAPABILITIES = [
  "Client project requests",
  "Preliminary & official estimates",
  "Shoot scheduling & client approval",
  "In-portal messaging",
  "Photo & video delivery with review",
  "Stripe payments & Connect payouts (ShootPortal takes 0%)",
  "Branded client emails",
] as const;

function limitLines(plan: PlanRow): string[] {
  const limits = plan.limits as Record<string, unknown>;
  const lines: string[] = [];
  const seats = limits.admin_seats;
  if (typeof seats === "number") {
    lines.push(seats === 1 ? "1 admin seat" : `${seats} admin seats`);
  }
  const storage = limits.storage_gb;
  if (typeof storage === "number") {
    lines.push(`${storage} GB media storage`);
  }
  const projects = limits.projects_per_month;
  if (typeof projects === "number") {
    lines.push(`${projects} projects / month`);
  } else if (projects === null) {
    lines.push("Unlimited projects");
  }
  return lines;
}

function liveEntitlementLines(plan: PlanRow): string[] {
  const ents = plan.entitlements ?? {};
  return ENFORCED_ENTITLEMENTS.filter((key) => ents[key] === true).map(
    (key) => ENTITLEMENT_LABELS[key]
  );
}

export function isRecommendedPlan(plan: PlanRow): boolean {
  return plan.key === "studio";
}

export function MarketingPricingGrid({
  plans,
  highlightKey,
}: {
  plans: PlanRow[];
  highlightKey?: string;
}) {
  if (!plans.length) {
    return (
      <p className="text-center text-[#475569]">
        Plans are temporarily unavailable. Contact{" "}
        <a className="underline" href="mailto:hello@shootportal.app">
          hello@shootportal.app
        </a>
        .
      </p>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-4">
      {plans.map((plan) => {
        const recommended = isRecommendedPlan(plan) || plan.key === highlightKey;
        const features = [
          ...limitLines(plan),
          ...BASE_CAPABILITIES,
          ...liveEntitlementLines(plan),
        ];
        // Dedupe while preserving order
        const unique = Array.from(new Set(features));

        return (
          <article
            key={plan.id}
            className={cn(
              "relative flex flex-col rounded-xl border bg-white p-6 shadow-sm",
              recommended ? "border-[#4F46E5] ring-2 ring-[#4F46E5]/15" : "border-[#E2E8F0]"
            )}
          >
            {recommended ? (
              <span
                className="absolute -top-3 left-6 rounded-md px-2 py-0.5 text-xs font-semibold text-white"
                style={{ backgroundColor: MARKETING_BRAND.indigo }}
              >
                Recommended
              </span>
            ) : null}
            <h3 className="text-lg font-semibold text-[#0F172A]">{plan.name}</h3>
            {plan.description ? (
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">
                {/* Strip future-feature disclaimers from customer-facing blurb when present */}
                {plan.description.replace(/\s*Future-gated features[^.]*\./gi, "").trim()}
              </p>
            ) : null}
            <div className="mt-5">
              <p className="flex items-baseline gap-1">
                <span className="text-3xl font-bold tracking-tight text-[#0F172A]">
                  {formatPlanPrice(plan.price_monthly_cents)}
                </span>
                <span className="text-sm text-[#475569]">/mo</span>
              </p>
              {plan.price_annual_cents != null ? (
                <p className="mt-1 text-sm text-[#475569]">
                  or {formatPlanPrice(plan.price_annual_cents)}/mo billed annually
                </p>
              ) : null}
              {plan.trial_days > 0 ? (
                <p className="mt-2 text-sm font-medium text-[#4F46E5]">
                  {formatTrialDaysLabel(plan.trial_days)} free trial
                </p>
              ) : (
                <p className="mt-2 text-sm text-[#475569]">No free trial</p>
              )}
            </div>
            <ul className="mt-6 flex-1 space-y-2.5">
              {unique.map((line) => (
                <li key={line} className="flex gap-2 text-sm text-[#475569]">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#4F46E5]" aria-hidden />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <Link href="/signup" className="mt-8 block">
              <Button
                className={cn(
                  "min-h-11 w-full",
                  recommended
                    ? "bg-[#4F46E5] text-white hover:bg-[#4338CA]"
                    : "border-[#E2E8F0] bg-white text-[#0F172A] hover:bg-[#F8FAFC]"
                )}
                variant={recommended ? "default" : "outline"}
              >
                Start free trial
              </Button>
            </Link>
          </article>
        );
      })}
    </div>
  );
}

/** Only list enforced entitlement keys that are true — used by pricing footnotes. */
export function marketingEntitlementIsLive(key: string): boolean {
  return isEnforcedEntitlement(key);
}
