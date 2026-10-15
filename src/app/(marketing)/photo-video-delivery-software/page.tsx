import type { Metadata } from "next";
import Link from "next/link";
import {
  Box,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Clapperboard,
  CreditCard,
  Download,
  FileText,
  FolderOpen,
  Images,
  KeyRound,
  Link2,
  Mail,
  MessageSquare,
  MessageSquareText,
  Orbit,
  Package,
  RotateCcw,
  Upload,
  UserRound,
  XCircle,
} from "lucide-react";
import { BrandProvider } from "@/components/brand/brand-provider";
import { MarketingShell } from "@/components/marketing/marketing-chrome";
import { platformPortalBrand } from "@/lib/public-host-chrome";
import { requirePlatformMarketingHost } from "@/lib/marketing-host";
import { loadBlogRenderContext } from "@/lib/blog/render-context";
import { getSolutionPage, solutionCtaId } from "@/lib/solutions";
import { solutionJsonLd, solutionMetadata } from "@/lib/solutions-seo";
import { jsonLdString } from "@/lib/blog/structured-data";
import {
  FeatureCards,
  FeatureSpotlight,
  FinalCta,
  GradientText,
  PricingStrip,
  RelatedReading,
  Section,
  SolutionFaq,
  SolutionHero,
  ToolsVsPlatform,
  TrialButton,
} from "@/components/solutions/solution-sections";
import { BrowserFrame, FloatingChip, GalleryCard, VideoReviewCard } from "@/components/solutions/solution-visuals";
import { BeforeAfter, PaymentFlowDiagram } from "@/components/blog/business-diagrams";
import { BestFitPanel } from "@/components/blog/conversion-parts";
import { Steps } from "@/components/blog/article-parts";
import { ProductPreview } from "@/components/blog/product-preview";

const PAGE = getSolutionPage("media-delivery");
const cta = (p: "hero" | "mid" | "final" | "pricing") => solutionCtaId(PAGE.key, p);

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

const linkCls = "font-medium text-[#4F46E5] underline underline-offset-2";

export default async function PhotoVideoDeliverySoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          layout="stacked"
          eyebrow="Photo and video delivery software"
          title={
            <>
              Professional photo and video delivery, <GradientText>without the chaos</GradientText>
            </>
          }
          subtitle={
            <>
              Give every client one branded place for their photos, films, 360 tours, and 3D embeds. They review and approve in the
              portal, leave time-stamped notes on video, pay, and download Print or MLS sizes. No expired links, no &quot;which folder
              was it?&quot;
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "/pricing", label: "See pricing" }}
          visual={
            <div className="relative px-1 pb-12 pt-4 text-left sm:px-6">
              <div className="grid items-center gap-5 md:grid-cols-[1.2fr_1fr]">
                <BrowserFrame url="portal.yourstudio.com/projects/harbor-view">
                  <div className="bg-[#F8FAFC] p-3 sm:p-4">
                    <GalleryCard />
                  </div>
                </BrowserFrame>
                <VideoReviewCard className="relative z-[1] md:-ml-14 md:mt-24" />
              </div>
              <FloatingChip icon={CheckCircle2} title="24 of 24 approved" detail="Client signed off on the photos" tone="emerald" className="-top-2 left-2 sm:-left-4" />
              <FloatingChip icon={Link2} title="Share link sent" detail="Invite expires Friday" tone="sky" className="right-0 top-6 sm:-right-4" delayMs={600} />
              <FloatingChip icon={Package} title="ZIP ready" detail="Print + MLS (2048px)" tone="indigo" className="bottom-0 left-1/3" delayMs={1200} />
            </div>
          }
        />

        <Section
          eyebrow="The problem with folder links"
          title="A shared folder is storage. A delivery is a handoff."
          intro="Generic file sharing gets files from A to B. It doesn't know which job they belong to, whether the client liked them, or whether the invoice is paid."
          tone="cloud"
        >
          <BeforeAfter
            beforeTitle="Delivering with a folder or transfer link"
            afterTitle="Delivering with ShootPortal"
            before={[
              "Transfer links expire before the client opens them, so you upload again",
              "Feedback comes back by email, text, or not at all",
              "No connection to the invoice; files are out before payment",
              "Clients lose the link and ask for it again next month",
              "Video notes like \"the part in the middle\" with no timestamp",
              "Everything looks like a cloud drive, not your business",
            ]}
            after={[
              "One project link per job that clients sign in to whenever they need it",
              "Approve or reject each deliverable with written feedback",
              "Optional: previews open now, downloads unlock after final payment",
              "Past projects stay organized under each client record",
              "Comments pinned to exact timestamps on numbered video versions",
              "Your logo, colors, and domain on the whole experience",
            ]}
          />
          <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-[#E2E8F0] bg-white p-6 text-sm leading-relaxed text-[#475569]">
            <p className="font-semibold text-[#0F172A]">To be fair to Google Drive and Dropbox</p>
            <p className="mt-1.5">
              They&apos;re excellent for storage, backup, and moving files between your own devices, and many photographers should keep
              using them for exactly that. Where they fall short is the client workflow around the files: review, approval, payment,
              and a branded experience. We compare the two in detail in{" "}
              <Link href="/blog/google-drive-vs-dropbox-photo-delivery" className={linkCls}>
                Google Drive vs. Dropbox for photo delivery
              </Link>
              .
            </p>
          </div>
        </Section>

        <Section
          eyebrow="Galleries organized by project"
          title="Every job gets its own gallery, not another folder"
          intro="Media attaches to the project it belongs to, alongside the client, the estimate, and the payment status."
        >
          <FeatureSpotlight
            eyebrow="One project, every format"
            title="Photos, video, tours, 3D, and documents together"
            body={
              <p>
                Upload photos into folders (exteriors, interiors, aerials, twilight), add video files or YouTube embeds, drop in a Kuula
                360 tour, and embed 3D models or maps from Matterport, Polycam, Sketchfab, DroneDeploy, Pix4D, Agisoft, Cesium, ArcGIS, or
                MipMap. Attach documents like floor plans or shot lists. You decide which media sections the client sees.
              </p>
            }
            bullets={[
              "Photos grouped in folders so a 60-image set stays navigable",
              "Video, 360 tours, and 3D embeds on the same page as the stills",
              "Show only the sections that apply to this client",
            ]}
            visual={<ProductPreview view="media" />}
            caption="Product illustration: a project's photo grid (demo data)."
          />
        </Section>

        <Section
          eyebrow="Photo & video projects"
          title="The right file, in the right size, for every job"
          intro="Stills and films have different problems. ShootPortal handles both on the same project."
          tone="cloud"
        >
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="mk-reveal flex flex-col rounded-3xl border border-[#E2E8F0] bg-white p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                <Images className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-xl font-semibold text-[#0F172A]">Delivering photo projects</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">
                Clients choose the size they need when they download, so you never export two sets by hand. Grab one image for a
                social post or the whole set as a ZIP.
              </p>
              <div className="mt-6 grid gap-3 sm:grid-cols-2" aria-hidden>
                <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#64748B]">Print</p>
                  <p className="mt-1 font-semibold text-[#0F172A]">Original, full resolution</p>
                  <p className="mt-1 text-xs text-[#64748B]">For print, brochures, and archives</p>
                </div>
                <div className="rounded-2xl border border-[#C7D2FE] bg-[#EEF2FF]/60 p-4">
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#4F46E5]">MLS</p>
                  <p className="mt-1 font-semibold text-[#0F172A]">2048px long edge</p>
                  <p className="mt-1 text-xs text-[#64748B]">For listing sites and the web</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs" aria-hidden>
                {["Single file", "Download all (ZIP)"].map((t) => (
                  <span key={t} className="inline-flex items-center gap-1 rounded-lg border border-[#E2E8F0] px-2.5 py-1.5 text-[#334155]">
                    <Download className="h-3 w-3 text-[#4F46E5]" />
                    {t}
                  </span>
                ))}
              </div>
              <p className="mt-auto pt-6 text-sm text-[#475569]">
                Shooting listings? See our step-by-step guide on{" "}
                <Link href="/blog/how-to-deliver-real-estate-photos" className={linkCls}>
                  how to deliver real estate photos
                </Link>
                .
              </p>
            </div>

            <div className="mk-reveal flex flex-col rounded-3xl border border-[#E2E8F0] bg-white p-7">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#EEF2FF] text-[#4F46E5]">
                <Clapperboard className="h-5 w-5" aria-hidden />
              </span>
              <h3 className="mt-4 text-xl font-semibold text-[#0F172A]">Delivering video projects</h3>
              <p className="mt-2 text-[0.98rem] leading-relaxed text-[#475569]">
                Upload finished video files straight to the project, or embed a YouTube link for the version that goes public. Uploads
                are resumable, so a dropped connection halfway through a large file doesn&apos;t mean starting over.
              </p>
              <div className="mt-6 space-y-3 rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-4" aria-hidden>
                <div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 font-medium text-[#0F172A]">
                      <Upload className="h-3.5 w-3.5 text-[#4F46E5]" />
                      Harbor_View_Film_v2.mp4
                    </span>
                    <span className="text-[#64748B]">Resuming…</span>
                  </div>
                  <div className="mt-1.5 h-2 rounded-full bg-[#E2E8F0]">
                    <div className="h-full w-[68%] rounded-full bg-gradient-to-r from-[#4F46E5] to-[#7C3AED]" />
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-[#E2E8F0]">
                  <span className="flex items-center gap-1.5 text-[#0F172A]">
                    <Clapperboard className="h-3.5 w-3.5 text-[#64748B]" />
                    Social cut (YouTube embed)
                  </span>
                  <span className="font-semibold text-emerald-700">Live</span>
                </div>
              </div>
              <p className="mt-auto pt-6 text-sm text-[#475569]">
                Tip: export the format and resolution you want clients to watch and download, then upload that file.
              </p>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Client access & downloads"
          title="Easy for the client. Also easy for their assistant."
          intro="The client signs in to their portal. Anyone else who needs the files gets a link from you."
        >
          <FeatureCards
            columns={3}
            items={[
              {
                icon: KeyRound,
                title: "Client portal sign-in",
                body: "The client who ordered signs in to see their projects with you, with downloads, messages, and payment in one login.",
              },
              {
                icon: Link2,
                title: "View links for anyone",
                body: "Share an \"anyone with the link\" page so a co-agent, marketer, or builder can see the files without an account.",
              },
              {
                icon: Mail,
                title: "Email invites with expiry",
                body: "Invite someone by email with a one-time or reusable share, and set when it expires.",
              },
            ]}
          />
          <p className="mx-auto mt-8 max-w-2xl text-center text-sm leading-relaxed text-[#64748B]">
            Delivery is one part of the client&apos;s experience. Estimates, shoot times, and messages live in the same place: see the{" "}
            <Link href="/photography-client-portal" className={linkCls}>
              branded photography client portal
            </Link>
            .
          </p>
        </Section>

        <Section
          eyebrow="Feedback & revisions"
          title="Know exactly what the client approved"
          intro="Feedback lands on the deliverable it's about, so revision rounds stay short and documented."
          tone="cloud"
        >
          <FeatureSpotlight
            reverse
            eyebrow="Approve or request changes"
            title="Per-item approvals with written feedback"
            body={
              <>
                <p>
                  Clients approve or reject each deliverable and explain why in writing. When they&apos;re ready, they submit a revision
                  request and you see the full list in one place instead of piecing it together from an inbox.
                </p>
                <p>Fix the items, upload replacements, and the client reviews again on the same project.</p>
              </>
            }
            bullets={["Each deliverable gets its own approval status", "Messages with the client stay on the project", "Revision requests collected in one list"]}
            visual={
              <div className="rounded-3xl border border-[#E2E8F0] bg-white p-5 shadow-[0_30px_70px_-50px_rgba(15,23,42,0.6)]" aria-hidden>
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-[#0F172A]">Harbor View · Review</p>
                  <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">1 change requested</span>
                </div>
                <ul className="mt-4 divide-y divide-[#F1F5F9]">
                  {[
                    { name: "Exterior_01.jpg", state: "ok" },
                    { name: "Kitchen_03.jpg", state: "no", note: "Can the window be less bright? Lake view is blown out." },
                    { name: "Aerial_02.jpg", state: "ok" },
                    { name: "Harbor_View_Film_v2.mp4", state: "pending" },
                    { name: "Floor_plan.pdf", state: "ok" },
                  ].map((d) => (
                    <li key={d.name} className="py-3">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <span className="flex items-center gap-2 text-[#0F172A]">
                          {d.name.endsWith(".pdf") ? (
                            <FileText className="h-4 w-4 text-[#94A3B8]" />
                          ) : d.name.endsWith(".mp4") ? (
                            <Clapperboard className="h-4 w-4 text-[#94A3B8]" />
                          ) : (
                            <Images className="h-4 w-4 text-[#94A3B8]" />
                          )}
                          {d.name}
                        </span>
                        {d.state === "ok" ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-emerald-700">
                            <CheckCircle2 className="h-3.5 w-3.5" /> Approved
                          </span>
                        ) : d.state === "no" ? (
                          <span className="flex items-center gap-1 text-xs font-semibold text-rose-600">
                            <XCircle className="h-3.5 w-3.5" /> Changes requested
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-xs font-semibold text-[#64748B]">
                            <CircleDashed className="h-3.5 w-3.5" /> In review
                          </span>
                        )}
                      </div>
                      {d.note ? <p className="ml-6 mt-1.5 rounded-lg bg-rose-50/60 px-2.5 py-1.5 text-xs text-[#475569]">{d.note}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            }
            caption="Illustration of per-item approvals on one project (fictional files)."
          />
        </Section>

        <Section
          tone="dark"
          eyebrow="Time-stamped video review"
          title="Video notes that point to the exact frame"
          intro="No more “around the 40-second mark, I think.” Clients comment on the moment, and every round is a numbered version."
        >
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
            <ul className="space-y-6">
              {[
                { icon: MessageSquareText, title: "Pinned to time and place", body: "Each comment is tied to a timestamp and can be pinned to a spot on the frame." },
                { icon: MessageSquare, title: "Threaded replies", body: "Reply under the note instead of starting a new email chain." },
                { icon: RotateCcw, title: "Resolve and reopen", body: "Close notes as you fix them, and reopen any that need another pass." },
                { icon: ClipboardList, title: "Numbered versions", body: "v1, v2, v3 on the same deliverable, with notifications batched so nobody gets a flood of emails." },
              ].map((r) => {
                const Icon = r.icon;
                return (
                  <li key={r.title} className="mk-reveal flex gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-[#C7D2FE]">
                      <Icon className="h-5 w-5" aria-hidden />
                    </span>
                    <div>
                      <h3 className="font-semibold text-white">{r.title}</h3>
                      <p className="mt-0.5 text-sm leading-relaxed text-slate-300">{r.body}</p>
                    </div>
                  </li>
                );
              })}
              <li className="pl-14 text-sm text-slate-400">
                Comparing tools for this? Read{" "}
                <Link href="/blog/best-video-review-approval-software" className="font-medium text-[#A5B4FC] underline underline-offset-2 hover:text-white">
                  the best video review and approval software
                </Link>
                .
              </li>
            </ul>
            <figure className="mk-reveal">
              <div className="rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-6" aria-hidden>
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-semibold text-slate-200">Harbor_View_Film</span>
                  <span className="flex gap-1">
                    <span className="rounded-full bg-white/10 px-2 py-0.5">v1</span>
                    <span className="rounded-full bg-white/10 px-2 py-0.5">v2</span>
                    <span className="rounded-full bg-[#4F46E5] px-2 py-0.5 text-white">v3</span>
                  </span>
                </div>
                <div className="mt-4 space-y-3">
                  <div className="rounded-2xl bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-amber-300/15 px-1.5 py-0.5 font-mono text-amber-200">0:23</span>
                      <span className="font-semibold text-slate-200">Client</span>
                      <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-300">
                        <Check className="h-3 w-3" /> Resolved
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">The dock shot cuts away too fast. Hold it two seconds?</p>
                    <div className="mt-3 border-l-2 border-white/10 pl-3">
                      <p className="text-xs font-semibold text-[#C7D2FE]">You</p>
                      <p className="mt-0.5 text-sm text-slate-300">Done in v3, now 4 seconds with a slow push in.</p>
                    </div>
                  </div>
                  <div className="rounded-2xl bg-white/5 p-4">
                    <div className="flex items-center gap-2 text-xs">
                      <span className="rounded bg-amber-300/15 px-1.5 py-0.5 font-mono text-amber-200">0:51</span>
                      <span className="font-semibold text-slate-200">Client</span>
                      <span className="ml-auto rounded-full bg-amber-300/15 px-2 py-0.5 text-[11px] font-semibold text-amber-200">Open</span>
                    </div>
                    <p className="mt-2 text-sm text-slate-200">Pinned: can we lose the boat on the left side of the frame?</p>
                  </div>
                </div>
              </div>
              <figcaption className="mt-3 text-center text-xs text-slate-400">Illustration of a threaded, resolvable video comment across versions.</figcaption>
            </figure>
          </div>
        </Section>

        <Section
          eyebrow="Payments"
          title="Let them see it now. Let them download it once it's paid."
          intro="Delivery and billing live on the same project, so the files and the balance never drift apart."
        >
          <FeatureSpotlight
            eyebrow="Payment-linked delivery"
            title="Previews stay open; downloads wait for the final payment"
            body={
              <>
                <p>
                  Request payment from the project and the client pays by card through Stripe Checkout, straight to your own Stripe
                  account. Take a deposit when the estimate is approved and the balance at delivery, or the full amount at once.
                </p>
                <p>
                  Turn on &quot;unlock downloads after payment&quot; and clients can view and review everything right away, while
                  downloads open after the final payment. The project can move to Delivered automatically.
                </p>
              </>
            }
            bullets={["Email receipts", "Mark a check or transfer as paid by hand", "Stripe's standard processing fees apply"]}
            visual={<PaymentFlowDiagram />}
          />
        </Section>

        <Section
          eyebrow="Why it matters"
          title="Delivery works better when it knows the rest of the job"
          intro="A standalone gallery only sees the files. ShootPortal's delivery sits inside the business system that booked the shoot."
          tone="cloud"
        >
          <FeatureCards
            columns={4}
            items={[
              { icon: CreditCard, title: "Knows the balance", body: "Downloads can follow payment status automatically." },
              { icon: UserRound, title: "Knows the client", body: "Each delivery joins the client's history, revenue, and properties." },
              { icon: MessageSquare, title: "Keeps the conversation", body: "Messages and feedback stay with the job, not in your inbox." },
              { icon: FolderOpen, title: "Keeps the record", body: "The estimate, shoot date, and final files sit on one project." },
            ]}
          />
        </Section>

        <Section
          eyebrow="Example delivery"
          title="One commercial job, from upload to download"
          intro="A fictional waterfront listing with photos, aerials, a film, a 3D tour, and a floor plan."
          align="left"
        >
          <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:gap-14">
            <Steps
              items={[
                { title: "Upload to the project", body: "42 photos in Exterior, Interior, and Aerial folders, the film, a Matterport link, and the floor plan PDF." },
                { title: "Choose what the client sees", body: "Turn on the photo, video, 3D, and document sections. Leave the rest off." },
                { title: "Client reviews", body: "They approve 41 photos, request one change in writing, and leave two time-stamped notes on the film." },
                { title: "Revise and re-upload", body: "Replace the kitchen image, upload v2 of the film, and resolve the notes as you go." },
                { title: "Final payment", body: "The client pays the balance by card. With unlock after payment on, downloads open." },
                { title: "Download and share", body: "The agent grabs MLS sizes as a ZIP, and you send a view link to the stager." },
              ]}
            />
            <div className="mk-reveal space-y-4 lg:sticky lg:top-28 lg:self-start">
              <GalleryCard locked />
              <p className="text-center text-xs text-[#64748B]">Illustration of a delivery with downloads locked until payment.</p>
              <div className="rounded-2xl border border-[#E2E8F0] bg-[#F8FAFC] p-5 text-sm text-[#475569]">
                <p className="flex items-center gap-2 font-semibold text-[#0F172A]">
                  <Box className="h-4 w-4 text-[#4F46E5]" aria-hidden />
                  <Orbit className="h-4 w-4 text-[#4F46E5]" aria-hidden />
                  Tours and models
                </p>
                <p className="mt-1">Kuula 360 tours and 3D embeds sit beside the photos, so the client never needs a second link.</p>
              </div>
            </div>
          </div>
        </Section>

        <Section
          eyebrow="Side by side"
          title="Cloud storage links vs. purpose-built delivery"
          intro="Both get files to a client. Only one is designed around the client getting, reviewing, and paying for them."
          tone="cloud"
        >
          <ToolsVsPlatform
            leftTitle="Cloud storage links"
            rows={[
              { task: "Organization", before: "A folder per job, named however you remembered that day", after: "A gallery on each project, with photos in folders and media by type" },
              { task: "Access", before: "Links can expire, get lost, or get forwarded", after: "Client signs in to their portal; view links and expiring invites for others" },
              { task: "Photo sizes", before: "Export and upload a full-res set and a web set", after: "Client picks Print (original) or MLS (2048px), single or ZIP" },
              { task: "Video feedback", before: "Notes in an email with approximate times", after: "Time-stamped, pinnable comments on numbered versions" },
              { task: "Approvals", before: "\"Looks good!\" somewhere in a thread", after: "Approve or reject per deliverable, with written feedback" },
              { task: "Payment", before: "Separate invoice; files already downloaded", after: "Downloads can unlock after final payment through your Stripe" },
              { task: "Branding", before: "The storage provider's interface", after: "Your logo, colors, and domain" },
            ]}
          />
          <div className="mt-10 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Deliver your next job in ShootPortal" />
          </div>
        </Section>

        <Section
          eyebrow="Honest fit"
          title="When a gallery platform is the better choice"
          intro="ShootPortal is delivery inside a business system for commissioned work. Some photographers need a different kind of gallery."
        >
          <div className="mx-auto max-w-4xl">
            <BestFitPanel
              heading="Where ShootPortal delivery fits"
              fits={[
                { who: "Real estate media companies", why: "Photos, aerials, video, tours, and 3D on one project, with MLS sizes and payment-gated downloads." },
                { who: "Drone pilots and videographers", why: "Large uploads that resume, time-stamped video review, and map or model embeds." },
                { who: "Commercial photographers", why: "Estimates, approvals, and payment on the same job as the files." },
                { who: "Hybrid photo and video studios", why: "One delivery for stills and film instead of two separate tools." },
              ]}
              notFor={[
                "You sell prints or products from your galleries. Pixieset, Pic-Time, or ShootProof are built for that.",
                "Clients need to heart favorites to choose their selects, as in wedding and portrait proofing. Those platforms handle it; ShootPortal uses approve or reject per item.",
                "You only need a link to send files and nothing else around the job.",
              ]}
            />
          </div>
        </Section>

        <Section eyebrow="Pricing" title="One plan. No per-delivery fees.">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Photo and video delivery software questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "What is photo and video delivery software?",
                a: (
                  <p>
                    It&apos;s software for handing finished media to clients professionally: an organized gallery, a way to collect
                    feedback, download options, and often payment. ShootPortal does that inside a full business system, so delivery is
                    connected to the estimate, the schedule, and the invoice.
                  </p>
                ),
              },
              {
                q: "Can I deliver large video files?",
                a: (
                  <p>
                    Yes. Uploads are resumable, so an interrupted upload picks up where it left off. The video file you upload is what
                    the client gets. You can also embed a YouTube link.
                  </p>
                ),
              },
              {
                q: "Do clients need an account to download?",
                a: (
                  <p>
                    The client who ordered signs in to their portal. For anyone else, send an &quot;anyone with the link&quot; view page or
                    an email invite that can be one-time or reusable, with an expiry date.
                  </p>
                ),
              },
              {
                q: "Can clients leave feedback on photos?",
                a: (
                  <p>
                    Yes. Clients approve or reject each photo or other deliverable with written feedback and can submit a revision
                    request. Time-stamped and pinned comments are for video.
                  </p>
                ),
              },
              {
                q: "Can I stop downloads until the client pays?",
                a: (
                  <p>
                    Yes. Turn on &quot;unlock downloads after payment.&quot; Clients can view everything immediately; downloads open once the
                    final payment is made through your Stripe account.
                  </p>
                ),
              },
              {
                q: "Does ShootPortal sell prints or let clients pick favorites?",
                a: (
                  <p>
                    No. There&apos;s no print store and no favorites. If those matter, a gallery platform such as Pixieset, Pic-Time, or
                    ShootProof is a better fit.
                  </p>
                ),
              },
              {
                q: "Is there a free trial?",
                a: (
                  <p>
                    Yes. {ctx.trialDays > 0 ? `${ctx.trialDays} days free, ` : ""}no credit card required. Sign up with Google or a
                    five-field form and deliver a real job during the trial.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="More on delivering photos and video">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Make your next delivery the best part of the job"
          body="Upload a real project, send your client one branded link, and let review, payment, and downloads happen in one place."
        />
      </MarketingShell>
    </BrandProvider>
  );
}
