"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  valueCents: number;
  onChangeCents: (cents: number) => void;
  className?: string;
  placeholder?: string;
}

function formatDollars(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

function parseDollars(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  if (!cleaned || cleaned === ".") return 0;
  const parts = cleaned.split(".");
  const dollars = parts[0] || "0";
  const cents = (parts[1] || "").slice(0, 2);
  const value = parseFloat(cents ? `${dollars}.${cents}` : dollars);
  if (Number.isNaN(value)) return 0;
  return Math.round(value * 100);
}

export function CurrencyInput({ valueCents, onChangeCents, className, placeholder = "0.00" }: CurrencyInputProps) {
  const [display, setDisplay] = useState(() => (valueCents ? formatDollars(valueCents) : ""));

  useEffect(() => {
    const formatted = valueCents ? formatDollars(valueCents) : "";
    if (parseDollars(display) !== valueCents) {
      setDisplay(formatted);
    }
  }, [valueCents]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={cn("relative", className)}>
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">$</span>
      <Input
        type="text"
        inputMode="decimal"
        placeholder={placeholder}
        value={display}
        onChange={(e) => {
          const raw = e.target.value;
          setDisplay(raw);
          onChangeCents(parseDollars(raw));
        }}
        onBlur={() => {
          if (valueCents) setDisplay(formatDollars(valueCents));
        }}
        className="pl-7"
      />
    </div>
  );
}
