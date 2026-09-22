/**
 * Unit checks for custom-domain compose + DNS record building rules.
 * Run: npx tsx scripts/verify-custom-domain-input.ts
 */
import {
  composePortalDomainInput,
  validateCustomDomainCandidate,
} from "../src/lib/custom-domain-input";

function expect(label: string, ok: boolean, detail?: string) {
  if (!ok) throw new Error(`fail ${label}${detail ? `: ${detail}` : ""}`);
  console.log(`ok  ${label}`);
}

// www subdomain refused
{
  const r = composePortalDomainInput({
    mode: "subdomain",
    subdomain: "www",
    rootDomain: "swiftaerialmedia.com",
  });
  expect("www subdomain refused", !r.ok);
  if (!r.ok) {
    expect("www message mentions main website", /main website/i.test(r.error));
    console.log("   →", r.error);
  }
}

// https://www in domain field → strip www, keep portal subdomain
{
  const r = composePortalDomainInput({
    mode: "subdomain",
    subdomain: "portal",
    rootDomain: "https://www.swiftaerialmedia.com",
  });
  expect("https www → portal.swiftaerialmedia.com", r.ok && r.ok && r.domain === "portal.swiftaerialmedia.com");
  if (r.ok) {
    expect("https www notice", !!r.notice && /www/i.test(r.notice));
    console.log("   →", r.domain, "|", r.notice);
  }
}

// https without www
{
  const r = composePortalDomainInput({
    mode: "subdomain",
    subdomain: "portal",
    rootDomain: "https://swiftaerialmedia.com",
  });
  expect("https root stripped", r.ok && r.ok && r.domain === "portal.swiftaerialmedia.com");
  if (r.ok) {
    expect("https notice", !!r.notice && /understood/i.test(r.notice));
    console.log("   →", r.domain, "|", r.notice);
  }
}

// FQDN in domain field splits
{
  const r = composePortalDomainInput({
    mode: "subdomain",
    subdomain: "portal",
    rootDomain: "portal.swiftaerialmedia.com",
  });
  expect("FQDN split ok", r.ok);
  if (r.ok) {
    expect("no doubled subdomain", r.domain === "portal.swiftaerialmedia.com");
    expect("split present", !!r.split && r.split.subdomain === "portal");
    console.log("   →", r.domain, r.notice);
  }
}

// Empty subdomain → apex redirect
{
  const r = composePortalDomainInput({
    mode: "subdomain",
    subdomain: "",
    rootDomain: "swiftaerialmedia.com",
  });
  expect("empty subdomain refused", !r.ok);
  if (!r.ok) {
    expect("redirectToApex", r.redirectToApex === true);
    console.log("   →", r.error);
  }
}

// Apex path
{
  const r = composePortalDomainInput({
    mode: "apex",
    apexDomain: "swiftaerialmedia.com",
  });
  expect("apex ok", r.ok && r.isApex && r.domain === "swiftaerialmedia.com");
}

// Candidate www.portal-style
{
  const r = validateCustomDomainCandidate("www.swiftaerialmedia.com");
  expect("validate www subdomain refused", !r.ok);
  if (!r.ok) console.log("   →", r.error);
}

console.log("\nAll custom-domain input cases passed.");
