/**
 * Live sender-policy checks against the DB (same path as PATCH /api/admin/settings).
 * Does not print secrets.
 *
 *   npx tsx scripts/verify-email-sender-live.ts
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

async function main() {
  const { getAppSettings, saveAppSettings } = await import("../src/lib/app-settings");
  const { InvalidEmailSenderError } = await import("../src/lib/email-sender-policy");
  const { resolveFromHeader, resolveReplyTo, sendTestEmail } = await import("../src/lib/email");

  const swift = await getAppSettings(SWIFT);
  const pilot = await getAppSettings(PILOT);

  console.log("Swift From:", resolveFromHeader(swift));
  console.log("Swift Reply-To:", resolveReplyTo(swift) ?? "(none)");
  console.log("Pilot From:", resolveFromHeader(pilot));
  console.log("Pilot Reply-To:", resolveReplyTo(pilot) ?? "(none)");
  console.log("Pilot senderMode:", pilot.email.senderMode);

  const expectedSwift = "Swift Portal <notification@swiftaerialmedia.com>";
  if (resolveFromHeader(swift) !== expectedSwift) {
    throw new Error(`Swift From changed: got ${resolveFromHeader(swift)}`);
  }

  try {
    await saveAppSettings(
      {
        email: {
          ...pilot.email,
          senderEmail: "notification@swiftaerialmedia.com",
        },
      },
      PILOT_ADMIN,
      PILOT
    );
    throw new Error("ATTACK SUCCEEDED: Test Pilot was allowed to set Swift's senderEmail");
  } catch (error) {
    if (!(error instanceof InvalidEmailSenderError)) throw error;
    console.log("Attack rejected:", error.message);
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
    throw new Error("custom_domain while unverified was allowed");
  } catch (error) {
    if (!(error instanceof InvalidEmailSenderError)) throw error;
    console.log("Unverified custom_domain rejected:", error.message);
  }

  const after = await getAppSettings(PILOT);
  if (after.email.senderEmail) {
    throw new Error("Test Pilot senderEmail was persisted after rejected saves");
  }
  console.log("Pilot senderEmail still empty after attacks.");

  const swiftSend = await sendTestEmail("jackson@swiftaerialmedia.com", SWIFT);
  console.log(
    "Swift test send:",
    swiftSend.sent,
    swiftSend.messageId ?? swiftSend.error ?? swiftSend.skipReason
  );
  const pilotSend = await sendTestEmail("test@gmail.com", PILOT);
  console.log(
    "Pilot test send:",
    pilotSend.sent,
    pilotSend.messageId ?? pilotSend.error ?? pilotSend.skipReason
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
