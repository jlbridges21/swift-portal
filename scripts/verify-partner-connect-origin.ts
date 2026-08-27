/**
 * Partner Connect return-origin guards (tenant host vs apex vs forged).
 * Usage: npx tsx scripts/verify-partner-connect-origin.ts
 */
import { readFileSync } from "node:fs";
import {
  partnerConnectReturnUrls,
  resolvePartnerConnectOrigin,
} from "../src/lib/partner-stripe-connect";
import { getPlatformApexOrigin } from "../src/lib/portal-url";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^([^#=]+)=(.*)$/);
  if (!m) continue;
  let v = m[2].trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1);
  }
  if (!(m[1].trim() in process.env)) process.env[m[1].trim()] = v;
}

const SWIFT_BUSINESS_ID = "00000000-0000-0000-0000-000000000001";
const apex = getPlatformApexOrigin().replace(/\/$/, "");

function expect(label: string, ok: boolean, detail?: unknown) {
  if (!ok) {
    throw new Error(`fail ${label}${detail ? `: ${JSON.stringify(detail)}` : ""}`);
  }
  console.log(`ok  ${label}`);
}

async function main() {
  // 3. Partner-only → apex
  const partnerOnly = await resolvePartnerConnectOrigin({
    hostname: "portal.swiftaerialmedia.com",
    pathname: "/api/partner/stripe/connect",
    pathCookie: null,
    profileBusinessId: null,
    forwardedProto: "https",
  });
  expect("partner-only user → apex", partnerOnly.origin === apex, partnerOnly);

  // 2. Tenant custom domain → tenant origin
  const tenantCustom = await resolvePartnerConnectOrigin({
    hostname: "portal.swiftaerialmedia.com",
    pathname: "/api/partner/stripe/connect",
    pathCookie: null,
    profileBusinessId: SWIFT_BUSINESS_ID,
    forwardedProto: "https",
  });
  const customReturn = partnerConnectReturnUrls(tenantCustom.origin);
  expect(
    "tenant custom domain return_url",
    customReturn.returnUrl ===
      "https://portal.swiftaerialmedia.com/api/partner/stripe/connect/callback",
    customReturn
  );
  expect("tenant custom used request host", tenantCustom.usedRequestHost === true);

  // 4. Apex partner with business → apex unchanged
  const apexPartner = await resolvePartnerConnectOrigin({
    hostname: "www.shootportal.app",
    pathname: "/api/partner/stripe/connect",
    pathCookie: null,
    profileBusinessId: SWIFT_BUSINESS_ID,
    forwardedProto: "https",
  });
  const apexReturn = partnerConnectReturnUrls(apexPartner.origin);
  expect("apex partner return_url", apexReturn.returnUrl === `${apex}/api/partner/stripe/connect/callback`, apexReturn);
  expect("apex partner origin", apexPartner.origin === apex);

  // 5. refresh_url same origin as return
  expect(
    "refresh_url matches tenant origin",
    partnerConnectReturnUrls(tenantCustom.origin).refreshUrl ===
      "https://portal.swiftaerialmedia.com/api/partner/stripe/connect/refresh"
  );

  // 6. Forged origin rejected
  const forged = await resolvePartnerConnectOrigin({
    hostname: "evil-phish.example",
    pathname: "/api/partner/stripe/connect",
    pathCookie: null,
    profileBusinessId: SWIFT_BUSINESS_ID,
    forwardedProto: "https",
  });
  console.log("\n=== forged origin attempt ===");
  console.log(
    JSON.stringify(
      {
        inputHostname: "evil-phish.example",
        result: forged,
        returnUrl: partnerConnectReturnUrls(forged.origin).returnUrl,
      },
      null,
      2
    )
  );
  expect("forged host rejected to apex", forged.origin === apex);
  expect("forged host recorded", forged.rejectedHostname === "evil-phish.example");
  expect(
    "forged return_url stays on apex",
    partnerConnectReturnUrls(forged.origin).returnUrl === `${apex}/api/partner/stripe/connect/callback`
  );

  console.log("\n✓ Partner Connect origin verification complete.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
