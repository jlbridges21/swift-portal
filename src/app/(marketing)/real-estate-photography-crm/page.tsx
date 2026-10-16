import type { Metadata } from "next";
import Link from "next/link";
import {
  BadgeDollarSign,
  BookUser,
  Building2,
  CalendarClock,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  FileSpreadsheet,
  History,
  Images,
  Inbox,
  KanbanSquare,
  LogIn,
  MapPin,
  MessageSquare,
  NotebookPen,
  Smartphone,
  StickyNote,
  UserPlus,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
  FeatureCards,
  FeatureSpotlight,
  FinalCta,
  FounderNote,
  GradientText,
  PricingStrip,
  ProblemGrid,
  RelatedReading,
  ScopeCard,
  Section,
  SolutionFaq,
  SolutionHero,
  ToolsVsPlatform,
  TrialButton,
  DemoShowcase,
  REAL_CAPTURE_NOTE,
} from "@/components/solutions/solution-sections";
import { FloatingChip } from "@/components/solutions/solution-visuals";
import { LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";
import { CrmRecordDiagram } from "@/components/blog/diagrams";
import { ProjectBoardDiagram, SampleEstimate } from "@/components/blog/business-diagrams";

const PAGE = getSolutionPage("crm");
const cta = (p: CtaPlacement) => solutionCtaId(PAGE.key, p);

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

const LINK = "font-medium text-[#4F46E5] underline underline-offset-2";

/** Fictional client record matching the "clients" product demo row (Jordan Blake). */
function HeroRecordCard() {
  const stats = [
    { label: "Lifetime revenue", value: "$18,600" },
    { label: "Outstanding", value: "$890", warn: true },
    { label: "Last payment", value: "Oct 2" },
    { label: "Last portal login", value: "Yesterday" },
  ];
  return (
    <div className="rounded-2xl border border-white/70 bg-white p-4 shadow-[0_40px_80px_-35px_rgba(0,0,0,0.85)] sm:p-5" aria-hidden>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] text-sm font-bold text-white">JB</span>
        <div className="min-w-0">
          <p className="truncate font-semibold text-[#0F172A]">Jordan Blake</p>
          <p className="truncate text-xs text-[#64748B]">Jordan Blake Realty · Referred by Maya Ortiz</p>
        </div>
        <span className="ml-auto shrink-0 rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4F46E5]">5 projects</span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-[#F8FAFC] px-2.5 py-2">
            <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#64748B]">{s.label}</dt>
            <dd className={s.warn ? "mt-0.5 text-sm font-semibold text-amber-700" : "mt-0.5 text-sm font-semibold text-[#0F172A]"}>{s.value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-100 bg-amber-50/60 px-3 py-2 text-xs text-[#78350F]">
        <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Prefers twilight exteriors. Lockbox on the side gate. Assistant Dana handles downloads.
      </div>
    </div>
  );
}

/** Notes, messages, and activity for one agent, newest first (fictional). */
const TIMELINE: { icon: LucideIcon; kind: string; when: string; text: string; tone: string }[] = [
  { icon: CircleDollarSign, kind: "Payment", when: "Oct 2", text: "Balance paid for 88 Harbor View Dr", tone: "bg-emerald-400/15 text-emerald-300" },
  { icon: MessageSquare, kind: "Message", when: "Sep 29", text: "\"Can we add aerials? The lot backs onto the water.\"", tone: "bg-sky-400/15 text-sky-300" },
  { icon: ClipboardList, kind: "Activity", when: "Sep 28", text: "Estimate approved: listing photos + walkthrough video", tone: "bg-indigo-400/15 text-indigo-300" },
  { icon: NotebookPen, kind: "Note", when: "Sep 12", text: "Team switching brokerages in January. Update company then.", tone: "bg-amber-400/15 text-amber-300" },
  { icon: UserPlus, kind: "Referral", when: "Mar 3", text: "Referral source: Maya Ortiz", tone: "bg-fuchsia-400/15 text-fuchsia-300" },
];

/** Property history by address for one agent (fictional, illustrative amounts). */
const PROPERTIES = [
  {
    address: "214 Oak Street",
    total: "$1,140",
    visits: [
      { when: "Apr 2025", what: "Listing photos + aerials" },
      { when: "Sep 2026", what: "Relist: refreshed exteriors + video" },
    ],
  },
  { address: "88 Harbor View Dr", total: "$620", visits: [{ when: "Sep 2026", what: "Listing photos + walkthrough video" }] },
  { address: "15 Cedar Grove Ct", total: "$410", visits: [{ when: "Jun 2026", what: "Listing photos + floor plan" }] },
];

export default async function RealEstatePhotographyCrmPage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          tone="dark"
          eyebrow="Real estate photography CRM"
          title={
            <>
              Keep every real estate photography <GradientText>client and project</GradientText> organized
            </>
          }
          subtitle={
            <>
              A CRM for photographers and media teams who serve agents, not a CRM for agents. Every agent gets one record with their
              properties, projects, notes, messages, and balance, connected to the work you actually deliver.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "#client-record", label: "Look inside a client record" }}
          visual={
            <div className="relative pb-14 pt-8 [contain:inline-size] sm:pl-4">
              <div className="sm:mr-14">
                <ShowcaseImage image={MEDIA.crm.dashboard} frame="dark" priority className="ring-1 ring-white/15" />
              </div>
              <div className="relative -mt-20 ml-auto w-[94%] sm:-mt-28 sm:w-[80%]">
                <HeroRecordCard />
              </div>
              <FloatingChip icon={History} title="Relist: 214 Oak Street" detail="2nd project at this address" tone="indigo" className="-top-1 left-0 sm:-left-4" />
              <FloatingChip icon={BadgeDollarSign} title="Outstanding balance" detail="$890 awaiting payment" tone="amber" className="right-0 top-1/3 hidden sm:flex lg:-right-6" delayMs={700} />
              <FloatingChip icon={LogIn} title="Last portal login" detail="Yesterday, 6:40 PM" tone="sky" className="bottom-0 left-2 sm:left-8" delayMs={1400} />
            </div>
          }
        />

        <Section
          eyebrow="Before you read further"
          title="Built for the photographer's side of the listing"
          intro="Search for a real estate CRM and you'll mostly find tools for agents to manage buyers and sellers. This is the other side: software for the photographers, videographers, and media companies those agents hire."
        >
          <div className="mx-auto grid max-w-4xl gap-4 md:grid-cols-2">
            <div className="mk-reveal rounded-3xl border border-[#C7D2FE] bg-gradient-to-br from-[#EEF2FF] to-white p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#4F46E5]">This page is for you if</p>
              <ul className="mk-plain-list mt-3 space-y-2 text-sm text-[#1E293B]">
                <li>· Your clients are listing agents, teams, and brokerages</li>
                <li>· The same agents order again with every new listing</li>
                <li>· You need to know who owes what, and what you shot where</li>
              </ul>
            </div>
            <div className="mk-reveal rounded-3xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#64748B]">Look elsewhere if</p>
              <ul className="mk-plain-list mt-3 space-y-2 text-sm text-[#475569]">
                <li>· You&apos;re an agent tracking buyers, sellers, and showings</li>
                <li>· You need drip campaigns to your sphere of influence</li>
                <li>· You want a transaction or brokerage management system</li>
              </ul>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="The problem"
          title="Client details scattered across five places"
          intro="Most photographers' client management is a spreadsheet, their phone, and their memory. That holds up until you have thirty active agents and a second photographer."
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: FileSpreadsheet, title: "A spreadsheet nobody updates", body: "The client list was accurate in January. Since then three agents changed brokerages and two assistants took over ordering." },
              { icon: Smartphone, title: "Notes trapped in your phone", body: "Gate codes, the agent who hates wide angles, the seller who works nights: all in texts only you can find." },
              { icon: StickyNote, title: "Preferences forgotten", body: "The agent asked for twilight shots last time. The new shooter didn't know, and now there's a reshoot." },
              { icon: CircleDollarSign, title: "Billing confusion", body: "Which listings are paid? Did the team lead or the agent pay for Cedar Grove? The answer is in a different app." },
              { icon: MapPin, title: "No history by property", body: "A relist comes in and you can't quickly find what you shot there last spring or what you charged." },
              { icon: Users, title: "Know-how lives with one person", body: "When the owner is on a shoot, nobody else can answer an agent's question about their account." },
            ]}
          />
        </Section>

        <DemoShowcase
          title="Every client, connected to their projects"
          intro="A 35-second tour of client management in ShootPortal: the client list, the pipeline, estimates, deposits and payments, the activity timeline, and moving projects between stages."
          video={MEDIA.crm.demo}
          points={["Revenue, balances, and activity for every client", "Estimates, deposits, and payments tracked per project", "A shared activity timeline on every job"]}
          ctaId={cta("demo")}
          trialDays={ctx.trialDays}
          ctaLabel="Organize your agents in ShootPortal"
        />

        <Section
          eyebrow="What to expect"
          title="What a photography CRM should give you"
          intro="A CRM for a media business isn't a list of contacts. It's the agent, their properties, their jobs, and their money, connected."
        >
          <FeatureCards
            columns={4}
            items={[
              { icon: BookUser, title: "Client records", body: "Name, email, phone, company, and referral source for every agent." },
              { icon: NotebookPen, title: "Notes and timeline", body: "Timestamped notes plus messages and activity in one running history." },
              { icon: MapPin, title: "Property history", body: "Every address you've shot for a client, with projects and revenue per address." },
              { icon: KanbanSquare, title: "Project pipeline", body: "Every job on a board by stage, from new request to delivered." },
              { icon: CircleDollarSign, title: "Balances at a glance", body: "Lifetime revenue, outstanding balance, and last payment on the record." },
              { icon: LogIn, title: "Portal activity", body: "Last portal login shows whether an agent has looked at their delivery." },
              { icon: Inbox, title: "Leads kept apart", body: "New inquiries sit in their own view until they become clients." },
              { icon: Users, title: "Team access", body: "Staff accounts with granular permissions, assigned to specific projects." },
            ]}
          />
        </Section>

        <Section
          tone="dark"
          eyebrow="Agent relationships"
          title="Remember every agent the way your best clients expect"
          intro="Repeat agents are the business. The record keeps what you know about them where your whole team can find it."
        >
          <LoopVideo video={MEDIA.crm.agentLoop} frame="dark" className="mk-reveal mx-auto mb-12 max-w-4xl" />
          <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.1fr]">
            <div className="space-y-5 text-base leading-relaxed text-slate-300">
              <p>
                Add timestamped notes for the things that make an agent happy: preferred shot styles, which assistant handles downloads,
                brokerage quirks, access instructions. There&apos;s no special preferences form; notes are where they live, and they sit on
                the record next to everything else.
              </p>
              <p>
                The timeline merges those notes with project messages and activity such as approved estimates and payments, so you can read
                an agent&apos;s whole history in order before you call them. A referral source field tells you who sent each agent your way.
              </p>
              <p>
                For a deeper playbook on keeping agents organized and coming back, read our guide to{" "}
                <Link href="/blog/real-estate-photography-client-management" className="font-medium text-[#A5B4FC] underline underline-offset-2">
                  real estate photography client management
                </Link>
                .
              </p>
            </div>
            <figure>
              <ol className="mk-plain-list relative space-y-3 rounded-3xl border border-white/10 bg-white/5 p-5 sm:p-6" aria-label="Example client timeline">
                <span className="absolute bottom-8 left-[2.6rem] top-8 w-px bg-white/10 sm:left-[2.85rem]" aria-hidden />
                {TIMELINE.map((t) => {
                  const Icon = t.icon;
                  return (
                    <li key={t.when + t.kind} className="relative flex gap-4">
                      <span className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${t.tone}`}>
                        <Icon className="h-4 w-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1 rounded-2xl bg-white/5 px-4 py-3">
                        <p className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                          <span>{t.kind}</span>
                          <span className="normal-case tracking-normal">{t.when}</span>
                        </p>
                        <p className="mt-1 text-sm text-slate-100">{t.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
              <figcaption className="mt-3 text-center text-xs text-slate-400">Illustration of one agent&apos;s timeline (fictional data).</figcaption>
            </figure>
          </div>
        </Section>

        <Section
          id="client-record"
          eyebrow="Client records"
          title="One record per agent, with the numbers that matter"
          intro="Open a client and you see who they are, what you've done for them, and where the money stands."
          tone="cloud"
        >
          <figure>
            <CrmRecordDiagram />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">The layers of a ShootPortal client record (fictional client).</figcaption>
          </figure>
          <dl className="mt-10 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { t: "Contact and company", d: "Name, email, phone, and company, searchable from the client list." },
              { t: "Lifetime revenue", d: "What this agent has spent with you, so you know who your best accounts are." },
              { t: "Outstanding balance", d: "What's still owed across their projects, without opening a separate payment app." },
              { t: "Last payment", d: "When they last paid, useful before you accept another rush job." },
              { t: "Last portal login", d: "Whether they've been back to the portal to see their delivery." },
              { t: "Projects and properties", d: "Every job and address, linked from the record." },
            ].map((f) => (
              <div key={f.t} className="border-l-2 border-[#C7D2FE] pl-4">
                <dt className="font-semibold text-[#0F172A]">{f.t}</dt>
                <dd className="mt-1 text-sm leading-relaxed text-[#475569]">{f.d}</dd>
              </div>
            ))}
          </dl>
        </Section>

        <Section
          eyebrow="Property history"
          title="Track projects by client and by address"
          intro="Listings come back: price drops, relists, a new agent on the same house. Property history shows what you've shot at each address for a client, with revenue per address."
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
            <figure>
              <div className="mk-reveal overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-55px_rgba(15,23,42,0.7)]" aria-hidden>
                <div className="flex items-center justify-between border-b border-[#E2E8F0] bg-[#F8FAFC] px-5 py-3">
                  <p className="text-sm font-semibold text-[#0F172A]">Property history · Jordan Blake</p>
                  <span className="text-[11px] text-[#64748B]">3 addresses</span>
                </div>
                <ul className="divide-y divide-[#F1F5F9]">
                  {PROPERTIES.map((p) => (
                    <li key={p.address} className="px-5 py-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="flex items-center gap-2 text-sm font-semibold text-[#0F172A]">
                          <MapPin className="h-4 w-4 text-[#4F46E5]" />
                          {p.address}
                        </p>
                        <span className="text-xs font-semibold text-[#334155]">{p.total}</span>
                      </div>
                      <ul className="mt-2 space-y-1.5 pl-6">
                        {p.visits.map((v) => (
                          <li key={v.when} className="flex flex-wrap items-center gap-2 text-xs text-[#475569]">
                            <span className="rounded-full bg-[#F1F5F9] px-2 py-0.5 font-medium text-[#334155]">{v.when}</span>
                            {v.what}
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </div>
              <figcaption className="mt-3 text-center text-xs text-[#64748B]">Illustration of property history with fictional addresses and amounts.</figcaption>
            </figure>
            <div className="space-y-4 text-base leading-relaxed text-[#475569]">
              <h3 className="text-2xl font-semibold tracking-tight text-[#0F172A]">When 214 Oak Street comes back, you&apos;re ready</h3>
              <p>
                Open the agent, find the address, and you have last season&apos;s project: the services they ordered, the price, the media
                you delivered, and the messages around it. Quoting the relist starts from real history instead of an inbox search.
              </p>
              <p>
                The same record shows which agents send you the most repeat listings, which is where your marketing time is best spent.
              </p>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Pipeline"
          title="Eight clear stages for every project"
          intro="Every job sits on a board from New Request to Delivered. The stages are fixed, which keeps the board and the client portal speaking the same language."
          tone="cloud"
        >
          <figure className="mk-reveal mx-auto mb-10 max-w-4xl">
            <ShowcaseImage image={MEDIA.crm.pipeline} frame="dark" sizes="(min-width: 1024px) 896px, 100vw" />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">{REAL_CAPTURE_NOTE}</figcaption>
          </figure>
          <figure>
            <ProjectBoardDiagram />
            <figcaption className="mt-3 text-center text-xs text-[#64748B]">
              ShootPortal&apos;s eight pipeline stages with fictional projects. Scroll sideways on small screens.
            </figcaption>
          </figure>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            New Request, Quote Sent, Proposal Approved, Scheduled, Shoot Complete, Review, Awaiting Payment, Delivered. Some moves happen
            automatically, and agents see friendlier labels in their portal. You can&apos;t add custom stages.
          </p>
        </Section>

        <Section
          eyebrow="Connected to the work"
          title="Estimates, schedules, messages, and media, all on the client"
          intro="A general CRM stops at the contact. Here the jobs themselves hang off the record, so nothing needs copying between tools."
        >
          <LoopVideo video={MEDIA.crm.clientLoop} frame="dark" className="mk-reveal mx-auto mb-14 max-w-4xl" />
          <FeatureSpotlight
            eyebrow="Estimates & payment requests"
            title="Every quote and payment tied to the agent who ordered it"
            body={
              <p>
                Estimates come from your service catalog, with travel fees calculated by ZIP-code distance. When the agent approves, you can
                take a deposit, then request the balance later through Stripe. Each payment rolls up into the client&apos;s lifetime revenue and
                outstanding balance, so billing questions have one answer.
              </p>
            }
            bullets={["Estimate versions and expiry dates", "Card payments straight to your own Stripe account", "Mark offline payments as paid"]}
            visual={
              <SampleEstimate
                title="88 Harbor View Dr · Listing package"
                client="Jordan Blake, Jordan Blake Realty"
                depositPercent={25}
                lines={[
                  { label: "Listing photos (up to 30)", amount: 225 },
                  { label: "Walkthrough video", amount: 150 },
                  { label: "Drone aerials (5 stills)", amount: 95 },
                  { label: "Travel fee", detail: "Within 25 miles of base ZIP", amount: 0 },
                ]}
              />
            }
            caption="Example estimate with illustrative prices."
          />
          <ul className="mk-plain-list mt-16 grid gap-4 md:grid-cols-3">
            {[
              {
                icon: MessageSquare,
                title: "Communication and updates",
                body: "Two-way messages on each project, email notifications at each step, and a portal that shows the agent the current stage.",
              },
              {
                icon: CalendarDays,
                title: "Scheduling",
                body: "Propose a shoot time from the project; the agent accepts or counters in the portal, and confirmed shoots push to your Google Calendar.",
              },
              {
                icon: Images,
                title: "Media delivery",
                body: "Photos, video, tours, and Print or MLS-size downloads on the same project, visible from the agent's record.",
              },
            ].map((it) => {
              const Icon = it.icon;
              return (
                <li key={it.title} className="mk-reveal rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-6">
                  <Icon className="h-5 w-5 text-[#4F46E5]" aria-hidden />
                  <h3 className="mt-3 font-semibold text-[#0F172A]">{it.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#475569]">{it.body}</p>
                </li>
              );
            })}
          </ul>
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            This page covers the client side. For the full request-to-delivery workflow, see{" "}
            <Link href="/real-estate-photography-software" className={LINK}>
              ShootPortal&apos;s real estate photography software
            </Link>
            , and for what agents see, the{" "}
            <Link href="/photography-client-portal" className={LINK}>
              branded client portal
            </Link>
            .
          </p>
        </Section>

        <Section eyebrow="Leads and team" title="New inquiries in one place, staff on the right jobs" tone="cloud">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="mk-reveal rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8">
              <Inbox className="h-6 w-6 text-[#4F46E5]" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-[#0F172A]">A separate leads view</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">
                Inquiries land in their own list with the contact&apos;s details, company, property address, the service they asked about, a
                preferred date, and notes. New ones are flagged until you read them, and your client list stays reserved for people you work
                with. Need more of those inquiries? Start with{" "}
                <Link href="/blog/how-to-get-real-estate-photography-clients" className={LINK}>
                  how to get real estate photography clients
                </Link>
                .
              </p>
              <div className="mt-6 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4" aria-hidden>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-[#0F172A]">Chris Delgado</p>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800">New</span>
                  <span className="rounded-full bg-[#EEF2FF] px-2 py-0.5 text-[11px] font-semibold text-[#4F46E5]">Listing photos + video</span>
                </div>
                <p className="mt-2 flex items-center gap-1.5 text-xs text-[#64748B]">
                  <Building2 className="h-3.5 w-3.5" /> Harborline Properties · <MapPin className="h-3.5 w-3.5" /> 9 Willow Bend
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-[#64748B]">
                  <CalendarClock className="h-3.5 w-3.5" /> Preferred: Friday morning
                </p>
              </div>
            </div>
            <div className="mk-reveal rounded-3xl border border-[#E2E8F0] bg-white p-6 sm:p-8">
              <Users className="h-6 w-6 text-[#4F46E5]" aria-hidden />
              <h3 className="mt-4 text-xl font-semibold text-[#0F172A]">Staff accounts with permissions</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">
                Add photographers, editors, and office help as staff, give each one the permissions their role needs from a granular list, and
                assign them to specific projects. Everyone works from the same client history, and you decide what each person can access.
              </p>
              <div className="mt-6 space-y-2" aria-hidden>
                {[
                  { name: "214 Oak Street · Relist", who: ["SR", "DK"] },
                  { name: "88 Harbor View Dr", who: ["SR"] },
                  { name: "Westfield exterior", who: ["MT", "DK"] },
                ].map((p) => (
                  <div key={p.name} className="flex items-center justify-between rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5">
                    <span className="text-sm text-[#0F172A]">{p.name}</span>
                    <span className="flex -space-x-1.5">
                      {p.who.map((w) => (
                        <span key={w} className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-[#4F46E5] text-[10px] font-bold text-white">
                          {w}
                        </span>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-12 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Add your first agents free" />
          </div>
        </Section>

        <Section
          eyebrow="Compare"
          title="General-purpose CRM vs. a CRM built into your media workflow"
          intro="Tools like HubSpot or Pipedrive are built around contacts and deals. They're strong at sales, but the photos, the shoot, and the payment still live somewhere else."
        >
          <ShowcaseImage image={MEDIA.crm.comparison} className="mk-reveal mx-auto mb-10 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <ToolsVsPlatform
            leftTitle="General-purpose CRM"
            rows={[
              { task: "Client record", before: "Contacts and deals; properties become custom fields you maintain", after: "Agent record with properties, projects, notes, and balances built in" },
              { task: "Repeat listings", before: "Search old deals and email threads", after: "Property history by address, with revenue per address" },
              { task: "Quotes", before: "A separate quoting tool or template", after: "Estimates from your service catalog with automatic travel fees" },
              { task: "Shoot scheduling", before: "Meeting links or calendar invites", after: "Propose a shoot time; the agent accepts or counters in the portal" },
              { task: "Getting paid", before: "Needs an invoicing integration", after: "Stripe payment requests on the project; balances update the record" },
              { task: "Delivery", before: "Not included; files go out by link", after: "Photos, video, tours, and downloads on the client's project" },
              { task: "Email marketing", before: "Campaigns, sequences, and lead scoring", after: "Not included; pair with a marketing tool if you rely on it" },
            ]}
          />
        </Section>

        <Section
          eyebrow="Honest limits"
          title="What this CRM deliberately doesn't do"
          intro="ShootPortal's CRM is built around running client work, not sales automation. If these are must-haves, a dedicated tool will serve you better."
          tone="cloud"
        >
          <ScopeCard
            title="ShootPortal's client management"
            does={[
              "Client records with notes, timeline, referral source, and property history",
              "Lifetime revenue, outstanding balance, last payment, and last portal login",
              "Eight-stage project pipeline and a separate leads view",
              "Staff accounts with granular permissions and project assignment",
            ]}
            doesNot={[
              "Automated lead scoring",
              "Marketing sequences and email campaigns",
              "Pipeline automation rules or custom stages",
              "Brokerage billing or pay-at-close",
              "SMS text messaging",
            ]}
          />
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            Comparing options? Our roundup of the{" "}
            <Link href="/blog/best-photography-crm-software" className={LINK}>
              best photography CRM software
            </Link>{" "}
            covers general and photography-specific tools side by side.
          </p>
        </Section>

        <Section eyebrow="Solo or growing" title="Useful at ten agents, essential at fifty">
          <AudienceSplit
            items={[
              {
                label: "Solo photographers",
                title: "Stop being the database",
                body: <p>Get what&apos;s in your head and your phone onto records you can search, so nothing depends on memory.</p>,
                points: [
                  "Notes and preferences ready before every shoot",
                  "See unpaid balances before you take the next job",
                  "Quote relists from the last project at that address",
                ],
              },
              {
                label: "Growing media teams",
                title: "Share the client history safely",
                body: <p>Give staff the access their role needs and assign them to the projects they&apos;re shooting or editing.</p>,
                points: [
                  "Any team member can answer an agent's question",
                  "Pipeline view of every project across photographers",
                  "Lifetime revenue shows which agents to prioritize",
                ],
              },
            ]}
          />
          <div className="mt-12">
            <FounderNote />
          </div>
        </Section>

        <Section eyebrow="Pricing" title="Every CRM feature on one flat plan" tone="cloud">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Real estate photography CRM questions">
          <SolutionFaq
            items={[
              {
                q: "Is this a CRM for real estate agents?",
                a: (
                  <p>
                    No. ShootPortal is for real estate photographers, videographers, and media companies whose clients are agents. Agents use it
                    only through your branded portal to approve estimates, confirm shoot times, pay, and download their media.
                  </p>
                ),
              },
              {
                q: "What does a real estate photography CRM track?",
                a: (
                  <p>
                    In ShootPortal: each client&apos;s contact details, company, referral source, notes, a timeline of messages and activity,
                    property history by address, projects, lifetime revenue, outstanding balance, last payment, and last portal login.
                  </p>
                ),
              },
              {
                q: "Can I see every listing I've shot for one agent?",
                a: (
                  <p>
                    Yes. Property history on the client record lists each address you&apos;ve shot for them, with the projects and revenue at
                    each one, which makes relists and repeat orders quick to quote.
                  </p>
                ),
              },
              {
                q: "Can I customize the pipeline stages?",
                a: (
                  <p>
                    No. Every project uses the same eight stages, from New Request to Delivered, and clients see friendlier versions of those
                    labels in their portal. If you need custom stages or automation rules, a general-purpose CRM is a better fit.
                  </p>
                ),
              },
              {
                q: "Does it send marketing emails to agents?",
                a: (
                  <p>
                    No. ShootPortal sends project emails such as estimate, scheduling, review, and payment notifications, but not marketing
                    campaigns or sequences. Use a dedicated email marketing tool for newsletters.
                  </p>
                ),
              },
              {
                q: "Can my team use it?",
                a: (
                  <p>
                    Yes. Add staff accounts, set granular permissions for each person, and assign them to specific projects.
                  </p>
                ),
              },
              {
                q: "How do I start?",
                a: (
                  <p>
                    {ctx.trialDays > 0 ? `Start a ${ctx.trialDays}-day free trial` : "Start free"} with no credit card. Sign up with Google or a
                    five-field form, then add your services, connect Stripe, and bring in your first agents.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="More on managing real estate clients" tone="cloud">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Give every agent one organized record"
          body="Bring your repeat agents into ShootPortal, run their next listing through it, and keep the history, notes, and balances in one place from then on."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
