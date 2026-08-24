import Link from "next/link";
import type { PartnerReferralDiscountWarning } from "@/lib/partner-referral-discount.constants";

type Props = {
  warnings: PartnerReferralDiscountWarning[];
};

function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 === 0 ? 0 : 2)}`;
}

export function PartnerReferralDiscountOverrideWarnings({ warnings }: Props) {
  if (!warnings.length) return null;

  return (
    <div
      role="alert"
      className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"
    >
      <p className="font-semibold">Partner discount coupon mapping issues</p>
      <p className="mt-1 text-amber-900">
        These partners have an enabled referral discount with no Stripe coupon for that exact
        configuration. Their landing pages hide the offer and checkout proceeds at full price until
        fixed.
      </p>
      <ul className="mt-3 list-inside list-disc space-y-1">
        {warnings.map((w) => (
          <li key={w.partnerId}>
            <Link href={`/platform/partners/${w.partnerId}`} className="font-medium underline">
              {w.brandName}
            </Link>
            {" — "}
            {formatCents(w.amountOffCents)}/mo × {w.durationMonths} months ({w.reason})
          </li>
        ))}
      </ul>
    </div>
  );
}
