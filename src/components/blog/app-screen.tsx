import Image from "next/image";
import type { ReactNode } from "react";
import {
  Brush,
  CalendarClock,
  ClipboardList,
  CreditCard,
  FileText,
  Globe,
  Home,
  Megaphone,
  MessageSquareText,
  Monitor,
  PackageCheck,
  Smartphone,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Real ShootPortal screens for blog articles, served from public/blog/screens/.
 * Desktop captures are 1920x1200 (16:10) except the Marketing Kit captures (1920x1080).
 * Screens show demo businesses with sample clients and fictional addresses.
 */

type Desktop = { kind: "desktop"; url: string; alt: string; w: number; h: number; side: "business" | "client" | "public" };
type Phone = { kind: "phone"; alt: string; side: "business" | "client" | "public"; w?: number; h?: number; file?: string };

const SCREENS = {
  "video-review": {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/projects",
    alt: "ShootPortal video review: a listing film on version 2 with time-stamped client comments, replies, and Resolve buttons",
    w: 1920,
    h: 1200,
  },
  payments: {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/projects",
    alt: "ShootPortal project payments tab showing total billed, paid, outstanding balance, deposit and balance payments",
    w: 1920,
    h: 1200,
  },
  proposals: {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/projects",
    alt: "ShootPortal Estimates and Proposals tab with a luxury listing package proposal awaiting client approval",
    w: 1920,
    h: 1200,
  },
  "project-media": {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/projects",
    alt: "ShootPortal project page with the listing photos organized on the Media tab",
    w: 1920,
    h: 1200,
  },
  "project-scheduled": {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/projects",
    alt: "ShootPortal project page for a scheduled listing shoot with services, status, and client details",
    w: 1920,
    h: 1200,
  },
  "website-editor": {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/sites",
    alt: "ShootPortal Sites editor for a business website with template, logo, and accent color beside a live preview",
    w: 1920,
    h: 1200,
  },
  automation: {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/settings",
    alt: "ShootPortal Workflow Automation settings for payments, proposals, scheduling, deliverables, and reminders",
    w: 1920,
    h: 1200,
  },
  "automated-emails": {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/settings",
    alt: "ShootPortal Automated Emails settings listing the branded emails sent to clients at each project step",
    w: 1920,
    h: 1200,
  },
  branding: {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/settings",
    alt: "ShootPortal Branding and Colors settings with logo upload, brand colors, and a live preview",
    w: 1920,
    h: 1200,
  },
  services: {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/settings",
    alt: "ShootPortal services catalog with photography, aerial, video, and twilight services and their starting prices",
    w: 1920,
    h: 1200,
  },
  "payment-settings": {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/settings",
    alt: "ShootPortal payment settings with Stripe connected for card payments",
    w: 1920,
    h: 1200,
  },
  "photo-editor": {
    kind: "desktop",
    side: "business",
    url: "coastallight.shootportal.app/admin/photo-editor",
    alt: "ShootPortal built-in photo editor adjusting exposure, highlights, and shadows on an interior listing photo",
    w: 1920,
    h: 1200,
  },
  "marketing-kit-tab": {
    kind: "desktop",
    side: "business",
    url: "yourstudio.shootportal.app/admin/projects",
    alt: "ShootPortal project Marketing Kit tab offering a Property Website and Social Media Kit to the client, with prices",
    w: 1920,
    h: 1080,
  },
  "property-website-editor": {
    kind: "desktop",
    side: "business",
    url: "yourstudio.shootportal.app/admin/projects/marketing",
    alt: "ShootPortal property website editor with Modern, Luxury, and Coastal designs and a live listing preview",
    w: 1920,
    h: 1080,
  },
  "social-kit": {
    kind: "desktop",
    side: "business",
    url: "yourstudio.shootportal.app/admin/projects/marketing",
    alt: "ShootPortal Social Media Kit with a Just Listed post generated from the listing photos, ready to download",
    w: 1920,
    h: 1080,
  },
  "listing-flyer": {
    kind: "desktop",
    side: "business",
    url: "yourstudio.shootportal.app/admin/projects/marketing",
    alt: "ShootPortal print-ready property flyer with listing photos, price, details, and the agent's contact card",
    w: 1920,
    h: 1080,
  },
  "property-website": {
    kind: "desktop",
    side: "public",
    url: "listings.yourstudio.com/1420-magnolia-lane",
    alt: "A single-property listing website built by ShootPortal with the hero photo, price, and home details",
    w: 1920,
    h: 1080,
  },
  "business-website": {
    kind: "desktop",
    side: "public",
    url: "coastallight.shootportal.app",
    alt: "A real estate media business website built in ShootPortal with a Book a Shoot button",
    w: 1920,
    h: 1200,
  },
  "request-form": {
    kind: "desktop",
    side: "public",
    url: "coastallight.shootportal.app/request",
    alt: "A branded Book a Shoot request form where clients enter contact details, property, and services",
    w: 1920,
    h: 1200,
  },
  "portal-pay": {
    kind: "desktop",
    side: "client",
    url: "coastallight.shootportal.app/dashboard/projects",
    alt: "Client portal: media is ready, with a Pay Now button and deliverables to approve",
    w: 1920,
    h: 1200,
  },
  "portal-proposal": {
    kind: "desktop",
    side: "client",
    url: "coastallight.shootportal.app/dashboard/projects",
    alt: "Client portal: an official proposal with line items, deposit terms, and an Approve Proposal button",
    w: 1920,
    h: 1200,
  },
  "portal-estimate": {
    kind: "desktop",
    side: "client",
    url: "coastallight.shootportal.app/dashboard/projects",
    alt: "Client portal: an instant preliminary estimate shown right after the client requests a shoot",
    w: 1920,
    h: 1200,
  },
  "portal-shoot-time": {
    kind: "desktop",
    side: "client",
    url: "coastallight.shootportal.app/dashboard/projects",
    alt: "Client portal: a proposed shoot time with Approve Time and Request a Different Time buttons",
    w: 1920,
    h: 1200,
  },
  "portal-gallery": {
    kind: "desktop",
    side: "client",
    url: "coastallight.shootportal.app/dashboard/projects",
    alt: "Client portal: the finished listing photo gallery",
    w: 1920,
    h: 1200,
  },
  "phone-video-review": {
    kind: "phone",
    side: "client",
    alt: "The client's video review on a phone: version 2 of a listing film with Add mark and a box to describe the change",
    w: 780,
    h: 1310,
    file: "phone-client-video-review",
  },
  "phone-portal-pay": { kind: "phone", side: "client", alt: "Client portal on a phone: media ready with a Pay Now button" },
  "phone-portal-finished": { kind: "phone", side: "client", alt: "Client portal on a phone: a finished project with Download All" },
  "phone-request-form": { kind: "phone", side: "public", alt: "The branded Book a Shoot form on a phone" },
  "phone-property-website": { kind: "phone", side: "public", alt: "A ShootPortal property website on a phone" },
} satisfies Record<string, Desktop | Phone>;

export type AppScreenView = { [K in keyof typeof SCREENS]: (typeof SCREENS)[K] extends { kind: "desktop" } ? K : never }[keyof typeof SCREENS];
export type PhoneScreenView = { [K in keyof typeof SCREENS]: (typeof SCREENS)[K] extends { kind: "phone" } ? K : never }[keyof typeof SCREENS];

const SIDE_LABEL = { business: "What you see", client: "What your client sees", public: "What the public sees" } as const;

/** A real ShootPortal screen in a browser frame. */
export function AppScreen({ view, alt, sizes = "(min-width: 1024px) 760px, 100vw" }: { view: AppScreenView; alt?: string; sizes?: string }) {
  const v = SCREENS[view] as Desktop;
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-[0_30px_70px_-50px_rgba(15,23,42,0.7)]">
      <div className="flex items-center gap-2 border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-2.5" aria-hidden>
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-2.5 w-2.5 rounded-full bg-[#CBD5E1]" />
        ))}
        <span className="ml-3 truncate rounded-md bg-white px-3 py-1 text-xs text-[#64748B] ring-1 ring-[#E2E8F0]">{v.url}</span>
      </div>
      <Image
        src={`/blog/screens/${view}.webp`}
        alt={alt ?? v.alt}
        width={v.w}
        height={v.h}
        sizes={sizes}
        quality={90}
        className="block h-auto w-full"
      />
    </div>
  );
}

/** A real ShootPortal screen on a phone. */
export function PhoneScreen({ view, alt, className }: { view: PhoneScreenView; alt?: string; className?: string }) {
  const v = SCREENS[view] as Phone;
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[240px] overflow-hidden rounded-[2rem] border-[6px] border-[#0F172A] bg-[#0F172A] shadow-[0_30px_60px_-30px_rgba(15,23,42,0.8)]",
        className
      )}
    >
      <Image
        src={`/blog/screens/${v.file ?? view}.webp`}
        alt={alt ?? v.alt}
        width={v.w ?? 780}
        height={v.h ?? 1688}
        sizes="240px"
        quality={90}
        className="block h-auto w-full rounded-[1.6rem]"
      />
    </div>
  );
}

/**
 * Two-sided view: the business screen and the matching client (or public) screen, labelled
 * so readers see both halves of the experience.
 */
export function TwoSidedScreens({
  business,
  client,
  businessLabel = SIDE_LABEL.business,
  clientLabel,
}: {
  business: AppScreenView;
  client: AppScreenView | PhoneScreenView;
  businessLabel?: string;
  clientLabel?: string;
}) {
  const c = SCREENS[client];
  const label = clientLabel ?? SIDE_LABEL[c.side];
  return (
    <div className={cn("grid items-center gap-5", c.kind === "phone" && "sm:grid-cols-[minmax(0,1fr)_190px]")}>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#4F46E5]">
          <Monitor className="h-3.5 w-3.5" aria-hidden /> {businessLabel}
        </p>
        <AppScreen view={business} />
      </div>
      <div>
        <p className="mb-2 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#0F766E]">
          <Smartphone className="h-3.5 w-3.5" aria-hidden /> {label}
        </p>
        {c.kind === "phone" ? <PhoneScreen view={client as PhoneScreenView} className="max-w-[190px]" /> : <AppScreen view={client as AppScreenView} />}
      </div>
    </div>
  );
}

/** Three screens in a row (stacks on phones), e.g. Posts / Flyer / Website. */
export function ScreenTrio({ views }: { views: [AppScreenView, AppScreenView, AppScreenView] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {views.map((v) => (
        <AppScreen key={v} view={v} sizes="(min-width: 640px) 260px, 100vw" />
      ))}
    </div>
  );
}

const PLATFORM: { icon: LucideIcon; title: string; body: string; replaces?: string }[] = [
  { icon: Globe, title: "Business website", body: "A professional website with your services, portfolio, and a Book a Shoot button, on your own domain.", replaces: "Squarespace / Wix" },
  { icon: ClipboardList, title: "Booking & requests", body: "A branded request form that creates the client, the project, and an instant estimate.", replaces: "Booking forms" },
  { icon: FileText, title: "Estimates & proposals", body: "Line-item proposals with deposits. Clients approve online in one click.", replaces: "PDF quotes" },
  { icon: CalendarClock, title: "Scheduling", body: "Propose a shoot time; the client accepts or counters. Shoots push to your Google Calendar.", replaces: "Scheduling by text" },
  { icon: Users, title: "CRM & client portal", body: "Every agent, property, message, and payment in one record, and one branded portal for each client.", replaces: "Spreadsheets / CRM" },
  { icon: Brush, title: "Photo editor", body: "One-click Auto, light, color, curves, HDR and B&W looks, saved straight back to the project.", replaces: "Editing round-trips" },
  { icon: MessageSquareText, title: "Video review", body: "Time-stamped client comments pinned to the frame, threaded replies, numbered versions, approvals.", replaces: "Dropbox Replay / Frame.io" },
  { icon: CreditCard, title: "Invoices & payments", body: "Card, wallet, or bank payments straight to your Stripe. ShootPortal takes no cut.", replaces: "Separate invoicing apps" },
  { icon: PackageCheck, title: "Delivery", body: "Branded galleries, full-size or MLS-size downloads, ZIPs, and downloads that unlock after payment.", replaces: "Dropbox / Google Drive" },
  { icon: Home, title: "Property websites", body: "A single-property listing site in Modern, Luxury, or Coastal designs, built from the photos you delivered.", replaces: "Listing site tools" },
  { icon: Megaphone, title: "Marketing kit", body: "Just Listed posts, Stories, an Instagram carousel, and print flyers. Include it, or sell it as an add-on.", replaces: "Canva templates" },
  { icon: Workflow, title: "Automation", body: "Branded emails, reminders, and stage changes that run on their own at every step.", replaces: "Manual follow-ups" },
];

/**
 * "Everything in one place" panel: every major ShootPortal tool with the separate app it
 * replaces. Only verified capabilities are listed here.
 */
export function AllInOnePlatform({
  title = "Everything your media business runs on, in one platform",
  intro,
}: {
  title?: string;
  intro?: ReactNode;
}) {
  return (
    <div className="mk-reveal !mt-10 overflow-hidden rounded-3xl border border-[#E2E8F0] bg-white">
      <div className="bg-gradient-to-r from-[#0F172A] to-[#1E1B4B] px-6 py-5">
        <p className="text-lg font-semibold tracking-tight text-white">{title}</p>
        <p className="mt-1 text-sm leading-relaxed text-slate-300">
          {intro ?? "One subscription replaces the stack of apps most real estate photographers, drone pilots, and videographers juggle."}
        </p>
      </div>
      <ul className="mk-plain-list !my-0 grid gap-px bg-[#E2E8F0] !pl-0 sm:grid-cols-2 xl:grid-cols-3">
        {PLATFORM.map((f) => {
          const Icon = f.icon;
          return (
            <li key={f.title} className="!m-0 bg-white p-5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#EEF2FF] text-[#4F46E5]">
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <p className="font-semibold text-[#0F172A]">{f.title}</p>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-[#475569]">{f.body}</p>
              {f.replaces ? (
                <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#94A3B8]">Replaces {f.replaces}</p>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
