"use client";

import { useEffect, useMemo, useState } from "react";
import { formatMoney } from "@/lib/tools/pricing-math";
import { todayIso } from "@/lib/tools/quote-model";
import { fileSlug, saveFile } from "@/lib/tools/logo";
import { trackEngagement } from "@/lib/analytics/engagement";
import {
  REAL_ESTATE_ADDONS,
  REAL_ESTATE_DEFAULTS as DEFAULTS,
  realEstatePriceSheet,
  sanitizeRealEstateState,
  type RealEstateState,
} from "@/lib/tools/defaults";
import { useToolState } from "@/components/tools/use-tool-state";
import { NumberField, Segmented, TextField } from "@/components/tools/controls";
import { BrandFields, useBrand } from "@/components/tools/brand-fields";
import { ChipToggles, MoreOptions, Step, ToolStudio } from "@/components/tools/studio";
import { PriceSheetDocument, sizeRange } from "@/components/tools/price-sheet-document";

export function RealEstateCalculator() {
  const { state: st, setState, reset } = useToolState<RealEstateState>({ storageKey: "sp:tool:real-estate:v2", defaults: DEFAULTS, sanitize: sanitizeRealEstateState, urlState: false });
  const { brand, setBrand } = useBrand();
  const sheet = useMemo(() => realEstatePriceSheet(st), [st]);
  const [issued, setIssued] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setIssued(todayIso()), []);

  function set(patch: Partial<RealEstateState>) {
    setState((s) => ({ ...s, ...patch }));
    trackEngagement("tool:real-estate-calculator:calculated");
  }
  function toggleAddOn(id: string) {
    setState((s) => ({ ...s, addOns: s.addOns.includes(id) ? s.addOns.filter((a) => a !== id) : [...s.addOns, id] }));
    trackEngagement("tool:real-estate-calculator:calculated");
  }

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const { buildPriceSheetPdf } = await import("@/lib/tools/price-sheet-pdf");
      saveFile(await buildPriceSheetPdf({ brand, sheet, title: st.title, note: st.note, issued }), `${fileSlug(brand.name, "price-list")}.pdf`);
      trackEngagement("tool:real-estate-calculator:pdf", { once: false });
    } catch {
      setError("The PDF couldn't be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const mid = sheet.packages[1]!;

  const form = (
    <>
      <Step n={1} title="Your rates" hint="Four quick answers. The starting numbers are examples: change any of them.">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="Your hourly rate" prefix="$" suffix="/hour" value={st.hourlyRate} onChange={(hourlyRate) => set({ hourlyRate })} max={10000} hint="What you pay yourself." />
          <NumberField label="Miles to a typical listing" suffix="miles" value={st.travelMiles} onChange={(travelMiles) => set({ travelMiles })} max={10000} hint="Round trip." />
          <Segmented
            label="Who edits the photos?"
            value={st.editMode}
            options={[
              { value: "inhouse", label: "I do" },
              { value: "outsourced", label: "I outsource" },
            ]}
            onChange={(editMode) => set({ editMode })}
          />
          {st.editMode === "outsourced" ? (
            <NumberField label="Editing cost per photo" prefix="$" value={st.outsourcedCostPerPhoto} onChange={(outsourcedCostPerPhoto) => set({ outsourcedCostPerPhoto })} max={1000} />
          ) : (
            <NumberField label="Your editing time per photo" suffix="min" value={st.editMinutesPerPhoto} onChange={(editMinutesPerPhoto) => set({ editMinutesPerPhoto })} max={240} />
          )}
        </div>

        <div className="mt-5">
          <ChipToggles label="Add-ons you offer" options={REAL_ESTATE_ADDONS.map((a) => ({ id: a.id, label: a.label }))} selected={st.addOns} onToggle={toggleAddOn} />
        </div>

        <MoreOptions label="Fine-tune the math (optional)">
          <NumberField
            label="Business costs per shoot"
            prefix="$"
            value={st.businessCostPerShoot}
            onChange={(businessCostPerShoot) => set({ businessCostPerShoot })}
            max={1000000}
            hint="Insurance, gear, software, and phone, spread across your shoots. Example: $6,000 a year ÷ 200 shoots = $30."
          />
          <NumberField label="Profit (share of the price)" suffix="%" value={st.profitPct} onChange={(profitPct) => set({ profitPct })} max={90} hint="What the business keeps after paying you and its costs." />
          <NumberField label="Drive time" suffix="min" value={st.travelMinutes} onChange={(travelMinutes) => set({ travelMinutes })} max={1440} hint="Round trip to a typical listing." />
          <NumberField label="Cost per mile" prefix="$" value={st.mileageRate} onChange={(mileageRate) => set({ mileageRate })} max={50} hint="Fuel and wear on your vehicle." />
          <Segmented
            label="Round prices up to"
            value={String(st.roundTo)}
            options={[
              { value: "1", label: "$1" },
              { value: "5", label: "$5" },
              { value: "10", label: "$10" },
              { value: "25", label: "$25" },
            ]}
            onChange={(v) => set({ roundTo: Number(v) })}
            wide
          />
        </MoreOptions>

        <div className="mt-5 rounded-2xl bg-[#0B1124] p-5 text-white" aria-live="polite">
          <p className="text-sm text-slate-300">Your package prices</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
            {sheet.packages.map((p) => (
              <div key={p.upTo}>
                <dt className="text-xs text-slate-400">{sizeRange(p.from, p.upTo)}</dt>
                <dd className="text-2xl font-bold tabular-nums">{formatMoney(p.price, { whole: true })}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">
            A {mid.name.toLowerCase()} shoot costs you about {formatMoney(Math.round(mid.cost), { whole: true })} and leaves{" "}
            <span className="font-semibold text-white">{formatMoney(Math.round(mid.profit), { whole: true })} profit</span>.
          </p>
        </div>
      </Step>

      <Step n={2} title="Add your business" hint="Your logo and details go on the price list. Saved on this device for next time.">
        <BrandFields brand={brand} onChange={(patch) => setBrand((b) => ({ ...b, ...patch }))} />
      </Step>

      <Step n={3} title="Personalize the price list" hint="Optional. Change the heading or the note agents see.">
        <div className="grid gap-4">
          <TextField label="Heading" value={st.title} onChange={(title) => set({ title })} maxLength={80} />
          <TextField label="Note for agents" value={st.note} onChange={(note) => set({ note })} multiline maxLength={600} />
        </div>
      </Step>
    </>
  );

  return (
    <ToolStudio
      id="price-list"
      form={form}
      preview={<PriceSheetDocument brand={brand} sheet={sheet} title={st.title} note={st.note} issued={issued} />}
      barLabel={`${mid.name} (${sizeRange(mid.from, mid.upTo)})`}
      barValue={formatMoney(mid.price, { whole: true })}
      onDownload={download}
      busy={busy}
      error={error}
      onReset={() => {
        reset();
        trackEngagement("tool:real-estate-calculator:reset", { once: false });
      }}
    />
  );
}
