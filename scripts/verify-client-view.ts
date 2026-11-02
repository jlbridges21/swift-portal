/**
 * Client View on /admin/projects — NEW badge expiry, saved view preference,
 * client filtering, search, and sorting.
 * Run: npx tsx scripts/verify-client-view.ts
 */
import {
  ALL_CLIENTS,
  CLIENT_VIEW_NEW_BADGE_EXPIRES_AT,
  CLIENT_VIEW_STAGES,
  STAGE_ACCENTS,
  clientIdsForProject,
  countProjectsByClient,
  filterProjectsByClient,
  filterProjectsByService,
  isClientViewNewBadgeActive,
  parseProjectsViewCookie,
  searchClients,
  serializeProjectsViewCookie,
  sortClientViewProjects,
  type ClientViewProject,
} from "../src/lib/client-view";
import { PROJECT_STATUSES } from "../src/lib/constants";

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}

// ── NEW badge: hidden at/after Jan 1 2027 12:00 AM Central (06:00 UTC) ──
assert(CLIENT_VIEW_NEW_BADGE_EXPIRES_AT === "2027-01-01T06:00:00.000Z", "expiry is midnight CST in UTC");
assert(isClientViewNewBadgeActive(new Date("2026-11-02T12:00:00Z")), "badge shows today (Nov 2026)");
assert(isClientViewNewBadgeActive(new Date("2026-12-31T23:59:59-06:00")), "badge shows 11:59:59 PM Dec 31 Central");
assert(isClientViewNewBadgeActive(Date.parse("2027-01-01T05:59:59.999Z")), "badge shows 1ms before expiry");
assert(!isClientViewNewBadgeActive(new Date("2027-01-01T00:00:00-06:00")), "badge gone at 12:00 AM Jan 1 Central");
assert(!isClientViewNewBadgeActive(Date.parse("2027-01-01T06:00:00Z")), "badge gone exactly at expiry (number input)");
assert(!isClientViewNewBadgeActive(new Date("2027-06-01T00:00:00Z")), "badge stays gone later");
// Dec 31 evening in Central is already Jan 1 in UTC — must still show.
assert(isClientViewNewBadgeActive(new Date("2027-01-01T03:00:00Z")), "Jan 1 03:00 UTC (9 PM Dec 31 Central) still shows");

// ── Saved view preference ──
const me = "11111111-aaaa-bbbb-cccc-000000000001";
const other = "22222222-aaaa-bbbb-cccc-000000000002";
assert(parseProjectsViewCookie(undefined, me) === "pipeline", "no cookie → Pipeline (default)");
assert(parseProjectsViewCookie("", me) === "pipeline", "empty cookie → Pipeline");
assert(parseProjectsViewCookie("pipeline", me) === "pipeline", "pipeline cookie → Pipeline");
assert(parseProjectsViewCookie(serializeProjectsViewCookie("client", me), me) === "client", "client round-trips for same user");
assert(parseProjectsViewCookie(serializeProjectsViewCookie("client", other), me) === "pipeline", "another user's choice is ignored");
assert(parseProjectsViewCookie("client", me) === "pipeline", "bare 'client' without user id is ignored");
assert(parseProjectsViewCookie(`client:${me}`, "") === "pipeline", "no user id → Pipeline");
assert(serializeProjectsViewCookie("pipeline", me) === "pipeline", "pipeline serializes without user id");

// ── Filtering ──
function project(id: string, overrides: Partial<ClientViewProject> = {}): ClientViewProject {
  return {
    id,
    project_name: `Project ${id}`,
    property_address: "",
    service_type: "Aerial Photography",
    status: "new_request",
    shoot_date: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    client_id: null,
    confirmedShootAt: null,
    ...overrides,
  };
}

const projects = [
  project("p1", { client_id: "c1" }),
  project("p2", { client_id: "c2", service_type: "Aerial Videography" }),
  project("p3", { client_id: "c1", service_type: "Aerial Videography" }),
  project("p4", { client_id: null }), // only linked through the junction
  project("p5", { client_id: "c2" }), // primary c2, also c1 via junction
];
const junction = { p4: ["c3"], p5: ["c1", "c2"] };

assert(filterProjectsByClient(projects, ALL_CLIENTS, junction).length === 5, "All Clients shows every project");
assert(filterProjectsByClient(projects, "", junction).length === 5, "empty selection shows every project");
assert(
  filterProjectsByClient(projects, "c1", junction).map((p) => p.id).join() === "p1,p3,p5",
  "client filter = primary client_id + project_clients"
);
assert(filterProjectsByClient(projects, "c3", junction).map((p) => p.id).join() === "p4", "junction-only client");
assert(filterProjectsByClient(projects, "nobody", junction).length === 0, "unknown client → nothing");
assert(clientIdsForProject(projects[4], junction).sort().join() === "c1,c2", "no duplicate client ids");

const counts = countProjectsByClient(projects, junction);
assert(counts.c1 === 3 && counts.c2 === 2 && counts.c3 === 1, "per-client counts include junction links");

assert(filterProjectsByService(projects, []).length === 5, "no service filter → all");
assert(
  filterProjectsByService(projects, ["Aerial Videography"]).map((p) => p.id).join() === "p2,p3",
  "service filter"
);

// ── Client search ──
const clients = [
  { name: "Chris Malone", company: "Resonate Marketing", email: "chris@resonate.co" },
  { name: "Janet Swift", company: null, email: "janet@example.com" },
  { name: "Danny Creative", company: null, email: null },
];
assert(searchClients(clients, "").length === 3, "empty search → all clients");
assert(searchClients(clients, "  mal ")[0]?.name === "Chris Malone", "search by name, trims, case-insensitive");
assert(searchClients(clients, "resonate").length === 1, "search by company");
assert(searchClients(clients, "example.com")[0]?.name === "Janet Swift", "search by email");
assert(searchClients(clients, "zzz").length === 0, "no matches");

// ── Sorting ──
const sortable = [
  project("a", { project_name: "Bravo", updated_at: "2026-03-01T00:00:00Z", created_at: "2026-01-02T00:00:00Z", shoot_date: "2026-12-10" }),
  project("b", { project_name: "alpha", updated_at: "2026-05-01T00:00:00Z", created_at: "2026-01-01T00:00:00Z" }),
  project("c", { project_name: "Charlie", updated_at: "2026-04-01T00:00:00Z", created_at: "2026-01-03T00:00:00Z", confirmedShootAt: "2026-11-05T15:00:00Z" }),
];
const ids = (list: ClientViewProject[]) => list.map((p) => p.id).join();
assert(ids(sortClientViewProjects(sortable, "updated")) === "b,c,a", "sort: updated (newest first)");
assert(ids(sortClientViewProjects(sortable, "newest")) === "c,a,b", "sort: newest created");
assert(ids(sortClientViewProjects(sortable, "name")) === "b,a,c", "sort: name (case-insensitive locale)");
assert(ids(sortClientViewProjects(sortable, "shoot_date")) === "c,a,b", "sort: soonest shoot first, undated last");
assert(ids(sortable) === "a,b,c", "sorting does not mutate the input");

// ── Stages are the existing workflow, unchanged ──
assert(CLIENT_VIEW_STAGES === PROJECT_STATUSES, "Client View columns are PROJECT_STATUSES");
assert(PROJECT_STATUSES.every((s) => STAGE_ACCENTS[s.value]), "every stage has an accent color");

console.log(`\n${passed} checks passed`);
