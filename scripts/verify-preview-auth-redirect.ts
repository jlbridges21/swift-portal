/**
 * Post-login redirects on Vercel Preview vs Production vs local, and return-path validation.
 * Run: npx tsx scripts/verify-preview-auth-redirect.ts
 *
 * Browser-level checks (signed-out redirect, forged session rejected) live in
 * scripts/perf/nav-regression.mjs and run against a deployed preview.
 */
import { getLoginRedirectOrigin, isVercelPreviewHost, joinPortalPath } from "../src/lib/portal-url";
import { safeRelativePath, sameOriginRelativePath } from "../src/lib/safe-relative-path";
import { safeAuthNext } from "../src/lib/auth-confirm";

const SWIFT = {
  slug: "swift-aerial-media",
  custom_domain: "portal.swiftaerialmedia.com",
  custom_domain_status: "connected",
  custom_domain_vercel_verified: true,
  custom_domain_misconfigured: false,
};
const PREVIEW_HOST = "swift-portal-abc123-team.vercel.app";
const PREVIEW = { hostname: PREVIEW_HOST, origin: `https://${PREVIEW_HOST}` };

let failures = 0;
function expect(label: string, ok: boolean, detail?: unknown) {
  if (ok) console.log(`ok    ${label}`);
  else {
    failures++;
    console.log(`FAIL  ${label}${detail === undefined ? "" : ` — got ${JSON.stringify(detail)}`}`);
  }
}
function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env.VERCEL_ENV;
  if (value === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = value;
  try {
    fn();
  } finally {
    if (prev === undefined) delete process.env.VERCEL_ENV;
    else process.env.VERCEL_ENV = prev;
  }
}

// 1. Preview login stays on the preview hostname and enters /b/{slug}/…
withEnv("preview", () => {
  expect("preview host detected", isVercelPreviewHost(PREVIEW_HOST));
  for (const foreignTenantHost of [false, true]) {
    const origin = getLoginRedirectOrigin(SWIFT, PREVIEW, { foreignTenantHost });
    const dest = joinPortalPath(origin, "/admin");
    expect(
      `preview login (foreignTenantHost=${foreignTenantHost}) stays on preview under /b/{slug}`,
      dest === `https://${PREVIEW_HOST}/b/swift-aerial-media/admin`,
      dest
    );
    expect("…never the custom domain", !dest.includes("portal.swiftaerialmedia.com"), dest);
    // What /api/auth/post-login returns on a preview: an app-relative path.
    const relative = sameOriginRelativePath(dest, PREVIEW.origin);
    expect("post-login answer is relative /b/{slug}/admin", relative === "/b/swift-aerial-media/admin", relative);
  }
  const deep = sameOriginRelativePath(`https://${PREVIEW_HOST}/b/swift-aerial-media/admin/projects?x=1`, PREVIEW.origin);
  expect("relative answer keeps path and query", deep === "/b/swift-aerial-media/admin/projects?x=1", deep);
  expect(
    "off-origin redirect is never passed through on preview",
    sameOriginRelativePath("https://portal.swiftaerialmedia.com/admin", PREVIEW.origin) === null
  );
  expect("preview flag ignores non-vercel hosts", !isVercelPreviewHost("portal.swiftaerialmedia.com"));
});

// 2. Production still sends a custom-domain tenant to its custom domain.
withEnv("production", () => {
  expect("production *.vercel.app is not treated as preview", !isVercelPreviewHost(PREVIEW_HOST));
  const fromApex = getLoginRedirectOrigin(SWIFT, { hostname: "www.shootportal.app", origin: "https://www.shootportal.app" });
  expect("production apex login → custom domain", fromApex === "https://portal.swiftaerialmedia.com", fromApex);
  const fromForeign = getLoginRedirectOrigin(
    SWIFT,
    { hostname: "test-pilot-drones.shootportal.app", origin: "https://test-pilot-drones.shootportal.app" },
    { foreignTenantHost: true }
  );
  expect("production foreign-tenant login → custom domain", fromForeign === "https://portal.swiftaerialmedia.com", fromForeign);
  const onOwn = getLoginRedirectOrigin(SWIFT, { hostname: "portal.swiftaerialmedia.com", origin: "https://portal.swiftaerialmedia.com" });
  expect("production login on the custom domain stays there", onOwn === "https://portal.swiftaerialmedia.com", onOwn);
  const vercelForeign = getLoginRedirectOrigin(SWIFT, PREVIEW, { foreignTenantHost: true });
  expect("production *.vercel.app foreign tenant → custom domain (unchanged)", vercelForeign === "https://portal.swiftaerialmedia.com", vercelForeign);
});

// Local development unchanged.
withEnv(undefined, () => {
  const local = getLoginRedirectOrigin(SWIFT, { hostname: "localhost", origin: "http://localhost:3000" });
  expect("local dev → localhost/b/{slug}", local === "http://localhost:3000/b/swift-aerial-media", local);
  expect("no VERCEL_ENV → *.vercel.app not preview", !isVercelPreviewHost(PREVIEW_HOST));
});

// 3. External / protocol-relative next URLs are rejected.
const REJECT = [
  "https://evil.example/admin",
  "http://evil.example",
  "//evil.example",
  "//evil.example/b/swift-aerial-media/admin",
  "/\\evil.example",
  "\\\\evil.example",
  "/%2Fevil.example",
  "/%2F%2Fevil.example",
  "%2F%2Fevil.example",
  "/%5Cevil.example",
  "/%252F%252Fevil.example",
  "/\t/evil.example",
  "/\n/evil.example",
  "/%09/evil.example",
  "/ /evil.example",
  "javascript:alert(1)",
  "/javascript:alert(1)",
  "data:text/html,hi",
  "evil.example",
  "",
  "/" + "a".repeat(3000),
];
for (const raw of REJECT) {
  expect(`rejects ${JSON.stringify(raw.length > 40 ? raw.slice(0, 40) + "…" : raw)}`, safeRelativePath(raw) === null && safeAuthNext(raw) === null);
}
const ACCEPT = ["/admin", "/b/swift-aerial-media/admin/projects", "/dashboard/projects/123?tab=media#top", "/admin/projects/26e6%2D1"];
for (const raw of ACCEPT) expect(`accepts ${raw}`, safeRelativePath(raw) === raw && safeAuthNext(raw) === raw);

if (failures) {
  console.log(`\n${failures} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll preview auth redirect checks passed.");
