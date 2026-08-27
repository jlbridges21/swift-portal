import type { Metadata } from "next";
import Link from "next/link";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { MARKETING_SUPPORT_EMAIL, marketingPageMetadata } from "@/lib/marketing";

export const revalidate = 86400;

export const metadata: Metadata = marketingPageMetadata({
  title: "Terms of Service",
  description:
    "Terms governing use of ShootPortal for media businesses and their clients.",
  path: "/terms",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-[#0F172A]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#475569]">{children}</div>
    </section>
  );
}

export default async function TermsPage() {
  await requirePlatformMarketingHost();
  const updated = "August 27, 2026";

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0F172A]">
            Terms of Service
          </h1>
          <p className="mt-3 text-sm text-[#475569]">Last updated: {updated}</p>
          <p className="mt-6 text-sm leading-relaxed text-[#475569]">
            These Terms govern access to ShootPortal. They are a working draft for attorney review,
            not legal advice. By creating an account or using the service, you agree to these Terms.
          </p>

          <Section title="1. The service">
            <p>
              ShootPortal is a SaaS platform that helps media businesses manage client projects
              from request through delivery — including estimates, scheduling, messaging, media
              review, payments, and delivery — under the Tenant’s branding.
            </p>
          </Section>

          <Section title="2. Accounts and eligibility">
            <p>
              You must provide accurate registration information and keep credentials secure. You
              are responsible for activity under your Tenant workspace. Clients access the portal
              under accounts linked to a Tenant’s projects.
            </p>
          </Section>

          <Section title="3. Plans, trials, and billing">
            <p>
              Paid plans, prices, entitlements, and trial lengths are defined in our live plans
              catalog and shown on the{" "}
              <Link href="/pricing" className="font-medium text-[#4F46E5] hover:underline">
                Pricing
              </Link>{" "}
              page. Trials may start without a credit card; continuing after a trial requires a
              subscription billed through Stripe. Taxes may apply. Failure to pay may result in
              suspension.
            </p>
          </Section>

          <Section title="4. Tenant responsibilities">
            <p>
              Tenants are responsible for: (a) lawful collection and use of Client personal data
              and media; (b) required notices and consents to Clients; (c) content they upload;
              (d) configuring branding, services, and communications accurately; and (e) complying
              with photography/video and privacy laws in their jurisdictions.
            </p>
          </Section>

          <Section title="5. Client data and media">
            <p>
              Client personal data and project media are owned by the Tenant (or the Client, as
              applicable). ShootPortal processes that data to provide the service. You grant us a
              limited license to host, transmit, and display content solely to operate ShootPortal
              for your workspace. You represent you have rights to upload and process that content.
            </p>
          </Section>

          <Section title="6. Payments and Stripe Connect">
            <p>
              Payment features rely on Stripe. Tenants who receive payouts must complete Stripe
              Connect onboarding and comply with Stripe’s terms. ShootPortal is not a bank and does
              not hold client funds outside Stripe’s systems.
            </p>
          </Section>

          <Section title="7. Acceptable use">
            <p>
              You may not misuse the service, attempt to access other Tenants’ data, upload unlawful
              or infringing content, interfere with security, or reverse engineer the product except
              as allowed by law. We may suspend accounts that violate these Terms.
            </p>
          </Section>

          <Section title="8. Intellectual property">
            <p>
              ShootPortal software, branding, and documentation remain our property. Tenant
              branding assets and Client media remain the Tenant’s or Client’s property, subject to
              the licenses above.
            </p>
          </Section>

          <Section title="9. Confidentiality">
            <p>
              Each party will protect the other’s confidential information and use it only as
              needed to perform under these Terms, except for information that is public,
              independently developed, or required to be disclosed by law.
            </p>
          </Section>

          <Section title="10. Disclaimers">
            <p>
              THE SERVICE IS PROVIDED “AS IS.” TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE DISCLAIM
              WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
              We do not guarantee uninterrupted service or that media delivery will meet every
              Client expectation — that remains between Tenant and Client.
            </p>
          </Section>

          <Section title="11. Limitation of liability">
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, SHOOTPORTAL’S TOTAL LIABILITY ARISING OUT OF
              THESE TERMS WILL NOT EXCEED THE FEES PAID BY YOU TO SHOOTPORTAL IN THE TWELVE (12)
              MONTHS BEFORE THE CLAIM. WE ARE NOT LIABLE FOR INDIRECT, INCIDENTAL, SPECIAL,
              CONSEQUENTIAL, OR LOST-PROFIT DAMAGES.
            </p>
          </Section>

          <Section title="12. Indemnity">
            <p>
              Tenants will indemnify ShootPortal against claims arising from Tenant content, Client
              relationships, unlawful use of the service, or violation of these Terms, except to
              the extent caused by our willful misconduct.
            </p>
          </Section>

          <Section title="13. Termination">
            <p>
              You may stop using the service and request account closure. We may suspend or
              terminate for breach, non-payment, or risk to the platform. Upon termination, your
              right to access the workspace ends; we handle deletion/export per our Privacy Policy.
            </p>
          </Section>

          <Section title="14. Changes">
            <p>
              We may update these Terms. Continued use after the effective date of changes
              constitutes acceptance where permitted. Material changes may be communicated by email
              or in-product notice.
            </p>
          </Section>

          <Section title="15. Contact">
            <p>
              Questions:{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
            </p>
          </Section>

          <Section title="16. Partners / referral program — DRAFT NEEDED">
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
              <p className="font-semibold">
                NEW — AWAITING ATTORNEY REVIEW (structure / facts only; no legal prose)
              </p>
              <p className="mt-2">
                Current Terms do <strong>not</strong> mention Partners, commissions, referral
                attribution, hold periods, clawbacks/reversals, or partner Stripe Express payouts.
                Counsel should add a Partners section covering at least:
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                <li>Partner eligibility, application, and account status (active / suspended)</li>
                <li>Commission rate (program default and per-partner override)</li>
                <li>
                  Hold period before commissions are payable:{" "}
                  <strong>30 days</strong> (product constant{" "}
                  <code className="text-xs">PARTNER_COMMISSION_HOLD_DAYS</code>)
                </li>
                <li>
                  Clawback / reversal behavior when referred-subscription payments are refunded
                  (append-only negative ledger rows — not silent mutation of history)
                </li>
                <li>
                  Payouts via Stripe Express Transfers; ShootPortal does not hold partner bank
                  details (see Privacy §4b)
                </li>
                <li>Relationship to Privacy Policy and Stripe’s Connected Account Agreement</li>
              </ul>
            </div>
          </Section>
        </article>
      </MarketingShell>
    </BrandProvider>
  );
}
