"use client";

import { OUTCOME_CARDS } from "./constants";
import { Reveal } from "./motion";

export function OutcomeCards() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2">
      {OUTCOME_CARDS.map((card, i) => (
        <Reveal key={card.title} delayMs={i * 80}>
          <li className="h-full rounded-2xl border border-[#E2E8F0] bg-white p-6 shadow-sm transition hover:border-[#C7D2FE] hover:shadow-md">
            <h3 className="text-lg font-semibold tracking-tight text-[#0F172A]">
              {card.title}
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-[#475569]">{card.body}</p>
          </li>
        </Reveal>
      ))}
    </ul>
  );
}
