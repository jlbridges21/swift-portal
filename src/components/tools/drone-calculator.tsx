"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, Clapperboard, HardHat, Home, Map, PartyPopper } from "lucide-react";
import { calculateDrone, formatHours, formatMoney } from "@/lib/tools/pricing-math";
import { blankQuote, DEFAULT_TERMS, todayIso, type Quote } from "@/lib/tools/quote-model";
import type { Brand } from "@/lib/tools/brand";
import { fileSlug, saveFile } from "@/lib/tools/logo";
import { trackEngagement } from "@/lib/analytics/engagement";
import {
  DRONE_DEFAULTS as DEFAULTS,
  DRONE_EXTRAS,
  DRONE_JOB_TYPES as JOB_TYPES,
  droneInputs,
  sanitizeDroneState,
  type DroneExtraId,
  type DroneJobType,
  type DroneState,
} from "@/lib/tools/defaults";
import { useToolState } from "@/components/tools/use-tool-state";
import { NumberField, Segmented, TextField } from "@/components/tools/controls";
import { BrandFields, useBrand } from "@/components/tools/brand-fields";
import { ChipToggles, ChoiceGrid, MoreOptions, ResultCard, Step, ToolStudio } from "@/components/tools/studio";
import { QuoteDocument } from "@/components/tools/quote-document";

const ICONS: Record<DroneJobType, React.ReactNode> = {
  "real-estate": <Home className="h-5 w-5" aria-hidden />,
  construction: <HardHat className="h-5 w-5" aria-hidden />,
  inspection: <Building2 className="h-5 w-5" aria-hidden />,
  commercial: <Clapperboard className="h-5 w-5" aria-hidden />,
  event: <PartyPopper className="h-5 w-5" aria-hidden />,
  mapping: <Map className="h-5 w-5" aria-hidden />,
};

const NOTES = "Flights depend on weather and airspace. If conditions aren’t safe on the day, we’ll reschedule at no extra charge.";

/** The client-facing quote built from the calculator's answers. */
export function droneQuote(st: DroneState, brand: Brand, price: number, meta: { number: string; issued: string }): Quote {
  const job = JOB_TYPES[st.jobType];
  const extras = DRONE_EXTRAS.filter((e) => st.extras.includes(e.id)).map((e) => e.label.toLowerCase());
  const detail = [st.description.trim(), extras.length ? `Includes ${extras.join(", ")}.` : ""].filter(Boolean).join(" ");
  return {
    ...blankQuote("drone"),
    business: brand,
    client: { name: st.client.name, company: st.client.company, email: st.client.email },
    project: { title: job.title, location: st.client.location, date: st.client.date },
    number: meta.number,
    issued: meta.issued,
    lines: [{ id: "job", description: job.title, detail, quantity: 1, unitPrice: price }],
    depositType: st.depositPct > 0 ? "percent" : "none",
    depositValue: st.depositPct,
    notes: NOTES,
    terms: DEFAULT_TERMS,
  };
}

export function DroneCalculator() {
  const { state: st, setState, reset } = useToolState<DroneState>({ storageKey: "sp:tool:drone:v2", defaults: DEFAULTS, sanitize: sanitizeDroneState, urlState: false });
  const { brand, setBrand } = useBrand();
  const r = useMemo(() => calculateDrone(droneInputs(st)), [st]);
  const [meta, setMeta] = useState({ number: "", issued: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Quote number and date are set on the client (avoids a server/client date mismatch).
  useEffect(() => {
    const d = todayIso();
    setMeta({ issued: d, number: `Q-${d.replace(/-/g, "")}-${Math.floor(100 + Math.random() * 900)}` });
  }, []);

  const quote = useMemo(() => droneQuote(st, brand, r.price, meta), [st, brand, r.price, meta]);

  function set(patch: Partial<DroneState>) {
    setState((s) => ({ ...s, ...patch }));
    trackEngagement("tool:drone-calculator:calculated");
  }
  function chooseJob(jobType: DroneJobType) {
    const job = JOB_TYPES[jobType];
    set({ jobType, hours: job.hours, description: job.description });
  }
  function toggleExtra(id: string) {
    setState((s) => ({ ...s, extras: s.extras.includes(id as DroneExtraId) ? s.extras.filter((e) => e !== id) : [...s.extras, id as DroneExtraId] }));
    trackEngagement("tool:drone-calculator:calculated");
  }
  const setClient = (patch: Partial<DroneState["client"]>) => set({ client: { ...st.client, ...patch } });

  async function download() {
    setBusy(true);
    setError(null);
    try {
      const { buildQuotePdf } = await import("@/lib/tools/quote-pdf");
      saveFile(await buildQuotePdf(quote), `${fileSlug(brand.name, "drone-quote", st.client.name)}.pdf`);
      trackEngagement("tool:drone-calculator:pdf", { once: false });
    } catch {
      setError("The PDF couldn't be created. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const form = (
    <>
      <Step n={1} title="Tell us about the job" hint="Pick the closest match. The starting numbers are examples: change any of them.">
        <ChoiceGrid label="Type of job" value={st.jobType} onChange={chooseJob} options={(Object.keys(JOB_TYPES) as DroneJobType[]).map((k) => ({ value: k, label: JOB_TYPES[k].label, icon: ICONS[k] }))} />

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <NumberField label="Hours of work" suffix="hours" value={st.hours} onChange={(hours) => set({ hours })} max={500} hint="Planning, flying, editing, and driving." />
          <NumberField label="Your hourly rate" prefix="$" suffix="/hour" value={st.hourlyRate} onChange={(hourlyRate) => set({ hourlyRate })} max={10000} hint="What you pay yourself." />
          <NumberField label="Miles driven" suffix="miles" value={st.travelMiles} onChange={(travelMiles) => set({ travelMiles })} max={10000} hint="Round trip." />
        </div>

        <div className="mt-5">
          <ChipToggles
            label="Extras the client wants (optional)"
            options={DRONE_EXTRAS.map((e) => ({ id: e.id, label: e.label, note: "rushPct" in e ? `+${e.rushPct}%` : e.hours < 1 ? `+${Math.round(e.hours * 60)} min` : `+${formatHours(e.hours)}` }))}
            selected={st.extras}
            onToggle={toggleExtra}
          />
        </div>

        <MoreOptions label="Fine-tune the math (optional)">
          <NumberField
            label="Business costs per job"
            prefix="$"
            value={st.businessCostPerJob}
            onChange={(businessCostPerJob) => set({ businessCostPerJob })}
            max={1000000}
            hint="Insurance, gear, software, and phone, spread across your jobs. Example: $6,000 a year ÷ 75 jobs = $80."
          />
          <NumberField label="Profit (share of the price)" suffix="%" value={st.profitPct} onChange={(profitPct) => set({ profitPct })} max={90} hint="What the business keeps after paying you and its costs." />
          <NumberField label="Cost per mile" prefix="$" value={st.mileageRate} onChange={(mileageRate) => set({ mileageRate })} max={50} hint="Fuel and wear on your vehicle." />
          <NumberField label="Deposit to book" suffix="%" value={st.depositPct} onChange={(depositPct) => set({ depositPct })} max={100} hint="Shown on the quote. Use 0 for none." />
          <Segmented
            label="Round the price up to"
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

        <ResultCard label="Charge this" value={formatMoney(r.price, { whole: true })}>
          It covers {formatMoney(Math.round(r.totalCost), { whole: true })} for your time, travel, and business costs and leaves{" "}
          <span className="font-semibold text-white">{formatMoney(Math.round(r.profit), { whole: true })} profit</span>
          {r.effectiveHourly ? <>, or about {formatMoney(Math.round(r.effectiveHourly), { whole: true })} for every hour of work</> : null}.
        </ResultCard>
      </Step>

      <Step n={2} title="Add your business" hint="Your logo and details go on the quote. Saved on this device for next time.">
        <BrandFields brand={brand} onChange={(patch) => setBrand((b) => ({ ...b, ...patch }))} />
      </Step>

      <Step n={3} title="Who is it for?" hint="Optional. Leave blank to fill in by hand later.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Client name" value={st.client.name} onChange={(name) => setClient({ name })} placeholder="e.g. Jordan Lee" />
          <TextField label="Company" value={st.client.company} onChange={(company) => setClient({ company })} placeholder="e.g. Harbor Realty" />
          <TextField label="Job address or location" value={st.client.location} onChange={(location) => setClient({ location })} wide />
          <TextField label="Shoot date" type="date" value={st.client.date} onChange={(date) => setClient({ date })} />
          <TextField label="Client email" type="email" value={st.client.email} onChange={(email) => setClient({ email })} />
          <TextField label="What's included (shown on the quote)" value={st.description} onChange={(description) => set({ description })} multiline maxLength={300} wide />
        </div>
      </Step>
    </>
  );

  return (
    <ToolStudio
      id="drone-quote"
      form={form}
      preview={<QuoteDocument quote={quote} />}
      barLabel="Your price"
      barValue={formatMoney(r.price, { whole: true })}
      onDownload={download}
      busy={busy}
      error={error}
      onReset={() => {
        reset();
        trackEngagement("tool:drone-calculator:reset", { once: false });
      }}
    />
  );
}
