import { LayoutDashboard, Percent, Target, UserCheck } from "lucide-react";

const WHY = [
  {
    title: "Recurring commissions",
    body: "You keep earning while your referred customers keep paying ShootPortal.",
    icon: Percent,
  },
  {
    title: "Built for a specific audience",
    body: "ShootPortal is designed for photographers, drone pilots, and media businesses, so the product is easy to explain to the right audience.",
    icon: Target,
  },
  {
    title: "Your own dashboard",
    body: "Track referred customers, commissions, and payout activity without keeping your own spreadsheet.",
    icon: LayoutDashboard,
  },
  {
    title: "No subscription required",
    body: "You do not need to be a paying ShootPortal customer to participate in the partner program.",
    icon: UserCheck,
  },
] as const;

export function WhyShootPortalCards() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {WHY.map((card) => {
        const Icon = card.icon;
        return (
          <li
            key={card.title}
            className="rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:border-[#C7D2FE] hover:shadow-md"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">{card.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-[#475569]">{card.body}</p>
          </li>
        );
      })}
    </ul>
  );
}
