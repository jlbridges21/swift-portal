"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CurrencyInput } from "@/components/ui/currency-input";
import { cn } from "@/lib/utils";
import { DESIGN_STYLES, DESIGN_STYLE_META, PRODUCT_LABEL, type DesignStyle, type MarketingProduct } from "@/lib/marketing/model";
import { formatCents, type MarketingKitSettings } from "@/lib/marketing/offers";

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
      <Card className="shadow-sm">
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="font-semibold text-heading">Offer the Marketing Kit to clients</h3>
              <p className="mt-1 text-sm text-muted">
                When on, clients see a property website and social graphics already built from their delivered media — with a
                preview, and a price if it&apos;s a paid add-on. You can always use the Marketing Kit yourself from any project.
              </p>
            </div>
            <Switch checked={value.showToClients} onCheckedChange={(v) => patch({ showToClients: v })} aria-label="Show Marketing Kit to clients" />
          </div>
          {!value.showToClients ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted surface-dark:bg-subtle">
              Clients don&apos;t see it yet. Projects where you set an offer, include a product or publish a website still show it to that client.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {(["website", "social"] as MarketingProduct[]).map((product) => {
        const s = value[product];
        return (
          <Card key={product} className="shadow-sm">
            <CardContent className="space-y-4 pt-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h3 className="font-semibold text-heading">{PRODUCT_LABEL[product]}</h3>
                  <p className="mt-1 text-sm text-muted">
                    {product === "website"
                      ? "A premium single-property website with its own link, built from each project."
                      : "Square posts, Stories, an Instagram carousel and a print-ready flyer PDF."}
                  </p>
                </div>
                <Switch checked={s.offered} onCheckedChange={(v) => patchProduct(product, { offered: v })} aria-label={`Offer ${PRODUCT_LABEL[product]}`} />
              </div>
              {s.offered ? (
                <div className="flex flex-wrap items-end gap-4">
                  <div className="inline-flex rounded-lg bg-slate-100 p-1 surface-dark:bg-subtle" role="radiogroup" aria-label={`${PRODUCT_LABEL[product]} pricing`}>
                    {(["included", "paid"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="radio"
                        aria-checked={s.mode === m}
                        onClick={() => patchProduct(product, { mode: m })}
                        className={cn("rounded-md px-3 py-1.5 text-sm font-medium", s.mode === m ? "bg-white shadow-sm surface-dark:bg-card" : "text-muted")}
                      >
                        {m === "included" ? "Included free" : "Paid add-on"}
                      </button>
                    ))}
                  </div>
                  {s.mode === "paid" ? (
                    <div className="w-32 space-y-1">
                      <Label className="text-xs">Price</Label>
                      <CurrencyInput valueCents={s.priceCents} onChangeCents={(c) => patchProduct(product, { priceCents: c })} />
                    </div>
                  ) : null}
                </div>
              ) : (
                <p className="text-xs text-muted">Not offered by default. You can still turn it on for a single project.</p>
              )}
            </CardContent>
          </Card>
        );
      })}

      {bothPaid ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-wrap items-end justify-between gap-4 pt-6">
            <div>
              <h3 className="font-semibold text-heading">Bundle price (optional)</h3>
              <p className="mt-1 text-sm text-muted">When a client buys both together. Leave empty to charge {formatCents(sum)}.</p>
            </div>
            <div className="w-32">
              <CurrencyInput valueCents={value.bundlePriceCents ?? 0} onChangeCents={(c) => patch({ bundlePriceCents: c > 0 ? c : null })} placeholder={(sum / 100).toFixed(2)} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold text-heading">Client permissions</h3>
          {(
            [
              ["clientCanEdit", "Clients can customize", "Edit property details, design, photos and branding."],
              ["clientCanPublish", "Clients can publish their website", "Once included or purchased."],
              ["allowAddToInvoice", "Allow “Add to invoice”", "Clients can add an add-on to their project invoice and pay later. Access unlocks only when it's paid."],
            ] as const
          ).map(([key, label, hint]) => (
            <label key={key} className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-heading">{label}</span>
                <span className="block text-xs text-muted">{hint}</span>
              </span>
              <Switch checked={value[key]} onCheckedChange={(v) => patch({ [key]: v } as Partial<MarketingKitSettings>)} aria-label={label} />
            </label>
          ))}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardContent className="space-y-4 pt-6">
          <h3 className="font-semibold text-heading">Defaults</h3>
          <div>
            <Label className="text-xs">Starting design</Label>
            <div className="mt-2 flex flex-wrap gap-2">
              {DESIGN_STYLES.map((d: DesignStyle) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => patch({ defaultTemplate: d })}
                  className={cn("rounded-lg border px-3 py-2 text-left text-sm", value.defaultTemplate === d ? "border-accent bg-accent/5" : "border-border")}
                >
                  <span className="block font-medium">{DESIGN_STYLE_META[d].label}</span>
                  <span className="block text-xs text-muted">{DESIGN_STYLE_META[d].blurb}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">A realtor&apos;s saved branding (including their favorite design) takes priority.</p>
          </div>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-heading">“Photography by” credit</span>
              <span className="block text-xs text-muted">Show your business name in website footers and on flyers by default.</span>
            </span>
            <Switch checked={value.photographerCredit} onCheckedChange={(v) => patch({ photographerCredit: v })} aria-label="Photography credit" />
          </label>
          <label className="flex items-start justify-between gap-4">
            <span>
              <span className="block text-sm font-medium text-heading">“Powered by ShootPortal” credit</span>
              <span className="block text-xs text-muted">A small credit at the bottom of new property websites. You can still turn it off on any single website.</span>
            </span>
            <Switch checked={value.poweredBy} onCheckedChange={(v) => patch({ poweredBy: v })} aria-label="Powered by ShootPortal credit" />
          </label>
        </CardContent>
      </Card>
    </div>
  );
}
