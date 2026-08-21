const FAQ_ITEMS = [
  {
    q: "What happens after the free trial?",
    a: "You choose a plan and subscribe with Stripe. If you do not subscribe, access pauses — your data stays available for export or reactivation. Trial length comes from the plan catalog and can change when plans are updated.",
  },
  {
    q: "Do my clients need accounts?",
    a: "Yes — clients sign in to your branded portal to review estimates, confirm shoot times, message you, review media, pay, and download. That keeps the whole job in one place instead of email threads and shared folders.",
  },
  {
    q: "Can I use my own domain?",
    a: "Custom domains are available on plans that include the custom domain entitlement (for example Studio). You connect a domain you own; clients open your portal on that host while ShootPortal runs underneath.",
  },
  {
    q: "How do I get paid?",
    a: "ShootPortal uses Stripe for client payments and Stripe Connect so funds can route to your connected account. You create payment requests from the project; clients pay in the portal.",
  },
  {
    q: "Can I leave and take my data?",
    a: "Yes. You can export project and client records and download media you uploaded. Contact support if you need help with a full account closure. We process deletion and export requests for business and client data as described in our Privacy Policy.",
  },
  {
    q: "Is a credit card required to start?",
    a: "No. Signup starts your Studio trial without a card. You add billing when you are ready to subscribe after the trial.",
  },
] as const;

export function MarketingFaq({
  trialDaysLabel,
}: {
  /** e.g. formatTrialDaysLabel(n) — never hardcode trial length in the component */
  trialDaysLabel: string;
}) {
  const items = FAQ_ITEMS.map((item) =>
    item.q.includes("free trial")
      ? {
          ...item,
          a: item.a.replace(
            "Trial length comes from the plan catalog and can change when plans are updated.",
            `Current Studio trial: ${trialDaysLabel}. Trial length comes from the plan catalog and can change when plans are updated.`
          ),
        }
      : item
  );

  return (
    <div className="mx-auto max-w-3xl divide-y divide-[#E2E8F0] rounded-xl border border-[#E2E8F0] bg-white">
      {items.map((item) => (
        <details key={item.q} className="group px-5 py-4">
          <summary className="cursor-pointer list-none text-left text-base font-semibold text-[#0F172A] marker:content-none [&::-webkit-details-marker]:hidden">
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
