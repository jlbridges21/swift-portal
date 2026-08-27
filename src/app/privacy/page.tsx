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

function ReviewBadge({ kind }: { kind: "new" | "changed" | "unchanged" }) {
  if (kind === "unchanged") return null;
  const label =
    kind === "new" ? "NEW — AWAITING ATTORNEY REVIEW" : "CHANGED — AWAITING ATTORNEY REVIEW";
  return (
    <span className="ml-2 inline-block rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-950">
      {label}
    </span>
  );
}

function Section({
  title,
  review = "unchanged",
  children,
}: {
  title: string;
  review?: "new" | "changed" | "unchanged";
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold text-[#0F172A]">
        {title}
        <ReviewBadge kind={review} />
      </h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#475569]">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
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

          <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <p className="font-semibold">Attorney review map (August 27, 2026)</p>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              <li>
                Sections marked <strong>NEW</strong> or <strong>CHANGED</strong> contain
                code-derived facts / structure only — not polished legal prose.
              </li>
              <li>
                Unmarked sections are prior draft text and remain unreviewed unless counsel says
                otherwise.
              </li>
              <li>
                Full data-flow inventory for counsel is summarized in §15 and in{" "}
                <code className="text-xs">docs/LAUNCH-CHECKLIST.md</code> §1b.
              </li>
            </ul>
          </div>

          <Section title="1. Who we are and roles" review="changed">
            <p>
              ShootPortal provides software for media businesses (photographers, videographers,
              drone operators, real estate media companies, and similar studios). When a business
              (“Tenant”) uses ShootPortal to serve its customers (“Clients”), ShootPortal typically
              acts as a <strong>processor</strong> (or service provider) for Client personal data
              and media that the Tenant uploads or collects. The Tenant is the controller (or
              business) for that Client data. For Tenant account data (admins, billing contacts),
              ShootPortal acts as a controller.
            </p>
            <p>
              <strong>Partners (referral program):</strong> individuals or brands who refer new
              Tenants and may receive commission payouts. Partner account data is collected by
              ShootPortal as controller for the partner program. Sensitive payout KYC (bank /
              tax) is collected by Stripe during hosted Express onboarding — see §4b.
            </p>
          </Section>

          <Section title="2. Data we collect" review="changed">
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
              <strong>From Partners:</strong> application and account fields (name, email, brand
              name, website, social links, audience/promotion description as submitted), referral
              code, commission rate, status, notes (platform-admin), Connect account status
              identifiers (not bank/tax secrets — §4b), landing-page content they configure, and
              payout/commission ledger records (amounts, period, Stripe transfer id).
            </p>
            <p>
              <strong>Automatically:</strong> device/browser information, IP address, approximate
              location derived from IP, cookies or similar technologies for authentication and
              security, diagnostic logs, and (where used) the first-party referral attribution
              cookie described in §2b.
            </p>
            <p>
              <strong>Sign-in via Google (OAuth):</strong> when a user chooses Google sign-in
              (Tenant admin, Client, Partner, or platform admin on an allowed host), Google
              authenticates the user through our auth provider (Supabase). We receive identity
              needed to create/link a session (typically email and display name). We do not use
              Google Calendar or other Google product APIs.
            </p>
          </Section>

          <Section title="2b. Referral attribution cookie (sp_partner_ref)" review="new">
            <p>
              <strong>Facts from product code</strong> (counsel to convert into policy language):
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Name:</strong> <code className="text-xs">sp_partner_ref</code>
              </li>
              <li>
                <strong>Purpose:</strong> attribute a new Tenant signup to a Partner referral code
                or partner landing page so commission / referral-discount logic can run.
              </li>
              <li>
                <strong>Lifetime:</strong> 90 days (<code className="text-xs">90 * 24 * 60 * 60</code>{" "}
                seconds).
              </li>
              <li>
                <strong>Attributes:</strong> first-party, <code className="text-xs">httpOnly</code>,{" "}
                <code className="text-xs">SameSite=Lax</code>, <code className="text-xs">Secure</code>{" "}
                in production; path <code className="text-xs">/</code>; host-only (no cross-site
                tracking domain).
              </li>
              <li>
                <strong>Value:</strong> signed payload containing referral code, timestamps, and
                source (<code className="text-xs">link</code> or{" "}
                <code className="text-xs">landing_page</code>) — not a browsing profile.
              </li>
              <li>
                <strong>Set on:</strong> platform apex when visitor uses <code className="text-xs">?ref=</code>{" "}
                or an active partner landing slug. Not set on Tenant custom domains.
              </li>
              <li>
                <strong>Prior §2 “cookies … for authentication and security” language does not
                specifically disclose this 90-day attribution cookie.</strong>
              </li>
            </ul>
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

          <Section title="4. Payments — Stripe and Stripe Connect (Tenants)" review="changed">
            <p>
              <strong>Scope of this section:</strong> Tenant subscription billing to ShootPortal,
              and Tenant→Client project payments via the Tenant’s Stripe Connect account.
            </p>
            <p>
              Payment processing is provided by Stripe. Client card data is handled by Stripe; we
              do not store full card numbers on ShootPortal servers. For Tenant payouts of Client
              charges, we use Stripe Connect (Tenant connected accounts). Stripe’s privacy
              documentation applies to payment data they process. We store payment status, amounts,
              and identifiers needed for project accounting.
            </p>
            <p>
              Partner commission payouts use a separate Stripe Express flow — see §4b (not covered
              by the paragraph above).
            </p>
          </Section>

          <Section title="4b. Partner payouts — Stripe Express" review="new">
            <p>
              <strong>Facts from product code</strong> (counsel to convert into policy language):
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                Partners who receive commissions onboard a <strong>Stripe Express</strong> connected
                account via Stripe-hosted Account Links (<code className="text-xs">account_onboarding</code>
                ). ShootPortal does not embed bank-detail or tax-ID forms in-app.
              </li>
              <li>
                <strong>ShootPortal does not receive or store</strong> partner bank account numbers,
                routing numbers, Social Security numbers, TINs, W-9/W-8 form contents, or 1099
                filing payloads. Those are collected and held by Stripe during Express onboarding /
                Stripe tax products. Code comment and behavior: “we never collect TINs in-app.”
              </li>
              <li>
                <strong>ShootPortal does store</strong> Connect operational fields only: Express
                account id (<code className="text-xs">acct_…</code>), status enums, payouts-enabled
                flag, details-submitted flag, whether requirements are due, a short summary of
                Stripe requirement <em>key names</em> (not the underlying secrets), Connect mode
                (test/live), and connected-at timestamps.
              </li>
              <li>
                Payouts are Stripe <strong>Transfers</strong> to the partner’s Express account id.
                ShootPortal stores ledger rows (commission amounts, hold/payable dates, reversals
                on refunds), payout records (amount, Stripe transfer id as reference), and run
                audit metadata — not bank credentials.
              </li>
              <li>
                Platform operators may see Connect <em>status</em> and requirement key summaries in
                the admin console; they do not see bank or tax identifiers through ShootPortal.
              </li>
            </ul>
          </Section>

          <Section title="5. Email — Resend" review="changed">
            <p>
              Transactional and notification email (estimates, messages, reminders, account mail,
              partner lifecycle and payout notices) is sent via Resend. Message content and
              recipient addresses necessary to deliver mail are processed by Resend under their
              terms. Platform-owned mail uses ShootPortal sending domains; Tenant-branded content
              may appear in message bodies. Delivery events (e.g. open/click/bounce) may be stored
              for product diagnostics when webhooks are configured.
            </p>
          </Section>

          <Section title="6. Subprocessors" review="changed">
            <p>We use reputable infrastructure providers to run the product, including:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Supabase — authentication, database, and file storage</li>
              <li>Vercel — application hosting, edge delivery, and custom-domain APIs</li>
              <li>
                Stripe — Tenant billing, Tenant Connect (Client charges), Partner Express accounts
                and commission transfers
              </li>
              <li>Resend — transactional email</li>
              <li>
                Google — OAuth sign-in only (identity provider via Supabase Auth). Not used for
                Calendar or other Google Workspace APIs.
              </li>
              <li>
                OneSignal — optional web push notifications for subscribed Tenant admins
                (subscription id stored on the admin profile)
              </li>
            </ul>
            <p>
              <strong>Tenant-configured outbound (not a platform-wide subprocessor by default):</strong>{" "}
              GoHighLevel — if a Tenant enables a GHL webhook, Client lead fields the Tenant
              already holds may be sent to that Tenant’s GHL endpoint.
            </p>
            <p>
              <strong>Removed / not in use:</strong> Google Calendar sync (previously present; not
              in current product code).
            </p>
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

          <Section title="9. Deletion and export requests" review="changed">
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
            <p>
              <strong>Partners:</strong> may request account/export/deletion guidance via{" "}
              {MARKETING_SUPPORT_EMAIL}. Payout KYC held by Stripe must be handled under Stripe’s
              processes.
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

          <Section title="15. Code-derived data flow inventory (for counsel)" review="new">
            <p>
              Compact inventory of personal-data categories the product touches. “ShootPortal sees?”
              means stored or processed in ShootPortal-controlled systems (DB, object storage, logs),
              not merely passed through a third party’s hosted UI.
            </p>
            <div className="overflow-x-auto">
              <table className="mt-3 w-full min-w-[720px] border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-[#CBD5E1] text-[#0F172A]">
                    <th className="py-2 pr-2 font-semibold">What</th>
                    <th className="py-2 pr-2 font-semibold">Whose</th>
                    <th className="py-2 pr-2 font-semibold">Collected by</th>
                    <th className="py-2 pr-2 font-semibold">Stored where</th>
                    <th className="py-2 pr-2 font-semibold">Shared with</th>
                    <th className="py-2 pr-2 font-semibold">Why</th>
                    <th className="py-2 font-semibold">ShootPortal sees?</th>
                  </tr>
                </thead>
                <tbody className="align-top text-[#475569]">
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Account email, name, password hash / OAuth identity</td>
                    <td className="py-2 pr-2">Tenant admin, Client, Partner, platform admin</td>
                    <td className="py-2 pr-2">ShootPortal / Supabase Auth / Google (OAuth)</td>
                    <td className="py-2 pr-2">Supabase Auth + profiles</td>
                    <td className="py-2 pr-2">Supabase; Google (OAuth only)</td>
                    <td className="py-2 pr-2">Sign-in, roles, routing</td>
                    <td className="py-2">Yes (email/name/role; not Google refresh tokens in app tables)</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Business profile, branding, billing contact</td>
                    <td className="py-2 pr-2">Tenant</td>
                    <td className="py-2 pr-2">Tenant admin</td>
                    <td className="py-2 pr-2">Postgres (businesses, app_settings)</td>
                    <td className="py-2 pr-2">Vercel/Supabase infra</td>
                    <td className="py-2 pr-2">Operate Tenant workspace</td>
                    <td className="py-2">Yes</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Client PII (name, email, phone, company, address fields)</td>
                    <td className="py-2 pr-2">Client</td>
                    <td className="py-2 pr-2">Tenant (ShootPortal as processor)</td>
                    <td className="py-2 pr-2">Postgres (clients, projects)</td>
                    <td className="py-2 pr-2">Optional GHL webhook if Tenant enables</td>
                    <td className="py-2 pr-2">Projects / CRM</td>
                    <td className="py-2">Yes (as processor)</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Project media (photos, video, docs, 360)</td>
                    <td className="py-2 pr-2">Client / Tenant subjects</td>
                    <td className="py-2 pr-2">Tenant</td>
                    <td className="py-2 pr-2">Supabase Storage / object storage</td>
                    <td className="py-2 pr-2">Storage provider</td>
                    <td className="py-2 pr-2">Delivery / review</td>
                    <td className="py-2">Yes (as processor)</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Card numbers / payment methods (Client→Tenant; Tenant→ShootPortal)</td>
                    <td className="py-2 pr-2">Client / Tenant</td>
                    <td className="py-2 pr-2">Stripe</td>
                    <td className="py-2 pr-2">Stripe</td>
                    <td className="py-2 pr-2">Stripe</td>
                    <td className="py-2 pr-2">Charges / subscriptions</td>
                    <td className="py-2">No full PANs — status/amount/ids only</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Partner bank account, tax ID/SSN, W-9/W-8, 1099 payloads</td>
                    <td className="py-2 pr-2">Partner</td>
                    <td className="py-2 pr-2">Stripe (hosted Express onboarding)</td>
                    <td className="py-2 pr-2">Stripe only</td>
                    <td className="py-2 pr-2">Stripe</td>
                    <td className="py-2 pr-2">KYC / tax / payouts</td>
                    <td className="py-2">
                      <strong>No</strong> — never received or stored by ShootPortal
                    </td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Partner Connect status (acct id, flags, requirement key names)</td>
                    <td className="py-2 pr-2">Partner</td>
                    <td className="py-2 pr-2">Stripe Account API → ShootPortal</td>
                    <td className="py-2 pr-2">partners.stripe_connect_*</td>
                    <td className="py-2 pr-2">Stripe</td>
                    <td className="py-2 pr-2">Payout eligibility UI</td>
                    <td className="py-2">Yes (status only)</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Commission ledger &amp; transfer ids</td>
                    <td className="py-2 pr-2">Partner</td>
                    <td className="py-2 pr-2">ShootPortal</td>
                    <td className="py-2 pr-2">partner_commissions, partner_payouts, run tables</td>
                    <td className="py-2 pr-2">Stripe (Transfers API)</td>
                    <td className="py-2 pr-2">Pay commissions</td>
                    <td className="py-2">Yes</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">sp_partner_ref cookie</td>
                    <td className="py-2 pr-2">Visitor → prospective Tenant</td>
                    <td className="py-2 pr-2">ShootPortal (apex)</td>
                    <td className="py-2 pr-2">Browser cookie (90 days)</td>
                    <td className="py-2 pr-2">—</td>
                    <td className="py-2 pr-2">Referral attribution</td>
                    <td className="py-2">Yes (reads signed code; writes partner_referrals on signup)</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Transactional email content + recipient</td>
                    <td className="py-2 pr-2">All user types</td>
                    <td className="py-2 pr-2">ShootPortal</td>
                    <td className="py-2 pr-2">Resend; optional email_events</td>
                    <td className="py-2 pr-2">Resend</td>
                    <td className="py-2 pr-2">Notify / deliver</td>
                    <td className="py-2">Yes</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Web push subscription id</td>
                    <td className="py-2 pr-2">Tenant admin</td>
                    <td className="py-2 pr-2">OneSignal + ShootPortal</td>
                    <td className="py-2 pr-2">profiles.onesignal_subscription_id</td>
                    <td className="py-2 pr-2">OneSignal</td>
                    <td className="py-2 pr-2">Admin notifications</td>
                    <td className="py-2">Yes</td>
                  </tr>
                  <tr className="border-b border-[#E2E8F0]">
                    <td className="py-2 pr-2">Platform audit (actor email, IP, action metadata)</td>
                    <td className="py-2 pr-2">Platform operators / targets</td>
                    <td className="py-2 pr-2">ShootPortal</td>
                    <td className="py-2 pr-2">platform_audit_log</td>
                    <td className="py-2 pr-2">—</td>
                    <td className="py-2 pr-2">Security / compliance</td>
                    <td className="py-2">Yes</td>
                  </tr>
                  <tr>
                    <td className="py-2 pr-2">Impersonation session cookie</td>
                    <td className="py-2 pr-2">Platform super-admin</td>
                    <td className="py-2 pr-2">ShootPortal</td>
                    <td className="py-2 pr-2">httpOnly cookie (short TTL)</td>
                    <td className="py-2 pr-2">—</td>
                    <td className="py-2 pr-2">Support / debugging</td>
                    <td className="py-2">Yes (audited)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>
        </article>
      </MarketingShell>
    </BrandProvider>
  );
}
