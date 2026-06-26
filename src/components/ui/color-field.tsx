"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

const HEX_RE = /^#([0-9A-Fa-f]{6})$/;

export function isValidHexColor(value: string): boolean {
  return HEX_RE.test(value.trim());
}

export function normalizeHexColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (HEX_RE.test(trimmed)) return trimmed.toUpperCase();
  if (/^[0-9A-Fa-f]{6}$/.test(trimmed)) return `#${trimmed.toUpperCase()}`;
  return fallback;
}

interface ColorFieldProps {
  id: string;
  label: string;
  value: string;
  fallback?: string;
  onChange: (value: string) => void;
  className?: string;
}

export function ColorField({
  id,
  label,
  value,
  fallback = "#3B82F6",
  onChange,
  className,
}: ColorFieldProps) {
  const normalized = isValidHexColor(value) ? value : fallback;
  const invalid = value.trim().length > 0 && !isValidHexColor(value);

  return (
    <div className={cn("space-y-2", className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          id={`${id}-picker`}
          value={normalized}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-border bg-white p-1"
          aria-label={`${label} picker`}
        />
        <div
          className="h-10 w-10 shrink-0 rounded-lg border border-border shadow-inner"
          style={{ backgroundColor: normalized }}
          title="Preview"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => {
            if (!isValidHexColor(value)) onChange(normalizeHexColor(value, fallback));
          }}
          placeholder="#3B82F6"
          className={cn("font-mono text-sm", invalid && "border-amber-400")}
          spellCheck={false}
        />
      </div>
      {invalid && <p className="text-xs text-amber-700">Enter a valid hex color like #3B82F6</p>}
    </div>
  );
}
