/**
 * Quick same-origin handoff check. Run: npx tsx scripts/verify-auth-handoff.ts
 */
process.env.PLATFORM_SESSION_SECRET ??= "test-secret-for-handoff-unit";
process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ??= "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.x";

async function main() {
  const { resolveCrossOriginRedirect } = await import("../src/lib/auth-session-handoff");
  const same = await resolveCrossOriginRedirect({
    currentOrigin: "https://portal.swiftaerialmedia.com",
    redirect: "https://portal.swiftaerialmedia.com/dashboard",
    userId: "00000000-0000-0000-0000-000000000099",
    accessToken: "a",
    refreshToken: "r",
  });
  if (same !== "https://portal.swiftaerialmedia.com/dashboard") {
    throw new Error(`same-origin should not mint handoff, got ${same}`);
  }
  console.log("ok  same-origin does not mint handoff");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
