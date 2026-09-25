import type { Metadata } from "next";
import Link from "next/link";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { MARKETING_SUPPORT_EMAIL, marketingPageMetadata } from "@/lib/marketing";

export const revalidate = 86400;

export const metadata: Metadata = marketingPageMetadata({
  title: "Privacy Policy",
  description:
    "How ShootPortal collects, uses, and shares information for media businesses, their clients, and referral partners.",
  path: "/privacy",
});

const TOC = [
  ["who", "1. Who this policy covers"],
  ["collect", "2. Information we collect"],
  ["google", "3. Google sign-in and Calendar"],
  ["cookies", "4. Cookies and similar technologies"],
  ["use", "5. How we use information"],
  ["payments", "6. Payments and Stripe"],
  ["sharing", "7. Service providers and other disclosures"],
  ["sale", "8. Sale, sharing, and advertising"],
  ["retention", "9. How long we keep information"],
  ["security", "10. Security"],
  ["transfers", "11. International transfers"],
  ["rights", "12. Privacy rights and requests"],
  ["children", "13. Children"],
  ["changes", "14. Changes and contact"],
] as const;

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-10 scroll-mt-24">
      <h2 className="text-xl font-semibold text-[#0F172A]">{title}</h2>
      <div className="mt-3 space-y-3 text-sm leading-relaxed text-[#475569]">{children}</div>
    </section>
  );
}

export default async function PrivacyPage() {
  await requirePlatformMarketingHost();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell>
        <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#4F46E5]">
            Legal
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-[#0F172A]">Privacy Policy</h1>
          <p className="mt-3 text-sm text-[#475569]">Last updated: September 24, 2026</p>
          <p className="mt-6 text-sm leading-relaxed text-[#475569]">
            This policy explains how ShootPortal (“we,” “us,” and “our”) handles information when
            you use shootportal.app, a Tenant workspace, a Client project portal, or the Partner
            program. It should be read with our{" "}
            <Link href="/terms" className="font-medium text-[#4F46E5] hover:underline">
              Terms of Service
            </Link>
            .
          </p>

          <nav aria-label="On this page" className="mt-8">
            <h2 className="text-sm font-semibold text-[#0F172A]">On this page</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-[#475569]">
              {TOC.map(([id, label]) => (
                <li key={id}>
                  <a href={`#${id}`} className="text-[#4F46E5] hover:underline">
                    {label.replace(/^\d+\.\s/, "")}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <Section id="who" title="1. Who this policy covers">
            <p>
              ShootPortal provides software to media businesses such as photographers, videographers,
              drone operators, real-estate media companies, and similar studios. The software helps
              those businesses manage projects from request through delivery.
            </p>
            <p>In this policy:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Tenant</strong> means a media business that uses ShootPortal, including its
                administrators and team members.
              </li>
              <li>
                <strong>Client</strong> means a Tenant’s customer or another person who participates
                in a project, such as someone who receives an estimate, message, invoice, or media
                delivery.
              </li>
              <li>
                <strong>Partner</strong> means a person or business that participates in the
                ShootPortal referral program.
              </li>
              <li>
                <strong>User</strong> means any person who accesses ShootPortal, including website
                visitors, Tenants, Clients, and Partners.
              </li>
            </ul>
            <p>
              For Client information and project media that a Tenant places in ShootPortal,
              ShootPortal generally acts as a processor or service provider. The Tenant generally
              decides why that information is collected and how it is used. For information we use
              to run our own relationships with Tenants, Partners, website visitors, support,
              security, and billing, ShootPortal generally acts as a controller or business. The
              role can depend on the particular activity. A Tenant that needs a separate data
              processing arrangement can contact us at the address below.
            </p>
          </Section>

          <Section id="collect" title="2. Information we collect">
            <p>We collect information in four ways:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>directly from you when you create an account, apply, or contact us;</li>
              <li>from a Tenant about its Clients and projects;</li>
              <li>automatically when you use the site or the service; and</li>
              <li>
                from providers that help us operate the service, such as Stripe and our
                authentication provider.
              </li>
            </ul>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Tenant administrators and team members
            </h3>
            <p>
              Name, email address, phone number, company and business-profile details, branding,
              contact information, account credentials or authentication records, team membership,
              plan and subscription status, and support messages.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">Clients</h3>
            <p>
              Information a Tenant or Client provides for a project, which may include name, email,
              phone, company, property and scheduling details, estimates, invoices, payment status,
              messages, review comments and other feedback, and project files such as photos,
              videos, documents, and 360 media.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">Partners</h3>
            <p>
              Application and account details such as name, email, brand, website, social links, and
              the description of how the Partner plans to promote ShootPortal; referral status;
              the commission rate that applies to that Partner; landing-page content the Partner
              publishes; and commission, payout-status, and transfer-reference records. Bank-account
              and tax details for payouts are collected by Stripe, as described in section 6.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Website visitors, support contacts, and payment participants
            </h3>
            <p>
              If you browse the marketing site, contact support, start a subscription, pay a
              project invoice, or join the Partner program, we may receive the contact details you
              submit, the pages and features you use, and the payment-status information Stripe
              returns to us. We do not receive full payment-card numbers.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Device, security, and delivery information
            </h3>
            <p>
              Device and browser type, IP address, approximate location derived from IP address,
              usage and diagnostic logs, security and audit records, and email-delivery or
              notification events when those events are used to operate the product. If a Tenant
              administrator turns on web push notifications, we store a OneSignal subscription
              identifier for that administrator.
            </p>
            <p>
              If a Tenant owner connects Google Calendar, we also process the calendar information
              described in section 3. That connection is separate from Google sign-in and happens
              only if the owner turns it on.
            </p>
          </Section>

          <Section id="google" title="3. Google sign-in and Calendar">
            <h3 className="text-base font-semibold text-[#0F172A]">Google sign-in</h3>
            <p>
              You may sign in with Google. That sign-in is provided through our authentication
              provider, Supabase. When you choose it, we receive the identity information needed
              to create or link your account and session, typically your name and email address.
              The sign-in permission does not include Google Drive, Gmail, contacts, or Calendar.
              Calendar access is a separate choice, described next.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Optional Google Calendar connection
            </h3>
            <p>
              A Tenant owner may connect a Google account so ShootPortal can work with Google
              Calendar. The owner must affirmatively opt in. ShootPortal does not connect Google
              Calendar unless that owner chooses Connect Google Calendar in the Tenant’s settings
              and approves the request on Google’s consent screen. Team members who are not the
              owner cannot connect it. Connecting Calendar uses a separate Google permission from
              sign-in.
            </p>
            <p>If the owner connects, Google’s consent screen asks for permission to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>view and edit events on the calendars in that Google account; and</li>
              <li>see the list of calendars on that account.</li>
            </ul>
            <p>
              In ShootPortal, the owner chooses which calendar on that account receives shoot
              events. Each owner admin separately chooses which calendars from that account are
              shown on their Shoot Calendar. A newly discovered calendar is shown until that admin
              hides it. We do not use the connection to change calendar settings, and we do not
              request Google Drive, Gmail, or contacts.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">What we send to Google</h3>
            <p>
              When a shoot is proposed, ShootPortal creates or updates a one-hour event on the
              calendar the owner selected. While the time is still awaiting approval, the event
              title starts with “PENDING - ” followed by the Client’s name and the project name.
              When the Client approves that time, ShootPortal updates that same Google event and
              drops the pending prefix. The event includes the project name, the Client’s name,
              the property address, and a note that it was scheduled in ShootPortal. If that shoot
              is declined or cancelled, we delete the matching event from that Google calendar. The
              owner can change which calendar receives these events. Until they choose another,
              new connections write to the Google account’s primary calendar.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">What we read from Google</h3>
            <p>
              Each owner admin can choose which calendars on the connected account to display on
              their Shoot Calendar. For the dates shown, we request the events on the calendars
              that admin has left visible and use the event title, start and end time, whether it
              is an all-day event, the calendar’s color, and a link that opens the event in Google
              Calendar. Events the owner has declined, cancelled events, and events ShootPortal
              itself created are not shown again in that view. Those events are not shown to staff
              or Clients, and they cannot be edited inside ShootPortal.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              What we store, and for how long
            </h3>
            <p>
              We store the Google account email used for the connection, the calendars the owner
              selected, encrypted access and refresh tokens, the connection status, and, for each
              shoot we sync, the Google event identifier and whether the sync succeeded. We do not
              keep a copy of the other events we read from Google. Those are requested when the
              owner views the calendar.
            </p>
            <p>
              We keep the connection while it remains connected. If the owner disconnects, or the
              Tenant account is closed, we delete the stored connection, including the tokens. A
              project may still keep the sync status and event identifier for a shoot we created.
              Events already written to Google Calendar stay in that Google account unless they are
              deleted there or the related shoot is declined or cancelled while the connection is
              still active.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Disconnecting and revoking access
            </h3>
            <p>
              The Tenant owner can disconnect from the same settings page. Disconnect asks Google
              to revoke ShootPortal’s token and deletes the connection we store. The owner can
              also remove ShootPortal from the Google account’s third-party access page at{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href="https://myaccount.google.com/permissions"
                rel="noopener noreferrer"
                target="_blank"
              >
                myaccount.google.com/permissions
              </a>
              . If Google does not confirm revocation when we disconnect, that Google page is how
              the owner can remove the permission. Google’s privacy policy is at{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href="https://policies.google.com/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                policies.google.com/privacy
              </a>
              .
            </p>
          </Section>

          <Section id="cookies" title="4. Cookies and similar technologies">
            <p>We use cookies and similar technologies for these purposes:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Authentication and security.</strong> Keeping you signed in, protecting the
                session, and remembering limited routing needed to open the correct workspace.
              </li>
              <li>
                <strong>Preferences.</strong> Remembering choices required for the product to work
                as you move through it.
              </li>
              <li>
                <strong>Diagnostics.</strong> Recording limited technical information that helps us
                understand errors and reliability.
              </li>
              <li>
                <strong>Referral attribution.</strong> Connecting a prospective Tenant signup to a
                Partner, as described next.
              </li>
            </ul>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Referral cookie (sp_partner_ref)
            </h3>
            <p>
              We use a first-party cookie named <code className="text-xs">sp_partner_ref</code> to
              attribute a prospective Tenant signup to a Partner. The cookie may be created when
              someone follows a referral link or visits an active Partner landing page on
              shootportal.app. It lasts up to 90 days. It holds a signed referral payload — a
              referral code and related timing information — and it is not a cross-site browsing
              profile.
            </p>
            <p>
              The cookie is set only on the ShootPortal site. It is not set on a Tenant’s custom
              domain. If you later follow a different valid referral link, or visit another active
              Partner landing page on shootportal.app, that newer referral replaces the cookie. A
              commission is recorded only when a new Tenant account is created and the program
              attributes an eligible subscription to the Partner. An existing Tenant account is not
              reassigned because a cookie is present later.
            </p>
            <p>
              You can block or delete cookies in your browser. Blocking the referral cookie means
              a signup may not be attributed to a Partner. Blocking authentication cookies will
              prevent sign-in. We do not use cookies to sell personal information or to build
              cross-site advertising profiles, and the site does not respond to Global Privacy
              Control or “Do Not Track” signals. Depending on where you live and subject to
              applicable law, you may still send an opt-out request to{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
              .
            </p>
          </Section>

          <Section id="use" title="5. How we use information">
            <p>We use information to:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>provide, administer, personalize, and secure the service;</li>
              <li>create and authenticate accounts;</li>
              <li>manage projects and deliver media under a Tenant’s branding;</li>
              <li>
                provide estimates, scheduling, review, communications, and payment features,
                including sending proposed and confirmed shoots to Google Calendar and showing selected Google
                events when a Tenant owner has connected Calendar;
              </li>
              <li>
                process subscriptions, Client payments, Partner referrals, commissions, and payouts;
              </li>
              <li>provide support and send transactional and service communications;</li>
              <li>prevent fraud, abuse, and security incidents;</li>
              <li>keep records and enforce our agreements;</li>
              <li>meet legal obligations; and</li>
              <li>improve reliability and product performance.</li>
            </ul>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Legal bases (GDPR and UK GDPR)
            </h3>
            <p>
              Where the GDPR or UK GDPR applies, we rely on the following bases, depending on the
              activity:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Contract.</strong> Providing the service a Tenant, Client, or Partner asked
                us to provide, including accounts, projects, billing, and payouts.
              </li>
              <li>
                <strong>Legitimate interests.</strong> Securing the service, preventing fraud and
                abuse, attributing referrals, keeping operational records, and improving
                reliability, where those interests are not overridden by your rights.
              </li>
              <li>
                <strong>Legal obligation.</strong> Keeping records we are required to keep, and
                responding to lawful requests.
              </li>
              <li>
                <strong>Consent.</strong> Where we ask for it. A Tenant administrator chooses
                whether to enable web push notifications, and a Tenant owner chooses whether to
                connect Google Calendar and approves that access on Google’s consent screen. You
                may withdraw that consent by turning the feature off, disconnecting Calendar, or
                contacting us. Withdrawal does not affect processing that already occurred.
              </li>
            </ul>
          </Section>

          <Section id="payments" title="6. Payments and Stripe">
            <p>ShootPortal uses Stripe for three different payment flows:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Tenant subscriptions.</strong> A Tenant pays ShootPortal for a plan.
                Stripe processes the subscription payment.
              </li>
              <li>
                <strong>Client project payments.</strong> A Client pays a Tenant for the Tenant’s
                services through the Tenant’s Stripe Connect account. Those funds are processed by
                Stripe for the Tenant.
              </li>
              <li>
                <strong>Partner commissions.</strong> ShootPortal pays an eligible Partner through
                a Stripe Express account, using a Stripe transfer.
              </li>
            </ul>
            <p>
              Stripe processes payment-card and payment-account information. ShootPortal does not
              store full payment-card numbers. We store payment status, amounts, and identifiers
              needed to operate projects, subscriptions, and accounting. Stripe’s privacy policy is
              at{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href="https://stripe.com/privacy"
                rel="noopener noreferrer"
                target="_blank"
              >
                stripe.com/privacy
              </a>
              .
            </p>
            <p>
              Before a Partner can receive a payout, the Partner completes Stripe-hosted Express
              onboarding. Stripe collects the identity, bank-account, and tax information that
              onboarding requires. ShootPortal stores operational Connect information, commission
              records, payout status, transfer references, and related accounting records.
              ShootPortal does not receive or store Partner bank-account numbers, routing numbers,
              Social Security numbers, taxpayer identification numbers, or the contents of W-9 or
              W-8 forms through the ShootPortal application.
            </p>
          </Section>

          <Section id="sharing" title="7. Service providers and other disclosures">
            <p>We use the following providers to run ShootPortal:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Supabase</strong> for authentication, databases, and file storage.
              </li>
              <li>
                <strong>Vercel</strong> for hosting, application delivery, and domain-related
                services.
              </li>
              <li>
                <strong>Stripe</strong> for subscriptions, Client payments, Connect accounts, and
                Partner transfers.
              </li>
              <li>
                <strong>Resend</strong> for transactional and notification email.
              </li>
              <li>
                <strong>Google</strong> as a sign-in identity provider when you choose Google,
                through Supabase, and as a calendar provider when a Tenant owner connects Google
                Calendar, as described in section 3.
              </li>
              <li>
                <strong>OneSignal</strong> for optional web push notifications when a Tenant
                administrator enables them.
              </li>
            </ul>
            <p>
              <strong>GoHighLevel</strong> is used only when a Tenant turns on its own outbound
              integration. In that case, Client lead information the Tenant already holds may be
              sent to the Tenant’s GoHighLevel endpoint at the Tenant’s direction. GoHighLevel is
              not a ShootPortal-wide provider for every Tenant.
            </p>
            <p>We also disclose information:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>to the Tenant and its authorized users, for that Tenant’s workspace;</li>
              <li>to providers working on our behalf, under their own terms;</li>
              <li>
                in a merger, financing, or sale of the business, subject to this policy or a
                successor policy that protects the information in a comparable way;
              </li>
              <li>to comply with law, legal process, or a lawful request;</li>
              <li>to protect users, rights, safety, and the service; and</li>
              <li>with your consent or at your direction.</li>
            </ul>
            <p>
              Client information belonging to one Tenant is not made available to another Tenant.
            </p>
          </Section>

          <Section id="sale" title="8. Sale, sharing, and advertising">
            <p>
              ShootPortal does not sell personal information for money. ShootPortal does not share
              personal information for cross-context behavioral advertising, and it does not use
              personal information for targeted advertising. Disclosures to service providers and
              payment processors, described above, are made so those providers can perform services
              for us or for a Tenant. Those disclosures are not a sale or a share for advertising.
            </p>
            <p>
              Depending on where you live and subject to applicable law, you may still have a right
              to opt out of sale, sharing, or targeted advertising, or to limit certain uses of
              sensitive personal information. You can send that request to{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
              . We do not use sensitive personal information to infer characteristics for
              advertising.
            </p>
          </Section>

          <Section id="retention" title="9. How long we keep information">
            <p>
              We keep information for as long as the related account is active and for as long as
              we need it to provide the service, meet legal and accounting duties, resolve
              disputes, and prevent fraud. We do not apply one deletion date to every category.
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Account and business records</strong> are kept while the Tenant or Partner
                account is open and for a period afterward that is needed for the purposes above.
              </li>
              <li>
                <strong>Client and project records, including media,</strong> follow the Tenant’s
                use of the product. A Tenant may delete projects, files, or request account
                closure. We then remove or schedule removal of the associated records, subject to
                backups, legal holds, and records we must keep.
              </li>
              <li>
                <strong>Subscription, transaction, tax, commission, and payout records</strong> are
                kept for accounting, tax, fraud-prevention, and dispute purposes.
              </li>
              <li>
                <strong>Authentication, security, and audit records, and support communications,</strong>{" "}
                are kept for security, troubleshooting, and enforcement of our agreements.
              </li>
              <li>
                <strong>The referral cookie</strong> expires within 90 days unless it is replaced
                or you delete it sooner. A referral record created when a Tenant account is opened
                is kept with that account’s business records.
              </li>
              <li>
                <strong>A Google Calendar connection</strong> is kept until the Tenant owner
                disconnects it or the Tenant account is closed, as described in section 3. Events
                read from Google for the owner’s calendar view are not stored as a copy.
              </li>
              <li>
                <strong>Backups</strong> may retain copies until the backup cycle overwrites them.
                Information on a legal hold is kept until the hold ends.
              </li>
            </ul>
            <p>
              Deletion from active systems does not mean every backup copy disappears the same day.
            </p>
          </Section>

          <Section id="security" title="10. Security">
            <p>
              We use administrative, technical, and organizational safeguards designed for a
              multi-tenant software service. Those safeguards include encrypted transmission
              (HTTPS), authentication, authorization, separation of Tenant workspaces in
              application access controls, restricted access to production systems, logging, and
              the security controls of our infrastructure providers. Credentials are stored by our
              authentication provider using its hashing controls.
            </p>
            <p>
              No method of transmission or storage is completely secure. We do not promise that
              unauthorized access will never occur, and this policy does not claim a particular
              security certification.
            </p>
          </Section>

          <Section id="transfers" title="11. International transfers">
            <p>
              ShootPortal and its providers may process information in the United States and in
              other countries where they operate. Those countries may have data-protection rules
              that differ from the rules where you live.
            </p>
            <p>
              Where the law requires a transfer mechanism, we rely on a mechanism that law
              recognizes when that mechanism is in place with the relevant provider. This policy
              does not itself state that a particular transfer contract has been executed.
            </p>
          </Section>

          <Section id="rights" title="12. Privacy rights and requests">
            <p>
              Depending on where you live and subject to applicable law, you may have the right to:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>access or confirm personal information;</li>
              <li>correct inaccurate information;</li>
              <li>delete personal information;</li>
              <li>receive a copy or ask for portability;</li>
              <li>restrict or object to certain processing;</li>
              <li>withdraw consent where processing is based on consent;</li>
              <li>opt out of sale, sharing, or targeted advertising;</li>
              <li>limit certain uses of sensitive personal information;</li>
              <li>appeal a denial where an appeal right applies; and</li>
              <li>not be unlawfully discriminated against for exercising a privacy right.</li>
            </ul>
            <p>
              You may also complain to a data-protection authority where you live. We will not
              retaliate against you for a lawful privacy request.
            </p>
            <p>
              Tenants, their business users, and Partners may send requests to{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
              . Clients should generally contact the Tenant that collected their information,
              because that Tenant ordinarily decides how the information is used. If you contact us
              about Client information while we are acting as a processor, we may forward or
              redirect the request to the relevant Tenant.
            </p>
            <p>
              We may need to verify your identity and your authority to act for an account before
              we respond. An authorized agent may submit a request where applicable law permits,
              and we may ask for proof of that authority. Some rights are subject to exceptions,
              including where we must keep a record for legal, security, or accounting reasons, or
              where the Tenant controls the information.
            </p>
          </Section>

          <Section id="children" title="13. Children">
            <p>
              ShootPortal is not directed to children under 16, and we do not knowingly collect
              personal information from children under 16. A Tenant’s project media might depict
              people of any age because the Tenant chooses what to upload. If you believe a child
              under 16 has provided personal information to us directly, contact{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>{" "}
              and we will take appropriate steps.
            </p>
          </Section>

          <Section id="changes" title="14. Changes and contact">
            <p>
              We may update this policy. We will change the “Last updated” date when we do. If a
              change is material, we may also notify Tenants or Partners by email or with an
              in-product notice where that is appropriate.
            </p>
            <p>
              Privacy questions and requests:{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
            </p>
          </Section>
        </article>
      </MarketingShell>
    </BrandProvider>
  );
}
