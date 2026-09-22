"use client";

import { Label } from "@/components/ui/label";

type Props = {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  help: string;
  onChange: (value: number) => void;
};

export function LogoSizeSlider({ id, label, value, min, max, help, onChange }: Props) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <span className="font-mono text-xs text-muted">{value}px</span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-accent"
      />
      <div className="flex justify-between text-[10px] uppercase tracking-wide text-muted">
        <span>{min}px</span>
        <span>{max}px</span>
      </div>
      <p className="text-xs text-muted">{help}</p>
    </div>
  );
}
