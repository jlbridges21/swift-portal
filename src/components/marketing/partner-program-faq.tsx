export function PartnerProgramFaq({
  commissionRatePct,
  holdDays,
  monthlyPriceLabel,
}: {
  commissionRatePct: number;
  holdDays: number;
  monthlyPriceLabel: string;
}) {
  const priceNote = monthlyPriceLabel
    ? ` For reference, the current public Studio monthly price is ${monthlyPriceLabel}.`
    : "";

  const items = [
    {
      q: "How much commission do partners earn?",
      a: `Partners earn ${commissionRatePct}% of eligible ShootPortal subscription payments from customers they refer.${priceNote} Your rate is set when you join and applies to each payment that earns a commission.`,
    },
    {
      q: "How long do commissions last?",
      a: `As long as the referred customer keeps paying ShootPortal and your partner account stays active, you keep earning ${commissionRatePct}% on their subscription payments. This is not a one-time referral bonus.`,
    },
    {
      q: "When do commissions become payable?",
      a: `Each commission becomes payable ${holdDays} days after the referred customer's ShootPortal subscription payment clears. The hold helps cover refunds and payment reverses before earnings are marked ready to pay.`,
    },
    {
      q: "Do I need to use ShootPortal myself?",
      a: "No. You do not need a ShootPortal subscription to become a partner or to earn commissions.",
    },
    {
      q: "How are referrals tracked?",
      a: "After approval you get a partner link and referral code. When someone signs up through your link and creates a ShootPortal business, that referral is attributed to you.",
    },
    {
      q: "What happens if a customer cancels?",
      a: "If a customer stops paying ShootPortal, new commissions from that customer stop. Past commissions for periods they already paid stay on your history. If ShootPortal refunds a payment that already earned you a commission, that commission can be reversed so your balance stays accurate.",
    },
    {
      q: "Can I promote ShootPortal in a course or community?",
      a: "Yes. Many partners share ShootPortal inside courses, communities, YouTube descriptions, newsletters, resource pages, and social content. Tell us how you plan to introduce it when you apply.",
    },
    {
      q: "Do I need a large audience?",
      a: "No. You need the right people paying attention. A smaller audience of photographers, drone pilots, or media professionals can be more valuable than a huge unrelated following.",
    },
    {
      q: "How do I get paid?",
      a: "ShootPortal pays partners manually after commissions clear the hold period (for example PayPal, Wise, ACH, or check). You can see payout history in your partner dashboard.",
    },
    {
      q: "Can I see my referrals and commissions?",
      a: "Yes. Your partner dashboard shows referred customers, commission activity, and payout history in one place.",
    },
  ];

  return (
    <div className="mx-auto max-w-3xl divide-y divide-[#E2E8F0] rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4 sm:px-6">
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
