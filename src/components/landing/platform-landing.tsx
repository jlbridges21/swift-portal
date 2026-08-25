import Link from "next/link";
import dynamic from "next/dynamic";
import {
  formatAnnualSavingsLabel,
  formatAnnualSavingsLongLabel,
  formatTrialDaysLabel,
  formatPlanPrice,
} from "@/lib/plan-catalog";
import type { PlanRow } from "@/lib/plan-catalog";
import { Button } from "@/components/ui/button";
import {
  MarketingShell,
  MarketingCtaBand,
} from "@/components/marketing/marketing-chrome";
import { MarketingHomePricing } from "@/components/marketing/marketing-home-pricing";
import { MarketingFaq } from "@/components/marketing/marketing-faq";
import { HeroProductVizLazy } from "@/components/marketing/hero-viz-lazy";
import { HomepageWorkflowMarquee } from "@/components/marketing/home/workflow-marquee";
import { ConsolidationPills } from "@/components/marketing/home/consolidation-pills";
import { HomePainConverge } from "@/components/marketing/home/pain-converge";
import { HomeSocialProgression } from "@/components/marketing/home/social-progression";
import { HomeStackCollapse } from "@/components/marketing/home/stack-collapse";
import {
  CalendarClock,
  CheckCircle2,
  CreditCard,
  FolderKanban,
  Images,
  Link2,
  MessageSquare,
  Paintbrush,
  Palette,
  Receipt,
  Users,
  FileText,
  UserPlus,
} from "lucide-react";

const ProductDemo = dynamic(
  () =>
    import("@/components/marketing/product-demo/product-demo").then((m) => m.ProductDemo),
  {
    ssr: true,
    loading: () => (
      <div
        className="mx-auto h-[560px] max-w-6xl animate-pulse rounded-2xl bg-[#F1F5F9]"
        aria-hidden
      />
    ),
  }
);

const REPLACES = [
  { label: "CRM", icon: Users },
  { label: "Scheduling", icon: CalendarClock },
  { label: "File delivery", icon: FolderKanban },
  { label: "Proofing", icon: Images },
  { label: "Invoicing", icon: Receipt },
  { label: "Payments", icon: CreditCard },
] as const;

const FEATURES = [
  {
    icon: Palette,
    title: "Branded client portal",
    body: "Give clients one professional place to approve work, view project details, access media, and handle payment.",
  },
  {
    icon: FileText,
    title: "Estimates and approvals",
    body: "Send clear estimates and let clients approve the project before the shoot moves forward.",
  },
  {
    icon: CalendarClock,
    title: "Scheduling",
    body: "Keep shoot dates connected to the project so you are not updating Google Calendar in a separate tab.",
  },
  {
    icon: MessageSquare,
    title: "Client communication",
    body: "Stop searching old texts and emails for what the client asked for. Keep the conversation on the job.",
  },
  {
    icon: Images,
    title: "Media delivery",
    body: "Give clients one clean place to get their photos and videos instead of sending another random download link.",
  },
  {
    icon: FolderKanban,
    title: "Project management",
    body: "Open the project and see exactly what needs to happen next.",
  },
  {
    icon: CreditCard,
    title: "Invoices and payments",
    body: "Send the invoice from the project and know what has been paid without another follow-up chase.",
  },
  {
    icon: Users,
    title: "Client management",
    body: "Keep contact information, previous jobs, project history, and payment activity in one place.",
  },
  {
    icon: UserPlus,
    title: "Lead capture",
    body: "Turn website inquiries into organized leads and projects instead of letting them disappear into your inbox.",
  },
  {
    icon: Link2,
    title: "One record for every job",
    body: "Scheduling, messages, files, approvals, invoices, and payments stay connected to the same project.",
  },
  {
    icon: CheckCircle2,
    title: "Client approvals",
    body: "Let clients approve estimates, shoot details, and project decisions without chasing another text or email.",
  },
  {
    icon: Paintbrush,
    title: "Business branding",
    body: "Customize the client experience with your logo, colors, services, and branded communication.",
  },
] as const;

const PAIN_POINTS = [
  "No more hunting through old texts and emails for project details.",
  "No more wondering which jobs still need payment.",
  "No more sending clients five different links.",
  "No more keeping your calendar separate from your projects.",
  "No more building your own workflow out of disconnected software.",
] as const;

function SectionEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#4F46E5]">
      {children}
    </p>
  );
}

export function PlatformLanding({
  trialDays,
  plans,
}: {
  trialDays: number;
  plans: PlanRow[];
}) {
  const studioPlan =
    plans.find((p) => p.key === "studio") ?? plans.find((p) => p.key !== "founding") ?? plans[0];
  const monthlyPriceLabel = studioPlan ? formatPlanPrice(studioPlan.price_monthly_cents) : "$29";
  const annualPriceLabel = studioPlan?.price_annual_cents
    ? formatPlanPrice(studioPlan.price_annual_cents)
    : monthlyPriceLabel;
  const annualSavingsLabel = studioPlan
    ? formatAnnualSavingsLabel(studioPlan.price_monthly_cents, studioPlan.price_annual_cents)
    : null;
  const annualSavingsLongLabel = studioPlan
    ? formatAnnualSavingsLongLabel(studioPlan.price_monthly_cents, studioPlan.price_annual_cents)
    : null;
  const trialDaysLabel = formatTrialDaysLabel(trialDays);

  const trialNote =
    trialDays > 0
      ? `${trialDays} days free. No credit card required.`
      : "Create your studio. Subscribe when you are ready.";

  const finalTrialNote =
    trialDays > 0
      ? `${monthlyPriceLabel} a month after your ${trialDays} day trial. Cancel anytime.`
      : `${monthlyPriceLabel} a month. Cancel anytime.`;

  return (
    <MarketingShell trialNote={trialNote}>
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-[#E2E8F0]">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,70,229,0.14), transparent 55%), linear-gradient(180deg, #FFFFFF 0%, #F8FAFC 72%, #F1F5F9 100%)",
          }}
        />
        <div className="relative mx-auto max-w-6xl px-4 pb-6 pt-16 sm:px-6 sm:pt-20 lg:px-8 lg:pb-10 lg:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <SectionEyebrow>BUILT FOR REAL ESTATE MEDIA</SectionEyebrow>
            <h1 className="mt-5 text-[2.125rem] font-bold leading-[1.12] tracking-tight text-[#0F172A] sm:text-5xl sm:leading-[1.08] lg:text-[3.5rem] lg:leading-[1.05]">
              Run your entire media business from one place.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#475569] sm:text-lg sm:leading-relaxed">
              Manage leads, projects, scheduling, client communication, media delivery, invoices,
              and payments in one simple portal built for real estate media professionals.
            </p>
            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <Link href="/signup" className="inline-flex">
                <Button className="min-h-12 bg-[#4F46E5] px-7 text-base font-semibold text-white shadow-md shadow-indigo-500/25 hover:bg-[#4338CA] focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2">
                  Start your free trial
                </Button>
              </Link>
              <a href="#product-demo" className="inline-flex">
                <Button
                  variant="outline"
                  className="min-h-12 border-[#E2E8F0] bg-white/80 px-6 text-base font-medium text-[#0F172A] hover:bg-white focus-visible:ring-2 focus-visible:ring-[#4F46E5] focus-visible:ring-offset-2"
                >
                  See how it works
                </Button>
              </a>
            </div>
            {trialDays > 0 ? (
              <p className="mt-4 text-sm text-[#475569]">
                {trialDays} days free. No credit card required.
              </p>
            ) : null}
            <p className="mt-3 text-sm font-medium text-[#0F172A]">
              Spend less time managing the business and more time shooting.
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-5xl lg:mt-16">
            <HeroProductVizLazy />
          </div>
        </div>
        <div
          className="pointer-events-none h-10 bg-gradient-to-b from-transparent to-white"
          aria-hidden
        />
      </section>

      {/* Consolidation strip */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <h2 className="text-center text-sm font-semibold uppercase tracking-[0.16em] text-[#64748B]">
            ONE PORTAL INSTEAD OF
          </h2>
          <ConsolidationPills items={[...REPLACES]} />
          <p className="mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-[#475569]">
            Your clients, projects, schedule, media, messages, invoices, and payments all stay
            connected to the same job.
          </p>
        </div>
      </section>

      {/* Product tour */}
      <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <ProductDemo />
        </div>
      </section>

      {/* Workflow */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <SectionEyebrow>ONE SIMPLE WORKFLOW</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            The path every job follows.
          </h2>
          <p className="mt-3 max-w-2xl text-base text-[#475569]">
            From the first request to final delivery and payment, every step stays connected to the
            same project.
          </p>
          <div className="mt-10">
            <HomepageWorkflowMarquee />
          </div>
          <div className="mt-8">
            <Link
              href="/how-it-works"
              className="text-sm font-semibold text-[#4F46E5] hover:underline"
            >
              See the full workflow
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <SectionEyebrow>BUILT FOR THE WAY YOU WORK</SectionEyebrow>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
            What ShootPortal actually does for your business.
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-[#475569]">
            The tools you need to handle the work around the shoot, without building your own system
            out of five different apps.
          </p>
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f) => {
              const Icon = f.icon;
              return (
                <div
                  key={f.title}
                  className="group rounded-xl border border-[#E2E8F0] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#C7D2FE] hover:bg-[#FAFBFF] hover:shadow-md"
                >
                  <Icon
                    className="h-5 w-5 text-[#4F46E5] transition group-hover:scale-110"
                    aria-hidden
                  />
                  <h3 className="mt-3 text-sm font-semibold text-[#0F172A]">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#475569]">{f.body}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pain */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="grid gap-10 lg:grid-cols-2 lg:items-center lg:gap-12">
            <div>
              <SectionEyebrow>LESS ADMIN. MORE SHOOTING.</SectionEyebrow>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
                Your business should not feel held together with duct tape.
              </h2>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                A lot of media businesses start with texts, Google Calendar, Dropbox, Stripe,
                spreadsheets, and whatever else gets the job done. That works until the business gets
                busy.
              </p>
              <p className="mt-4 text-base leading-relaxed text-[#475569]">
                ShootPortal gives you one system for the entire job so you spend less time searching
                for information, following up on payments, sending links, and trying to remember what
                happens next.
              </p>
              <ul className="mt-8 space-y-3">
                {PAIN_POINTS.map((point) => (
                  <li key={point} className="flex gap-3 text-base text-[#0F172A]">
                    <span
                      className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#4F46E5]"
                      aria-hidden
                    />
                    {point}
                  </li>
                ))}
              </ul>
              <p className="mt-8 text-lg font-semibold text-[#0F172A]">Shoot more. Manage less.</p>
            </div>
            <HomePainConverge />
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="border-b border-[#E2E8F0] bg-[#0F172A]">
        <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6 lg:px-8">
          <p className="text-center text-sm font-semibold uppercase tracking-[0.18em] text-[#818CF8]">
            BUILT FOR WORKING MEDIA PROFESSIONALS
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl text-center text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            A better experience for you and your clients.
          </h2>
          <div className="mx-auto mt-8 grid max-w-4xl gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-center">
            <div>
              <blockquote className="text-center text-lg leading-relaxed text-slate-200 lg:text-left">
                &ldquo;I want clients to feel like they are working with a real company, even when I
                am running the entire business myself. ShootPortal gives me one place to keep the job
                organized from the first request through delivery and payment.&rdquo;
              </blockquote>
              <p className="mt-6 text-center text-sm font-medium text-slate-400 lg:text-left">
                Real estate media professional
              </p>
            </div>
            <HomeSocialProgression />
          </div>
        </div>
      </section>

      {/* Pre-pricing collapse */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:px-8">
          <HomeStackCollapse priceLabel={annualPriceLabel} />
        </div>
      </section>

      {/* Pricing */}
      <section className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-2xl text-center">
            <SectionEyebrow>SIMPLE PRICING</SectionEyebrow>
            <h2 className="mt-3 text-3xl font-semibold tracking-tight text-[#0F172A] sm:text-4xl">
              Everything you need to run the business. Starting at {annualPriceLabel} a month.
            </h2>
            <p className="mt-3 text-base leading-relaxed text-[#475569]">
              One plan with the full ShootPortal experience. Manage clients, projects, scheduling,
              media delivery, invoices, and payments without paying for a stack of separate tools.
            </p>
            <ul
              className="mx-auto mt-6 max-w-xl space-y-2 text-left text-sm text-[#475569] sm:text-center sm:space-y-1"
              aria-label="Studio plan highlights"
            >
              <li>One plan with the full feature set</li>
              <li>{monthlyPriceLabel} per month billed monthly</li>
              {studioPlan?.price_annual_cents != null ? (
                <li>{annualPriceLabel} per month billed annually</li>
              ) : null}
              {annualSavingsLongLabel ? <li>{annualSavingsLongLabel}</li> : null}
              {trialDays > 0 ? (
                <li>
                  {trialDays} day free trial. No credit card required. Cancel anytime.
                </li>
              ) : (
                <li>Cancel anytime</li>
              )}
            </ul>
          </div>
          <div className="mt-10">
            <MarketingHomePricing plan={studioPlan ?? null} trialDays={trialDays} />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-b border-[#E2E8F0] bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8 lg:py-20">
          <h2 className="text-center text-3xl font-semibold tracking-tight text-[#0F172A]">
            Straight answers.
          </h2>
          <div className="mt-10">
            <MarketingFaq
              trialDaysLabel={trialDaysLabel}
              monthlyPriceLabel={monthlyPriceLabel}
              annualPriceLabel={annualPriceLabel}
              annualSavingsLabel={annualSavingsLabel}
            />
          </div>
        </div>
      </section>

      <MarketingCtaBand
        title="Put your next shoot in one portal."
        body="Start with your next job. Keep the client, schedule, messages, media, invoice, and payment together from beginning to end."
        trialLabel={finalTrialNote}
        secondaryHref="#product-demo"
        secondaryLabel="See how it works"
      />
    </MarketingShell>
  );
}
