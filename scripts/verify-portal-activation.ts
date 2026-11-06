/**
 * Optional client portal activation — tokens, invite state, request scenarios A–D,
 * and the guards that keep a request with someone else's email from granting
 * access to their projects.
 * Run: npx tsx scripts/verify-portal-activation.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

if (!process.env.PLATFORM_SESSION_SECRET && !process.env.CRON_SECRET) {
  process.env.PLATFORM_SESSION_SECRET = "verify-portal-activation-secret";
}

import { sealWithPurpose } from "../src/lib/purpose-cipher";
import {
  ACTIVATION_PATH,
  INVITE_ACTIVATION_TTL_MS,
  REQUEST_ACTIVATION_TTL_MS,
  buildActivationUrl,
  checkActivationEligibility,
  derivePortalAccessState,
  isActivationUrl,
  maskEmail,
  openActivationToken,
  resolveRequestScenario,
  resolveThankYouMode,
  safeActivationNextPath,
  sealActivationToken,
  validatePortalPassword,
  type ActivationEligibilityInput,
  type ActivationPayload,
} from "../src/lib/portal-activation";
import {
  allowPortalActivationAttempt,
  resetPortalActivationRateLimitsForTests,
} from "../src/lib/portal-activation-rate-limit";

let passed = 0;
function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(`FAIL: ${msg}`);
  passed++;
  console.log("OK:", msg);
}

const BIZ = "11111111-0000-0000-0000-00000000000b";
const OTHER_BIZ = "22222222-0000-0000-0000-00000000000b";
const CLIENT = "33333333-0000-0000-0000-00000000000c";
const PROJECT = "44444444-0000-0000-0000-00000000000d";
const OLD_PROJECT = "55555555-0000-0000-0000-00000000000d";
const NOW = Date.parse("2026-11-06T12:00:00Z");

function open(token: string, now = NOW): ActivationPayload {
  const r = openActivationToken(token, now);
  if (!r.ok) throw new Error("token did not open");
  return r.payload;
}

// ── Token format ─────────────────────────────────────────────────────────────
const requestToken = sealActivationToken(
  { kind: "request", businessId: BIZ, clientId: CLIENT, email: " Jane@Example.com ", projectId: PROJECT, freshClient: true },
  NOW
);
const reqPayload = open(requestToken);
assert(reqPayload.k === "request" && reqPayload.b === BIZ && reqPayload.c === CLIENT, "request token round-trips business + client");
assert(reqPayload.e === "jane@example.com", "email is normalized in the token");
assert(reqPayload.p === PROJECT && reqPayload.n === `/dashboard/projects/${PROJECT}?welcome=1`, "request token lands on the new project");
assert(reqPayload.f === true, "fresh-client flag is carried on request tokens");
assert(reqPayload.exp - reqPayload.iat === REQUEST_ACTIVATION_TTL_MS, "request token expires in 24h");
assert(!requestToken.includes("jane") && !requestToken.includes(CLIENT), "token is encrypted (no plaintext email or ids)");

const inviteToken = sealActivationToken(
  { kind: "invite", businessId: BIZ, clientId: CLIENT, email: "jane@example.com", freshClient: true },
  NOW
);
const invPayload = open(inviteToken);
assert(invPayload.exp - invPayload.iat === INVITE_ACTIVATION_TTL_MS, "invite token expires in 7 days");
assert(invPayload.f === false, "invite tokens never carry the fresh-client flag");
assert(invPayload.n === "/dashboard" && invPayload.p === null, "invite without project lands on portal home");

const expiredCheck = openActivationToken(inviteToken, NOW + INVITE_ACTIVATION_TTL_MS + 1);
assert(expiredCheck.ok && expiredCheck.expired, "expired token still authenticates (for resend) but is flagged expired");
const freshCheck = openActivationToken(inviteToken, NOW + 1000);
assert(freshCheck.ok && !freshCheck.expired, "unexpired token is not flagged");

const parts = requestToken.split(".");
const tamperedData = Buffer.from(parts[3], "base64url");
tamperedData[0] ^= 0x01;
const tampered = [parts[0], parts[1], parts[2], tamperedData.toString("base64url")].join(".");
assert(!openActivationToken(tampered, NOW).ok, "tampered ciphertext is rejected");
assert(!openActivationToken(requestToken.slice(0, -4), NOW).ok, "truncated token is rejected");
assert(!openActivationToken("", NOW).ok && !openActivationToken(null, NOW).ok, "empty token is rejected");
assert(!openActivationToken("x".repeat(5000), NOW).ok, "oversized token is rejected");
const otherPurpose = sealWithPurpose("project-share", "x", Buffer.from(JSON.stringify(reqPayload)));
assert(!openActivationToken(otherPurpose, NOW).ok, "a ciphertext from another purpose cannot be used as an activation token");
const wrongShape = sealWithPurpose("client-portal-activation", "portal activation token", Buffer.from(JSON.stringify({ v: 1, k: "admin" })));
assert(!openActivationToken(wrongShape, NOW).ok, "well-sealed but malformed payload is rejected");

// ── Next path + URLs ─────────────────────────────────────────────────────────
assert(safeActivationNextPath("/dashboard/projects/abc") === "/dashboard/projects/abc", "portal project path allowed");
assert(safeActivationNextPath("//evil.example/dashboard") === "/dashboard", "protocol-relative next rejected");
assert(safeActivationNextPath("https://evil.example/dashboard") === "/dashboard", "absolute next rejected");
assert(safeActivationNextPath("/admin/clients") === "/dashboard", "non-portal path rejected");
assert(safeActivationNextPath("/dashboardx") === "/dashboard", "lookalike prefix rejected");
const forged = open(sealActivationToken({ kind: "invite", businessId: BIZ, clientId: CLIENT, email: "a@b.co", nextPath: "https://evil.example" }, NOW));
assert(forged.n === "/dashboard", "unsafe next path is sanitized at seal time");
const url = buildActivationUrl("https://acme.shootportal.app/", inviteToken);
assert(url.startsWith(`https://acme.shootportal.app${ACTIVATION_PATH}?token=`), "activation URL is on the tenant portal origin");
assert(isActivationUrl(url) && !isActivationUrl("https://acme.shootportal.app/dashboard"), "activation URLs are detectable for the email CTA label");
assert(openActivationToken(decodeURIComponent(new URL(url).searchParams.get("token")!), NOW).ok, "URL-encoded token survives the round trip");

// ── Portal access state (admin badges) ───────────────────────────────────────
assert(derivePortalAccessState({ authUser: null, lastInviteSentAt: null }) === "not_activated", "no login → Portal Not Activated");
assert(
  derivePortalAccessState({ authUser: { emailConfirmedAt: null }, lastInviteSentAt: null }) === "not_activated",
  "request placeholder login (unconfirmed) → Portal Not Activated"
);
assert(
  derivePortalAccessState({ authUser: { emailConfirmedAt: null }, lastInviteSentAt: "2026-11-05T10:00:00Z" }) === "invite_sent",
  "invite logged → Portal Invite Sent"
);
assert(
  derivePortalAccessState({ authUser: { emailConfirmedAt: "2026-11-06T10:00:00Z" }, lastInviteSentAt: "2026-11-05T10:00:00Z" }) === "active",
  "confirmed login flips to Portal Access Active even after invites"
);

// ── Request scenarios A–D ────────────────────────────────────────────────────
assert(resolveRequestScenario({ sessionClientId: null, existingClient: null }) === "A", "Scenario A: brand-new client");
assert(
  resolveRequestScenario({ sessionClientId: null, existingClient: { id: CLIENT, portalActive: false } }) === "B",
  "Scenario B: same email, no active portal → attach to existing client"
);
assert(
  resolveRequestScenario({ sessionClientId: null, existingClient: { id: CLIENT, portalActive: true } }) === "C",
  "Scenario C: same email with active portal, not signed in"
);
assert(
  resolveRequestScenario({ sessionClientId: CLIENT, existingClient: { id: "other", portalActive: true } }) === "D",
  "Scenario D: signed in wins — attach to own account"
);
assert(
  resolveRequestScenario({ sessionClientId: null, existingClient: null, newClientPortalActive: true }) === "C",
  "new client row that linked to an already-active login is treated as C (log in, not register)"
);

function eligibility(overrides: Partial<ActivationEligibilityInput> & { payload: ActivationPayload }) {
  return checkActivationEligibility({
    expired: false,
    hostBusinessId: BIZ,
    client: { id: CLIENT, email: "jane@example.com", deleted: false },
    portalActive: false,
    foreignLogin: false,
    clientProjectIds: [PROJECT],
    ...overrides,
  });
}

// A: fresh client, only this project → password on the thank-you page.
const aElig = eligibility({ payload: reqPayload });
assert(aElig.ok, "A: thank-you page may set a password");
assert(
  resolveThankYouMode({ eligibility: aElig, portalActive: false, signedInAsClient: false, hasEmail: true }) === "create_password",
  "A: thank-you shows Create Password / Confirm Password"
);

// B: existing client (token not fresh) → never a password from the thank-you page.
const bPayload = open(
  sealActivationToken({ kind: "request", businessId: BIZ, clientId: CLIENT, email: "jane@example.com", projectId: PROJECT, freshClient: false }, NOW)
);
const bElig = eligibility({ payload: bPayload, clientProjectIds: [OLD_PROJECT, PROJECT] });
assert(!bElig.ok && bElig.reason === "requires_email_link", "B: request token cannot activate an existing client");
assert(
  resolveThankYouMode({ eligibility: bElig, portalActive: false, signedInAsClient: false, hasEmail: true }) === "email_link",
  "B: thank-you points to the emailed activation link instead"
);
const bNoProjects = eligibility({ payload: bPayload, clientProjectIds: [PROJECT] });
assert(!bNoProjects.ok, "B: even an existing client with no other projects needs the email link");

// Someone else's email: attacker submits with victim's address → B path; no access.
const attackerElig = eligibility({ payload: bPayload, clientProjectIds: [OLD_PROJECT, PROJECT] });
assert(!attackerElig.ok, "request with someone else's email cannot set their password");

// A token later used after the same client gained another project (e.g. victim's own request).
const aLater = eligibility({ payload: reqPayload, clientProjectIds: [PROJECT, OLD_PROJECT] });
assert(!aLater.ok && aLater.reason === "requires_email_link", "A token stops working once the client has other projects");
const aNoProject = open(
  sealActivationToken({ kind: "request", businessId: BIZ, clientId: CLIENT, email: "jane@example.com", freshClient: true }, NOW)
);
assert(!eligibility({ payload: aNoProject }).ok, "request token without a project cannot activate");

// C: active portal → log in, not register.
const cElig = eligibility({ payload: reqPayload, portalActive: true });
assert(!cElig.ok && cElig.reason === "already_active", "C: activation refused when a portal account is active");
assert(
  resolveThankYouMode({ eligibility: cElig, portalActive: true, signedInAsClient: false, hasEmail: true }) === "login",
  "C: thank-you offers Log In"
);

// D: signed in → straight to the project, no password prompts.
assert(
  resolveThankYouMode({ eligibility: cElig, portalActive: true, signedInAsClient: true, hasEmail: true }) === "signed_in",
  "D: signed-in client skips all password prompts"
);
assert(
  resolveThankYouMode({ eligibility: aElig, portalActive: false, signedInAsClient: true, hasEmail: true }) === "signed_in",
  "D: signed-in mode takes priority over activation"
);

// ── Token scoping + single use ───────────────────────────────────────────────
assert(eligibility({ payload: invPayload, clientProjectIds: [OLD_PROJECT, PROJECT] }).ok, "invite (email-proven) token activates existing clients");
const wrongBiz = eligibility({ payload: invPayload, hostBusinessId: OTHER_BIZ });
assert(!wrongBiz.ok && wrongBiz.reason === "wrong_business", "token is tenant-scoped to the issuing business host");
const wrongClient = eligibility({ payload: invPayload, client: { id: "someone-else", email: "jane@example.com", deleted: false } });
assert(!wrongClient.ok && wrongClient.reason === "client_missing", "token is scoped to exactly one client");
const deleted = eligibility({ payload: invPayload, client: { id: CLIENT, email: "jane@example.com", deleted: true } });
assert(!deleted.ok && deleted.reason === "client_missing", "deleted client cannot be activated");
const emailChanged = eligibility({ payload: invPayload, client: { id: CLIENT, email: "new@example.com", deleted: false } });
assert(!emailChanged.ok && emailChanged.reason === "email_changed", "changing the client email invalidates outstanding links");
const used = eligibility({ payload: invPayload, portalActive: true });
assert(!used.ok && used.reason === "already_active", "single use: every link is refused once the portal is active");
const expired = eligibility({ payload: invPayload, expired: true });
assert(!expired.ok && expired.reason === "expired", "expired link is refused for activation");
assert(
  resolveThankYouMode({ eligibility: expired, portalActive: false, signedInAsClient: false, hasEmail: true }) === "email_link",
  "expired link offers 'request a new invite'"
);
const foreign = eligibility({ payload: invPayload, foreignLogin: true });
assert(!foreign.ok && foreign.reason === "foreign_login", "login owned by another business is never touched");
assert(
  resolveThankYouMode({ eligibility: foreign, portalActive: false, signedInAsClient: false, hasEmail: true }) === "none",
  "foreign login: nothing to offer"
);

// ── Passwords + copy ─────────────────────────────────────────────────────────
assert(validatePortalPassword("short", "short") !== null, "password under 8 chars rejected");
assert(validatePortalPassword("longenough1", "longenough2") === "Passwords do not match.", "mismatched confirmation rejected");
assert(validatePortalPassword("longenough1", "longenough1") === null, "valid password accepted");
assert(validatePortalPassword(undefined, undefined) !== null, "missing password rejected");
assert(maskEmail("Jane@Example.com") === "j***@example.com", "email masked for confirmation copy");
assert(maskEmail("a@b.co") === "a*@b.co", "short local part masked");

// ── Rate limits ──────────────────────────────────────────────────────────────
resetPortalActivationRateLimitsForTests();
assert(
  [1, 2, 3].every(() => allowPortalActivationAttempt("resend", "client:x")) && !allowPortalActivationAttempt("resend", "client:x"),
  "self-service resend is limited to 3 per window per key"
);
assert(allowPortalActivationAttempt("resend", "client:y"), "resend limits are per key");

// ── Static guards on the wiring ──────────────────────────────────────────────
const root = join(__dirname, "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

const requestRoute = read("src/app/api/request/route.ts");
assert(
  !requestRoute.includes("confirm_password") && !/body\.password|\bpassword,|password\.length/.test(requestRoute),
  "/api/request no longer reads or requires a password"
);
assert(!requestRoute.includes("auth.admin.createUser"), "/api/request never creates a password login itself");
assert(requestRoute.includes('status: "new_request"'), "requests land in New Requests");
assert(requestRoute.includes("notifyAdmins(") && requestRoute.includes('eventKey: "new_project_request"'), "business owner notifications unchanged");
assert(requestRoute.includes("fillBlankClientFields"), "existing client details are never overwritten from the public form");
assert(requestRoute.includes("normalizeEmail(c.email) === email"), "existing-client match is exact (ilike wildcards ignored)");

const form = read("src/components/forms/public-request-form.tsx");
assert(!/type="password"/.test(form) && !form.includes("confirm_password"), "request form has no password fields");
assert(form.includes('"Submit Request"'), "primary button says Submit Request");

const panel = read("src/components/portal/portal-activation-panel.tsx");
assert(
  panel.includes("Create Password") && panel.includes("Confirm Password") && panel.includes("Create Account & View My Project"),
  "thank-you activation has Create Password / Confirm Password / Create Account & View My Project"
);

const projectClients = read("src/app/api/project-clients/route.ts");
assert(!projectClients.includes("enableClientPortalAccess"), "adding a client to a project never sets a password");
const portalRoute = read("src/app/api/clients/[id]/portal/route.ts");
assert(portalRoute.includes("status: 410") && !portalRoute.includes("enableClientPortalAccess"), "owner set-password endpoint is retired");
const clientsRoute = read("src/app/api/clients/route.ts");
assert(!clientsRoute.includes("password: body.password"), "creating a client never sets an owner-chosen password");
const projectDetail = read("src/components/admin/project-detail.tsx");
assert(!projectDetail.includes("window.prompt(") && projectDetail.includes("<PortalAccessStatus"), "Project Clients shows portal access state, no password prompt");
const status = read("src/components/admin/portal-access-status.tsx");
assert(
  ["Portal Access Active", "Portal Not Activated", "Portal Invite Sent", "Send Portal Invite", "Resend Invite", "Copy Invite Link"].every((s) =>
    status.includes(s)
  ),
  "admin widget has all three states and invite actions"
);
const emailNotifications = read("src/lib/client-email-notifications.ts");
assert(emailNotifications.includes("clientEmailCtaUrl("), "client emails use the activation link for clients without a portal");

console.log(`\nverify-portal-activation: ${passed} checks passed`);
