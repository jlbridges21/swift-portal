import type { Metadata } from "next";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { MARKETING_SUPPORT_EMAIL, marketingPageMetadata } from "@/lib/marketing";

export const revalidate = 86400;

export const metadata: Metadata = marketingPageMetadata({
  title: "Privacy Policy",
  description:
    "How ShootPortal collects, stores, and processes business and client data, media, and payments.",
  path: "/privacy",
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-[#0F172A]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#475569]">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  await requirePlatformMarketingHost();
  const updated = "August 21, 2026";

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0F172A]">
            Privacy Policy
          </h1>
          <p className="mt-3 text-sm text-[#475569]">Last updated: {updated}</p>
          <p className="mt-6 text-sm leading-relaxed text-[#475569]">
            This policy describes how ShootPortal (“we,” “us”) handles information when you use
            shootportal.app and related services. It is a starting point for legal review — not a
            substitute for advice from your counsel. ShootPortal stores third-party client personal
            data and media on behalf of media businesses and participates in payment flows; treat
            those obligations seriously.
          </p>

          <Section title="1. Who we are and roles">
            <p>
              ShootPortal provides software for media businesses (photographers, videographers,
              drone operators, real estate media companies, and similar studios). When a business
              (“Tenant”) uses ShootPortal to serve its customers (“Clients”), ShootPortal typically
              acts as a <strong>processor</strong> (or service provider) for Client personal data
              and media that the Tenant uploads or collects. The Tenant is the controller (or
              business) for that Client data. For Tenant account data (admins, billing contacts),
              ShootPortal acts as a controller.
            </p>
          </Section>

          <Section title="2. Data we collect">
            <p>
              <strong>From Tenants / business users:</strong> name, email, password (hashed via our
              auth provider), business profile (name, logo, branding, contact details, address),
              plan and subscription status, team member accounts, support messages, and usage logs
              needed to operate the service.
            </p>
            <p>
              <strong>From Clients (on behalf of Tenants):</strong> name, email, phone, company,
              property/project details, messages, estimate and payment records, review feedback,
              and media files (photos, video, documents, 360 content) uploaded to projects.
            </p>
            <p>
              <strong>Automatically:</strong> device/browser information, IP address, approximate
              location derived from IP, cookies or similar technologies for authentication and
              security, and diagnostic logs.
            </p>
          </Section>

          <Section title="3. Media storage and retention">
            <p>
              Project media is stored in object storage associated with the Tenant’s workspace.
              Retention follows the Tenant’s use of the product and plan storage limits. When a
              Tenant deletes media, projects, or their business account, we remove or schedule
              removal of associated objects according to our deletion processes, subject to
              backups and legal holds. Tenants should not upload media they are not authorized to
              process.
            </p>
          </Section>

          <Section title="4. Payments — Stripe and Stripe Connect">
            <p>
              Payment processing is provided by Stripe. Client card data is handled by Stripe; we
              do not store full card numbers on ShootPortal servers. For Tenant payouts, we use
              Stripe Connect. Stripe’s privacy documentation applies to payment data they process.
              We store payment status, amounts, and identifiers needed for project accounting.
            </p>
          </Section>

          <Section title="5. Email — Resend">
            <p>
              Transactional and notification email (estimates, messages, reminders, account mail)
              is sent via Resend. Message content and recipient addresses necessary to deliver mail
              are processed by Resend under their terms. Platform-owned mail uses ShootPortal
              sending domains; Tenant-branded content may appear in message bodies.
            </p>
          </Section>

          <Section title="6. Subprocessors">
            <p>We use reputable infrastructure providers to run the product, including:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Supabase — authentication, database, and file storage</li>
              <li>Vercel — application hosting and edge delivery</li>
              <li>Stripe — payments and Connect payouts</li>
              <li>Resend — transactional email</li>
            </ul>
            <p>
              We may update this list as providers change. Material changes will be reflected in
              this policy.
            </p>
          </Section>

          <Section title="7. How we use information">
            <p>
              We use data to provide and secure the service, authenticate users, send
              product/transactional communications, process payments, prevent abuse, improve
              reliability, and comply with law. We do not sell personal information.
            </p>
          </Section>

          <Section title="8. Sharing">
            <p>
              We share data with subprocessors under contract, with Tenants regarding their own
              workspace, with Stripe for payments, and when required by law or to protect rights
              and safety. Client data belonging to a Tenant is not shared with other Tenants.
            </p>
          </Section>

          <Section title="9. Deletion and export requests">
            <p>
              <strong>Tenants:</strong> may export project/client records and download media they
              control, and may request account closure via {MARKETING_SUPPORT_EMAIL}.
            </p>
            <p>
              <strong>Clients:</strong> should contact the Tenant that collected their data.
              ShootPortal can assist Tenants with deletion/export technical requests. Individuals
              may also contact us at {MARKETING_SUPPORT_EMAIL}; we may redirect Client requests to
              the relevant Tenant when we act as processor.
            </p>
          </Section>

          <Section title="10. Security">
            <p>
              We use industry-standard controls including encrypted transport (HTTPS), access
              controls, tenant isolation in application data access, and hashed credentials via
              our auth provider. No method of transmission or storage is 100% secure.
            </p>
          </Section>

          <Section title="11. International transfers">
            <p>
              Infrastructure may process data in the United States and other regions where our
              providers operate. Where required, we rely on appropriate transfer mechanisms.
            </p>
          </Section>

          <Section title="12. Children">
            <p>
              The service is not directed to children under 16. We do not knowingly collect
              personal information from children.
            </p>
          </Section>

          <Section title="13. Changes">
            <p>
              We may update this policy. The “Last updated” date will change when we post
              revisions. Continued use after changes constitutes acceptance where permitted by law.
            </p>
          </Section>

          <Section title="14. Contact">
            <p>
              Privacy questions:{" "}
              <a className="font-medium text-[#4F46E5] hover:underline" href={`mailto:${MARKETING_SUPPORT_EMAIL}`}>
                {MARKETING_SUPPORT_EMAIL}
              </a>
            </p>
          </Section>
        </article>
      </MarketingShell>
    </BrandProvider>
  );
}
