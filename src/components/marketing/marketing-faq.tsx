const FAQ_ITEMS = [
  {
    q: "Who is ShootPortal for?",
    a: "ShootPortal is built for drone pilots, real estate photographers, videographers, and real estate media businesses that want one place to manage their work and clients.",
  },
  {
    q: "What does ShootPortal replace?",
    a: "For many businesses, ShootPortal can replace parts of your CRM, project tracker, scheduling system, file delivery workflow, invoicing process, and client portal.",
  },
  {
    q: "Do my clients need an account?",
    a: "No. Clients can interact with the parts of the project you share with them without having to learn another complicated piece of software.",
  },
  {
    q: "Can I use my own branding?",
    a: "ShootPortal is designed to help your business look professional to clients. Your client experience should feel like an extension of your business, not a random collection of third party links.",
  },
  {
    q: "How much does ShootPortal cost?",
    a: null,
  },
  {
    q: "Is there a free trial?",
    a: null,
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. There are no long term contracts.",
  },
  {
    q: "Does ShootPortal handle payments?",
    a: "Yes. You can send invoices and payment links and keep payment activity connected to the project.",
  },
  {
    q: "What happens to my media?",
    a: "Your media stays organized with the project so clients can access their deliverables through one clean experience.",
  },
  {
    q: "How long does setup take?",
    a: "You can create your account and start building your first project in minutes.",
  },
  {
    q: "Is ShootPortal only for real estate photography?",
    a: "No. It works especially well for real estate media, but drone pilots, photographers, videographers, and other project based media businesses can use it too.",
  },
  {
    q: "Is a credit card required to start?",
    a: null,
  },
] as const;

function trialDaysPhrase(trialDaysLabel: string): string {
  const n = parseInt(trialDaysLabel, 10);
  if (!Number.isNaN(n) && n > 0) return `${n} days`;
  return trialDaysLabel.replace(/-day$/, " days");
}

export function MarketingFaq({
  trialDaysLabel,
  monthlyPriceLabel,
  annualPriceLabel,
  annualSavingsLabel,
}: {
  trialDaysLabel: string;
  monthlyPriceLabel: string;
  annualPriceLabel?: string;
  annualSavingsLabel?: string | null;
}) {
  const trialPhrase = trialDaysPhrase(trialDaysLabel);
  const trialDayPhrase = trialPhrase.replace(/ days$/, " day");
  const annualLabel = annualPriceLabel ?? monthlyPriceLabel;

  const items = FAQ_ITEMS.map((item) => {
    if (item.q === "How much does ShootPortal cost?") {
      const savingsNote = annualSavingsLabel ? ` ${annualSavingsLabel}.` : "";
      return {
        q: item.q,
        a: `Studio is one plan with the full feature set: ${monthlyPriceLabel} per month when billed monthly, or ${annualLabel} per month when billed annually.${savingsNote} Cancel anytime.`,
      };
    }
    if (item.q === "Is there a free trial?") {
      return {
        q: item.q,
        a: `Yes. You can try ShootPortal free for ${trialPhrase} with no credit card required.`,
      };
    }
    if (item.q === "Is a credit card required to start?") {
      return {
        q: item.q,
        a: `No. You can start your ${trialDayPhrase} trial without entering a credit card.`,
      };
    }
    return { q: item.q, a: item.a as string };
  });

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
