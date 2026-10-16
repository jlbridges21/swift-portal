/**
 * Media for the Solutions landing pages: real ShootPortal captures (screens recorded
 * from a live account, personal data blurred) composed into device mockups, motion
 * graphics, and demo videos. Files live in public/solutions/<folder>/. Source index
 * with redaction notes: "Landing Page Assets/07-Source-Frames/SOURCE-INDEX.md".
 *
 * Videos have no audio track, so loops autoplay muted. Every video has a poster.
 */

export type SolutionImageAsset = { src: string; width: number; height: number; alt: string };
export type SolutionVideoAsset = {
  mp4: string;
  webm?: string;
  poster: string;
  /** Accessible description of what the video shows. */
  label: string;
  /** Demo videos: visible title and length. */
  title?: string;
  duration?: string;
};

const W = { width: 2400, height: 1350 };
const img = (folder: string, file: string, alt: string, size: { width: number; height: number } = W): SolutionImageAsset => ({
  src: `/solutions/${folder}/${file}.webp`,
  ...size,
  alt,
});
const vid = (folder: string, file: string, label: string, opts: { webm?: boolean; title?: string; duration?: string } = {}): SolutionVideoAsset => ({
  mp4: `/solutions/${folder}/${file}.mp4`,
  webm: opts.webm ? `/solutions/${folder}/${file}.webm` : undefined,
  poster: `/solutions/${folder}/${file}-poster.webp`,
  label,
  title: opts.title,
  duration: opts.duration,
});

export const MEDIA = {
  realEstate: {
    heroDashboard: img("real-estate-software", "real-estate-hero-dashboard-transparent", "ShootPortal Command Center on a laptop and phone, showing new requests, quotes, upcoming shoots, editing, review, and awaiting payment", { width: 1902, height: 1170 }),
    beforeAfter: img("real-estate-software", "real-estate-before-after", "Before: email threads, spreadsheets, file links, and invoices scattered across tools. With ShootPortal: one connected workflow with a client progress tracker"),
    mediaDelivery: img("real-estate-software", "real-estate-media-delivery", "ShootPortal media library on laptop and phone with aerial listing photos organized by project"),
    twoSided: img("real-estate-software", "real-estate-two-sided-experience", "Photographer view of an estimate with line items next to the agent's view of the official proposal with Approve and Request changes"),
    workflowLoop: vid("real-estate-software", "real-estate-workflow-animation", "Animation of the ShootPortal workflow: request, estimate, schedule, shoot, review, pay, deliver, with real screens at each step", { webm: true }),
    demo: vid("real-estate-software", "real-estate-workflow-demo", "Demo: an agent requests a shoot, gets an automatic preliminary estimate, the shoot lands on the calendar, the client comments on video, and pays through Stripe", { title: "A listing from request to paid", duration: "0:37" }),
  },
  drone: {
    dashboard: img("drone-software", "drone-dashboard-laptop", "ShootPortal Command Center on a laptop with time-stamped video comments on a phone"),
    lessAdmin: img("drone-software", "drone-less-admin-more-flying", "Disconnected tools compared with ShootPortal's Workflow Automation payment settings", { width: 1600, height: 900 }),
    film: vid("drone-software", "drone-business-hero", "Aerial footage of a boat at sunset with ShootPortal's Command Center, request form, pipeline, video review, and delivery screens", { webm: true }),
    workflowLoop: vid("drone-software", "drone-business-workflow-animation", "Animation of a drone job moving from client to project, estimate, schedule, deliverables, and payment", { webm: true }),
    lifecycle: vid("drone-software", "drone-project-lifecycle", "Demo of a drone project from inquiry to delivery: estimate, pipeline, video notes, Stripe payment, and link sharing", { title: "Every flight, from inquiry to delivery", duration: "0:35" }),
    review: vid("drone-software", "drone-video-review", "Demo of a client leaving a time-stamped note on drone footage and the pilot replying and resolving it", { title: "Feedback on the exact frame", duration: "0:20" }),
  },
  portal: {
    phones: img("client-portal", "client-portal-iphone-transparent", "A photographer's branded client portal on three phones: landing page, request form, and sign-in", { width: 1320, height: 1306 }),
    responsive: img("client-portal", "client-portal-responsive-transparent", "The same branded client portal on laptop, tablet, and phone", { width: 2234, height: 1114 }),
    twoSided: img("client-portal", "client-portal-two-sided", "Portal branding settings on a laptop next to the branded portal on the client's phone"),
    film: vid("client-portal", "client-portal-hero", "Walkthrough of a branded client portal: projects, progress, proposals, payments, and media", { webm: true }),
    journeyLoop: vid("client-portal", "client-journey-animation", "Animation of the client journey: project access, communication, invoice, and media review and delivery", { webm: true }),
    demo: vid("client-portal", "client-portal-delivery-demo", "Demo of what a client sees: branded portal, their projects, progress, media, and downloads", { title: "What your client sees", duration: "0:22" }),
  },
  crm: {
    dashboard: img("crm", "crm-dashboard-hero", "ShootPortal client list with revenue, outstanding balance, active and delivered projects, and last activity (client details blurred)"),
    comparison: img("crm", "crm-comparison", "A standalone CRM with separate tools compared with ShootPortal, where clients connect to projects, estimates, payments, messages, and media"),
    pipeline: img("crm", "crm-multiple-projects", "ShootPortal project pipeline with 11 active projects (client details blurred)"),
    agentLoop: vid("crm", "crm-client-project-animation", "Animation: one real estate agent connected to several property shoots, each with its estimate, messages, and deliverables", { webm: true }),
    clientLoop: vid("crm", "crm-organized-workflow", "Animation: a client record connected to projects, scheduling, estimates, communication, and delivery", { webm: true }),
    demo: vid("crm", "crm-client-management-demo", "Demo of client management: pipeline, estimates and proposals, deposits and payments, mark as paid, activity timeline, and moving projects between stages", { title: "Every client, connected to their projects", duration: "0:35" }),
  },
  delivery: {
    gallery: img("media-delivery", "media-gallery-laptop", "ShootPortal media library with 319 assets on a laptop and phone"),
    comparison: img("media-delivery", "media-delivery-comparison", "A link to a shared folder compared with ShootPortal delivery: branding, organized by project, time-stamped review, download all, optional unlock after payment"),
    film: vid("media-delivery", "media-delivery-hero", "Drone footage with ShootPortal's media library, time-stamped feedback, and branded delivery screens", { webm: true }),
    workflowLoop: vid("media-delivery", "media-delivery-workflow", "Animation: upload, organize, client review, and final delivery, with optional unlock after payment", { webm: true }),
    demo: vid("media-delivery", "media-delivery-demo", "Demo: media library, filters by client and service, organized projects, unlock after payment setting, share links, and client downloads", { title: "Organize, share, and deliver", duration: "0:30" }),
    reviewDemo: vid("media-delivery", "media-video-review-demo", "Demo of time-stamped video comments, replies, and resolving notes", { title: "Clear feedback, faster revisions", duration: "0:23" }),
  },
  booking: {
    hero: img("booking", "booking-hero-laptop-transparent", "ShootPortal shoot calendar on a laptop next to the Request a Shoot form on a phone", { width: 1922, height: 1170 }),
    calendar: img("booking", "booking-calendar-showcase", "ShootPortal shoot calendar with month, week, day, and agenda views and Google calendars shown alongside"),
    twoViews: img("booking", "booking-client-photographer-view", "The client's request form on a phone and the photographer's shoot calendar on a laptop"),
    comparison: img("booking", "booking-tools-comparison", "A booking tool plus separate spreadsheets, texts, invoices, and links compared with ShootPortal booking that starts the workflow"),
    workflowLoop: vid("booking", "booking-to-delivery-animation", "Animation: booking leads to project, shoot, payment, and delivery", { webm: true }),
    demo: vid("booking", "booking-workflow-demo", "Demo: the client chooses a service and preferred date, gets an instant preliminary estimate, the project is created, and the client responds to a proposed shoot time", { title: "A booking that starts the whole workflow", duration: "0:31" }),
  },
  invoicing: {
    hero: img("invoicing", "invoicing-hero-laptop", "ShootPortal project payments with a deposit and a balance, mark as paid, and Stripe payment links"),
    dashboard: img("invoicing", "invoicing-dashboard-showcase", "Project payments screen: create a payment, open or copy the Stripe link, mark as paid, payment status, deposits with the full project total"),
    clientView: img("invoicing", "invoicing-client-payment-experience", "Photographer's payments screen next to the client's outstanding payments in their portal"),
    comparison: img("invoicing", "invoicing-tools-comparison", "Invoices disconnected from the work compared with ShootPortal payments connected to every project"),
    workflowLoop: vid("invoicing", "invoicing-payment-workflow", "Animation: project, estimate, invoice, payment, delivery, with optional unlock after payment", { webm: true }),
    demo: vid("invoicing", "estimate-to-payment-demo", "Demo: instant preliminary estimate, official estimate, client approval, payment link on approval, Stripe checkout, and mark as paid", { title: "From estimate to payment", duration: "0:37" }),
  },
  videoReview: {
    hero: img("video-review", "video-review-hero-laptop", "ShootPortal video review on a laptop and phone with time-stamped comments beside the video"),
    features: img("video-review", "video-review-feature-showcase", "Video review screen: upload a new version, filter unresolved and resolved, timestamps on every comment, reply and resolve, comment markers on the timeline"),
    twoSided: img("video-review", "video-review-two-sided-experience", "The client watches and comments in their portal; the photographer sees every note in context"),
    comparison: img("video-review", "video-feedback-comparison", "Notes in texts and email threads compared with comments pinned to the footage, with replies and versions"),
    workflowLoop: vid("video-review", "video-review-workflow-animation", "Animation: upload, share, comment, revise with a new version, deliver", { webm: true }),
    demo: vid("video-review", "video-timestamp-comments-demo", "Demo: the client opens the video, pauses and types a note, the note is pinned to its timestamp, and the editor replies and resolves it", { title: "Feedback on the exact second", duration: "0:24" }),
  },
  workflow: {
    hero: img("workflow", "automation-hero-dashboard", "Automatic client emails, optional payment automations, and project update emails around the ShootPortal Command Center"),
    beforeAfter: img("workflow", "automation-before-after", "Admin work by hand compared with ShootPortal's Workflow Automation settings: automatic client emails, instant estimates, payment link on approval, receipts, and downloads after payment"),
    stages: img("workflow", "automation-project-stages", "ShootPortal project pipeline and the client's progress tracker"),
  },
  business: {
    hero: img("business-management", "business-management-hero", "ShootPortal Command Center on a laptop and phone, with video review and payments panels"),
    ecosystem: img("business-management", "business-management-ecosystem", "ShootPortal at the center of clients, projects, estimates, scheduling, payments, communication, media review, and delivery", { width: 1600, height: 1600 }),
    showcase: img("business-management", "business-management-product-showcase", "Media delivery, project dashboard, and client portal across laptop and phone"),
    comparison: img("business-management", "business-management-tools-comparison", "Five apps to run one business compared with ShootPortal running clients, projects, estimates, scheduling, payments, review, and delivery"),
  },
  shared: {
    allInOne: img("shared", "shootportal-all-in-one", "Your whole media business connected: client management, projects, estimates, scheduling, payments, media review, and delivery", { width: 1600, height: 1600 }),
    desktopMobile: img("shared", "shootportal-desktop-mobile-transparent", "ShootPortal on a laptop and phone", { width: 1924, height: 1160 }),
    trialCard: img("shared", "shootportal-free-trial-cta", "Run your media business in one place. 14-day free trial, no credit card required"),
    cycleLoop: vid("shared", "shootportal-full-workflow", "Animation of ShootPortal's connected workflow cycle: request, estimate, schedule, shoot, review, pay, deliver", { webm: true }),
    tour: vid("shared", "shootportal-complete-workflow", "Full product tour: client requests, proposal approval, calendar with Google, pipeline, video review, mark paid, share links, and your own brand and domain", { title: "The complete ShootPortal workflow", duration: "0:52" }),
  },
} as const;
