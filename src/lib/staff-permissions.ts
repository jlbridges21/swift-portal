/**
 * Staff permission model (Phase 2).
 *
 * Storage: profiles.staff_permissions JSONB, loaded with every getProfile.
 * Missing / unknown keys = DENIED. Never default unrecognized keys to allowed.
 * Versioned shape so future keys can be added without breaking stored values.
 *
 * Phase 2 defines + stores only. Enforcement is Phase 3 — staff remain denied
 * on all 172 admin checks regardless of what is stored here.
 */

export const STAFF_PERMISSIONS_VERSION = 1 as const;

/** Keys that may never be stored or toggled — owner/admin only. */
export const NEVER_DELEGABLE_PERMISSION_KEYS = [
  "billing",
  "subscription",
  "staff_management",
  "partner_program",
  "custom_domain",
  "stripe_connect",
  "delete_business",
] as const;

export type NeverDelegablePermissionKey = (typeof NEVER_DELEGABLE_PERMISSION_KEYS)[number];

/**
 * Canonical permission keys. Defaults are all false (DENIED).
 * Grouped for UI; storage is a flat Record<key, boolean> plus `v`.
 */
export const STAFF_PERMISSION_KEYS = [
  // Area access — can they reach this part of the app at all
  "area.projects",
  "area.clients",
  "area.media",
  "area.calendar",
  "area.messages",
  // Projects (within assigned, unless view_all)
  "projects.view_all",
  "projects.create",
  "projects.edit",
  "projects.delete",
  "projects.manage_staff",
  // Clients
  "clients.create",
  "clients.edit",
  "clients.add_to_projects",
  // Media
  "media.upload",
  "media.delete",
  "media.organize",
  "media.download_originals",
  // Video review
  "video_review.comment",
  "video_review.resolve",
  "video_review.upload_versions",
  // Scheduling
  "scheduling.propose",
  "scheduling.confirm",
  // Money — default OFF
  "money.view",
  "money.create_send_estimates",
  "money.send_payment_links",
  "money.mark_paid",
  // Messages
  "messages.send",
  // Sharing — two separate permissions
  "sharing.email",
  "sharing.anyone_with_link",
] as const;

export type StaffPermissionKey = (typeof STAFF_PERMISSION_KEYS)[number];

export type StaffPermissions = {
  v: typeof STAFF_PERMISSIONS_VERSION;
} & Partial<Record<StaffPermissionKey, boolean>>;

export type StaffPermissionGroupId =
  | "areas"
  | "projects"
  | "clients"
  | "media"
  | "video_review"
  | "scheduling"
  | "money"
  | "messages"
  | "sharing";

export type StaffPermissionMeta = {
  key: StaffPermissionKey;
  label: string;
  description: string;
  group: StaffPermissionGroupId;
  /** Default when unset — always false (DENIED). */
  default: false;
};

export const STAFF_PERMISSION_META: StaffPermissionMeta[] = [
  {
    key: "area.projects",
    label: "Projects",
    description: "Reach the Projects area at all.",
    group: "areas",
    default: false,
  },
  {
    key: "area.clients",
    label: "Clients",
    description: "Reach the Clients area at all.",
    group: "areas",
    default: false,
  },
  {
    key: "area.media",
    label: "Media library",
    description: "Reach the Media library at all.",
    group: "areas",
    default: false,
  },
  {
    key: "area.calendar",
    label: "Calendar",
    description: "Reach the Calendar at all.",
    group: "areas",
    default: false,
  },
  {
    key: "area.messages",
    label: "Messages",
    description: "Reach the Messages area at all.",
    group: "areas",
    default: false,
  },
  {
    key: "projects.view_all",
    label: "View all projects",
    description: "See every project, not only assigned ones.",
    group: "projects",
    default: false,
  },
  {
    key: "projects.create",
    label: "Create projects",
    description: "Create new projects (auto-assigned on create).",
    group: "projects",
    default: false,
  },
  {
    key: "projects.edit",
    label: "Edit project details",
    description: "Change name, status, address, notes, etc.",
    group: "projects",
    default: false,
  },
  {
    key: "projects.delete",
    label: "Delete / archive projects",
    description: "Hide or permanently remove projects.",
    group: "projects",
    default: false,
  },
  {
    key: "projects.manage_staff",
    label: "Manage project staff",
    description: "Assign or remove staff on projects they can access.",
    group: "projects",
    default: false,
  },
  {
    key: "clients.create",
    label: "Create clients",
    description: "Add new CRM clients.",
    group: "clients",
    default: false,
  },
  {
    key: "clients.edit",
    label: "Edit clients",
    description: "Update client contact details and notes.",
    group: "clients",
    default: false,
  },
  {
    key: "clients.add_to_projects",
    label: "Add clients to projects",
    description: "Attach clients to projects.",
    group: "clients",
    default: false,
  },
  {
    key: "media.upload",
    label: "Upload media",
    description: "Upload photos, video, and files.",
    group: "media",
    default: false,
  },
  {
    key: "media.delete",
    label: "Delete media",
    description: "Remove media assets.",
    group: "media",
    default: false,
  },
  {
    key: "media.organize",
    label: "Organize media",
    description: "Reorder, folders, hero, hide/show.",
    group: "media",
    default: false,
  },
  {
    key: "media.download_originals",
    label: "Download originals",
    description: "Download original-quality files.",
    group: "media",
    default: false,
  },
  {
    key: "video_review.comment",
    label: "Comment on reviews",
    description: "Leave feedback on video reviews.",
    group: "video_review",
    default: false,
  },
  {
    key: "video_review.resolve",
    label: "Resolve & reopen feedback",
    description: "Mark review comments resolved or reopen them.",
    group: "video_review",
    default: false,
  },
  {
    key: "video_review.upload_versions",
    label: "Upload new versions",
    description: "Upload replacement video versions for review.",
    group: "video_review",
    default: false,
  },
  {
    key: "scheduling.propose",
    label: "Propose shoot times",
    description: "Send shoot time proposals to clients.",
    group: "scheduling",
    default: false,
  },
  {
    key: "scheduling.confirm",
    label: "Confirm & reschedule shoots",
    description: "Confirm or reschedule shoot dates.",
    group: "scheduling",
    default: false,
  },
  {
    key: "money.view",
    label: "View estimates & payments",
    description: "See estimates, invoices, and payment status.",
    group: "money",
    default: false,
  },
  {
    key: "money.create_send_estimates",
    label: "Create & send estimates",
    description: "Build and send estimates / proposals.",
    group: "money",
    default: false,
  },
  {
    key: "money.send_payment_links",
    label: "Send payment links",
    description: "Send Stripe payment links to clients.",
    group: "money",
    default: false,
  },
  {
    key: "money.mark_paid",
    label: "Mark payments paid",
    description: "Manually mark payments as paid.",
    group: "money",
    default: false,
  },
  {
    key: "messages.send",
    label: "Send messages to clients",
    description: "Send portal messages to clients.",
    group: "messages",
    default: false,
  },
  {
    key: "sharing.email",
    label: "Share projects by email",
    description: "Invite a named person to view a project.",
    group: "sharing",
    default: false,
  },
  {
    key: "sharing.anyone_with_link",
    label: 'Set a project to "Anyone with link"',
    description: "Make a project publicly viewable via link.",
    group: "sharing",
    default: false,
  },
];

export const STAFF_PERMISSION_GROUP_LABELS: Record<StaffPermissionGroupId, string> = {
  areas: "Area access",
  projects: "Projects",
  clients: "Clients",
  media: "Media",
  video_review: "Video review",
  scheduling: "Scheduling",
  money: "Money",
  messages: "Messages",
  sharing: "Sharing",
};

const KEY_SET = new Set<string>(STAFF_PERMISSION_KEYS);
const NEVER_SET = new Set<string>(NEVER_DELEGABLE_PERMISSION_KEYS);

export function emptyStaffPermissions(): StaffPermissions {
  const out: StaffPermissions = { v: STAFF_PERMISSIONS_VERSION };
  for (const key of STAFF_PERMISSION_KEYS) {
    out[key] = false;
  }
  return out;
}

/**
 * Read a single permission. Missing, unknown, or non-true → DENIED.
 * Never-delegable keys always deny (even if somehow stored).
 */
export function hasStaffPermission(
  raw: unknown,
  key: string
): boolean {
  if (NEVER_SET.has(key)) return false;
  if (!KEY_SET.has(key)) return false;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return false;
  const val = (raw as Record<string, unknown>)[key];
  return val === true;
}

export type SanitizeStaffPermissionsResult =
  | { ok: true; permissions: StaffPermissions }
  | { ok: false; error: string; refusedKeys?: string[] };

/**
 * Normalize inbound permissions for storage.
 * - Strips unknown keys
 * - Refuses never-delegable keys if present (explicit injection attempt)
 * - Coerces values to boolean true only when === true
 * - Sets version
 */
export function sanitizeStaffPermissions(raw: unknown): SanitizeStaffPermissionsResult {
  if (raw == null) {
    return { ok: true, permissions: emptyStaffPermissions() };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "Permissions must be an object." };
  }

  const input = raw as Record<string, unknown>;
  const refused: string[] = [];
  for (const key of Object.keys(input)) {
    if (key === "v") continue;
    if (NEVER_SET.has(key)) refused.push(key);
  }
  if (refused.length > 0) {
    return {
      ok: false,
      error: `These permissions cannot be delegated: ${refused.join(", ")}. Owner only.`,
      refusedKeys: refused,
    };
  }

  const out = emptyStaffPermissions();
  for (const key of STAFF_PERMISSION_KEYS) {
    out[key] = input[key] === true;
  }
  return { ok: true, permissions: out };
}

export type StaffPermissionPresetId = "editor" | "coordinator" | "full_except_money" | "blank";

export type StaffPermissionPreset = {
  id: StaffPermissionPresetId;
  label: string;
  description: string;
  /** Keys set to true; all others false. */
  enabled: readonly StaffPermissionKey[];
};

export const STAFF_PERMISSION_PRESETS: StaffPermissionPreset[] = [
  {
    id: "blank",
    label: "Blank",
    description: "Everything off — start from scratch.",
    enabled: [],
  },
  {
    id: "editor",
    label: "Editor",
    description: "Projects + media + video review on assigned work.",
    enabled: [
      "area.projects",
      "area.media",
      "projects.edit",
      "media.upload",
      "media.organize",
      "media.download_originals",
      "video_review.comment",
      "video_review.resolve",
      "video_review.upload_versions",
    ],
  },
  {
    id: "coordinator",
    label: "Coordinator",
    description: "Clients, scheduling, messages, and project ops — no money.",
    enabled: [
      "area.projects",
      "area.clients",
      "area.media",
      "area.calendar",
      "area.messages",
      "projects.create",
      "projects.edit",
      "projects.manage_staff",
      "clients.create",
      "clients.edit",
      "clients.add_to_projects",
      "media.upload",
      "media.organize",
      "scheduling.propose",
      "scheduling.confirm",
      "messages.send",
      "sharing.email",
      "video_review.comment",
    ],
  },
  {
    id: "full_except_money",
    label: "Full access except money",
    description: "Everything except estimates and payments.",
    enabled: STAFF_PERMISSION_KEYS.filter((k) => !k.startsWith("money.")),
  },
];

export function applyStaffPermissionPreset(id: StaffPermissionPresetId): StaffPermissions {
  const preset = STAFF_PERMISSION_PRESETS.find((p) => p.id === id);
  const out = emptyStaffPermissions();
  if (!preset) return out;
  const enabled = new Set(preset.enabled);
  for (const key of STAFF_PERMISSION_KEYS) {
    out[key] = enabled.has(key);
  }
  return out;
}

/** Defaults map for docs / verification — every key → false. */
export function staffPermissionDefaults(): Record<StaffPermissionKey, false> {
  const out = {} as Record<StaffPermissionKey, false>;
  for (const key of STAFF_PERMISSION_KEYS) {
    out[key] = false;
  }
  return out;
}
