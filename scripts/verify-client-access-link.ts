/**
 * One-click client access links: token sealing, expiry, tampering, path safety.
 * Pure logic — no database. Run: npm run test:client-access-link
 */
import assert from "node:assert/strict";

process.env.PLATFORM_SESSION_SECRET ||= "verify-client-access-link-secret";

async function main() {
  const link = await import("../src/lib/client-access-link");
  const activation = await import("../src/lib/portal-activation");

  const P = "11111111-2222-4333-8444-555555555555";
  const base = { businessId: "biz-1", clientId: "client-1", email: "  Sarah@Example.com ", projectId: P };
  let passed = 0;
  const ok = (name: string, fn: () => void) => {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  };

  ok("seal → open round trip, email normalized", () => {
    const token = link.sealClientAccessToken({ ...base, nextPath: `/dashboard/projects/${P}?tab=pay#payments` });
    const opened = link.openClientAccessToken(token);
    assert.ok(opened.ok);
    if (!opened.ok) return;
    assert.equal(opened.expired, false);
    assert.equal(opened.payload.e, "sarah@example.com");
    assert.equal(opened.payload.p, P);
    assert.equal(opened.payload.n, `/dashboard/projects/${P}?tab=pay#payments`);
  });

  ok("expired tokens still open but are flagged", () => {
    const now = Date.now();
    const token = link.sealClientAccessToken({ ...base, ttlMs: 1000 }, now - 5000);
    const opened = link.openClientAccessToken(token, now);
    assert.ok(opened.ok && opened.expired);
  });

  ok("default lifetime is 45 days", () => {
    const now = Date.now();
    const opened = link.openClientAccessToken(link.sealClientAccessToken(base, now), now);
    assert.ok(opened.ok);
    if (opened.ok) assert.equal(opened.payload.exp - opened.payload.iat, 45 * 24 * 60 * 60 * 1000);
  });

  ok("tampered / garbage / empty tokens are invalid", () => {
    const token = link.sealClientAccessToken(base);
    const parts = token.split(".");
    const flipped = parts[3]!.startsWith("A") ? `B${parts[3]!.slice(1)}` : `A${parts[3]!.slice(1)}`;
    assert.equal(link.openClientAccessToken([parts[0], parts[1], parts[2], flipped].join(".")).ok, false);
    assert.equal(link.openClientAccessToken("nope").ok, false);
    assert.equal(link.openClientAccessToken("").ok, false);
    assert.equal(link.openClientAccessToken("x".repeat(3000)).ok, false);
  });

  ok("activation tokens can't be used as access links (and vice versa)", () => {
    const act = activation.sealActivationToken({ kind: "invite", businessId: "biz-1", clientId: "client-1", email: "a@b.co", projectId: P });
    assert.equal(link.openClientAccessToken(act).ok, false);
    assert.equal(activation.openActivationToken(link.sealClientAccessToken(base)).ok, false);
  });

  ok("landing path stays inside the project", () => {
    const b = `/dashboard/projects/${P}`;
    assert.equal(link.safeClientAccessPath(P, null), b);
    assert.equal(link.safeClientAccessPath(P, `${b}#payments`), `${b}#payments`);
    assert.equal(link.safeClientAccessPath(P, `${b}?tab=pay`), `${b}?tab=pay`);
    assert.equal(link.safeClientAccessPath(P, "https://evil.example"), b);
    assert.equal(link.safeClientAccessPath(P, "//evil.example"), b);
    assert.equal(link.safeClientAccessPath(P, "/admin"), b);
    assert.equal(link.safeClientAccessPath(P, `/dashboard/projects/99999999-2222-4333-8444-555555555555`), b);
    assert.equal(link.safeClientAccessPath(P, `${b}-evil`), b);
    assert.equal(link.safeClientAccessPath(P, `${b}/../../admin`), b);
    assert.equal(link.safeClientAccessPath(P, `${b}\\x`), b);
  });

  ok("project id is read from portal paths only", () => {
    assert.equal(link.projectIdFromPortalPath(`/dashboard/projects/${P}`), P);
    assert.equal(link.projectIdFromPortalPath(`/dashboard/projects/${P}#payments`), P);
    assert.equal(link.projectIdFromPortalPath(`/dashboard/projects/${P}?tab=pay`), P);
    assert.equal(link.projectIdFromPortalPath(`/dashboard/projects/${P.toUpperCase()}`), P);
    assert.equal(link.projectIdFromPortalPath("/dashboard"), null);
    assert.equal(link.projectIdFromPortalPath(`/admin/projects/${P}`), null);
    assert.equal(link.projectIdFromPortalPath(`/dashboard/projects/${P}x`), null);
  });

  ok("URL shape and detection", () => {
    const url = link.buildClientAccessUrl("https://portal.example.com/", "abc.def");
    assert.equal(url, "https://portal.example.com/auth/client?token=abc.def");
    assert.ok(link.isClientAccessUrl(url));
    assert.ok(!activation.isActivationUrl(url));
  });

  ok("business logins are never reachable by client links", () => {
    assert.ok(link.isBusinessLoginRole("admin"));
    assert.ok(link.isBusinessLoginRole("staff"));
    assert.ok(link.isBusinessLoginRole("super_admin"));
    assert.ok(!link.isBusinessLoginRole("client"));
    assert.ok(!link.isBusinessLoginRole(null));
  });

  ok("fresh links are offered only for recoverable refusals", () => {
    assert.ok(link.canOfferFreshLink("expired"));
    assert.ok(link.canOfferFreshLink("email_changed"));
    assert.ok(!link.canOfferFreshLink("not_on_project"));
    assert.ok(!link.canOfferFreshLink("business_login"));
    assert.ok(!link.canOfferFreshLink("wrong_business"));
    assert.match(link.clientAccessRefusalMessage("something-else"), /isn't valid/);
  });

  console.log(`\nclient access link: ${passed} checks passed`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
