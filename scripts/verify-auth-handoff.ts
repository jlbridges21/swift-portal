/**
 * Auth handoff + return_to security checks.
 * Run: npx tsx scripts/verify-auth-handoff.ts
 */
process.env.PLATFORM_SESSION_SECRET ??= "test-secret-for-handoff-unit";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.x";
process.env.PLATFORM_ROOT_DOMAIN ??= "shootportal.app";
process.env.NODE_ENV = "production";

function expect(label: string, ok: boolean, detail?: string) {
  if (!ok) throw new Error(`FAIL ${label}${detail ? `: ${detail}` : ""}`);
  console.log(`ok  ${label}`);
}

async function main() {
  const {
    resolveCrossOriginRedirect,
    hashHandoffToken,
    consumeSessionHandoff,
  } = await import("../src/lib/auth-session-handoff");
  const {
    parseAuthReturnTo,
    isPlatformOwnedAuthHost,
    canonicalAuthHostsMatch,
  } = await import("../src/lib/auth-return-to");
  const {
    getCanonicalAuthConfirmUrl,
    buildAuthConfirmLink,
    safeAuthReturnToParam,
    safeAuthNext,
  } = await import("../src/lib/auth-confirm");

  // --- Canonical confirm ---
  expect(
    "canonical confirm is www",
    getCanonicalAuthConfirmUrl() === "https://www.shootportal.app/auth/confirm"
  );

  const link = buildAuthConfirmLink({
    portalOrigin: "https://portal.swiftaerialmedia.com",
    tokenHash: "abc",
    type: "recovery",
    nextPath: "/auth/update-password",
  });
  expect("confirm link hosts on www", link.startsWith("https://www.shootportal.app/auth/confirm?"));
  expect("confirm link has return_to", link.includes("return_to="));
  expect(
    "confirm link return_to is tenant",
    decodeURIComponent(new URL(link).searchParams.get("return_to") || "") ===
      "https://portal.swiftaerialmedia.com"
  );
  expect("confirm link has next", new URL(link).searchParams.get("next") === "/auth/update-password");

  const sameHostLink = buildAuthConfirmLink({
    portalOrigin: "https://www.shootportal.app",
    tokenHash: "abc",
    type: "invite",
    nextPath: "/partner/dashboard",
  });
  expect(
    "no return_to when destination is canonical",
    !new URL(sameHostLink).searchParams.has("return_to")
  );

  // --- return_to parsing (open redirect guards) ---
  expect("reject path in return_to", parseAuthReturnTo("https://evil.com/phish") === null);
  expect("reject query in return_to", parseAuthReturnTo("https://evil.com?x=1") === null);
  expect("reject protocol-relative", safeAuthReturnToParam("//evil.com") === null);
  expect("reject javascript", parseAuthReturnTo("javascript:alert(1)") === null);
  expect(
    "accept bare origin",
    parseAuthReturnTo("https://portal.swiftaerialmedia.com") ===
      "https://portal.swiftaerialmedia.com"
  );
  expect("reject next absolute", safeAuthNext("https://evil.com") === null);
  expect("reject next protocol-relative", safeAuthNext("//evil.com") === null);
  expect("accept next path", safeAuthNext("/dashboard") === "/dashboard");

  expect("platform owned www", isPlatformOwnedAuthHost("www.shootportal.app"));
  expect("platform owned slug", isPlatformOwnedAuthHost("acme.shootportal.app"));
  expect("custom not platform-owned", !isPlatformOwnedAuthHost("portal.swiftaerialmedia.com"));

  expect(
    "hosts match",
    canonicalAuthHostsMatch("https://www.shootportal.app", "https://www.shootportal.app/foo")
  );
  expect(
    "hosts differ",
    !canonicalAuthHostsMatch("https://www.shootportal.app", "https://acme.shootportal.app")
  );

  // --- Same-origin: no handoff minted ---
  const same = await resolveCrossOriginRedirect({
    currentOrigin: "https://portal.swiftaerialmedia.com",
    redirect: "https://portal.swiftaerialmedia.com/dashboard",
    userId: "00000000-0000-0000-0000-000000000099",
    accessToken: "a",
    refreshToken: "r",
  });
  expect(
    "same-origin does not mint handoff",
    same === "https://portal.swiftaerialmedia.com/dashboard"
  );

  // --- Token hash is one-way ---
  const raw = "test-raw-token-value-32bytes-min!!";
  const h1 = hashHandoffToken(raw);
  const h2 = hashHandoffToken(raw);
  expect("hash stable", h1 === h2);
  expect("hash not plaintext", h1 !== raw && h1.length === 64);

  // --- Consume rejects bad tokens without DB hit semantics ---
  const bad = await consumeSessionHandoff({
    rawToken: "short",
    requestHost: "portal.swiftaerialmedia.com",
  });
  expect("reject short token", !bad.ok);

  const missing = await consumeSessionHandoff({
    rawToken: "a".repeat(32),
    requestHost: "portal.swiftaerialmedia.com",
  });
  // Without a real DB row this fails closed (not found / already used).
  expect("missing token fails closed", !missing.ok);

  console.log("\nAll auth-handoff security checks passed.");
  console.log(
    "Note: single-use / expiry / host-bind / user re-verify are enforced in consumeSessionHandoff + /auth/handoff/consume (atomic consumed_at, 60s TTL, destination_host match, getUser id check)."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
