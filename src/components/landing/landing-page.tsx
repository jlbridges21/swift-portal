import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LANDING } from "@/lib/landing-assets";
import {
  Camera,
  Video,
  Globe,
  CreditCard,
  Calendar,
  FileDown,
  MessageSquare,
  CheckCircle2,
  ArrowRight,
  Play,
  Home,
} from "lucide-react";

const SWIFT_LOGO =
  "https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a42b49721adde19f4c00193.png";

const STEP_CARD_WIDTH = 480;

const STEPS = [
  {
    step: "01",
    title: "Request your shoot",
    description: "Submit your property details, service type, and preferred timing in minutes.",
    image: LANDING.screenshots.request,
    alt: "Swift Portal request form",
  },
  {
    step: "02",
    title: "See a preliminary estimate",
    description: "Get a fast ballpark estimate before final details are confirmed.",
    image: LANDING.screenshots.quote,
    alt: "Quote and estimate screen",
  },
  {
    step: "03",
    title: "Track your project",
    description: "Follow scheduling, shoot progress, and deliverables in one organized dashboard.",
    image: LANDING.screenshots.dashboard,
    alt: "Client command center",
  },
  {
    step: "04",
    title: "Pay and download",
    description: "Preview deliverables, complete secure payment, and access final media.",
    image: LANDING.screenshots.review,
    alt: "Review deliverables screen",
  },
];

const FEATURES = [
  { icon: MessageSquare, title: "Project requests", description: "Submit new shoots without email back-and-forth." },
  { icon: FileDown, title: "Instant estimates", description: "See preliminary pricing before the project is confirmed." },
  { icon: Calendar, title: "Scheduling", description: "Coordinate shoot dates with a clear workflow." },
  { icon: Camera, title: "Photo delivery", description: "Access polished photo galleries after delivery." },
  { icon: Video, title: "Video previews", description: "Review aerial videos directly inside your project." },
  { icon: Globe, title: "360° tours", description: "Access virtual tours and links in one place." },
  { icon: CreditCard, title: "Secure payments", description: "Pay invoices through Stripe with instant confirmation." },
  { icon: CheckCircle2, title: "Project history", description: "Keep every project, update, and deliverable organized." },
];

const PORTAL_SHOWCASE = [
  { title: "Request form", image: LANDING.screenshots.request },
  { title: "Estimate & scheduling", image: LANDING.screenshots.quote },
  { title: "Property microsite", image: LANDING.screenshots.microsite },
];

const MEDIA_USES = [
  {
    title: "Real estate listings",
    image: LANDING.luxuryHome,
    description: "Cinematic aerial photography and video that elevates listings and shows property context.",
  },
  {
    title: "Golf courses",
    image: LANDING.golfCourse,
    description: "Course flyovers, clubhouse media, and marketing visuals for clubs and resorts.",
  },
  {
    title: "Construction progress",
    image: LANDING.construction,
    description: "Recurring aerial progress media for builders, developers, and project teams.",
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
        Get Instant Estimate <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  );
}

function Logo({ className = "h-8 w-auto" }: { className?: string }) {
  return (
    <a
      href="https://swiftaerialmedia.com"
      aria-label="Go to Swift Aerial Media website"
      className="inline-flex items-center"
    >
      <Image
        src={SWIFT_LOGO}
        alt="Swift Aerial Media"
        width={180}
        height={52}
        className={className}
        priority
      />
    </a>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-[#334155]">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0F172A]/90 backdrop-blur-xl safe-area-top safe-area-x">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />

          <nav className="flex items-center gap-2 sm:gap-3">
            <a
              href="https://swiftaerialmedia.com"
              className="hidden items-center gap-1 text-sm font-medium text-slate-300 transition hover:text-white sm:flex"
            >
              <Home className="h-4 w-4" />
              Main Website
            </a>

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
        <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-[#0F172A]">
          <div className="absolute inset-0">
            <iframe
              src={`https://www.youtube.com/embed/${LANDING.heroVideoId}?autoplay=1&mute=1&controls=0&loop=1&playlist=${LANDING.heroVideoId}&showinfo=0&rel=0&modestbranding=1&playsinline=1`}
              title="Swift Aerial Media showreel"
              className="pointer-events-none absolute inset-0 h-full w-full scale-[1.4] opacity-40"
              allow="autoplay; encrypted-media"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A]/80 via-[#0F172A]/70 to-[#0F172A]" />
          </div>

          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8 lg:py-32">
            <div className="max-w-3xl">
              <p className="mb-6 text-sm font-medium uppercase tracking-[0.2em] text-blue-300">
                Swift Aerial Media Client Portal
              </p>

              <h1 className="text-4xl font-bold leading-[1.1] tracking-tight text-white sm:text-5xl lg:text-6xl">
                Request. Estimate. Track. Download.
                <span className="mt-2 block text-blue-400">All in one premium portal.</span>
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-relaxed text-slate-300 sm:text-xl">
                Start a drone photo, video, or virtual tour project in minutes. Get a preliminary estimate,
                manage project progress, download final media, and pay securely without digging through emails.
              </p>

              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <RequestShootButton size="lg" className="w-full sm:w-auto" />

                <Link href="/login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="w-full border-white/25 bg-white/5 px-8 text-base text-white hover:bg-white/15 sm:w-auto"
                  >
                    Client Login
                  </Button>
                </Link>
              </div>
            </div>

            <div className="mt-16 hidden lg:block">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-2 text-sm text-slate-300">
                <Play className="h-4 w-4 text-blue-400" />
                Built for real estate, golf courses, construction, land, and commercial properties
              </div>
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#F8FAFC] py-24 sm:py-32">
          <div className="mx-auto mb-12 max-w-7xl px-4 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold uppercase tracking-widest text-[#3B82F6]">
              How it works
            </p>
            <h2 className="mt-3 max-w-xl text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
              From first request to final download
            </h2>
            <p className="mt-4 hidden text-[#64748B] sm:block">Scroll to explore each step →</p>
          </div>

          <div className="flex snap-x snap-mandatory items-start gap-8 overflow-x-auto pb-6 pl-[max(1rem,calc(50vw-240px))] pr-[max(1rem,calc(50vw-240px))] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {STEPS.map((item) => (
              <article
                key={item.step}
                className="flex shrink-0 snap-center flex-col"
                style={{ width: STEP_CARD_WIDTH, maxWidth: "88vw" }}
              >
                <div className="mb-6 px-1">
                  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[#3B82F6]">
                    Step {item.step}
                  </span>
                  <h3 className="mt-2 text-xl font-semibold tracking-tight text-[#0F172A] sm:text-2xl">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B] sm:text-base">
                    {item.description}
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-2 shadow-xl shadow-slate-200/60 ring-1 ring-black/[0.04] sm:p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image}
                    alt={item.alt}
                    width={STEP_CARD_WIDTH}
                    className="h-auto w-full rounded-2xl"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                Everything in one place
              </h2>
              <p className="mt-4 text-lg text-[#64748B]">
                A complete client experience, not a folder of random links.
              </p>
            </div>

            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURES.map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-slate-100 bg-[#F8FAFC] p-6 transition-all hover:-translate-y-0.5 hover:border-blue-100 hover:shadow-lg hover:shadow-blue-500/5"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#3B82F6]/10 transition-colors group-hover:bg-[#3B82F6]/15">
                    <feature.icon className="h-5 w-5 text-[#3B82F6]" />
                  </div>
                  <h3 className="mt-4 font-semibold text-[#0F172A]">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="overflow-hidden bg-[#0F172A] py-24 sm:py-32">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-3xl text-center">
              <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
                Inside the portal
              </p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Request, schedule, estimate, review, and pay
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-slate-400">
                Submit project details, review preliminary pricing, track progress, preview deliverables,
                and complete payment from a single organized portal.
              </p>
            </div>

            <div className="flex snap-x snap-mandatory gap-6 overflow-x-auto pb-4 pl-[max(1rem,calc(50vw-210px))] pr-[max(1rem,calc(50vw-210px))]">
              {PORTAL_SHOWCASE.map((item, i) => (
                <div
                  key={item.title}
                  className="w-[85vw] shrink-0 snap-center sm:w-[420px] lg:w-[480px]"
                  style={{ transform: `rotate(${i % 2 === 0 ? -1 : 1}deg)` }}
                >
                  <div className="overflow-hidden rounded-2xl bg-slate-800 shadow-2xl ring-1 ring-white/10">
                    <div className="border-b border-white/10 px-4 py-3">
                      <p className="text-sm font-medium text-white">{item.title}</p>
                    </div>
                    <Image
                      src={item.image}
                      alt={item.title}
                      width={960}
                      height={600}
                      className="h-auto w-full"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-3xl font-bold tracking-tight text-[#0F172A] sm:text-4xl">
                Built for properties that need to stand out
              </h2>
              <p className="mt-4 text-lg text-[#64748B]">
                Swift Portal supports every type of aerial project Swift Aerial Media delivers.
              </p>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
              {MEDIA_USES.map((item) => (
                <div
                  key={item.title}
                  className="group overflow-hidden rounded-2xl bg-white shadow-lg shadow-slate-200/50 ring-1 ring-black/5"
                >
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
                    <p className="mt-2 text-sm leading-relaxed text-[#64748B]">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-y border-slate-100 bg-white py-24">
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
                <h2 className="text-3xl font-bold tracking-tight text-[#0F172A]">
                  Built to make working with Swift Aerial Media effortless
                </h2>
                <p className="mt-4 max-w-2xl text-lg leading-relaxed text-[#64748B]">
                  Swift Portal keeps requests, estimates, project updates, deliverables, and payments
                  organized in one beautiful place, so you spend less time chasing files and more time
                  using your media.
                </p>

                <ul className="mt-8 grid gap-3 text-sm text-[#334155] sm:grid-cols-2">
                  {[
                    "Direct communication",
                    "Organized project flow",
                    "Professional media delivery",
                    "Secure Stripe payments",
                    "Easy access to past projects",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-[#3B82F6]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-gradient-to-br from-[#0F172A] to-slate-900 py-24 sm:py-32">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <Logo className="mx-auto mb-8 h-12 w-auto opacity-95" />

            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
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
                  className="w-full border-white/25 bg-transparent px-8 text-white hover:bg-white/10 sm:w-auto"
                >
                  Client Login
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

            <footer className="border-t border-slate-200 bg-white py-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-4 sm:flex-row sm:justify-between sm:px-6 lg:px-8">
          <a
            href="https://swiftaerialmedia.com"
            aria-label="Go to Swift Aerial Media website"
            className="inline-flex items-center"
          >
            <Image
              src="https://assets.cdn.filesafe.space/6wSSuNQZ67Uqdlfzvz8B/media/6a42ade13a7f0c54688aaa09.png"
              alt="Swift Aerial Media"
              width={180}
              height={52}
              className="h-8 w-auto opacity-90"
            />
          </a>

          <div className="flex flex-col items-center gap-2 text-center sm:items-end sm:text-right">
            <p className="text-sm text-[#64748B]">
              © {new Date().getFullYear()} Swift Aerial Media. All rights reserved.
            </p>
            <a
              href="https://swiftaerialmedia.com"
              className="text-sm font-medium text-[#3B82F6] hover:text-[#0F172A]"
            >
              Back to main website →
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}