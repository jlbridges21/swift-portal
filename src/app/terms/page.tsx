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
    "Terms governing use of ShootPortal by media businesses, their clients, and referral partners.",
  path: "/terms",
});

const TOC = [
  ["acceptance", "1. Acceptance and eligibility"],
  ["service", "2. The Service"],
  ["accounts", "3. Accounts and security"],
  ["tenants", "4. Tenant and Client responsibilities"],
  ["billing", "5. Plans, billing, and cancellation"],
  ["payments", "6. Client payments"],
  ["partners", "7. Partner program"],
  ["content", "8. Content and licenses"],
  ["privacy", "9. Privacy and confidentiality"],
  ["use", "10. Acceptable use"],
  ["third", "11. Third-party services"],
  ["availability", "12. Availability and changes"],
  ["termination", "13. Suspension and termination"],
  ["disclaimers", "14. Disclaimers"],
  ["liability", "15. Limitation of liability"],
  ["indemnity", "16. Indemnification"],
  ["changes", "17. Changes to these Terms"],
  ["law", "18. Governing law and disputes"],
  ["general", "19. General"],
  ["contact", "20. Contact"],
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

export default async function TermsPage() {
  await requirePlatformMarketingHost();

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
          <p className="mt-3 text-sm text-[#475569]">Last updated: September 24, 2026</p>
          <p className="mt-6 text-sm leading-relaxed text-[#475569]">
            These Terms of Service (“Terms”) are an agreement between you and ShootPortal (“we,”
            “us,” and “our”) for access to and use of ShootPortal. By creating an account, applying
            to the Partner program, or using the Service, you agree to these Terms. If you do not
            agree, do not use the Service.
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

          <Section id="acceptance" title="1. Acceptance and eligibility">
            <p>In these Terms:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>Service</strong> means the ShootPortal websites, applications, and related
                software.
              </li>
              <li>
                <strong>Tenant</strong> means a media business that uses the Service, and the
                people authorized to act for that business.
              </li>
              <li>
                <strong>Client</strong> means a Tenant’s customer or another person who uses a
                project portal, estimate, message, invoice, or delivery that a Tenant provides
                through the Service.
              </li>
              <li>
                <strong>Partner</strong> means a person or business approved to participate in the
                referral program.
              </li>
              <li>
                <strong>Content</strong> means information, branding, messages, and media that a
                user submits to the Service, including photos, videos, documents, and 360 media.
              </li>
            </ul>
            <p>
              If you use the Service for an organization, you represent that you have authority to
              bind that organization, and “you” includes the organization. You must be at least 18
              years old, or the age of legal majority required to enter a contract where you live,
              whichever is older.
            </p>
            <p>
              These Terms apply to Tenants and their authorized users, to Clients who access a
              project portal, and to Partners. A Tenant’s acceptance covers that Tenant and its
              authorized users. It does not accept Partner-program obligations for a different
              person. A person becomes a Partner only by applying and being approved under section
              7.
            </p>
          </Section>

          <Section id="service" title="2. The Service">
            <p>
              ShootPortal is a software service that helps media businesses manage client projects
              from request through delivery. Features may include estimates, scheduling,
              communications, media review, payments, and delivery under the Tenant’s branding.
            </p>
            <p>
              We may modify, improve, or discontinue features. We do not promise that any
              particular feature will remain available.
            </p>
          </Section>

          <Section id="accounts" title="3. Accounts and security">
            <p>
              You will provide accurate account information and keep it current. You will protect
              your credentials, limit access to people you authorize, and tell us promptly at{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>{" "}
              if you suspect unauthorized access.
            </p>
            <p>
              A Tenant is responsible for activity in its workspace and for who has team access,
              including what those people can view and change.
            </p>
          </Section>

          <Section id="tenants" title="4. Tenant and Client responsibilities">
            <p>Each Tenant is responsible for:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>collecting and using Client information and media lawfully;</li>
              <li>giving Clients the privacy notices and obtaining the consents that law requires;</li>
              <li>having the rights needed to upload, process, and deliver Content;</li>
              <li>
                configuring branding, services, pricing, and communications so they are accurate;
              </li>
              <li>
                complying with laws that apply to its work, including photography, video, drone,
                intellectual-property, publicity, privacy, and consumer-protection laws; and
              </li>
              <li>
                the commercial relationship with its Clients, including project quality, scope,
                scheduling, cancellation, refunds, deliverables, and disputes.
              </li>
            </ul>
            <p>
              ShootPortal provides the software platform. ShootPortal is not a party to the
              media-services contract between a Tenant and a Client unless we expressly agree
              otherwise in a separate writing. A Client’s project terms are with the Tenant.
            </p>
          </Section>

          <Section id="billing" title="5. Plans, billing, and cancellation">
            <p>
              Plan names, prices, limits, and trial length are the ones shown in the live plans
              catalog and on the{" "}
              <Link href="/pricing" className="font-medium text-[#4F46E5] hover:underline">
                Pricing
              </Link>{" "}
              page at the time you subscribe or start a trial. A trial may begin without a payment
              card. Continued paid use requires a subscription billed through Stripe.
            </p>
            <p>
              The billing interval, renewal, and price shown at checkout are the terms of that
              subscription. Paid subscriptions renew for the same interval until you cancel.
              Applicable taxes may be charged. If a payment fails, we may limit features, suspend
              access, or end the subscription after notice through the product or by email.
            </p>
            <p>
              A Tenant can cancel from the billing tools in the product, which open Stripe’s
              billing portal. When cancellation is scheduled for the end of the current paid
              period, access continues until that period ends. Fees already paid are charged for
              that period. ShootPortal does not promise a refund of subscription fees. If we or
              Stripe issue a refund, it will appear in Stripe, and a related Partner commission may
              be reversed under section 7.
            </p>
            <p>
              If you change plans, the features and limits of the plan you move to are the ones
              shown for that plan. Use above a plan limit may restrict new activity until usage
              fits the plan.
            </p>
          </Section>

          <Section id="payments" title="6. Client payments">
            <p>
              Project-payment features depend on Stripe. A Tenant that wants to accept Client
              payments must complete Stripe Connect onboarding and remain eligible under Stripe’s
              rules. Stripe processes the payment information. ShootPortal is not a bank and does
              not hold Client funds outside Stripe’s systems.
            </p>
            <p>
              The Tenant remains responsible for its services, refunds, disputes, chargebacks,
              taxes, and other obligations to Clients. Use of Stripe is also subject to Stripe’s
              agreements, including the{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href="https://stripe.com/legal/connect-account"
                rel="noopener noreferrer"
                target="_blank"
              >
                Stripe Connected Account Agreement
              </a>
              .
            </p>
          </Section>

          <Section id="partners" title="7. Partner program">
            <h3 className="text-base font-semibold text-[#0F172A]">Eligibility and approval</h3>
            <p>
              To participate, you must give accurate application and account information.
              Participation is subject to our approval. Approval may be automatic or reviewed,
              depending on the program settings then in effect. A Partner account may be active,
              rejected, limited, or suspended. We may decline, limit, or end participation to
              protect the program from fraud, abuse, misleading promotion, self-referrals,
              manipulated attribution, or other improper conduct.
            </p>
            <p>
              A Partner does not earn a commission by referring an account that is the Partner’s
              own account, including a signup that uses the Partner’s own email address or user
              identity.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">Referral attribution</h3>
            <p>
              Eligible referrals may be tracked with a referral code, a referral link, a Partner
              landing page, and the first-party <code className="text-xs">sp_partner_ref</code>{" "}
              cookie described in the{" "}
              <Link href="/privacy#cookies" className="font-medium text-[#4F46E5] hover:underline">
                Privacy Policy
              </Link>
              . That cookie lasts up to 90 days and is set on shootportal.app, not on a Tenant
              custom domain. A later valid referral link or active Partner landing page replaces
              the cookie. Attribution is recorded when a new Tenant account is created. It is not
              applied retroactively to an account that already exists.
            </p>
            <p>
              A commission is credited only when the Service attributes an eligible paid
              subscription to the Partner under these rules. Clicking a link, or creating an
              account that never becomes a paid subscription, does not earn a commission.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">Commission rates</h3>
            <p>
              The commission rate is the rate displayed to the Partner or otherwise agreed with the
              Partner. We may keep a program default and a Partner-specific rate. Different
              Partners may have different rates. A change to a rate applies to commissions that
              accrue after the change, unless the Partner agrees that it also applies to commissions
              already accrued.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Hold period and payment
            </h3>
            <p>
              An otherwise eligible commission is subject to a 30-day hold before it becomes
              payable. The hold is time for payment confirmation, refunds, disputes, chargebacks,
              fraud review, and account-status review.
            </p>
            <p>
              After the hold, a commission may be paid on the monthly payout run, which is
              scheduled for the 1st of each month, or after ShootPortal reviews the payout. Payment
              requires an open payable balance of at least the program minimum then in effect. The
              default minimum is $50. The Partner account must be active, and the Partner’s Stripe
              Express account must be able to receive transfers. A smaller balance stays open.
              ShootPortal may pause payouts and retry them.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Refunds and reversals
            </h3>
            <p>
              If a referred subscription payment is refunded, reversed, disputed, fraudulent, or
              otherwise invalid, we may cancel or reverse the related commission. A reversal is
              recorded as an additional negative ledger entry. We do not erase the original
              commission record.
            </p>
            <p>
              A negative open balance is offset against later payable commissions. We do not, by
              these Terms, create a separate debt-collection right for that balance.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">Stripe Express payouts</h3>
            <p>
              A Partner must complete and maintain Stripe Express onboarding before receiving a
              payout. Commissions are paid by Stripe transfers to the Partner’s Express account.
              Timing depends on the hold period, eligibility review, Stripe’s status and
              verification requirements, technical availability, and applicable law.
            </p>
            <p>
              Stripe, not ShootPortal, collects and keeps the Partner’s bank-account information
              and sensitive tax and identity information through hosted onboarding. Partners must
              comply with Stripe’s terms, including the{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href="https://stripe.com/legal/connect-account"
                rel="noopener noreferrer"
                target="_blank"
              >
                Stripe Connected Account Agreement
              </a>
              . ShootPortal is not a bank and does not guarantee that Stripe will approve an
              account or that Stripe will be available.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">Taxes</h3>
            <p>
              Partners are responsible for their own taxes, filings, registrations, and reporting
              on commissions, except for reporting or withholding that ShootPortal or Stripe is
              legally required to perform. These Terms do not promise that every Partner will
              receive a particular tax form.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Promotional conduct
            </h3>
            <p>When promoting ShootPortal, a Partner will:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>make truthful statements and avoid misleading claims;</li>
              <li>avoid spam and other unlawful marketing;</li>
              <li>
                avoid bidding on, registering, or impersonating ShootPortal names, trademarks, or
                domains without our permission;
              </li>
              <li>
                avoid presenting themselves as an employee, agent, or legal representative of
                ShootPortal;
              </li>
              <li>
                clearly tell an ordinary viewer, in language that viewer can understand, that the
                Partner may receive a commission for promoting ShootPortal — a vague “affiliate”
                label alone is not enough if a viewer would not understand it;
              </li>
              <li>
                comply with endorsement, advertising, email, privacy, and consumer-protection laws
                that apply to the promotion; and
              </li>
              <li>use ShootPortal brand materials only as we authorize.</li>
            </ul>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Independent relationship
            </h3>
            <p>
              A Partner is an independent contractor. Participation does not create employment,
              agency, franchise, joint venture, fiduciary duty, or an exclusive relationship. A
              Partner may not bind ShootPortal.
            </p>
            <h3 className="pt-2 text-base font-semibold text-[#0F172A]">
              Suspension and ending participation
            </h3>
            <p>
              We may suspend or end Partner participation for a violation of these Terms, fraud,
              abuse, legal risk, reputational harm, or risk to the platform or to others.
              Suspension pauses payouts. Commissions that were validly earned and have become
              payable remain recorded and are paid when the account is eligible and Stripe can
              receive the transfer. Commissions that are still in the hold period, or that relate
              to a refund, dispute, fraud, or ineligible referral, may be reversed as described
              above. Ending participation does not by itself forfeit a commission that was validly
              earned and is payable.
            </p>
          </Section>

          <Section id="content" title="8. Content and licenses">
            <p>
              ShootPortal owns the Service, including its software, branding, documentation, and
              platform materials. Tenants and Clients keep their rights in their own branding,
              project information, and media. These Terms do not transfer ownership of user Content
              to ShootPortal.
            </p>
            <p>
              You grant ShootPortal a limited license to host, copy, transmit, process, display,
              and otherwise use Content only as needed to operate, secure, support, and improve the
              Service and to comply with law. The license ends when the Content is deleted from
              active systems, except for copies kept in backups, logs, or records we must retain.
              You represent that you have the rights and permissions needed to submit the Content.
            </p>
            <p>
              If you send us product suggestions, we may use them without obligation to you. That
              does not give us ownership of your Content.
            </p>
          </Section>

          <Section id="privacy" title="9. Privacy and confidentiality">
            <p>
              Our{" "}
              <Link href="/privacy" className="font-medium text-[#4F46E5] hover:underline">
                Privacy Policy
              </Link>{" "}
              explains how we handle personal information. For Client information and project media
              that a Tenant places in the Service, ShootPortal generally acts as a processor or
              service provider, and the Tenant generally decides why that information is used.
            </p>
            <p>
              Each party will protect the other party’s non-public business, technical, and account
              information and will use it only to perform under these Terms. This duty does not
              cover information that is public through no fault of the receiving party, that the
              receiving party already knew without a duty to keep it confidential, that the
              receiving party independently developed, that the receiving party lawfully received
              from someone else without a duty of confidentiality, or that must be disclosed by
              law.
            </p>
            <p>
              If the law requires disclosure, the disclosing party will give notice where that is
              lawful and practical, and will disclose only what is required.
            </p>
          </Section>

          <Section id="use" title="10. Acceptable use">
            <p>You will not:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>use the Service in a way that is unlawful, fraudulent, deceptive, abusive, or infringing;</li>
              <li>access another Tenant’s workspace without authorization;</li>
              <li>interfere with the security, availability, or integrity of the Service;</li>
              <li>
                upload malware, harvest credentials, scrape the Service, or use automation in a way
                that abuses it;
              </li>
              <li>upload Content without the rights required to do so;</li>
              <li>
                use the Service to violate privacy, publicity, intellectual-property, or
                communications laws;
              </li>
              <li>
                reverse engineer the Service, except to the extent a law prohibits this
                restriction; or
              </li>
              <li>resell or sublicense the Service unless we expressly authorize it.</li>
            </ul>
          </Section>

          <Section id="third" title="11. Third-party services">
            <p>
              The Service relies on third parties, including Stripe, Google sign-in, OneSignal,
              Resend, and infrastructure providers. A Tenant may also connect its own tools, such
              as GoHighLevel. Those services are governed by their own terms and privacy policies.
              ShootPortal remains responsible for its own obligations under these Terms and
              applicable law.
            </p>
          </Section>

          <Section id="availability" title="12. Availability and changes">
            <p>
              The Service may be interrupted by maintenance, outages, third-party failures, security
              events, or changes we make. We do not promise a particular uptime level. There is no
              separate service-level agreement unless we sign one with you.
            </p>
          </Section>

          <Section id="termination" title="13. Suspension and termination">
            <p>
              You may stop using the Service at any time. A Tenant may cancel as described in
              section 5 and may request account closure at{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
              .
            </p>
            <p>
              We may suspend or terminate access for breach of these Terms, nonpayment, fraud,
              security risk, unlawful conduct, or material risk to the platform or to other people.
              Termination ends the right to access the Service.
            </p>
            <p>
              Export and deletion are handled according to the{" "}
              <Link href="/privacy" className="font-medium text-[#4F46E5] hover:underline">
                Privacy Policy
              </Link>
              , the features available in the product, records we must retain, and any separate
              agreement we have with you. We do not promise a specific export window or a specific
              deletion deadline.
            </p>
            <p>
              Sections that by their nature should continue after termination will continue,
              including content licenses for retained copies, confidentiality, disclaimers,
              liability limits, indemnities, and these general terms.
            </p>
          </Section>

          <Section id="disclaimers" title="14. Disclaimers">
            <p className="font-semibold uppercase text-[#0F172A]">
              To the maximum extent permitted by law, the Service is provided “as is” and “as
              available.” We disclaim warranties of merchantability, fitness for a particular
              purpose, and non-infringement, and any warranty arising from course of dealing or
              usage of trade.
            </p>
            <p>
              We do not guarantee a Tenant’s deliverables, creative quality, Client satisfaction,
              uninterrupted availability, or the outcome of a dispute between a Tenant and a
              Client. This section does not limit rights that cannot legally be disclaimed.
            </p>
          </Section>

          <Section id="liability" title="15. Limitation of liability">
            <p className="font-semibold uppercase text-[#0F172A]">
              To the maximum extent permitted by law, ShootPortal’s total liability arising out of
              the Service or these Terms will not exceed the fees the claiming party paid to
              ShootPortal for the Service in the twelve (12) months before the event giving rise
              to the claim.
            </p>
            <p className="font-semibold uppercase text-[#0F172A]">
              To the maximum extent permitted by law, ShootPortal will not be liable for indirect,
              incidental, special, consequential, exemplary, or lost-profit damages, or for loss of
              data, goodwill, or business, even if advised of the possibility.
            </p>
            <p>
              The cap is measured by fees that party paid to ShootPortal, not by Client payments
              made to a Tenant and not by Partner commissions. If the claiming party paid no fees
              to ShootPortal in that period, the cap is what applicable law allows, and it may be
              zero where the law permits. These limits do not apply to liability that cannot
              legally be limited, including liability for ShootPortal’s willful misconduct where
              the law does not allow that liability to be capped.
            </p>
          </Section>

          <Section id="indemnity" title="16. Indemnification">
            <p>
              A Tenant will defend and indemnify ShootPortal and its personnel against third-party
              claims, damages, and reasonable attorneys’ fees arising from the Tenant’s Content,
              the Tenant’s services or Client relationships, the Tenant’s unlawful use of the
              Service, infringement, or the Tenant’s violation of these Terms.
            </p>
            <p>
              A Partner will defend and indemnify ShootPortal and its personnel against third-party
              claims, damages, and reasonable attorneys’ fees arising from the Partner’s
              promotions or statements, unlawful marketing, failure to make a required disclosure,
              misuse of ShootPortal branding, or violation of section 7.
            </p>
            <p>
              The indemnified party will give prompt notice of the claim (and a delay in notice
              excuses the duty only to the extent it materially harms the defense), reasonable
              cooperation, and control of the defense to the indemnifying party. The indemnifying
              party will not settle a claim in a way that admits fault of the indemnified party or
              imposes an obligation on the indemnified party without prior consent. This section
              does not require indemnification for ShootPortal’s own willful misconduct.
            </p>
          </Section>

          <Section id="changes" title="17. Changes to these Terms">
            <p>
              We may update these Terms. We will change the “Last updated” date when we do. If a
              change is material, we may also notify you by email or with an in-product notice
              where that is appropriate.
            </p>
            <p>
              If you continue to use the Service after the updated Terms take effect, you accept
              the updated Terms where the law allows acceptance by continued use. If you do not
              agree, stop using the Service. Silence alone is not acceptance of a change that the
              law requires us to present differently.
            </p>
          </Section>

          <Section id="law" title="18. Governing law and disputes">
            <p>
              These Terms do not select the law of a particular state or country, and they do not
              require arbitration or a waiver of class actions. Non-waivable rights and consumer
              protections where you live still apply. A dispute should first be raised with us at{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>{" "}
              so we can try to resolve it. If it is not resolved, either party may bring it in a
              forum that applicable law allows.
            </p>
          </Section>

          <Section id="general" title="19. General">
            <p>
              These Terms, together with the{" "}
              <Link href="/privacy" className="font-medium text-[#4F46E5] hover:underline">
                Privacy Policy
              </Link>{" "}
              and any order form or other agreement we both sign, are the entire agreement about
              the Service. If a signed order form or other signed agreement conflicts with these
              Terms, the signed document controls for that conflict. The Privacy Policy controls
              for how personal information is handled.
            </p>
            <p>
              You may not assign these Terms without our consent, except that a Tenant may assign
              them to a successor of its business if you notify us. We may assign these Terms in
              connection with a reorganization, financing, or sale of the business. A waiver must
              be in writing to be effective. If a provision is unenforceable, the rest remains in
              effect.
            </p>
            <p>
              Neither party is liable for a delay or failure caused by events outside its
              reasonable control, including outages of power, networks, or providers, provided it
              gives notice when practical and resumes performance when it can.
            </p>
            <p>
              Notices to ShootPortal may be sent to{" "}
              <a
                className="font-medium text-[#4F46E5] hover:underline"
                href={`mailto:${MARKETING_SUPPORT_EMAIL}`}
              >
                {MARKETING_SUPPORT_EMAIL}
              </a>
              . We may notify you at the email address on your account or through the product.
            </p>
            <p>
              These Terms do not create third-party beneficiary rights, except that Stripe may
              enforce its own agreements with you, and an indemnified person may enforce section
              16.
            </p>
          </Section>

          <Section id="contact" title="20. Contact">
            <p>
              Questions about these Terms:{" "}
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
