import type { Metadata } from "next";
import Link from "next/link";
import { AppWindow, BellRing, Copy, Hourglass, Layers3, ListChecks, MessagesSquare, SlidersHorizontal, Timer, Workflow } from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { getSolutionPage, solutionCtaId, type CtaPlacement } from "@/lib/solutions";
import { solutionJsonLd, solutionMetadata } from "@/lib/solutions-seo";
import { jsonLdString } from "@/lib/blog/structured-data";
import {
  AudienceSplit,
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
  TrialButton,
} from "@/components/solutions/solution-sections";
import { AutomationBadge, AutomationLedger, AutomationRail } from "@/components/solutions/solution-scenes";
import { LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";
import { ProductPreview } from "@/components/blog/product-preview";

const PAGE = getSolutionPage("workflow");
const cta = (p: CtaPlacement) => solutionCtaId(PAGE.key, p);
const A = "font-medium text-[#4F46E5] underline underline-offset-2";

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

export default async function RealEstatePhotographyWorkflowSoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          layout="stacked"
          eyebrow="Automatic where it can be"
          title={
            <>
              Real estate photography workflow software that <GradientText>automates the busywork</GradientText>
            </>
          }
          subtitle={
            <>
              ShootPortal is real estate photography workflow software that handles the hand-offs it can do on its own, like estimates, status
              updates, payment links, receipts, and unlocking downloads, and keeps every step that needs you on one project. This page tells you
              exactly which is which.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "#what-is-automatic", label: "See what's automatic" }}
          visual={
            <figure>
              <ShowcaseImage image={MEDIA.workflow.hero} frame="dark" priority sizes="(min-width: 1024px) 1024px, 100vw" />
              <figcaption className="mt-3 text-xs text-[#64748B]">Automatic client emails, payment automations, and delivery receipts. {REAL_CAPTURE_NOTE}</figcaption>
            </figure>
          }
        />

        <Section
          eyebrow="The admin tax"
          title="You started a photography business, not an operations job"
          intro="Growing real estate media businesses rarely stall on shooting. They stall on the coordination around each listing."
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: Copy, title: "Copying the same details", body: "Address, agent, and package get retyped into a calendar, an invoice, a folder name, and an email." },
              { icon: BellRing, title: "Status emails by hand", body: "\"Your shoot is confirmed\", \"Your photos are ready\", \"Payment received\": written dozens of times a week." },
              { icon: AppWindow, title: "Five apps per listing", body: "Form tool, calendar, invoicing, file transfer, messaging. Each one is fine; the gaps between them are the problem." },
              { icon: Hourglass, title: "Waiting on the next step", body: "Jobs sit after approval or after delivery because the next action depends on you noticing." },
              { icon: Layers3, title: "No single list of open work", body: "Knowing what's unscheduled, unreviewed, or unpaid means checking every app." },
              { icon: Timer, title: "Evenings spent on admin", body: "The editing gets done. The coordination is what runs late." },
            ]}
          />
          <ShowcaseImage image={MEDIA.workflow.beforeAfter} className="mk-reveal mx-auto mt-12 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
        </Section>

        <Section
          eyebrow="Automation vs. one place"
          title="Two different things, both worth having"
          intro="A lot of software calls everything automation. We separate it, because you should know what will happen while you're out shooting."
        >
          <figure className="mb-12">
            <AutomationRail className="mx-auto max-w-4xl" />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">
              Green steps run on their own once the trigger happens. Indigo steps take one action from you.
            </figcaption>
          </figure>
          <div className="grid gap-5 md:grid-cols-3">
            {[
              {
                kind: "automatic" as const,
                title: "Automatic",
                body: "ShootPortal does it with no action from you once the trigger happens, such as a client approving a proposal or a payment clearing.",
              },
              {
                kind: "one-click" as const,
                title: "One step",
                body: "You take a single action in the project, like sending a proposal or sending media for review, and the rest of that hand-off follows.",
              },
              {
                kind: "you" as const,
                title: "Your call",
                body: "Decisions and creative work stay with you: pricing a custom job, picking a time, editing, and marking the shoot complete.",
              },
            ].map((c) => (
              <div key={c.title} className="mk-reveal rounded-3xl border border-[#E2E8F0] bg-white p-7">
                <AutomationBadge kind={c.kind} />
                <h3 className="mt-4 text-lg font-semibold text-[#0F172A]">{c.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{c.body}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          id="what-is-automatic"
          eyebrow="The workflow, step by step"
          title="What ShootPortal does, and what you do"
          intro="Each row is real product behavior. Settings marked optional can be turned on or off per business."
          tone="cloud"
        >
          <AutomationLedger
            rows={[
              {
                when: "An agent submits your request form",
                then: "A project is created with the client attached, the client gets a portal account and a \"we received your request\" email, and you get an alert.",
                kind: "automatic",
              },
              {
                when: "The request names a service",
                then: "A preliminary estimate is built from your catalog and sent to the client, with a travel fee from ZIP-to-ZIP distance if you've set one up.",
                kind: "automatic",
                note: "Optional. Turn estimates off to use the form as an inquiry form.",
              },
              {
                when: "You're ready to quote",
                then: "Review line items and send the official proposal with an expiry date and PDF.",
                kind: "one-click",
              },
              {
                when: "The agent approves the proposal",
                then: "A Stripe payment link is created for the total, or for the deposit if you require one, and the project advances.",
                kind: "automatic",
                note: "Requires your Stripe account to be connected.",
              },
              {
                when: "You propose a shoot time",
                then: "Pick the date and time. Either side can also counter-propose.",
                kind: "you",
              },
              {
                when: "The agent accepts the time",
                then: "The shoot date is set, other pending times are declined, your Google Calendar is updated, and the client is notified.",
                kind: "automatic",
              },
              {
                when: "The shoot is done",
                then: "Mark the shoot complete. This stage waits for you by default.",
                kind: "you",
              },
              {
                when: "Media is uploaded",
                then: "Send the project for review; the agent is notified that deliverables are ready.",
                kind: "one-click",
              },
              {
                when: "The agent approves every deliverable",
                then: "The project moves to Awaiting Payment, and you and the agent are notified.",
                kind: "automatic",
              },
              {
                when: "Payment clears, or you mark it paid",
                then: "A receipt is emailed, the payment link is deactivated, and the project moves to Delivered so downloads open.",
                kind: "automatic",
                note: "Optional: automatic delivery after payment and payment-gated downloads are both settings.",
              },
            ]}
          />
          <div className="mt-10 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Run a listing through it free" />
          </div>
        </Section>

        <DemoShowcase
          title="The whole workflow, end to end"
          intro="A 52-second tour of real ShootPortal screens: requests, proposal approval, the calendar with Google, the pipeline, video review, marking payments, share links, and your own brand and domain."
          video={MEDIA.shared.tour}
          points={["Requests and approvals that move the job forward", "Video review and payments on the same project", "Everything under your own brand and domain"]}
          ctaId={cta("demo")}
          trialDays={ctx.trialDays}
          ctaLabel="Run a listing through it free"
        />

        <Section eyebrow="Everything else in one place" title="The steps that need you are still faster">
          <LoopVideo video={MEDIA.shared.cycleLoop} frame="dark" className="mk-reveal mx-auto mb-16 max-w-4xl" />
          <div className="space-y-20 lg:space-y-28">
            <FeatureSpotlight
              eyebrow="One project per listing"
              title="Every step reads from the same record"
              body={
                <p>
                  The request, estimate, shoot time, messages, files, approvals, and payments all hang off one project, so nothing gets re-entered
                  between steps. Projects move through eight fixed stages from New Request to Delivered, and the board shows what&apos;s waiting on
                  you.
                </p>
              }
              bullets={["Clients see friendlier stage labels in their portal", "Staff accounts with granular permissions, assigned per project"]}
              visual={<ShowcaseImage image={MEDIA.workflow.stages} />}
              caption="Your pipeline and the client's progress tracker. Real ShootPortal screens."
            />
            <FeatureSpotlight
              reverse
              eyebrow="Notifications you control"
              title="Status emails go out without you writing them"
              body={
                <p>
                  Around 25 workflow events can notify your team or your clients by email, in-app, or push, and each one can be switched on or off.
                  Ten client email templates are editable, so the automatic messages still sound like your business.
                </p>
              }
              bullets={["Request received, shoot confirmed, ready for review, payment received, and more", "Messages with the agent stay on the listing"]}
              visual={<ProductPreview view="messages" />}
              caption="Product illustration: a project message thread (demo data)."
            />
            <FeatureSpotlight
              eyebrow="Fewer tools to stitch together"
              title="Replace the gaps between apps, not just the apps"
              body={
                <p>
                  Most real estate photography automation advice starts with connecting separate tools. ShootPortal&apos;s approach is to put requests,
                  quotes, scheduling, review, payment, and delivery in one system so there are fewer hand-offs to automate in the first place.
                </p>
              }
              bullets={[
                <>
                  Want the how-to version? Read our{" "}
                  <Link href="/blog/real-estate-photography-automation" className={A}>
                    guide to real estate photography automation
                  </Link>
                  .
                </>,
              ]}
              visual={<ShowcaseImage image={MEDIA.shared.allInOne} frame="dark" className="mx-auto max-w-md" sizes="(min-width: 1024px) 448px, 100vw" />}
            />
          </div>
        </Section>

        <Section eyebrow="What stays manual" title="Honest limits" tone="cloud">
          <FeatureCards
            columns={2}
            items={[
              { icon: SlidersHorizontal, title: "Editing", body: "ShootPortal doesn't edit photos or video. Your editor or editing service stays in the workflow." },
              { icon: ListChecks, title: "Proposing shoot times", body: "Clients don't self-book open slots; you or the client propose a time and the other accepts." },
              { icon: MessagesSquare, title: "Following up", body: "If an agent goes quiet on a proposal or payment, the nudge is still yours to send." },
              { icon: Workflow, title: "Custom stages", body: "The eight stages are fixed; you can control which ones advance automatically, but you can't add your own." },
            ]}
          />
        </Section>

        <Section eyebrow="Who it's for" title="From solo shooter to small team">
          <AudienceSplit
            items={[
              {
                label: "Solo real estate photographers",
                title: "Get evenings back",
                body: <p>The hand-offs that happen while you&apos;re shooting no longer wait for you to get home.</p>,
                points: ["Estimates go out while you're on a shoot", "Payment and delivery happen without a manual step", "One login for every agent"],
              },
              {
                label: "Growing media teams",
                title: "Everyone works from the same project",
                body: <p>Shooters, editors, and the office see the same listing record and the same stage.</p>,
                points: ["Staff permissions per role", "Assign staff to the listings they shoot or edit", "One board for every open job"],
              },
            ]}
          />
          <p className="mt-8 text-center text-sm text-[#64748B]">
            Looking for the complete platform overview? See{" "}
            <Link href="/real-estate-photography-software" className={A}>
              real estate photography software
            </Link>
            .
          </p>
        </Section>

        <Section tone="cloud" title="Automation designed by someone who needed it">
          <FounderNote detail="The hand-offs ShootPortal automates are the ones that used to wait until after a long shoot day." />
        </Section>

        <Section eyebrow="Pricing" title="Every automation in the one plan">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Workflow automation questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "What does ShootPortal automate?",
                a: (
                  <p>
                    Project and client creation from requests, preliminary estimates, payment links on approval, shoot-time follow-through (calendar,
                    declining other times, client notice), moving to Awaiting Payment when everything is approved, receipts, and moving to Delivered
                    when payment clears.
                  </p>
                ),
              },
              {
                q: "What still needs me?",
                a: <p>Sending the official proposal, proposing shoot times, editing, marking the shoot complete, sending media for review, and following up with clients who go quiet.</p>,
              },
              {
                q: "Can I turn automations off?",
                a: <p>Yes. Automatic estimates, deposits, automatic delivery after payment, payment-gated downloads, and each notification are settings, and stages can be set to advance automatically or wait for you.</p>,
              },
              {
                q: "Does it integrate with Zapier or other apps?",
                a: <p>There is no Zapier integration. ShootPortal connects to Stripe for payments and Google Calendar for scheduling, and the goal is to need fewer connections.</p>,
              },
              {
                q: "Is there a free trial?",
                a: (
                  <p>
                    Yes. {ctx.trialDays > 0 ? `${ctx.trialDays} days free, ` : ""}no credit card required. Sign up with Google or a five-field form and run
                    one real listing from request to delivery.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="Guides on automating your business">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <Section eyebrow="More of ShootPortal" title="Explore the workflow by stage" tone="cloud">
          <RelatedSolutions keys={["booking", "invoicing", "real-estate-software"]} />
        </Section>

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Let the hand-offs run while you shoot"
          body="Put one listing through ShootPortal and see which steps take care of themselves."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
