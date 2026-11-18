/**
 * ShootPortal Academy course catalog (the owner lessons + the client guide).
 * Videos live on the ShootPortal YouTube channel; thumbnails are in /public/academy/<key>.jpg.
 * Lesson keys are stored in academy_lesson_progress (migration v130), so never rename a key.
 * Generated from Explainer_Videos_v2 (upload log, chapter files, real durations).
 */

export type AcademyModuleId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;

export type AcademyLesson = {
  key: string;
  /** URL segment: /admin/academy/<slug> */
  slug: string;
  title: string;
  description: string;
  /** 1-8 for the course; 0 for the client guide (not part of the course). */
  module: AcademyModuleId | 0;
  youtubeId: string;
  durationSeconds: number;
  /** Where "Try it now" goes. Null for the client guide. */
  tryHref: string | null;
  tryLabel: string | null;
  chapters: { t: number; title: string }[];
};

export const ACADEMY_MODULES: { id: AcademyModuleId; title: string }[] = [
  { id: 1, title: "Start here" },
  { id: 2, title: "Get set up" },
  { id: 3, title: "Clients and projects" },
  { id: 4, title: "Delivery and payments" },
  { id: 5, title: "Marketing" },
  { id: 6, title: "Communication and team" },
  { id: 7, title: "Your account" },
  { id: 8, title: "Partner program" },
];

const ALL_LESSONS: AcademyLesson[] = [
  {
    key: "V00",
    slug: "welcome-first-project",
    title: "Your first project, request to paid",
    description: "See one real estate job end to end: proposal, shoot, delivery and payment.",
    module: 1,
    youtubeId: "h9kzedeBVtA",
    durationSeconds: 168,
    tryHref: "/admin/projects/new",
    tryLabel: "Create a project",
    chapters: [
      { t: 0, title: "Your setup" },
      { t: 20, title: "Create the project" },
      { t: 48, title: "Send the proposal" },
      { t: 71, title: "Schedule the shoot" },
      { t: 80, title: "Upload media" },
      { t: 97, title: "Client feedback" },
      { t: 118, title: "Get paid" },
      { t: 145, title: "Download" },
    ],
  },
  {
    key: "V01",
    slug: "getting-started",
    title: "Set up your portal and brand",
    description: "Finish setup, then add your name, logo, colors and email sender.",
    module: 2,
    youtubeId: "hYz0PTDIM18",
    durationSeconds: 180,
    tryHref: "/admin/settings#settings-business-name",
    tryLabel: "Open Business Identity",
    chapters: [
      { t: 0, title: "Portal setup" },
      { t: 49, title: "The Command Center" },
      { t: 74, title: "Find your way around" },
      { t: 101, title: "Your name and brand" },
      { t: 143, title: "Contact info and email" },
    ],
  },
  {
    key: "V02",
    slug: "connect-your-own-domain",
    title: "Connect your own domain",
    description: "Put your client portal, listing sites and website on your own domain.",
    module: 2,
    youtubeId: "18JJmHTxD7s",
    durationSeconds: 178,
    tryHref: "/admin/settings#settings-custom-domain",
    tryLabel: "Open web address settings",
    chapters: [
      { t: 0, title: "Intro" },
      { t: 14, title: "Open two browser tabs" },
      { t: 33, title: "Client Portal (portal.yourbusiness.com)" },
      { t: 70, title: "Property Websites (listings.yourbusiness.com)" },
      { t: 102, title: "Business Website (www.yourbusiness.com)" },
    ],
  },
  {
    key: "V03",
    slug: "services-pricing-and-request-form",
    title: "Services, pricing and travel fees",
    description: "Build your service catalog so clients see a price the moment they book.",
    module: 2,
    youtubeId: "pcv9_LRaHFU",
    durationSeconds: 178,
    tryHref: "/admin/settings#settings-services",
    tryLabel: "Open Services",
    chapters: [
      { t: 0, title: "Your service catalog" },
      { t: 57, title: "Travel fees" },
      { t: 112, title: "The request form & instant estimate" },
      { t: 129, title: "What your client sees" },
    ],
  },
  {
    key: "V04",
    slug: "getting-paid-connect-stripe",
    title: "Get paid with Stripe",
    description: "Connect Stripe once. Clients pay by card or bank, straight to your bank.",
    module: 2,
    youtubeId: "6k23PgW5RkI",
    durationSeconds: 176,
    tryHref: "/admin/settings#settings-payments",
    tryLabel: "Open Payments",
    chapters: [
      { t: 0, title: "Why Stripe" },
      { t: 17, title: "Connect, step by step" },
      { t: 76, title: "Status and what it means" },
      { t: 120, title: "Bank transfers & card fee" },
    ],
  },
  {
    key: "V05",
    slug: "clients-and-portal-invites",
    title: "Clients and portal invites",
    description: "Import or add clients and invite each one to their own portal.",
    module: 3,
    youtubeId: "nZ6kK3vBQC8",
    durationSeconds: 164,
    tryHref: "/admin/clients",
    tryLabel: "Open Clients",
    chapters: [
      { t: 0, title: "The Clients page" },
      { t: 37, title: "Add a client" },
      { t: 60, title: "Invite and activation" },
      { t: 88, title: "Managing access" },
    ],
  },
  {
    key: "V06",
    slug: "projects-pipeline-next-step",
    title: "Projects and the pipeline",
    description: "Track every shoot in one pipeline. Each project tells you what is next.",
    module: 3,
    youtubeId: "-LeRB5y_ZAE",
    durationSeconds: 180,
    tryHref: "/admin/projects",
    tryLabel: "Open Projects",
    chapters: [
      { t: 0, title: "Where requests land" },
      { t: 18, title: "Create a project yourself" },
      { t: 44, title: "Move through the stages" },
      { t: 97, title: "Views & bulk actions" },
      { t: 119, title: "The next-step box" },
      { t: 154, title: "Visibility & defaults" },
    ],
  },
  {
    key: "V07",
    slug: "estimates-and-proposals",
    title: "Estimates and proposals",
    description: "Send a proposal your client approves in one click, with a deposit.",
    module: 3,
    youtubeId: "CW1_OmpoOXM",
    durationSeconds: 178,
    tryHref: "/admin/projects",
    tryLabel: "Open a project",
    chapters: [
      { t: 0, title: "Preliminary vs official" },
      { t: 58, title: "Build the proposal" },
      { t: 75, title: "Deposits" },
      { t: 91, title: "Send it" },
      { t: 109, title: "Your client approves" },
      { t: 135, title: "Changes requested" },
    ],
  },
  {
    key: "V08",
    slug: "scheduling-calendar-team",
    title: "Scheduling and the calendar",
    description: "Propose a shoot time, let your client confirm it, and sync Google Calendar.",
    module: 3,
    youtubeId: "XdDqo-t-jes",
    durationSeconds: 177,
    tryHref: "/admin/calendar",
    tryLabel: "Open the Shoot Calendar",
    chapters: [
      { t: 0, title: "Propose a time" },
      { t: 32, title: "Your client confirms" },
      { t: 87, title: "The Shoot Calendar" },
      { t: 128, title: "Google Calendar" },
      { t: 144, title: "Assign staff" },
    ],
  },
  {
    key: "V20",
    slug: "project-page-deliver-and-get-paid",
    title: "Deliver, share and get paid from the project page",
    description: "Send your client one link to view, pay and Download All, and share the project with anyone else.",
    module: 4,
    youtubeId: "FOZApNLmudY",
    durationSeconds: 235,
    tryHref: "/admin/projects",
    tryLabel: "Open a project",
    chapters: [
      { t: 0, title: "Your project page" },
      { t: 16, title: "Upload media" },
      { t: 29, title: "Proposals & payments" },
      { t: 52, title: "Send to client" },
      { t: 107, title: "Portal invites" },
      { t: 135, title: "Share with others" },
      { t: 185, title: "Downloads & Delivered" },
    ],
  },
  {
    key: "V09",
    slug: "payment-links-receipts-downloads",
    title: "Payment links and receipts",
    description: "Send a payment link and hold downloads until you are paid.",
    module: 4,
    youtubeId: "Mj6jlRgSJWk",
    durationSeconds: 180,
    tryHref: "/admin/projects",
    tryLabel: "Open a project",
    chapters: [
      { t: 0, title: "Create a payment link" },
      { t: 41, title: "What your client sees" },
      { t: 76, title: "Receipts" },
      { t: 96, title: "Cash, check & extra charges" },
      { t: 117, title: "Lock downloads until paid" },
      { t: 163, title: "Refunds" },
    ],
  },
  {
    key: "V10",
    slug: "uploading-organizing-media",
    title: "Upload and organize media",
    description: "Photos, drone video, 360 tours and 3D, organized the way clients see them.",
    module: 4,
    youtubeId: "kcJORui1vVM",
    durationSeconds: 178,
    tryHref: "/admin/media",
    tryLabel: "Open the Media Library",
    chapters: [
      { t: 0, title: "Upload photos" },
      { t: 37, title: "Videos, 360 tours, 3D & YouTube" },
      { t: 63, title: "Folders & order" },
      { t: 95, title: "Client Favorites" },
      { t: 111, title: "The Media Library" },
      { t: 134, title: "The photo editor" },
    ],
  },
  {
    key: "V11",
    slug: "delivering-review-downloads",
    title: "Delivery, review and downloads",
    description: "Collect video feedback, get approval and unlock Download All.",
    module: 4,
    youtubeId: "JzT-wKbQhaQ",
    durationSeconds: 179,
    tryHref: "/admin/projects",
    tryLabel: "Open a project",
    chapters: [
      { t: 0, title: "Send for review" },
      { t: 17, title: "What your client sees" },
      { t: 33, title: "Video review & new versions" },
      { t: 65, title: "Revisions & approval" },
      { t: 104, title: "Share & public links" },
      { t: 157, title: "Download All" },
    ],
  },
  {
    key: "V12",
    slug: "marketing-kit",
    title: "The Marketing Kit",
    description: "Listing websites, Just Listed posts, stories and flyers from your photos.",
    module: 5,
    youtubeId: "piyOmK4Yc1M",
    durationSeconds: 180,
    tryHref: "/admin/sites/property",
    tryLabel: "Open Property Websites",
    chapters: [
      { t: 0, title: "What's in the kit" },
      { t: 21, title: "The property website" },
      { t: 57, title: "Publish & share" },
      { t: 81, title: "Social graphics & flyers" },
      { t: 130, title: "Selling the kit to clients" },
    ],
  },
  {
    key: "V13",
    slug: "business-website",
    title: "Your business website",
    description: "Your website is already built. Pick a template and make it yours.",
    module: 5,
    youtubeId: "LEVKWCNam_o",
    durationSeconds: 180,
    tryHref: "/admin/sites/business",
    tryLabel: "Open your Business Website",
    chapters: [
      { t: 0, title: "It's already built" },
      { t: 20, title: "Appearance" },
      { t: 44, title: "Homepage & services" },
      { t: 72, title: "Testimonials & portfolio" },
      { t: 114, title: "About & contact" },
      { t: 152, title: "Save, go live, own domain" },
    ],
  },
  {
    key: "V14",
    slug: "messages-emails-automation",
    title: "Messages and automated emails",
    description: "One inbox for every client, and control over every email they get.",
    module: 6,
    youtubeId: "vZDVimD8M1I",
    durationSeconds: 179,
    tryHref: "/admin/messages",
    tryLabel: "Open Messages",
    chapters: [
      { t: 0, title: "Your inbox" },
      { t: 30, title: "Your client's side" },
      { t: 54, title: "Every email your client gets" },
      { t: 117, title: "Editing the wording" },
      { t: 140, title: "Workflow automation & reminders" },
    ],
  },
  {
    key: "V15",
    slug: "phone-app-push-notifications",
    title: "Phone app and push alerts",
    description: "Get an alert the moment a client books, approves or pays.",
    module: 6,
    youtubeId: "rkd1cNoNA4w",
    durationSeconds: 158,
    tryHref: "/admin/settings#settings-notifications",
    tryLabel: "Open Notifications",
    chapters: [
      { t: 0, title: "Add to Home Screen" },
      { t: 46, title: "Turn on push" },
      { t: 84, title: "The app tour" },
      { t: 126, title: "Choose your alerts" },
    ],
  },
  {
    key: "V16",
    slug: "team-permissions-tax-integrations",
    title: "Team, W-9s and integrations",
    description: "Staff logins and permissions, W-9 links, Google Calendar and more.",
    module: 6,
    youtubeId: "od2s8OoZBW8",
    durationSeconds: 178,
    tryHref: "/admin/settings#settings-staff",
    tryLabel: "Open Staff & Permissions",
    chapters: [
      { t: 0, title: "Invite your team" },
      { t: 29, title: "Permission presets" },
      { t: 82, title: "What staff see" },
      { t: 101, title: "Tax info & W-9" },
      { t: 148, title: "Integrations" },
      { t: 161, title: "Partner program" },
    ],
  },
  {
    key: "V18",
    slug: "plan-and-billing",
    title: "Your plan and billing",
    description: "Free trial, monthly or annual, promo codes and managing billing.",
    module: 7,
    youtubeId: "i8PxmepgAv0",
    durationSeconds: 113,
    tryHref: "/billing",
    tryLabel: "Open Billing & plan",
    chapters: [
      { t: 0, title: "Your free trial" },
      { t: 28, title: "Choose your plan" },
      { t: 71, title: "Manage billing" },
      { t: 83, title: "Banners to watch for" },
    ],
  },
  {
    key: "V19",
    slug: "partner-program",
    title: "The Partner Program",
    description: "Share your link and earn 30% of what every business you refer pays, for as long as they stay.",
    module: 8,
    youtubeId: "iCPKDdgw8fQ",
    durationSeconds: 171,
    tryHref: "/partner",
    tryLabel: "Open the Partner Program",
    chapters: [
      { t: 0, title: "What it is" },
      { t: 17, title: "What you can earn" },
      { t: 44, title: "Apply" },
      { t: 64, title: "Your link and landing page" },
      { t: 104, title: "How referrals count" },
      { t: 143, title: "Getting paid" },
    ],
  },
  {
    key: "V17",
    slug: "client-portal-guide",
    title: "Your client portal, explained",
    description: "For your clients: how to approve, review, pay and download in your portal.",
    module: 0,
    youtubeId: "Byx9Vs8OfQA",
    durationSeconds: 177,
    tryHref: null,
    tryLabel: null,
    chapters: [
      { t: 0, title: "Your invite" },
      { t: 37, title: "Request a shoot" },
      { t: 48, title: "Proposal & shoot time" },
      { t: 76, title: "Review your photos & videos" },
      { t: 114, title: "Pay & download" },
      { t: 151, title: "Your account" },
    ],
  },
];

/** The course, in order. The certificate needs every one of these. */
export const ACADEMY_LESSONS: AcademyLesson[] = ALL_LESSONS.filter((l) => l.module !== 0);

/** The brand-free guide owners send to their clients (not part of the course). */
export const ACADEMY_CLIENT_GUIDE: AcademyLesson = ALL_LESSONS.find((l) => l.module === 0)!;

export const ACADEMY_LESSON_COUNT = ACADEMY_LESSONS.length;

/** A lesson counts as watched once this share of the video has been reached. */
export const ACADEMY_COMPLETE_PERCENT = 90;

export function academyLessonByKey(key: string): AcademyLesson | null {
  return ALL_LESSONS.find((l) => l.key === key) ?? null;
}

export function academyLessonBySlug(slug: string): AcademyLesson | null {
  return ALL_LESSONS.find((l) => l.slug === slug) ?? null;
}

export function academyThumb(lesson: Pick<AcademyLesson, "key">): string {
  return `/academy/${lesson.key}.jpg`;
}

export function academyLessonHref(lesson: Pick<AcademyLesson, "slug">): string {
  return `/admin/academy/${lesson.slug}`;
}

export function academyYoutubeUrl(lesson: Pick<AcademyLesson, "youtubeId">): string {
  return `https://youtu.be/${lesson.youtubeId}`;
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 1-based position in the course (0 for the client guide). Compares keys: lessons cross the server/client boundary as copies. */
export function lessonNumber(lesson: Pick<AcademyLesson, "key">): number {
  return ACADEMY_LESSONS.findIndex((l) => l.key === lesson.key) + 1;
}

export function moduleLessons(id: AcademyModuleId): AcademyLesson[] {
  return ACADEMY_LESSONS.filter((l) => l.module === id);
}

export const ACADEMY_TOTAL_SECONDS = ACADEMY_LESSONS.reduce((s, l) => s + l.durationSeconds, 0);
