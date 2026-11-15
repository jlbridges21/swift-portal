"use client";

import type { ReactNode } from "react";
import { Images, MonitorSmartphone, Package, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { DESIGN_STYLES, DESIGN_STYLE_META, PRODUCT_LABEL, type DesignStyle, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents, type MarketingKitSettings } from "@/lib/marketing/offers";
import {
  MarketingKitDesignSwatch,
  MarketingKitProductThumb,
} from "@/components/admin/settings-tabs/marketing-kit-visuals";

const CARD = "rounded-2xl border border-border bg-card";

const PRODUCT_COPY: Record<MarketingProduct, { blurb: string; icon: typeof Images }> = {
  website: { blurb: "A single-property site with its own link", icon: MonitorSmartphone },
  social: { blurb: "Posts, Stories, a carousel and a print flyer", icon: Images },
};

/** Short design blurbs for the thumbnails (full blurbs live in DESIGN_STYLE_META). */
const DESIGN_SHORT: Record<DesignStyle, string> = {
  modern: "Bright, spacious",
  luxury: "Cinematic",
  coastal: "Warm, airy",
};

function IconTile({ children, active = true }: { children: ReactNode; active?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
        active ? "bg-accent-subtle text-accent" : "bg-subtle text-muted"
      )}
    >
      {children}
    </span>
  );
}

function ToggleRow({
  id,
  title,
  description,
  checked,
  onChange,
}: {
  id: string;
  title: ReactNode;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex min-h-11 cursor-pointer items-center justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-heading">{title}</span>
        {description ? <span className="mt-0.5 block text-[13px] text-muted">{description}</span> : null}
      </span>
      <Switch id={id} checked={checked} onCheckedChange={onChange} aria-label={typeof title === "string" ? title : undefined} />
    </label>
  );
}

/**
 * Settings → Marketing Kit. Business defaults for the Property Website and Social Media Kit.
 * Per-project overrides live on each project's Marketing Kit card. Saved with the shared
 * Save Settings button (business_settings.settings.marketingKit).
 */
export function MarketingKitSettingsCard({ value, onChange }: { value: MarketingKitSettings; onChange: (next: MarketingKitSettings) => void }) {
  const patch = (p: Partial<MarketingKitSettings>) => onChange({ ...value, ...p });
  const patchProduct = (product: MarketingProduct, p: Partial<MarketingKitSettings["website"]>) => onChange({ ...value, [product]: { ...value[product], ...p } });
  const sum = (value.website.mode === "paid" ? value.website.priceCents : 0) + (value.social.mode === "paid" ? value.social.priceCents : 0);
  const bothPaid = value.website.offered && value.social.offered && value.website.mode === "paid" && value.social.mode === "paid";

  return (
    <div className="space-y-4">
      {/* Master switch */}
      <div className={cn(CARD, "p-5 sm:p-6")}>
        <label htmlFor="marketingKitShowToClients" className="flex cursor-pointer items-center gap-4">
          <IconTile>
            <Sparkles className="h-[18px] w-[18px]" aria-hidden />
          </IconTile>
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-semibold text-heading">Offer the Marketing Kit to clients</span>
            <span className="mt-0.5 block text-[13px] text-muted">
              Clients see it on delivered projects, with a preview and price. You can always use it yourself.
            </span>
          </span>
          <Switch
            id="marketingKitShowToClients"
            checked={value.showToClients}
            onCheckedChange={(v) => patch({ showToClients: v })}
            aria-label="Show Marketing Kit to clients"
          />
        </label>
        {!value.showToClients ? (
          <p className="mt-4 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 surface-dark:bg-amber-500/15 surface-dark:text-amber-300">
            Clients don&apos;t see it yet. You can still set things up below. Projects where you set an offer, include a product or
            publish a website still show it to that client.
          </p>
        ) : null}
      </div>

      {/* Everything else is dimmed (but still editable) while the kit is hidden from clients. */}
      <div className={cn("space-y-4 transition-opacity", !value.showToClients && "opacity-60 focus-within:opacity-100 hover:opacity-100")}>
        <div className="grid gap-4 md:grid-cols-2">
          {(["website", "social"] as MarketingProduct[]).map((product) => {
            const s = value[product];
            const Icon = PRODUCT_COPY[product].icon;
            const label = PRODUCT_LABEL[product];
            return (
              <div key={product} className={cn(CARD, "flex flex-col gap-4 p-5")}>
                <label htmlFor={`marketingKitOffer-${product}`} className="flex cursor-pointer items-center gap-3">
                  <IconTile active={s.offered}>
                    <Icon className="h-[18px] w-[18px]" aria-hidden />
                  </IconTile>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-semibold text-heading">{label}</span>
                    <span className="mt-0.5 block text-[13px] text-muted">{PRODUCT_COPY[product].blurb}</span>
                  </span>
                  <Switch
                    id={`marketingKitOffer-${product}`}
                    checked={s.offered}
                    onCheckedChange={(v) => patchProduct(product, { offered: v })}
                    aria-label={`Offer ${label}`}
                  />
                </label>

                <MarketingKitProductThumb product={product} muted={!s.offered} />

                {s.offered ? (
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="inline-flex rounded-xl bg-subtle p-1" role="radiogroup" aria-label={`${label} pricing`}>
                      {(["included", "paid"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={s.mode === m}
                          onClick={() => patchProduct(product, { mode: m })}
                          className={cn(
                            "min-h-9 rounded-lg px-3 text-sm font-medium transition-colors",
                            s.mode === m ? "bg-card text-heading shadow-sm" : "text-muted hover:text-foreground"
                          )}
                        >
                          {m === "included" ? "Included" : "Paid add-on"}
                        </button>
                      ))}
                    </div>
                    {s.mode === "paid" ? (
                      <div className="ml-auto w-32">
                        <CurrencyInput
                          valueCents={s.priceCents}
                          onChangeCents={(c) => patchProduct(product, { priceCents: c })}
                          aria-label={`${label} price`}
                        />
                      </div>
                    ) : (
                      <span className="ml-auto text-[13px] text-muted">Free with every project</span>
                    )}
                  </div>
                ) : (
                  <p className="text-[13px] text-muted">Off by default. You can still turn it on for a single project.</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bundle price */}
        <div className={cn(CARD, "flex flex-wrap items-center gap-4 px-5 py-4 sm:px-6")}>
          <IconTile active={false}>
            <Package className="h-[18px] w-[18px]" aria-hidden />
          </IconTile>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-heading">
              Bundle price <span className="font-normal text-muted">· optional</span>
            </p>
            <p className="mt-0.5 text-[13px] text-muted">
              {bothPaid
                ? `When a client buys both. Leave empty to charge ${formatCents(sum)}.`
                : "Available when both products are paid add-ons."}
            </p>
          </div>
          {bothPaid ? (
            <div className="w-32 sm:ml-auto">
              <CurrencyInput
                valueCents={value.bundlePriceCents ?? 0}
                onChangeCents={(c) => patch({ bundlePriceCents: c > 0 ? c : null })}
                placeholder={(sum / 100).toFixed(2)}
                aria-label="Bundle price"
              />
            </div>
          ) : null}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {/* What clients can do */}
          <div className={cn(CARD, "p-5 sm:p-6")}>
            <h3 className="text-base font-semibold text-heading">What clients can do</h3>
            <div className="mt-2 divide-y divide-border">
              {(
                [
                  ["clientCanEdit", "Customize their website", "Details, design, photos and branding"],
                  ["clientCanPublish", "Publish it themselves", "Once included or purchased"],
                  ["allowAddToInvoice", "Add to their invoice", "Pay later; unlocks when paid"],
                ] as const
              ).map(([key, label, hint]) => (
                <ToggleRow
                  key={key}
                  id={`marketingKit-${key}`}
                  title={label}
                  description={hint}
                  checked={value[key]}
                  onChange={(v) => patch({ [key]: v } as Partial<MarketingKitSettings>)}
                />
              ))}
            </div>
          </div>

          {/* Defaults */}
          <div className={cn(CARD, "p-5 sm:p-6")}>
            <h3 className="text-base font-semibold text-heading">Defaults</h3>
            <p className="mt-3 text-[13px] font-medium text-foreground">Starting design</p>
            <div className="mt-2 grid grid-cols-3 gap-2 sm:gap-2.5" role="radiogroup" aria-label="Starting design">
              {DESIGN_STYLES.map((d: DesignStyle) => {
                const selected = value.defaultTemplate === d;
                return (
                  <button
                    key={d}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    title={DESIGN_STYLE_META[d].blurb}
                    onClick={() => patch({ defaultTemplate: d })}
                    className={cn(
                      "rounded-xl border p-2 text-left transition-colors",
                      selected ? "border-accent ring-2 ring-accent/25" : "border-border hover:bg-subtle"
                    )}
                  >
                    <MarketingKitDesignSwatch style={d} />
                    <span className="mt-2 block truncate text-[13px] font-semibold text-heading">{DESIGN_STYLE_META[d].label}</span>
                    <span className="block truncate text-xs text-muted">{DESIGN_SHORT[d]}</span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-xs text-muted">A realtor&apos;s saved branding (including their favorite design) takes priority.</p>
            <div className="mt-2 divide-y divide-border">
              <ToggleRow
                id="marketingKitPhotographerCredit"
                title="“Photography by” credit"
                description="Your business name on website footers and flyers"
                checked={value.photographerCredit}
                onChange={(v) => patch({ photographerCredit: v })}
              />
              <ToggleRow
                id="marketingKitPoweredBy"
                title="“Powered by ShootPortal” credit"
                description="Small footer credit; can be turned off per website"
                checked={value.poweredBy}
                onChange={(v) => patch({ poweredBy: v })}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
