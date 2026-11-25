"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

function toText(cents: number | null) {
  return cents == null ? "" : (cents / 100).toFixed(2);
}

/**
 * A dollar amount that saves when you leave the field (or press Enter), not on every key.
 * Empty commits `null`, which callers treat as "use the default".
 */
export function MoneyField({
  valueCents,
  onCommit,
  placeholder = "0.00",
  ariaLabel,
  className,
}: {
  valueCents: number | null;
  onCommit: (cents: number | null) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  const [text, setText] = useState(() => toText(valueCents));
  useEffect(() => setText(toText(valueCents)), [valueCents]);

  function commit() {
    const cleaned = text.replace(/[^0-9.]/g, "");
    const dollars = parseFloat(cleaned);
    const next = cleaned === "" || !Number.isFinite(dollars) ? null : Math.round(dollars * 100);
    setText(toText(next));
    if (next !== valueCents) onCommit(next);
  }

  return (
    <span className={cn("relative block", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
      <input
        type="text"
        inputMode="decimal"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
        }}
        className="h-11 w-full rounded-lg border border-border bg-white pl-7 pr-3 text-sm text-foreground surface-dark:bg-card"
      />
    </span>
  );
}
