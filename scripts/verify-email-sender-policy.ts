/**
 * Explicit sender-policy cases for prompt 16.
 * Run: npx tsx scripts/verify-email-sender-policy.ts
 */
import {
  assertEmailSenderPolicy,
  InvalidEmailSenderError,
  type EmailSenderMode,
  type DomainVerificationStatus,
} from "../src/lib/email-sender-policy";
import type { EmailSettings } from "../src/lib/app-settings";

const SWIFT = "00000000-0000-0000-0000-000000000001";
const PILOT = "00000000-0000-0000-0000-0000000000aa";
const PLATFORM = "shootportal.app";

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

function expectReject(label: string, fn: () => void, match: string) {
  try {
    fn();
    throw new Error(`${label}: expected rejection`);
  } catch (error) {
    if (!(error instanceof InvalidEmailSenderError)) throw error;
    if (!error.message.includes(match)) {
      throw new Error(`${label}: expected message containing "${match}", got "${error.message}"`);
    }
    console.log(`ok  ${label}`);
  }
}

function expectOk(label: string, fn: () => void) {
  fn();
  console.log(`ok  ${label}`);
}

const others = [
  { businessId: SWIFT, customDomain: "swiftaerialmedia.com" },
  { businessId: "00000000-0000-0000-0000-0000000000bb", customDomain: "other-pilot.example" },
];

expectOk("platform mode empty sender", () =>
  assertEmailSenderPolicy({
    email: email({ senderMode: "platform" }),
    businessId: PILOT,
    platformDomain: PLATFORM,
    otherBusinessDomains: others,
  })
);

expectReject(
  "attack: Test Pilot sets platform senderEmail",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "platform",
        senderEmail: "noreply@shootportal.app",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "platform domain"
);

expectReject(
  "custom_domain while unverified",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "custom_domain",
        domainVerificationStatus: "unverified",
        customDomain: "pilot.example",
        senderEmail: "hi@pilot.example",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "domainVerificationStatus='verified'"
);

expectReject(
  "custom_domain pending is not enough",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "custom_domain" as EmailSenderMode,
        domainVerificationStatus: "pending" as DomainVerificationStatus,
        customDomain: "pilot.example",
        senderEmail: "hi@pilot.example",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "domainVerificationStatus='verified'"
);

expectReject(
  "senderEmail domain owned by another business",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "custom_domain",
        domainVerificationStatus: "verified",
        customDomain: "pilot.example",
        senderEmail: "hi@other-pilot.example",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "belongs to another business"
);

expectReject(
  "senderEmail domain must match own customDomain",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "custom_domain",
        domainVerificationStatus: "verified",
        customDomain: "pilot.example",
        senderEmail: "hi@other.example",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "must equal this business's own verified customDomain"
);

expectOk("Swift custom_domain on the platform registrable domain", () =>
  assertEmailSenderPolicy({
    email: email({
      fromName: "Swift Portal",
      senderMode: "custom_domain",
      domainVerificationStatus: "verified",
      customDomain: "swiftaerialmedia.com",
      senderEmail: "notification@swiftaerialmedia.com",
    }),
    businessId: SWIFT,
    platformDomain: PLATFORM,
    otherBusinessDomains: others,
  })
);

expectOk("verified custom domain that is not the platform domain", () =>
  assertEmailSenderPolicy({
    email: email({
      senderMode: "custom_domain",
      domainVerificationStatus: "verified",
      customDomain: "pilot.example",
      senderEmail: "hello@pilot.example",
    }),
    businessId: PILOT,
    platformDomain: PLATFORM,
    otherBusinessDomains: others,
  })
);

expectReject(
  "cannot claim platform domain as customDomain",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "platform",
        customDomain: "shootportal.app",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: [],
    }),
  "platform domain"
);

expectReject(
  "cannot claim another business customDomain",
  () =>
    assertEmailSenderPolicy({
      email: email({
        senderMode: "platform",
        customDomain: "swiftaerialmedia.com",
      }),
      businessId: PILOT,
      platformDomain: PLATFORM,
      otherBusinessDomains: others,
    }),
  "customDomain belongs to another business"
);

console.log("\nAll email sender policy cases passed.");
