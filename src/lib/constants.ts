export const PROJECT_STATUSES = [
  { value: "new_request", label: "New Request", clientLabel: "Request Received", order: 0 },
  { value: "quote_sent", label: "Quote Sent", clientLabel: "Review Proposal", order: 1 },
  { value: "proposal_approved", label: "Proposal Approved – Awaiting Schedule", clientLabel: "Scheduling Your Shoot", order: 2 },
  { value: "scheduled", label: "Scheduled", clientLabel: "Shoot Scheduled", order: 3 },
  { value: "shoot_complete_editing", label: "Shoot Complete", clientLabel: "Media in Production", order: 4 },
  { value: "ready_for_review", label: "Review", clientLabel: "Review Your Deliverables", order: 5 },
  { value: "awaiting_payment", label: "Approved – Awaiting Payment", clientLabel: "Final Payment", order: 6 },
  { value: "delivered", label: "Delivered", clientLabel: "Project Complete", order: 7 },
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number]["value"];

/** Map legacy DB values to current workflow */
export const LEGACY_STATUS_MAP: Record<string, ProjectStatus> = {
  lead_received: "new_request",
  shot_complete: "shoot_complete_editing",
  editing: "shoot_complete_editing",
  shoot_complete: "shoot_complete_editing",
  shoot_rescheduled: "proposal_approved",
  shoot_confirmed: "scheduled",
  review: "ready_for_review",
  approved: "awaiting_payment",
};

export function normalizeStatus(status: string): ProjectStatus {
  if (PROJECT_STATUSES.some((s) => s.value === status)) {
    return status as ProjectStatus;
  }
  return LEGACY_STATUS_MAP[status] ?? "new_request";
}

export const PROPERTY_TYPES = [
  "Residential",
  "Waterfront",
  "Land",
  "Commercial",
  "Construction Site",
  "Golf Course",
  "Resort",
  "Marina",
  "HOA / Community",
  "Roof / Inspection",
  "Other",
] as const;

/** DAM filter labels mapped to stored service_type values */
export const DAM_SERVICE_FILTERS = [
  { label: "Aerial Photography", value: "Aerial Photography" },
  { label: "Aerial Video", value: "Aerial Videography" },
  { label: "Exterior 360 Tour", value: "Exterior 360° Virtual Tour" },
  { label: "Real Estate Package", value: "Real Estate Media Package" },
  { label: "Commercial", value: "Commercial Aerial Media" },
  { label: "Construction", value: "Construction Progress Documentation" },
  { label: "Drone Mapping", value: "Drone Mapping" },
  { label: "Land Listing", value: "Land Listing Package" },
  { label: "Golf Course", value: "Golf Course & Resort Marketing" },
  { label: "Marina", value: "Marina & Waterfront Marketing" },
  { label: "HOA", value: "HOA & Community Marketing" },
  { label: "Roof Inspection", value: "Roof Inspection" },
  { label: "Property Documentation", value: "Property Documentation" },
  { label: "Event Coverage", value: "Event Coverage" },
] as const;

export const DAM_SUGGESTED_TAGS = [
  "Luxury",
  "Waterfront",
  "Sunset",
  "Twilight",
  "Construction",
  "Golf",
  "Commercial",
  "Residential",
  "Drone",
  "Hero Image",
  "Social Media",
  "MLS",
  "Cover Photo",
] as const;

export const SERVICE_TYPES = [
  "Aerial Photography",
  "Aerial Videography",
  "Exterior 360° Virtual Tour",
  "Drone Mapping",
  "Real Estate Media Package",
  "Commercial Aerial Media",
  "Event Coverage",
  "Construction Progress Documentation",
  "Land Listing Package",
  "Golf Course & Resort Marketing",
  "Roof Inspection",
  "Property Documentation",
  "Marina & Waterfront Marketing",
  "HOA & Community Marketing",
  "Custom Project",
] as const;

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/x-m4v", "video/m4v"];
export const ALLOWED_DOCUMENT_TYPES = [
  "application/pdf",
  "application/zip",
  "application/x-zip-compressed",
];

export function getStatusLabel(status: string, audience: "admin" | "client" = "admin"): string {
  const normalized = normalizeStatus(status);
  const found = PROJECT_STATUSES.find((s) => s.value === normalized);
  if (!found) return status;
  return audience === "client" ? found.clientLabel : found.label;
}

export function getClientStatusLabel(status: string): string {
  return getStatusLabel(status, "client");
}

export function getStatusOrder(status: string): number {
  const normalized = normalizeStatus(status);
  const found = PROJECT_STATUSES.find((s) => s.value === normalized);
  return found?.order ?? 0;
}

export function getStatusColor(status: string): string {
  const normalized = normalizeStatus(status);
  const colors: Record<string, string> = {
    new_request: "bg-slate-100 text-slate-700",
    quote_sent: "bg-violet-50 text-violet-700",
    proposal_approved: "bg-sky-50 text-sky-700",
    scheduled: "bg-blue-50 text-blue-700",
    shoot_complete_editing: "bg-indigo-50 text-indigo-700",
    ready_for_review: "bg-purple-50 text-purple-700",
    awaiting_payment: "bg-orange-50 text-orange-700",
    delivered: "bg-teal-50 text-teal-700",
  };
  return colors[normalized] ?? "bg-slate-100 text-slate-700";
}
