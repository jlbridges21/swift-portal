/**
 * Live saveAppSettings checks (same merge/validate path as PATCH /api/admin/settings).
 * Does not send email.
 *
 *   npx tsx scripts/verify-settings-save-live.ts
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnvLocal() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1);
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnvLocal();

const SWIFT = "00000000-0000-0000-0000-000000000001";
const PILOT = "00000000-0000-0000-0000-0000000000aa";
const PILOT_ADMIN = "53042d80-c31a-4f30-a5a6-b924e44ae0e1";
const SWIFT_ADMIN = "7d0957c6-6330-48ca-a530-f13d4dc15a84";
const INJECTION = "red; } body { display:none } :root { --x:";

async function main() {
  const { getAppSettings, saveAppSettings } = await import("../src/lib/app-settings");
  const { InvalidEmailSenderError } = await import("../src/lib/email-sender-policy");
  const { InvalidBrandColorError } = await import("../src/lib/brand-color");

  const swiftBefore = await getAppSettings(SWIFT);
  const swiftEmail = { ...swiftBefore.email };

  const pilot = await getAppSettings(PILOT);
  const originalName = pilot.business.businessName;
  await saveAppSettings(
    { business: { ...pilot.business, businessName: `${originalName} (save-check)` } },
    PILOT_ADMIN,
    PILOT
  );
  const renamed = await getAppSettings(PILOT);
  if (renamed.business.businessName !== `${originalName} (save-check)`) {
    throw new Error("Test Pilot business name save did not persist");
  }
  await saveAppSettings(
    { business: { ...renamed.business, businessName: originalName } },
    PILOT_ADMIN,
    PILOT
  );
  console.log("ok  Test Pilot business name save (and restore)");

  try {
    await saveAppSettings(
      { email: { ...pilot.email, senderEmail: "notification@swiftaerialmedia.com" } },
      PILOT_ADMIN,
      PILOT
    );
    throw new Error("ATTACK SUCCEEDED: spoof senderEmail");
  } catch (error) {
    if (!(error instanceof InvalidEmailSenderError)) throw error;
    console.log("ok  spoof senderEmail rejected:", error.message);
  }

  try {
    await saveAppSettings(
      {
        email: {
          ...pilot.email,
          senderMode: "custom_domain",
          domainVerificationStatus: "unverified",
          customDomain: "pilot.example",
          senderEmail: "hi@pilot.example",
        },
      },
      PILOT_ADMIN,
      PILOT
    );
    throw new Error("ATTACK SUCCEEDED: unverified custom_domain");
  } catch (error) {
    if (!(error instanceof InvalidEmailSenderError)) throw error;
    console.log("ok  unverified custom_domain rejected:", error.message);
  }

  try {
    await saveAppSettings(
      { business: { ...pilot.business, brandPrimaryColor: INJECTION } },
      PILOT_ADMIN,
      PILOT
    );
    throw new Error("ATTACK SUCCEEDED: CSS injection color");
  } catch (error) {
    if (!(error instanceof InvalidBrandColorError)) throw error;
    console.log("ok  CSS injection color rejected:", error.message);
  }

  const afterAttacks = await getAppSettings(PILOT);
  if (afterAttacks.email.senderEmail) {
    throw new Error("Test Pilot senderEmail persisted after rejected saves");
  }
  if (afterAttacks.email.senderMode !== "platform") {
    throw new Error(`expected platform senderMode, got ${afterAttacks.email.senderMode}`);
  }
  console.log("ok  Test Pilot still on platform sender");

  await saveAppSettings({ email: swiftEmail }, SWIFT_ADMIN, SWIFT, {
    allowVerificationWrite: true,
  });
  const swiftAfter = await getAppSettings(SWIFT);
  if (
    swiftAfter.email.senderEmail !== swiftEmail.senderEmail ||
    swiftAfter.email.senderMode !== "custom_domain" ||
    swiftAfter.email.domainVerificationStatus !== "verified"
  ) {
    throw new Error("Swift email settings changed");
  }
  console.log("ok  Swift save succeeded; sender untouched");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
