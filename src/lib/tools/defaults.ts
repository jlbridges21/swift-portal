import { calculateRealEstate, clampNumber, ROUNDING_STEPS, type DroneInputs, type RealEstateAddOn, type RealEstateInputs } from "@/lib/tools/pricing-math";

/**
 * Starting values and the simple models behind the free calculators. The visitor answers a
 * handful of plain questions; everything else has a sensible starting value under "Fine-tune".
 * Starting values are examples to replace, never market prices. Shared by the client tools and
 * the server-rendered worked examples on each tool page.
 */

const s = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
const roundStep = (v: unknown) => (ROUNDING_STEPS.includes(v as (typeof ROUNDING_STEPS)[number]) ? (v as number) : 5);

/** Client and job details printed on a document. */
export type DocClient = { name: string; company: string; email: string; location: string; date: string };
const EMPTY_CLIENT: DocClient = { name: "", company: "", email: "", location: "", date: "" };
function sanitizeClient(c: DocClient): DocClient {
  return { name: s(c?.name, 80), company: s(c?.company, 100), email: s(c?.email, 120), location: s(c?.location, 160), date: s(c?.date, 10) };
}

// ---------------------------------------------------------------- drone

/** Typical total hours per job type (planning, flying, editing, and driving): a starting point only. */
export const DRONE_JOB_TYPES = {
  "real-estate": { label: "Real estate", title: "Real estate aerial photography", hours: 4, description: "Aerial photos of the property and its surroundings, edited and delivered online." },
  construction: { label: "Construction progress", title: "Construction progress aerials", hours: 5, description: "Aerial progress photos of the site from consistent angles, delivered online." },
  inspection: { label: "Roof or site inspection", title: "Aerial roof or site inspection", hours: 5, description: "Detailed aerial photos of the roof or site, delivered as high-resolution files." },
  commercial: { label: "Commercial video", title: "Commercial aerial video", hours: 10, description: "Aerial video for your brand or project: planning, filming, and an edited video." },
  event: { label: "Event coverage", title: "Aerial event coverage", hours: 8, description: "Aerial photo and video coverage of your event, edited and delivered online." },
  mapping: { label: "Mapping or survey", title: "Drone mapping or survey", hours: 8, description: "A planned mapping flight with processed map outputs for your site." },
} as const;
export type DroneJobType = keyof typeof DRONE_JOB_TYPES;

/** Optional extras: each adds work time. Rush adds a percentage to the price. */
export const DRONE_EXTRAS = [
  { id: "video", label: "Aerial video clip", hours: 2 },
  { id: "social", label: "Vertical social edit", hours: 1.5 },
  { id: "raw", label: "Raw footage", hours: 0.5 },
  { id: "rush", label: "Rush delivery", rushPct: 25 },
] as const;
export type DroneExtraId = (typeof DRONE_EXTRAS)[number]["id"];

export type DroneState = {
  jobType: DroneJobType;
  /** Total hours of work: planning, flying, editing, and driving. */
  hours: number;
  hourlyRate: number;
  /** Round-trip miles. */
  travelMiles: number;
  extras: DroneExtraId[];
  // Fine-tune
  /** Insurance, gear, software, and other running costs, as a share per job. */
  businessCostPerJob: number;
  /** Profit as a share of the price (margin). */
  profitPct: number;
  mileageRate: number;
  depositPct: number;
  roundTo: number;
  // Document
  description: string;
  client: DocClient;
};

export const DRONE_DEFAULTS: DroneState = {
  jobType: "real-estate",
  hours: DRONE_JOB_TYPES["real-estate"].hours,
  hourlyRate: 75,
  travelMiles: 30,
  extras: [],
  businessCostPerJob: 80,
  profitPct: 20,
  mileageRate: 0.7,
  depositPct: 50,
  roundTo: 5,
  description: DRONE_JOB_TYPES["real-estate"].description,
  client: EMPTY_CLIENT,
};

export function sanitizeDroneState(st: DroneState): DroneState {
  const jobType = (Object.keys(DRONE_JOB_TYPES) as DroneJobType[]).includes(st.jobType) ? st.jobType : "real-estate";
  const ids = DRONE_EXTRAS.map((e) => e.id) as readonly string[];
  return {
    jobType,
    hours: clampNumber(st.hours, 0, 500, DRONE_JOB_TYPES[jobType].hours),
    hourlyRate: clampNumber(st.hourlyRate, 0, 10_000, 75),
    travelMiles: clampNumber(st.travelMiles, 0, 10_000),
    extras: (Array.isArray(st.extras) ? st.extras : []).filter((e): e is DroneExtraId => ids.includes(e)),
    businessCostPerJob: clampNumber(st.businessCostPerJob, 0, 1_000_000, 80),
    profitPct: clampNumber(st.profitPct, 0, 90, 20),
    mileageRate: clampNumber(st.mileageRate, 0, 50, 0.7),
    depositPct: clampNumber(st.depositPct, 0, 100, 50),
    roundTo: roundStep(st.roundTo),
    description: typeof st.description === "string" ? st.description.slice(0, 300) : DRONE_JOB_TYPES[jobType].description,
    client: sanitizeClient({ ...EMPTY_CLIENT, ...st.client }),
  };
}

/** Maps the simple answers onto the full pricing model (lib/tools/pricing-math.ts). */
export function droneInputs(st: DroneState): DroneInputs {
  const extras = DRONE_EXTRAS.filter((e) => st.extras.includes(e.id));
  return {
    planningHours: 0,
    flightHours: st.hours,
    editingHours: 0,
    travelHours: 0,
    travelMiles: st.travelMiles,
    hourlyRate: st.hourlyRate,
    mileageRate: st.mileageRate,
    jobCosts: 0,
    annualOverhead: st.businessCostPerJob,
    jobsPerYear: 1,
    profitPct: st.profitPct,
    profitMode: "margin",
    rushPct: extras.reduce((n, e) => n + ("rushPct" in e ? e.rushPct : 0), 0),
    depositPct: st.depositPct,
    roundTo: st.roundTo,
    extras: extras.filter((e) => "hours" in e).map((e) => ({ id: e.id, label: e.label, enabled: true, hours: "hours" in e ? e.hours : 0, cost: 0 })),
  };
}

// ---------------------------------------------------------------- real estate

/** Starting time per add-on (minutes) — not prices. */
export const REAL_ESTATE_ADDONS: RealEstateAddOn[] = [
  { id: "drone", label: "Drone photos", enabled: false, onSiteMinutes: 20, editMinutes: 20, cost: 0 },
  { id: "video", label: "Walkthrough video", enabled: false, onSiteMinutes: 45, editMinutes: 120, cost: 0 },
  { id: "twilight", label: "Twilight photos", enabled: false, onSiteMinutes: 45, editMinutes: 30, cost: 0 },
  { id: "tour", label: "3D / 360° tour", enabled: false, onSiteMinutes: 30, editMinutes: 15, cost: 0 },
  { id: "floorplan", label: "Floor plan", enabled: false, onSiteMinutes: 15, editMinutes: 0, cost: 0 },
];

/** Package sizes on the price sheet (upper bound, sq ft) and how many photos each gets. */
export const REAL_ESTATE_PACKAGES = [
  { name: "Small home", upTo: 1500, photos: 20 },
  { name: "Medium home", upTo: 2500, photos: 30 },
  { name: "Large home", upTo: 3500, photos: 40 },
  { name: "Estate", upTo: 5000, photos: 50 },
] as const;

export type RealEstateState = {
  hourlyRate: number;
  /** Round-trip miles to a typical listing. */
  travelMiles: number;
  editMode: "inhouse" | "outsourced";
  addOns: string[];
  // Fine-tune
  editMinutesPerPhoto: number;
  outsourcedCostPerPhoto: number;
  businessCostPerShoot: number;
  profitPct: number;
  mileageRate: number;
  travelMinutes: number;
  roundTo: number;
  // Document
  title: string;
  note: string;
};

export const REAL_ESTATE_DEFAULTS: RealEstateState = {
  hourlyRate: 60,
  travelMiles: 25,
  editMode: "inhouse",
  addOns: ["drone", "video", "twilight"],
  editMinutesPerPhoto: 3,
  outsourcedCostPerPhoto: 2,
  businessCostPerShoot: 30,
  profitPct: 25,
  mileageRate: 0.7,
  travelMinutes: 40,
  roundTo: 5,
  title: "Real estate photography pricing",
  note: "Every package includes professionally edited photos delivered in an online gallery. Homes over 5,000 sq ft are quoted individually.",
};

export function sanitizeRealEstateState(st: RealEstateState): RealEstateState {
  const ids = REAL_ESTATE_ADDONS.map((a) => a.id);
  return {
    hourlyRate: clampNumber(st.hourlyRate, 0, 10_000, 60),
    travelMiles: clampNumber(st.travelMiles, 0, 10_000),
    editMode: st.editMode === "outsourced" ? "outsourced" : "inhouse",
    addOns: (Array.isArray(st.addOns) ? st.addOns : []).filter((a) => ids.includes(a)),
    editMinutesPerPhoto: clampNumber(st.editMinutesPerPhoto, 0, 240, 3),
    outsourcedCostPerPhoto: clampNumber(st.outsourcedCostPerPhoto, 0, 1000, 2),
    businessCostPerShoot: clampNumber(st.businessCostPerShoot, 0, 1_000_000, 30),
    profitPct: clampNumber(st.profitPct, 0, 90, 25),
    mileageRate: clampNumber(st.mileageRate, 0, 50, 0.7),
    travelMinutes: clampNumber(st.travelMinutes, 0, 1440, 40),
    roundTo: roundStep(st.roundTo),
    title: s(st.title, 80),
    note: s(st.note, 600),
  };
}

/** Full pricing-model inputs for a home of the given size (lib/tools/pricing-math.ts). */
export function realEstateInputs(st: RealEstateState, squareFeet: number, photoCount: number): RealEstateInputs {
  return {
    squareFeet,
    photoCount,
    baseShootMinutes: 30,
    shootMinutesPer1000: 15,
    editMode: st.editMode,
    editMinutesPerPhoto: st.editMinutesPerPhoto,
    outsourcedCostPerPhoto: st.outsourcedCostPerPhoto,
    adminMinutes: 20,
    travelMinutes: st.travelMinutes,
    travelMiles: st.travelMiles,
    hourlyRate: st.hourlyRate,
    mileageRate: st.mileageRate,
    annualOverhead: st.businessCostPerShoot,
    jobsPerYear: 1,
    profitPct: st.profitPct,
    profitMode: "margin",
    roundTo: st.roundTo,
    addOns: REAL_ESTATE_ADDONS.map((a) => ({ ...a, enabled: st.addOns.includes(a.id) })),
  };
}

export type PriceSheet = {
  packages: { name: string; from: number; upTo: number; photos: number; price: number; cost: number; profit: number; hours: number }[];
  addOns: { id: string; label: string; price: number }[];
};

/** Package prices by home size plus add-on prices, from the visitor's answers. */
export function realEstatePriceSheet(st: RealEstateState): PriceSheet {
  const packages = REAL_ESTATE_PACKAGES.map((p, i) => {
    const r = calculateRealEstate(realEstateInputs(st, p.upTo, p.photos));
    return {
      name: p.name,
      from: i ? REAL_ESTATE_PACKAGES[i - 1]!.upTo + 1 : 0,
      upTo: p.upTo,
      photos: p.photos,
      price: r.base.price,
      cost: r.base.totalCost,
      profit: r.base.profit,
      hours: r.base.hours,
    };
  });
  // Add-on prices don't depend on the home's size.
  const addOns = calculateRealEstate(realEstateInputs(st, 2000, 25))
    .addOns.filter((a) => st.addOns.includes(a.id))
    .map((a) => ({ id: a.id, label: a.label, price: a.price }));
  return { packages, addOns };
}
