"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isSafeCssColor, toNativeColorInputValue } from "@/lib/brand-color";
import { cn } from "@/lib/utils";

type Props = {
  id: string;
  label: string;
  /**
   * Stored color, or "" when unset.
   * Unset (`""`) vs deliberate black (`"#000000"`): empty string means no DB value;
   * the picker shows `fallback` for display only and never writes it until the partner
   * changes the picker or types a color.
   */
  value: string;
  /** ShootPortal default shown in the picker / placeholder when value is unset. */
  fallback: string;
  help: string;
  onChange: (value: string) => void;
  onReset: () => void;
};

export function PartnerBrandColorField({
  id,
  label,
  value,
  fallback,
  help,
  onChange,
  onReset,
}: Props) {
  const trimmed = value.trim();
  const isUnset = trimmed.length === 0;
  // Picker always needs a concrete #rrggbb; show fallback when unset — do not persist it.
  const pickerValue = toNativeColorInputValue(isUnset ? fallback : trimmed, fallback);
  const invalid = !isUnset && !isSafeCssColor(trimmed);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <button
          type="button"
          className="text-xs text-accent hover:underline disabled:opacity-50"
          disabled={isUnset}
          onClick={onReset}
        >
          Reset to default
        </button>
      </div>
      <div className="flex min-w-0 items-center gap-2 sm:gap-3">
        <input
          type="color"
          id={`${id}-picker`}
          value={pickerValue}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-11 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-white p-1"
          aria-label={`${label} picker`}
        />
        <div
          className="hidden h-11 w-11 shrink-0 rounded-lg border border-border shadow-inner sm:block"
          style={{ backgroundColor: isUnset || invalid ? fallback : trimmed }}
          title={isUnset ? `Default ${fallback}` : "Preview"}
          aria-hidden
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className={cn("min-h-11 min-w-0 flex-1 font-mono text-sm", invalid && "border-red-400")}
          spellCheck={false}
          aria-invalid={invalid}
        />
      </div>
      {invalid ? (
        <p className="text-xs text-red-600">
          Use a hex color (#RGB or #RRGGBB) or rgb()/rgba() with 0–255 channels.
        </p>
      ) : null}
      <p className="text-xs text-muted">{help}</p>
      {isUnset ? (
        <p className="text-xs text-muted">Using ShootPortal default ({fallback}) until you choose a color.</p>
      ) : null}
    </div>
  );
}
