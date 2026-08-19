/**
 * Settings saves must validate the effective change, not a stale merged object.
 * Malicious NEW values remain rejected (prompt 15 colors, prompt 16 sender).
 * Run: npx tsx scripts/verify-settings-patch-validation.ts
 */
import {
  assertSafeBrandColors,
  changedBrandColors,
  InvalidBrandColorError,
} from "../src/lib/brand-color";
import {
  assertEmailSenderPolicy,
  emailSenderPolicyFieldsChanged,
  InvalidEmailSenderError,
  PLATFORM_EMAIL_SENDER_DEFAULTS,
} from "../src/lib/email-sender-policy";
import type { EmailSettings } from "../src/lib/app-settings";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const PILOT = "00000000-0000-0000-0000-0000000000aa";
const PLATFORM = "shootportal.app";
const INJECTION = "red; } body { display:none } :root { --x:";

function email(partial: Partial<EmailSettings>): EmailSettings {
  return {
    fromName: "Test",
    senderEmail: "",
    replyTo: "",
    footerText: "",
    senderMode: "platform",
    customDomain: "",
    domainVerificationStatus: "unverified",
    resendDomainId: "",
    ...partial,
  };
}

function expect(label: string, ok: boolean) {
  if (!ok) throw new Error(`fail ${label}`);
  console.log(`ok  ${label}`);
}

function expectReject(label: string, fn: () => void, match: string) {
  try {
    fn();
    throw new Error(`${label}: expected rejection`);
  } catch (error) {
    if (!(error instanceof InvalidEmailSenderError || error instanceof InvalidBrandColorError)) {
      throw error;
    }
    if (!error.message.includes(match)) {
      throw new Error(`${label}: expected "${match}", got "${error.message}"`);
    }
    console.log(`ok  ${label}`);
  }
}

const others = [{ businessId: SWIFT, customDomain: "swiftaerialmedia.com" }];

const storedLegacy = email({
  senderMode: "platform",
  senderEmail: "notification@swiftaerialmedia.com",
  customDomain: "",
  domainVerificationStatus: "unverified",
});

expect(
  "unchanged legacy sender must not count as an email policy change",
  !emailSenderPolicyFieldsChanged(storedLegacy, { ...storedLegacy })
);

expect(
  "logo-style save (same email after merge) does not gate on policy",
  !emailSenderPolicyFieldsChanged(storedLegacy, storedLegacy)
);

expect(
  "full-object PATCH repeating stored spoof is still unchanged",
  !emailSenderPolicyFieldsChanged(
    storedLegacy,
    email({
      ...storedLegacy,
      senderEmail: "notification@swiftaerialmedia.com",
      senderMode: "platform",
    })
  )
);

const newSpoof = email({
  senderMode: "platform",
  senderEmail: "notification@swiftaerialmedia.com",
});
expect("new spoof vs platform defaults is a change", emailSenderPolicyFieldsChanged(email({}), newSpoof));

expectReject(
  "attack: NEW Test Pilot senderEmail on Swift domain is still rejected",
  () =>
    assertEmailSenderPolicy({
      email: newSpoof,
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "belongs to another business"
);

expectReject(
  "attack: NEW custom_domain while unverified is still rejected",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "custom_domain",
        customDomain: "pilot-drones.example",
        domainVerificationStatus: "unverified",
        senderEmail: "hello@pilot-drones.example",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "custom_domain"
);

const restore = email({ ...storedLegacy, ...PLATFORM_EMAIL_SENDER_DEFAULTS });
expect("restore platform defaults is an email change", emailSenderPolicyFieldsChanged(storedLegacy, restore));
assertEmailSenderPolicy({
  email: restore,
  businessId: PILOT,
  platformDomain: PLATFORM,
  otherBusinessDomains: others,
});
console.log("ok  restore to platform sender is a valid policy result");

const storedColors = { brandPrimaryColor: "#112233", brandAccentColor: "#445566" };
expect(
  "unchanged colors produce an empty delta (legacy injection would not block)",
  Object.keys(
    changedBrandColors(storedColors, {
      brandPrimaryColor: "#112233",
      brandAccentColor: "#445566",
    })
  ).length === 0
);

expectReject(
  "attack: NEW CSS-injection brand color is still rejected",
  () => assertSafeBrandColors({ brandPrimaryColor: INJECTION }),
  "brandPrimaryColor"
);

expectReject(
  "attack: changing accent to injection is still rejected",
  () =>
    assertSafeBrandColors(
      changedBrandColors(storedColors, {
        brandPrimaryColor: "#112233",
        brandAccentColor: INJECTION,
      })
    ),
  "brandAccentColor"
);

assertSafeBrandColors(
  changedBrandColors(storedColors, {
    brandPrimaryColor: "#aabbcc",
    brandAccentColor: "#445566",
  })
);
console.log("ok  legitimate color change still validates");

console.log("\nAll settings patch-validation cases passed.");
