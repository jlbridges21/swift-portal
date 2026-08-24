export function PartnerProgramFaq({
  commissionRatePct,
  holdDays,
  monthlyPriceLabel,
}: {
  commissionRatePct: number;
  holdDays: number;
  monthlyPriceLabel: string;
}) {
  const items = [
    {
      q: "When are commissions paid?",
      a: `Commissions are paid manually by ShootPortal after they clear a ${holdDays}-day hold. Your partner dashboard shows pending vs payable balances. There is no automated payout in this program version.`,
    },
    {
      q: `What is the ${holdDays}-day hold?`,
      a: `Each commission becomes payable ${holdDays} days after the referred business’s ShootPortal subscription payment. The hold covers refunds and payment reverses before we mark earnings ready to pay.`,
    },
    {
      q: "What happens on refunds or cancellations?",
      a: "If ShootPortal refunds a subscription payment that already earned you a commission, we add a negative ledger row (a reversal). That reduces your net balance and can make the next payable amount smaller — or temporarily negative until new earnings catch up. Cancellation alone does not reverse past paid periods; only refunded payments do.",
    },
    {
      q: "Do I need to be a ShootPortal customer?",
      a: "No. Partners do not need an active ShootPortal subscription. You promote the product; referred studios subscribe on their own.",
    },
    {
      q: "Are commissions truly lifetime?",
      a: `Yes for as long as the referred business keeps paying ShootPortal and your partner account remains active. You earn ${commissionRatePct}% of their ShootPortal subscription payments (the rate snapshotted when each commission is earned). If your account is suspended, new payments stop earning; existing history is kept.`,
    },
    {
      q: "How do I get paid?",
      a: "ShootPortal records manual payouts (for example PayPal, Wise, ACH, or check). You will see payout history in your partner dashboard. We do not use Stripe Connect for partner payouts.",
    },
    {
      q: "What if a referred customer downgrades?",
      a: `Your commission is a percentage of what they actually pay ShootPortal. If they move to a lower-priced plan, future commissions follow the new payment amounts at your snapshotted rate — for example ${commissionRatePct}% of ${monthlyPriceLabel}/mo on the public Studio monthly price today.`,
    },
  ];

  return (
    <div className="mx-auto max-w-3xl divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4">
          <summary className="cursor-pointer list-none text-left text-base font-semibold text-[#0F172A] marker:content-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span className="flex items-center justify-between gap-4">
              {item.q}
              <span className="text-[#4F46E5] transition group-open:rotate-45" aria-hidden>
                +
              </span>
            </span>
          </summary>
          <p className="mt-3 text-sm leading-relaxed text-[#475569]">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
