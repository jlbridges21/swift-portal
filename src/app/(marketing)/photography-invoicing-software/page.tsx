import { RelatedNext } from "@/components/tools/tool-page-parts";
import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  CircleDollarSign,
  CreditCard,
  FileClock,
  FileText,
  Landmark,
  Receipt,
  SearchX,
  Send,
  ShieldCheck,
  Unlink,
  Wallet,
} from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { getSolutionPage, solutionCtaId, type CtaPlacement } from "@/lib/solutions";
import { solutionJsonLd, solutionMetadata } from "@/lib/solutions-seo";
import { jsonLdString } from "@/lib/blog/structured-data";
import {
  ApproachCompare,
  DemoShowcase,
  FeatureCards,
  FeatureSpotlight,
  FinalCta,
  FounderNote,
  GradientText,
  PricingStrip,
  ProblemGrid,
  REAL_CAPTURE_NOTE,
  RelatedReading,
  RelatedSolutions,
  Section,
  SolutionFaq,
  SolutionHero,
  StepTimeline,
  TrialButton,
} from "@/components/solutions/solution-sections";
import { FloatingChip, GalleryCard } from "@/components/solutions/solution-visuals";
import { LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";
import { PaymentFlowDiagram } from "@/components/blog/business-diagrams";

const PAGE = getSolutionPage("invoicing");
const cta = (p: CtaPlacement) => solutionCtaId(PAGE.key, p);
const A = "font-medium text-[#4F46E5] underline underline-offset-2";

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

export default async function PhotographyInvoicingSoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          layout="stacked"
          eyebrow="Estimates · deposits · payments"
          title={
            <>
              Photography invoicing software that <GradientText>lives on the job</GradientText>
            </>
          }
          subtitle={
            <>
              ShootPortal is photography invoicing software built into each project. The estimate, the approval, the deposit, the payment
              request, and the receipt sit next to the shoot and the files, and clients pay by card straight into your own Stripe account.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "#money-flow", label: "See how payments flow" }}
          visual={
            <div className="relative">
              <ShowcaseImage image={MEDIA.invoicing.hero} frame="dark" priority sizes="(min-width: 1024px) 1024px, 100vw" />
              <FloatingChip icon={ShieldCheck} title="Paid to your Stripe" detail="Stripe's standard fees apply" tone="emerald" className="-top-6 right-4 hidden sm:flex" delayMs={700} />
              <p className="mt-4 text-center text-xs text-[#64748B]">{REAL_CAPTURE_NOTE}</p>
            </div>
          }
        />

        <Section
          eyebrow="Where the money gets stuck"
          title="The work is done. The money isn't in yet."
          intro="Most photographers don't have a pricing problem. They have a follow-through problem between the quote and the payment."
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: Unlink, title: "Quote and invoice don't match", body: "The client approved one price by email; the invoice app has another because the travel fee went missing." },
              { icon: FileClock, title: "Invoices sent late", body: "You deliver Friday and write the invoice Monday, and the payment clock starts three days late." },
              { icon: Send, title: "Files before money", body: "Once the download link is out, there is little reason for a busy client to pay quickly." },
              { icon: SearchX, title: "No view of who owes what", body: "Outstanding balances live in your head, a spreadsheet, and a banking app." },
              { icon: Wallet, title: "Deposits handled by hand", body: "Asking for 30% up front means another link, another email, another thing to reconcile." },
              { icon: Landmark, title: "Payment detached from the job", body: "When a client asks what a charge was for, you search three apps to find the shoot." },
            ]}
          />
        </Section>

        <Section
          id="money-flow"
          eyebrow="How payments flow"
          title="From estimate to receipt in four steps"
          intro="Payments in ShootPortal follow the project. Here is what you do, and what the system does for you."
        >
          <StepTimeline
            steps={[
              { tag: "You", title: "Send the proposal", body: "Line items from your service catalog plus any travel fee, with an expiry date, version history, and a PDF." },
              {
                tag: "Automatic",
                title: "Approval creates the payment link",
                body: "When the client approves, ShootPortal can create the Stripe payment link for the total, or for a deposit if you require one.",
              },
              { tag: "You", title: "Request the rest", body: "Create a payment for the balance or any custom amount and description from the project. Clients see what is still owed." },
              {
                tag: "Automatic",
                title: "Paid, receipted, updated",
                body: "When the payment clears, the client gets a receipt by email and the project can move to Delivered on its own.",
              },
            ]}
          />
          <LoopVideo video={MEDIA.invoicing.workflowLoop} frame="dark" className="mk-reveal mx-auto mt-12 max-w-4xl" />
        </Section>

        <DemoShowcase
          title="From estimate to payment, on real screens"
          intro="A 37-second walkthrough: the instant preliminary estimate, your official estimate, the client's approval, the payment link created on approval, Stripe checkout, and marking a check paid."
          video={MEDIA.invoicing.demo}
          points={["Convert the preliminary estimate to an official one", "Optional: the payment link is created when the client approves", "Paid by card through Stripe, or mark a check or cash paid"]}
          ctaId={cta("demo")}
          trialDays={ctx.trialDays}
          ctaLabel="Take your next payment through ShootPortal"
        />

        <Section eyebrow="Invoicing features" title="What you can do with payments in ShootPortal" tone="cloud">
          <div className="space-y-20 lg:space-y-28">
            <FeatureSpotlight
              eyebrow="Estimates & proposals"
              title="The price the client approved is the price they pay"
              body={
                <p>
                  Estimates and proposals are built from line items in your service catalog, with an optional travel fee calculated from ZIP-to-ZIP
                  distance. Edits create a new version and the old one is archived, so there is no question about which price was approved. Clients
                  approve or request changes in the portal and can download the estimate as a PDF.
                </p>
              }
              bullets={["Expiry dates on estimates and proposals", "Deposit terms per proposal: a percentage or a fixed amount", "Option to let clients pay in full instead of a deposit"]}
              visual={<PaymentFlowDiagram />}
            />
            <FeatureSpotlight
              reverse
              eyebrow="Card payments"
              title="A secure checkout page, not a bank transfer request"
              body={
                <p>
                  Each payment request is a Stripe payment link. The client pays by card on Stripe Checkout, and the money goes to your own Stripe
                  account through Stripe Connect. Stripe&apos;s standard processing fees apply. Clients reach the payment from the project in their
                  portal, next to the work it pays for.
                </p>
              }
              bullets={["Multiple payments per project, such as a deposit and a balance", "Payments are capped at the remaining balance on the proposal", "Mark cash or check payments as paid"]}
              visual={<ShowcaseImage image={MEDIA.invoicing.clientView} />}
              caption="Your payments screen and what your client sees in their portal. Real ShootPortal screens."
            />
            <FeatureSpotlight
              eyebrow="Tracking"
              title="Know who owes you, without a spreadsheet"
              body={
                <p>
                  Every project shows its payments and what is still owed. Your dashboard lists outstanding payments, and the client list shows
                  lifetime revenue and outstanding balance for each client, with a filter for clients who owe you.
                </p>
              }
              bullets={["Receipt emails to you and the client", "Stripe receipt link, with a payment record PDF as a fallback", "Admin alert when a card payment fails"]}
              visual={<ShowcaseImage image={MEDIA.invoicing.dashboard} />}
              caption="The payments section of a project. Real ShootPortal screen."
            />
            <FeatureSpotlight
              reverse
              eyebrow="Pay before download"
              title="Let clients see the work. Let payment open the downloads."
              body={
                <p>
                  Downloads can stay locked until the project reaches Delivered, and the project can move to Delivered automatically when payment
                  comes in. Clients preview photos and video in the portal right away, and the download buttons open once they pay.
                </p>
              }
              bullets={[
                <>
                  More on this: our guide to{" "}
                  <Link href="/blog/get-paid-before-delivering-real-estate-photos" className={A}>
                    getting paid before you deliver
                  </Link>
                </>,
              ]}
              visual={<GalleryCard locked />}
              caption="Illustration of a delivery with downloads locked until payment."
            />
          </div>
        </Section>

        <Section
          eyebrow="Be clear on the fit"
          title="Invoicing app or project payments?"
          intro="ShootPortal takes payment for jobs. It doesn't replace your accounting software, and it isn't trying to."
        >
          <ShowcaseImage image={MEDIA.invoicing.comparison} className="mk-reveal mx-auto mb-10 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <ApproachCompare
            left={{
              label: "Invoicing and accounting apps",
              title: "Documents for the books",
              points: ["Numbered invoice documents and custom due dates", "Sales tax, discounts, and quantities", "Bookkeeping, reconciliation, and refunds in one place"],
              fit: "Your bookkeeping and tax records. Many photographers keep one alongside a job system.",
            }}
            right={{
              label: "ShootPortal",
              title: "Payments attached to the work",
              points: [
                "The approved proposal sets the amount",
                "Deposits and balances tracked per project",
                "Downloads can wait for payment",
              ],
              fit: "Getting paid for each shoot quickly, with the payment, files, and conversation in one place.",
            }}
          />
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-[#64748B]">
            ShootPortal doesn&apos;t generate numbered invoice documents or add sales tax, and payments are in US dollars. Refunds are issued from your
            Stripe dashboard. For a broader look at tools, see our{" "}
            <Link href="/blog/best-photography-invoicing-software" className={A}>
              photography invoicing software comparison
            </Link>
            .
          </p>
          <div className="mt-10 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Take your next payment through ShootPortal" />
          </div>
        </Section>

        <Section eyebrow="The client's side" title="Paying you is the easy part for your clients" tone="cloud">
          <FeatureCards
            items={[
              { icon: FileText, title: "One place for the paperwork", body: "The estimate, approval, and payments are on the project in their portal." },
              { icon: CreditCard, title: "Card checkout", body: "A familiar Stripe Checkout page instead of bank details in an email." },
              { icon: CircleDollarSign, title: "Clear balances", body: "Clients see what they've paid and what is still owed." },
              { icon: Receipt, title: "Receipts by email", body: "Sent automatically when a payment clears. You can turn client receipts off." },
              { icon: BadgeDollarSign, title: "Your brand", body: "The portal carries your logo, colors, and domain." },
              { icon: ShieldCheck, title: "Your Stripe account", body: "Funds go to you through Stripe Connect; ShootPortal never holds them." },
            ]}
          />
          <p className="mt-8 text-center text-sm text-[#64748B]">
            See the full client experience on the{" "}
            <Link href="/photography-client-portal" className={A}>
              photography client portal
            </Link>{" "}
            page.
          </p>
        </Section>

        <Section title="Made for jobs that get paid per shoot">
          <FounderNote detail="Collecting deposits on aerial jobs and chasing balances after delivery is why payments live on the project." />
        </Section>

        <Section eyebrow="Pricing" title="Payments are included in the one plan" tone="cloud">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Photography invoicing software questions">
          <SolutionFaq
            items={[
              {
                q: "Does ShootPortal create PDF invoices?",
                a: (
                  <p>
                    Estimates and proposals download as PDFs, and each payment has a Stripe receipt (or a payment record PDF). ShootPortal doesn&apos;t
                    produce separate numbered invoice documents. The &quot;invoice&quot; your client sees is the payment request on their project.
                  </p>
                ),
              },
              {
                q: "How do clients pay?",
                a: (
                  <p>
                    By card on Stripe Checkout. You connect your own Stripe account during setup, and payments go directly to it. Stripe&apos;s standard
                    processing fees apply.
                  </p>
                ),
              },
              {
                q: "Can I take a deposit and a balance?",
                a: (
                  <p>
                    Yes. Require a percentage or fixed deposit when the proposal is approved, then request the balance later. A project can have several
                    payments, and the client sees what is still owed.
                  </p>
                ),
              },
              {
                q: "What about cash, checks, or bank transfers?",
                a: <p>Record them with &quot;mark as paid&quot; on the payment. It updates the project and sends the receipt, just like a card payment.</p>,
              },
              {
                q: "Does it handle sales tax or connect to QuickBooks?",
                a: (
                  <p>
                    No. There is no tax line and no accounting integration. Keep your accounting software for bookkeeping and tax; use ShootPortal to get
                    each job paid.
                  </p>
                ),
              },
              {
                q: "Is there a free trial?",
                a: (
                  <p>
                    Yes. {ctx.trialDays > 0 ? `${ctx.trialDays} days free, ` : ""}no credit card required. Sign up with Google or a five-field form, then
                    connect Stripe in the guided setup to start taking payments.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="Guides on pricing and getting paid" tone="cloud">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <Section eyebrow="More of ShootPortal" title="Before and after the payment">
          <RelatedSolutions keys={["booking", "media-delivery", "business-management"]} />
        </Section>

        <RelatedNext heading="Free tools and templates" tools={["quote-builder"]} resources={["photography-invoice", "drone-photography-quote"]} />

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Get your next job paid from the project"
          body="Send a proposal, collect a deposit if you want one, and let payment open the downloads, all in one place."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
