const FAQ_ITEMS = [
  {
    q: "What happens when the trial ends?",
    a: "You choose a plan and subscribe with Stripe. If you do not subscribe, portal access pauses. Your data remains available so you can export or reactivate — we do not silently delete a working studio overnight. Trial length comes from the live plan catalog.",
  },
  {
    q: "Do my clients need accounts?",
    a: "Yes. Clients sign in to your branded portal to review estimates, confirm shoot times, message you, review media, pay, and download. That is intentional: the job stays in one place instead of email threads and shared folders.",
  },
  {
    q: "Can I use my own domain?",
    a: "Custom domains are available on plans that include that entitlement (for example Studio). You connect a domain you own; clients open your portal on that host while ShootPortal runs underneath.",
  },
  {
    q: "How and when do I get paid?",
    a: "You create payment requests from the project. Clients pay in the portal via Stripe. With Stripe Connect, funds route to your connected Stripe account on Stripe’s normal payout schedule — not a ShootPortal wallet.",
  },
  {
    q: "Does ShootPortal take a cut of my client payments?",
    a: "No. ShootPortal does not take a percentage of what your clients pay you. You pay ShootPortal for the software subscription. Stripe’s own processing fees still apply on card payments, the same as any Stripe Checkout.",
  },
  {
    q: "Can I export and leave?",
    a: "Yes. You can export project and client records and download media you uploaded. Contact support if you need help with a full account closure. Deletion and export requests follow our Privacy Policy.",
  },
  {
    q: "What happens to my media if I cancel?",
    a: "Download what you need before you close the account. After cancellation, access pauses; we do not guarantee indefinite free hosting of cancelled tenants’ libraries. Export first if you are leaving.",
  },
  {
    q: "How long does setup take?",
    a: "Most studios can brand the portal, add services and pricing, and invite a first client in under an hour. There is an in-app setup checklist so you know what is left.",
  },
  {
    q: "Does it work for video as well as photo?",
    a: "Yes. Projects support photo and video deliverables, media review in the portal, and delivery of finals. It is built for media businesses — not photo-only.",
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
    item.q.includes("trial ends")
      ? {
          ...item,
          a: item.a.replace(
            "Trial length comes from the live plan catalog.",
            `Current Studio trial: ${trialDaysLabel}. Trial length comes from the live plan catalog.`
          ),
        }
      : item
  );

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
