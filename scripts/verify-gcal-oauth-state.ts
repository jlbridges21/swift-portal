/**
 * HMAC OAuth-state tamper test for Google Calendar connect.
 * Run with: npx tsx --env-file=.env.local scripts/verify-gcal-oauth-state.ts
 */
process.env.GOOGLE_CLIENT_SECRET ||= "unit-test-hmac-secret";

async function main() {
  const { signGoogleOAuthState, verifyGoogleOAuthState } = await import(
    "../src/lib/google-calendar"
  );

  function assert(cond: unknown, msg: string) {
    if (!cond) throw new Error(msg);
  }

  const businessId = "00000000-0000-0000-0000-000000000001";
  const otherId = "00000000-0000-0000-0000-0000000000ff";
  const valid = signGoogleOAuthState(businessId);
  const ok = verifyGoogleOAuthState(valid);
  assert(ok.ok && ok.businessId === businessId, "valid state must verify");

  const parts = valid.split(".");
  parts[0] = otherId;
  const tampered = parts.join(".");
  const tamperedResult = verifyGoogleOAuthState(tampered);
  assert(!tamperedResult.ok, "tampered business_id must be rejected");
  assert(
    !tamperedResult.ok && tamperedResult.reason === "bad_signature",
    `tampered state reason should be bad_signature, got ${JSON.stringify(tamperedResult)}`
  );

  const unsigned = "deadbeefcafebabe";
  const unsignedResult = verifyGoogleOAuthState(unsigned);
  assert(!unsignedResult.ok, "unsigned hex state must be rejected");

  const missingSig = `${businessId}.${Date.now()}.abcd`;
  assert(!verifyGoogleOAuthState(missingSig).ok, "truncated state must be rejected");

  console.log("gcal oauth state: ok (valid accepts; tampered/unsigned reject)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
