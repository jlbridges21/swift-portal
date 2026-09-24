/**
 * Explicit registry of staff-reachable data routes and their scoping policy.
 * Adding a new route under a scoped prefix without registering it fails the guard.
 */
import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

export type ScopePolicy =
  | "project" // must call canAccessProject / visibleProjectIdsFor
  | "client" // must call canAccessClient / visibleClientIdsFor
  | "media" // canAccessMediaAsset / assertMediaAssetProjectAccess / projectIds
  | "adminOnly" // staff must never reach
  | "self" // own user only (notifications, profile)
  | "catalog"; // business-wide catalog OK (services)

export type RegistryEntry = {
  /** Path relative to src/app/api, e.g. "clients/route.ts" */
  file: string;
  methods: Array<"GET" | "POST" | "PATCH" | "PUT" | "DELETE">;
  policy: ScopePolicy;
  /** Historical hole this entry covers — used for proof. */
  knownHole?:
    | "clients"
    | "media"
    | "messages"
    | "asset-reviews"
    | "client-notes"
    | "crm-profile"
    | "project-staff"
    | "payments"
    | "upload-sign";
};

/** Prefixes under src/app/api that staff with area permissions may hit. */
export const STAFF_SCOPED_PREFIXES = [
  "clients",
  "media",
  "media-folders",
  "messages",
  "projects",
  "project-clients",
  "project-staff",
  "project-3d-models",
  "shoot-proposals",
  "asset-reviews",
  "quotes",
  "revisions",
  "payments",
  "tours",
  "video-reviews",
  "admin/search",
] as const;

/**
 * Every staff-scoped data route. Keep alphabetical within groups.
 * Policy determines which helper the static check looks for.
 */
export const STAFF_DATA_ROUTE_REGISTRY: RegistryEntry[] = [
  // --- clients ---
  { file: "clients/route.ts", methods: ["GET", "POST"], policy: "client", knownHole: "clients" },
  { file: "clients/[id]/route.ts", methods: ["DELETE", "PATCH"], policy: "client", knownHole: "crm-profile" },
  { file: "clients/[id]/projects/route.ts", methods: ["GET"], policy: "client", knownHole: "clients" },
  { file: "clients/[id]/notes/route.ts", methods: ["GET", "POST", "PATCH", "DELETE"], policy: "client", knownHole: "client-notes" },
  { file: "clients/[id]/portal/route.ts", methods: ["GET", "POST"], policy: "adminOnly" },
  { file: "clients/[id]/portal-recovery/route.ts", methods: ["POST"], policy: "adminOnly" },

  // --- media ---
  { file: "media/library/route.ts", methods: ["GET"], policy: "media", knownHole: "media" },
  { file: "media/library/[id]/route.ts", methods: ["GET"], policy: "media", knownHole: "media" },
  { file: "media/upload/sign/route.ts", methods: ["POST"], policy: "project", knownHole: "upload-sign" },
  { file: "media/upload/route.ts", methods: ["POST"], policy: "project", knownHole: "upload-sign" },
  { file: "media/upload/complete/route.ts", methods: ["POST"], policy: "project", knownHole: "upload-sign" },
  { file: "media/youtube/route.ts", methods: ["POST"], policy: "project", knownHole: "upload-sign" },
  { file: "media/bulk/route.ts", methods: ["PATCH"], policy: "media", knownHole: "media" },
  { file: "media/[id]/route.ts", methods: ["PATCH", "DELETE"], policy: "media", knownHole: "media" },
  { file: "media/[id]/property-line/route.ts", methods: ["GET", "PUT"], policy: "media" },
  { file: "media/download/[id]/route.ts", methods: ["GET"], policy: "media", knownHole: "media" },
  { file: "media/thumbnails/route.ts", methods: ["POST"], policy: "media", knownHole: "media" },
  { file: "media/move-to-folder/route.ts", methods: ["POST"], policy: "project" },
  { file: "media/reorder/route.ts", methods: ["POST"], policy: "project" },
  { file: "media-folders/route.ts", methods: ["GET", "POST", "PATCH", "DELETE"], policy: "project" },

  // --- messages ---
  { file: "messages/route.ts", methods: ["GET", "POST", "PATCH"], policy: "client", knownHole: "messages" },

  // --- projects ---
  { file: "projects/route.ts", methods: ["POST", "PATCH"], policy: "project" },
  { file: "projects/[id]/route.ts", methods: ["DELETE", "PATCH"], policy: "project" },
  { file: "projects/[id]/download-zip/route.ts", methods: ["GET"], policy: "project", knownHole: "media" },
  { file: "projects/[id]/email-events/route.ts", methods: ["GET"], policy: "project" },
  { file: "projects/[id]/messages/route.ts", methods: ["GET", "POST", "PATCH"], policy: "project" },
  { file: "projects/[id]/shares/route.ts", methods: ["GET", "POST"], policy: "project" },
  { file: "projects/[id]/shares/[shareId]/route.ts", methods: ["PATCH", "DELETE"], policy: "project" },
  { file: "projects/[id]/link-access/route.ts", methods: ["GET", "PATCH"], policy: "project" },
  { file: "projects/[id]/link-access/rotate/route.ts", methods: ["POST"], policy: "project" },
  { file: "projects/[id]/payments/reconcile/route.ts", methods: ["POST"], policy: "project" },

  // --- project satellites ---
  { file: "project-clients/route.ts", methods: ["GET", "POST", "DELETE"], policy: "project" },
  { file: "project-staff/route.ts", methods: ["GET", "POST", "DELETE"], policy: "project", knownHole: "project-staff" },
  { file: "project-3d-models/route.ts", methods: ["POST", "PATCH", "DELETE"], policy: "project" },
  { file: "tours/route.ts", methods: ["POST", "PATCH", "DELETE"], policy: "project" },
  { file: "shoot-proposals/route.ts", methods: ["GET", "POST", "PATCH"], policy: "project" },
  { file: "asset-reviews/route.ts", methods: ["GET", "POST", "PATCH"], policy: "project", knownHole: "asset-reviews" },
  { file: "quotes/route.ts", methods: ["GET", "POST", "PATCH"], policy: "project" },
  { file: "revisions/route.ts", methods: ["GET", "POST", "PATCH"], policy: "project" },

  // --- payments ---
  { file: "payments/route.ts", methods: ["POST"], policy: "project", knownHole: "payments" },
  { file: "payments/[id]/route.ts", methods: ["PATCH", "DELETE"], policy: "project", knownHole: "payments" },
  { file: "payments/[id]/receipt/route.ts", methods: ["GET"], policy: "project", knownHole: "payments" },
  { file: "payments/[id]/checkout/route.ts", methods: ["GET", "POST"], policy: "project" },

  // --- video reviews ---
  { file: "video-reviews/route.ts", methods: ["GET", "POST"], policy: "project" },
  { file: "video-reviews/[id]/versions/route.ts", methods: ["POST"], policy: "project", knownHole: "upload-sign" },
  { file: "video-reviews/[id]/versions/[versionId]/route.ts", methods: ["DELETE", "GET"], policy: "project" },
  { file: "video-reviews/[id]/comments/route.ts", methods: ["GET", "POST"], policy: "project" },
  { file: "video-reviews/[id]/comments/[commentId]/resolve/route.ts", methods: ["POST"], policy: "project" },
  { file: "video-reviews/[id]/comments/[commentId]/reopen/route.ts", methods: ["POST"], policy: "project" },
  { file: "video-reviews/lazy-comment/route.ts", methods: ["POST"], policy: "project" },

  { file: "video-reviews/[id]/route.ts", methods: ["GET"], policy: "project" },
  { file: "video-reviews/[id]/poll/route.ts", methods: ["GET"], policy: "project" },
  { file: "video-reviews/[id]/comments/[commentId]/mark/route.ts", methods: ["POST"], policy: "project" },

  // --- search ---
  { file: "admin/search/route.ts", methods: ["GET"], policy: "project", knownHole: "clients" },
];

const SCOPE_MARKERS: Record<ScopePolicy, RegExp[]> = {
  project: [
    /canAccessProject/,
    /visibleProjectIdsFor/,
    /resolveProjectAccess/,
    /loadReviewForAccess/,
    /loadVersionForReview/,
    /assertReviewProjectAccess/,
    /authorizeProjectZipDownload/,
  ],
  client: [/canAccessClient/, /visibleClientIdsFor/],
  media: [
    /canAccessMediaAsset/,
    /assertMediaAssetProjectAccess/,
    /visibleProjectIdsFor/,
    /canAccessProject/,
    /projectIds/,
  ],
  adminOnly: [/adminOnly:\s*true/, /isOwnerAdmin/],
  self: [/profile\.id/, /user_id/],
  catalog: [/./], // any content OK
};

export function discoverStaffScopedRouteFiles(apiRoot: string): string[] {
  const found: string[] = [];
  function walk(dir: string) {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      const st = statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name === "route.ts") {
        const rel = relative(apiRoot, full).replace(/\\/g, "/");
        if (STAFF_SCOPED_PREFIXES.some((p) => rel === p + "/route.ts" || rel.startsWith(p + "/"))) {
          found.push(rel);
        }
      }
    }
  }
  walk(apiRoot);
  return found.sort();
}

export function assertRegistryCoversDiscovery(apiRoot: string): {
  discovered: string[];
  registered: string[];
  missing: string[];
} {
  const discovered = discoverStaffScopedRouteFiles(apiRoot);
  const registered = [...new Set(STAFF_DATA_ROUTE_REGISTRY.map((e) => e.file))].sort();
  const missing = discovered.filter((f) => !registered.includes(f));
  return { discovered, registered, missing };
}

export function assertSourceHasScopeMarkers(apiRoot: string): string[] {
  const failures: string[] = [];
  for (const entry of STAFF_DATA_ROUTE_REGISTRY) {
    if (entry.policy === "catalog" || entry.policy === "self") continue;
    const src = readFileSync(join(apiRoot, entry.file), "utf8");
    const markers = SCOPE_MARKERS[entry.policy];
    if (!markers.some((re) => re.test(src))) {
      failures.push(`${entry.file} (${entry.policy}) missing scope marker`);
    }
  }
  return failures;
}

export function knownHoleEntries() {
  return STAFF_DATA_ROUTE_REGISTRY.filter((e) => e.knownHole);
}
