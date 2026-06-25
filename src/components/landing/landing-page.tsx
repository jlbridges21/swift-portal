import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LANDING } from "@/lib/landing-assets";
import {
  Camera, Video, Globe, CreditCard, Calendar, FileDown,
  MessageSquare, CheckCircle2, ArrowRight, Play,
} from "lucide-react";

const STEP_CARD_WIDTH = 480; // 75% of prior 640px — full screenshot, text above image

const STEPS = [
  {
    step: "01",
    title: "Request your shoot",
    description: "Submit your property details and preferred dates in minutes.",
    image: LANDING.screenshots.request,
    alt: "Swift Portal request form",
  },
  {
    step: "02",
    title: "Review your proposal",
    description: "Approve proposals, request changes, and move forward with confidence.",
    image: LANDING.screenshots.quote,
    alt: "Quote and proposal screen",
  },
  {
    step: "03",
    title: "Track your project",
    description: "Follow scheduling, shoot progress, and deliverables in one place.",
    image: LANDING.screenshots.dashboard,
    alt: "Client command center",
  },
  {
    step: "04",
    title: "Approve, pay, and download",
    description: "Preview deliverables, complete secure payment, and access final media.",
    image: LANDING.screenshots.review,
    alt: "Review deliverables screen",
  },
];

const FEATURES = [
  { icon: MessageSquare, title: "Project requests", description: "Submit shoots without email back-and-forth." },
  { icon: FileDown, title: "Quotes & proposals", description: "Review, approve, and request revisions in portal." },
  { icon: Calendar, title: "Scheduling", description: "Confirm shoot dates with a clear workflow." },
  { icon: Camera, title: "Photo previews", description: "Beautiful galleries before final delivery." },
  { icon: Video, title: "Video previews", description: "Stream aerial video directly in your project." },
  { icon: Globe, title: "360° tours", description: "Immersive virtual tours embedded in one place." },
  { icon: CreditCard, title: "Secure payments", description: "Pay invoices through Stripe with instant confirmation." },
  { icon: CheckCircle2, title: "Project activity", description: "A complete timeline of every project update." },
];

const PORTAL_SHOWCASE = [
  { title: "Request form", image: LANDING.screenshots.request },
  { title: "Quote & proposal", image: LANDING.screenshots.quote },
  { title: "Property microsite", image: LANDING.screenshots.microsite },
];

const MEDIA_USES = [
  {
    title: "Real estate listings",
    image: LANDING.luxuryHome,
    description: "Cinematic aerial photography and video that elevates luxury listings.",
  },
  {
    title: "Golf courses",
    image: LANDING.golfCourse,
    description: "Stunning course coverage for marketing and member communications.",
  },
  {
    title: "Construction progress",
    image: LANDING.construction,
    description: "Document milestones with consistent aerial progress media.",
  },
];

function RequestShootButton({
  size = "default",
  className = "",
}: {
  size?: "default" | "lg";
  className?: string;
}) {
  return (
    <Link href="/request">
      <Button
        variant="accent"
        size={size}
        className={`${size === "lg" ? "px-8 text-base" : ""} ${className}`}
      >
        Request a Shoot <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#334155]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src={LANDING.logoWhite}
              alt="Swift Portal"
              width={140}
              height={36}
              className="h-8 w-auto"
              priority
            />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-3">
            <Link href="/request">
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/10 hover:text-white">
                Request a Shoot
              </Button>
            </Link>
            <Link href="/login">
              <Button variant="accent" size="sm">Client Login</Button>
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative min-h-[92vh] flex items-center overflow-hidden bg-[#0F172A]">
          <div className="absolute inset-0">
            <iframe
              src={`https://www.youtube.com/embed/${LANDING.heroVideoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${LANDING.heroVideoId}&showinfo=0&rel=0&modestbranding=1`}
              title="Swift Aerial Media showreel"
              className="absolute inset-0 h-full w-full scale-[1.4] pointer-events-none opacity-40"
              allow="autoplay; encrypted-media"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/80 via-[#0F172A]/70 to-[#0F172A]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="max-w-3xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-300 mb-6">
                Built exclusively for Swift Aerial Media clients
              </p>
              <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl leading-[1.1]">
                Request. Review. Pay. Download.
                <span className="block text-blue-400 mt-2">All in one premium portal.</span>
              </h1>
              <p className="mt-6 text-lg sm:text-xl text-slate-300 leading-relaxed max-w-2xl">
                Swift Portal gives every client a private place to request aerial media, review quotes,
                track project progress, approve deliverables, pay securely, and access final media without
                digging through emails or file links.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <RequestShootButton size="lg" className="w-full sm:w-auto" />
                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full sm:w-auto border-white/25 bg-white/5 text-white hover:bg-white/15 text-base px-8"
                  >
                    Client Login
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-16 hidden lg:block">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300">
                <Play className="h-4 w-4 text-blue-400" />
                Cinematic aerial media — organized beautifully
              </div>
            </div>
          </div>
        </section>

        {/* How it works — horizontal scroll */}
        <section className="py-24 sm:py-32 overflow-hidden bg-[#F8FAFC]">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 mb-12">
            <div>
              <p className="text-sm font-semibold uppercase tracking-widest text-[#3B82F6]">How it works</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight max-w-xl">
                From first request to final download
              </h2>
              <p className="mt-4 text-[#64748B] hidden sm:block">Scroll to explore each step →</p>
            </div>
          </div>

          <div
            className="flex items-start gap-8 overflow-x-auto pb-6 snap-x snap-mandatory scrollbar-hide [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pl-[max(1rem,calc(50vw-240px))] pr-[max(1rem,calc(50vw-240px))]"
          >
            {STEPS.map((item) => (
              <article
                key={item.step}
                className="snap-center shrink-0 flex flex-col"
                style={{ width: STEP_CARD_WIDTH, maxWidth: "88vw" }}
              >
                <div className="px-1 mb-6">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3B82F6]">
                    Step {item.step}
                  </span>
                  <h3 className="mt-2 text-xl sm:text-2xl font-semibold text-[#0F172A] tracking-tight">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm sm:text-base text-[#64748B] leading-relaxed">
                    {item.description}
                  </p>
                </div>
                <div className="rounded-3xl bg-white p-2 sm:p-3 shadow-xl shadow-slate-200/60 ring-1 ring-black/[0.04]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.alt}
                    width={STEP_CARD_WIDTH}
                    className="w-full h-auto rounded-2xl"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Everything in one place */}
        <section className="py-24 bg-white">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
                Everything in one place
              </h2>
              <p className="mt-4 text-lg text-[#64748B]">
                A complete client experience — not a folder of random links.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-slate-100 bg-[#F8FAFC] p-6 transition-all hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5 hover:border-blue-100"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B82F6]/10 transition-colors group-hover:bg-[#3B82F6]/15">
                    <feature.icon className="h-5 w-5 text-[#3B82F6]" />
                  </div>
                  <h3 className="mt-4 font-semibold text-[#0F172A]">{feature.title}</h3>
                  <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Portal preview */}
        <section className="py-24 sm:py-32 bg-[#0F172A] overflow-hidden">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">Inside the portal</p>
              <h2 className="mt-3 text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Request, schedule, quote, review, and pay — all in one place
              </h2>
              <p className="mt-4 text-lg text-slate-400 leading-relaxed">
                No more scattered emails or file links. Submit a shoot request, confirm your schedule,
                review proposals, preview deliverables, and complete payment from a single organized portal.
              </p>
            </div>

            <div className="flex gap-6 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide pl-[max(1rem,calc(50vw-210px))] pr-[max(1rem,calc(50vw-210px))]">
              {PORTAL_SHOWCASE.map((item, i) => (
                <div
                  key={item.title}
                  className="snap-center shrink-0 w-[85vw] sm:w-[420px] lg:w-[480px]"
                  style={{ transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)` }}
                >
                  <div className="rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10 bg-slate-800">
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                    </div>
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={960}
                      height={600}
                      className="w-full h-auto"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Media quality */}
        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-2xl mx-auto mb-16">
              <h2 className="text-3xl sm:text-4xl font-bold text-[#0F172A] tracking-tight">
                Built for properties that demand the best
              </h2>
              <p className="mt-4 text-lg text-[#64748B]">
                Swift Portal supports every type of aerial project Swift Aerial Media delivers.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {MEDIA_USES.map((item) => (
                <div key={item.title} className="group overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-black/5">
                  <div className="relative aspect-[4/3] overflow-hidden">
                    <Image
                      src={item.image}
                      alt={item.title}
                      fill
                      className="object-cover transition-transform duration-700 group-hover:scale-105"
                      sizes="(max-width: 1024px) 100vw, 33vw"
                    />
                  </div>
                  <div className="p-6">
                    <h3 className="text-lg font-semibold text-[#0F172A]">{item.title}</h3>
                    <p className="mt-2 text-sm text-[#64748B] leading-relaxed">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Owner / trust */}
        <section className="py-24 bg-white border-y border-slate-100">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid items-center gap-12 lg:grid-cols-[280px_1fr]">
              <div className="mx-auto lg:mx-0">
                <div className="relative h-56 w-56 overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/5">
                  <Image
                    src={LANDING.ownerHeadshot}
                    alt="Swift Aerial Media"
                    fill
                    className="object-cover"
                    sizes="224px"
                  />
                </div>
              </div>
              <div>
                <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight">
                  Built to make working with Swift Aerial Media effortless
                </h2>
                <p className="mt-4 text-lg text-[#64748B] leading-relaxed max-w-2xl">
                  Swift Portal keeps every conversation, deliverable, schedule update, and payment organized
                  in one beautiful place — so you spend less time chasing files and more time closing deals.
                </p>
                <ul className="mt-8 grid gap-3 sm:grid-cols-2 text-sm text-[#334155]">
                  {["Direct communication", "Organized process", "Professional delivery", "Secure payments", "Easy media access"].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-[#3B82F6] shrink-0" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="py-24 sm:py-32 bg-gradient-to-br from-[#0F172A] to-slate-900">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Image
              src={LANDING.logoStackedWhite}
              alt="Swift Aerial Media"
              width={160}
              height={48}
              className="mx-auto h-10 w-auto mb-8 opacity-90"
            />
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              Ready to request your next shoot?
            </h2>
            <p className="mt-4 text-lg text-slate-300">
              Start your project in minutes and manage everything through Swift Portal.
            </p>
            <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center">
              <RequestShootButton size="lg" />
              <Link href="/login">
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full sm:w-auto border-white/25 bg-transparent text-white hover:bg-white/10 px-8"
                >
                  Client Login
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <Image src={LANDING.logoNavy} alt="Swift Aerial Media" width={120} height={32} className="h-7 w-auto opacity-80" />
          <p className="text-sm text-[#64748B]">© {new Date().getFullYear()} Swift Aerial Media. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
