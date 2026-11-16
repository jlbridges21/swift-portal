"use client";

import { isValidHexColor, normalizeHexColor } from "@/components/ui/color-field";
import { cn } from "@/lib/utils";

/** Large color swatch that opens the native picker; the hex stays editable for exact brand colors. */
export function BrandingColorSwatch({
  id,
  label,
  description,
  value,
  fallback,
  onChange,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const normalized = isValidHexColor(value) ? value : fallback;
  const invalid = value.trim().length > 0 && !isValidHexColor(value);

  return (
    <div className="flex min-w-0 items-center gap-3.5 rounded-xl border border-border bg-card p-3.5">
      <label
        className="relative h-14 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-border shadow-inner focus-within:ring-2 focus-within:ring-accent"
        style={{ backgroundColor: normalized }}
        title={`Pick ${label.toLowerCase()} color`}
      >
        <input
          type="color"
          id={`${id}-picker`}
          value={normalized}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          aria-label={`${label} color picker`}
        />
      </label>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-heading">{label}</p>
        <p className="text-[13px] text-muted">{description}</p>
        <input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (!isValidHexColor(value)) onChange(normalizeHexColor(value, fallback));
          }}
          spellCheck={false}
          aria-label={`${label} hex code`}
          aria-invalid={invalid || undefined}
          className={cn(
            "mt-1 h-8 w-28 rounded-md border border-transparent bg-transparent px-1.5 -ml-1.5 font-mono text-sm text-foreground hover:border-border focus:border-border focus:outline-none focus:ring-2 focus:ring-accent",
            invalid && "border-amber-400"
          )}
        />
        {invalid ? (
          <p className="text-xs text-amber-700 surface-dark:text-amber-300">Use a hex color like #3B82F6</p>
        ) : null}
      </div>
    </div>
  );
}
