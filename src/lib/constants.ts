export const PROJECT_STATUSES = [
  { value: "new_request", label: "New Request", clientLabel: "Request Received", order: 0 },
  { value: "quote_sent", label: "Quote Sent", clientLabel: "Your Quote is Ready", order: 1 },
  { value: "proposal_approved", label: "Proposal Approved – Awaiting Schedule", clientLabel: "Awaiting Scheduling", order: 2 },
  { value: "scheduled", label: "Scheduled", clientLabel: "Shoot Scheduled", order: 3 },
  { value: "shoot_complete_editing", label: "Shoot Complete", clientLabel: "Media Being Prepared", order: 4 },
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

export const SERVICE_TYPES = [
  "Aerial Photography",
  "Aerial Videography",
  "360 Virtual Tour",
  "Drone Mapping",
  "Real Estate Media Package",
  "Commercial Aerial",
  "Event Coverage",
  "Other",
] as const;

export const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];
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
