"use client";

import { useId, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { BRAND_STORAGE_KEY, EMPTY_BRAND, sanitizeBrand, type Brand } from "@/lib/tools/brand";
import { LogoError, readLogoFile } from "@/lib/tools/logo";
import { useToolState } from "@/components/tools/use-tool-state";
import { TextField } from "@/components/tools/controls";
import { cn } from "@/lib/utils";

/** The visitor's business details, shared by every free tool on this device. */
export function useBrand() {
  const { state, setState, reset } = useToolState<Brand>({ storageKey: BRAND_STORAGE_KEY, defaults: EMPTY_BRAND, sanitize: sanitizeBrand, urlState: false });
  return { brand: state, setBrand: setState, resetBrand: reset };
}

/** Big, forgiving logo picker: click or drag an image in. Read and resized on the device. */
export function LogoDrop({ logo, name, onChange }: { logo: string | null; name: string; onChange: (logo: string | null) => void }) {
  const id = useId();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [over, setOver] = useState(false);

  async function take(file: File | undefined) {
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      onChange(await readLogoFile(file));
    } catch (e) {
      setError(e instanceof LogoError ? e.message : "That image couldn't be used. Try a PNG or JPG.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="sm:col-span-2">
      <p className="text-sm font-medium text-[#334155]" id={`${id}-label`}>
        Logo
      </p>
      {logo ? (
        <div className="mt-1.5 flex items-center gap-4 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <span className="flex h-16 w-32 shrink-0 items-center justify-center rounded-xl bg-white p-2 ring-1 ring-[#E2E8F0]">
            {/* eslint-disable-next-line @next/next/no-img-element -- the visitor's own logo, kept in the browser as a data URL */}
            <img src={logo} alt={name ? `${name} logo` : "Your logo"} className="max-h-full max-w-full object-contain" />
          </span>
          <div className="flex flex-wrap gap-2">
            <label className="inline-flex min-h-10 cursor-pointer items-center rounded-xl border border-[#E2E8F0] bg-white px-3 text-sm font-medium text-[#334155] focus-within:ring-2 focus-within:ring-[#4F46E5] hover:border-[#C7D2FE]">
              Change
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => void take(e.target.files?.[0])} />
            </label>
            <button
              type="button"
              onClick={() => onChange(null)}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-[#64748B] hover:bg-white hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4F46E5]"
            >
              <X className="h-4 w-4" aria-hidden /> Remove
            </button>
          </div>
        </div>
      ) : (
        <label
          htmlFor={id}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            void take(e.dataTransfer.files?.[0]);
          }}
          className={cn(
            "mt-1.5 flex min-h-24 cursor-pointer items-center gap-4 rounded-2xl border-2 border-dashed px-4 py-4 transition-colors focus-within:ring-2 focus-within:ring-[#4F46E5]",
            over ? "border-[#4F46E5] bg-[#EEF2FF]" : "border-[#CBD5E1] bg-[#F8FAFC] hover:border-[#818CF8] hover:bg-[#EEF2FF]/50"
          )}
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-[#4F46E5] ring-1 ring-[#E2E8F0]">
            <ImagePlus className="h-6 w-6" aria-hidden />
          </span>
          <span>
            <span className="block font-semibold text-[#0F172A]">{busy ? "Adding your logo…" : "Add your logo"}</span>
            <span className="block text-sm text-[#64748B]">Tap to choose an image, or drag it here.</span>
          </span>
          <input id={id} type="file" accept="image/*" className="sr-only" aria-labelledby={`${id}-label`} onChange={(e) => void take(e.target.files?.[0])} />
        </label>
      )}
      <p className="mt-1.5 text-xs text-[#64748B]" aria-live="polite">
        {error ? <span className="text-rose-600">{error}</span> : "Your logo stays on this device. Nothing is uploaded."}
      </p>
    </div>
  );
}

/** Business name, contact details, and logo. Saved in this browser so every tool starts filled in. */
export function BrandFields({ brand, onChange }: { brand: Brand; onChange: (patch: Partial<Brand>) => void }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <LogoDrop logo={brand.logo} name={brand.name} onChange={(logo) => onChange({ logo })} />
      <TextField label="Business name" value={brand.name} onChange={(name) => onChange({ name })} autoComplete="organization" placeholder="e.g. Skyline Aerial Media" wide />
      <TextField label="Phone" type="tel" value={brand.phone} onChange={(phone) => onChange({ phone })} autoComplete="tel" placeholder="(555) 123-4567" />
      <TextField label="Email" type="email" value={brand.email} onChange={(email) => onChange({ email })} autoComplete="email" placeholder="you@yourbusiness.com" />
      <TextField label="Website" type="url" value={brand.website} onChange={(website) => onChange({ website })} autoComplete="url" placeholder="yourbusiness.com" />
      <TextField label="Business address" value={brand.address} onChange={(address) => onChange({ address })} autoComplete="street-address" placeholder="Street, city, state" wide />
    </div>
  );
}
