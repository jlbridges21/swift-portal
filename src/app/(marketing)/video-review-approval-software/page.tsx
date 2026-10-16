import type { Metadata } from "next";
import Link from "next/link";
import {
  Bell,
  Clapperboard,
  Crosshair,
  Inbox,
  Layers,
  MessageSquareReply,
  MessagesSquare,
  Shuffle,
  UserCheck,
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
  ScopeCard,
  Section,
  SolutionFaq,
  SolutionHero,
  StepTimeline,
  ToolsVsPlatform,
  TrialButton,
} from "@/components/solutions/solution-sections";
import { GalleryCard, VideoReviewCard } from "@/components/solutions/solution-visuals";
import { DeliverableDecisionCard } from "@/components/solutions/solution-scenes";
import { LoopVideo, ShowcaseImage } from "@/components/solutions/solution-media";
import { MEDIA } from "@/lib/solution-media";

const PAGE = getSolutionPage("video-review");
const cta = (p: CtaPlacement) => solutionCtaId(PAGE.key, p);
const A = "font-medium text-[#4F46E5] underline underline-offset-2";

export const revalidate = 300;
export const metadata: Metadata = solutionMetadata(PAGE);

export default async function VideoReviewApprovalSoftwarePage() {
  await requirePlatformMarketingHost();
  const ctx = await loadBlogRenderContext();

  return (
    <BrandProvider brand={platformPortalBrand()}>
      <MarketingShell trialNote={ctx.trialDays > 0 ? `${ctx.trialDays} days free. No credit card required.` : null}>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(solutionJsonLd(PAGE, ctx)) }} />

        <SolutionHero
          tone="dark"
          layout="stacked"
          eyebrow="For videographers & media teams"
          title={
            <>
              Video review software where feedback <GradientText>lands on the exact frame</GradientText>
            </>
          }
          subtitle={
            <>
              ShootPortal is video review software for client work. Clients comment at a timestamp, pin the comment to a spot in the frame, and
              reply in threads. You post a new version, resolve what&apos;s done, and deliver the approved video from the same project.
            </>
          }
          ctaId={cta("hero")}
          ctx={ctx}
          secondary={{ href: "#review-round", label: "Walk through a review round" }}
          visual={
            <figure>
              <ShowcaseImage image={MEDIA.videoReview.hero} frame="dark" priority sizes="(min-width: 1024px) 1024px, 100vw" />
              <figcaption className="mt-3 text-center text-xs text-slate-400">{REAL_CAPTURE_NOTE}</figcaption>
            </figure>
          }
        />

        <Section
          eyebrow="Feedback by email"
          title={'"At about a minute in, the part with the kitchen…"'}
          intro="Video revisions go wrong because feedback arrives without a timestamp, a frame, or a version. Sound familiar?"
          tone="cloud"
        >
          <ProblemGrid
            items={[
              { icon: Crosshair, title: "Vague timestamps", body: "\"Near the start\" and \"the drone part\" cost you a full rewatch to find the moment." },
              { icon: Shuffle, title: "Notes in four places", body: "Some feedback comes by email, some by text, some on a call, and one note always gets missed." },
              { icon: Layers, title: "Which version?", body: "The client comments on v1 after you've already sent v2, and nobody notices until the second call." },
              { icon: MessagesSquare, title: "No thread", body: "When you reply \"done\", there's no record of which note it answered." },
              { icon: Inbox, title: "Review separate from delivery", body: "You review in one tool, deliver through another, and invoice in a third." },
              { icon: UserCheck, title: "Unclear sign-off", body: "A thumbs-up in a text message isn't a clear approval when there are four deliverables." },
            ]}
          />
        </Section>

        <DemoShowcase
          title="Watch a client leave feedback on the exact second"
          intro="A 24-second walkthrough of real ShootPortal screens: the client opens the video in their portal, pauses, types a note, and you reply and resolve it."
          video={MEDIA.videoReview.demo}
          points={["The video pauses while the client types", "Every note is pinned to its timestamp", "Reply, then mark it resolved as you revise"]}
          ctaId={cta("demo")}
          trialDays={ctx.trialDays}
          ctaLabel="Run your next review round in ShootPortal"
        />

        <Section
          id="review-round"
          eyebrow="A review round in ShootPortal"
          title="Upload, comment, revise, approve"
          intro="Video review lives on the project, next to the shoot details, the photos, and the payment."
        >
          <StepTimeline
            steps={[
              { tag: "You", title: "Upload and send for review", body: "Upload MP4, MOV, or M4V files up to 5 GB with resumable uploads, then send the project for review. The client is notified." },
              {
                tag: "Client",
                title: "Comment on the moment",
                body: "Each comment carries its timestamp and can be pinned to a point in the frame. Markers appear on the timeline.",
              },
              { tag: "You", title: "Reply, fix, post v2", body: "Reply in the thread, upload a new numbered version, and resolve the comments you've handled." },
              {
                tag: "Client",
                title: "Approve the deliverable",
                body: "The client approves each deliverable or requests changes. When everything is approved, the project moves to Awaiting Payment.",
              },
            ]}
          />
          <LoopVideo video={MEDIA.videoReview.workflowLoop} frame="dark" className="mk-reveal mx-auto mt-12 max-w-4xl" />
        </Section>

        <Section eyebrow="Review features" title="Built for client feedback, not post-production teams" tone="cloud">
          <div className="space-y-20 lg:space-y-28">
            <FeatureSpotlight
              eyebrow="Time-stamped comments"
              title="Every note knows when and where"
              body={
                <p>
                  Comments are tied to the playback time, and the author can pin each one to a point on the frame, so &quot;swap this clip&quot; points
                  at the clip. Timeline markers show where the feedback sits in the video.
                </p>
              }
              bullets={["Threaded replies on each comment", "Space or K to play and pause while reviewing", "Clients, your team, and invited viewers can comment after signing in"]}
              visual={<ShowcaseImage image={MEDIA.videoReview.features} />}
              caption={REAL_CAPTURE_NOTE}
            />
            <FeatureSpotlight
              reverse
              eyebrow="Versions"
              title="Version 2 doesn't start a new email thread"
              body={
                <p>
                  Upload a new version to the same review. Versions are numbered, the client is notified, and the comment history stays with the
                  video, so you can see what was asked for on v1 and what changed in v2.
                </p>
              }
              bullets={["Resolve comments as you address them", "Clients can reopen their own feedback if a fix missed the mark", "Uploading versions and resolving comments are separate staff permissions"]}
              visual={<VideoReviewCard className="mx-auto max-w-md" />}
              caption="Product illustration: a video with version tabs and time-stamped comments (demo data)."
            />
            <FeatureSpotlight
              eyebrow="Approval"
              title="Sign-off per deliverable, not per text message"
              body={
                <p>
                  Approval happens at the deliverable level. The client approves each video and photo set, or flags it and writes what needs to
                  change. For bigger changes they can submit a revision request, which you move from pending to in progress to completed.
                </p>
              }
              bullets={["When every deliverable is approved, the project moves to Awaiting Payment automatically", "You and the client are notified of the approval"]}
              visual={<DeliverableDecisionCard className="mx-auto max-w-md" />}
              caption="Product illustration: deliverable review with approved and flagged items (demo data)."
            />
            <FeatureSpotlight
              reverse
              eyebrow="Delivery"
              title="The approved cut is already where the client downloads it"
              body={
                <p>
                  Video review is part of the project, so delivery isn&apos;t a separate step in a separate tool. Approved videos sit alongside the photos,
                  360 tours, and 3D embeds. Downloads can wait until the project is paid and delivered.
                </p>
              }
              bullets={[
                <>
                  Delivery in depth:{" "}
                  <Link href="/photo-video-delivery-software" className={A}>
                    photo and video delivery software
                  </Link>
                </>,
              ]}
              visual={<GalleryCard locked />}
              caption="Illustration of a delivery with downloads locked until payment."
            />
          </div>
        </Section>

        <Section eyebrow="Notifications" title="The right people hear about the right comments">
          <ShowcaseImage image={MEDIA.videoReview.twoSided} frame="dark" className="mk-reveal mx-auto mb-12 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <FeatureCards
            items={[
              { icon: Bell, title: "Your team hears from clients", body: "New client comments and reopened feedback notify the team by email, push, and in-app." },
              { icon: MessageSquareReply, title: "Clients hear back", body: "Clients are notified of your replies and new versions." },
              { icon: Clapperboard, title: "Batched, not spammy", body: "Email and push notifications are grouped over a short window instead of one per comment." },
            ]}
          />
        </Section>

        <Section eyebrow="Before and after" title="Review rounds with and without a review tool" tone="cloud">
          <ShowcaseImage image={MEDIA.videoReview.comparison} className="mk-reveal mx-auto mb-10 max-w-4xl" sizes="(min-width: 1024px) 896px, 100vw" />
          <ToolsVsPlatform
            leftTitle="Email and file links"
            rows={[
              { task: "Feedback", before: "\"Around 1:10, maybe 1:20\"", after: "Comment saved at the exact time, pinned to the frame" },
              { task: "Revisions", before: "New link, new email, old notes lost", after: "Numbered versions on the same review" },
              { task: "Tracking", before: "Your memory", after: "Open and resolved comments, with threaded replies" },
              { task: "Approval", before: "\"Looks good!\" in a text", after: "Approve or request changes per deliverable" },
              { task: "Delivery", before: "A separate transfer link", after: "Approved files on the same project, with payment if required" },
            ]}
          />
          <div className="mt-10 flex justify-center">
            <TrialButton ctaId={cta("mid")} trialDays={ctx.trialDays} label="Run your next review round in ShootPortal" />
          </div>
        </Section>

        <Section eyebrow="What it is, and isn't" title="A client review tool, not an editing suite">
          <ScopeCard
            title="Where video review in ShootPortal fits"
            does={[
              "Client and team comments at timestamps, pinned to the frame",
              "Threaded replies, resolve and reopen",
              "Numbered versions with client notifications",
              "Per-deliverable approval and revision requests",
              "Delivery and payment on the same project",
            ]}
            doesNot={[
              "Editing, color, or audio work (keep Premiere Pro, Final Cut, or Resolve)",
              "Drawing or annotation tools on the frame",
              "Frame-by-frame stepping or playback-speed controls",
              "NLE panel integrations or comment import into your timeline",
              "Anonymous comments without signing in",
            ]}
          />
          <p className="mx-auto mt-8 max-w-3xl text-center text-sm leading-relaxed text-[#64748B]">
            If your work is mostly post-production collaboration inside an editing team, compare dedicated platforms in our{" "}
            <Link href="/blog/best-video-review-approval-software" className={A}>
              video review and approval software comparison
            </Link>
            .
          </p>
        </Section>

        <Section tone="cloud" title="Built by someone who cuts property films">
          <FounderNote detail="Walkthrough films and aerial reels with real client revision rounds are why video review, versions, and delivery share one project." />
        </Section>

        <Section eyebrow="Pricing" title="Video review is included in the one plan">
          <PricingStrip ctx={ctx} ctaId={cta("pricing")} />
        </Section>

        <Section eyebrow="FAQ" title="Video review software questions" tone="cloud">
          <SolutionFaq
            items={[
              {
                q: "Do clients need an account to leave feedback?",
                a: (
                  <p>
                    Yes, commenting requires signing in. The client who ordered already has a portal login, and you can invite other viewers through
                    share links; they sign in to comment.
                  </p>
                ),
              },
              {
                q: "Can clients approve a video?",
                a: (
                  <p>
                    Clients approve each deliverable, videos included, or request changes with written feedback. Approval happens on the deliverable
                    rather than on a specific version inside the review player.
                  </p>
                ),
              },
              {
                q: "What video formats and sizes are supported?",
                a: <p>MP4, MOV, and M4V files up to 5 GB each, uploaded with resumable uploads. Playback uses the browser&apos;s built-in video player.</p>,
              },
              {
                q: "Can I draw on the frame?",
                a: <p>No. Comments can be pinned to a point on the frame, but there are no drawing or markup tools.</p>,
              },
              {
                q: "Does it replace my video editor?",
                a: <p>No. Edit in Premiere Pro, Final Cut, DaVinci Resolve, or whatever you use. ShootPortal handles the client side: review, approval, payment, and delivery.</p>,
              },
              {
                q: "Is there a free trial?",
                a: (
                  <p>
                    Yes. {ctx.trialDays > 0 ? `${ctx.trialDays} days free, ` : ""}no credit card required. Sign up with Google or a five-field form, upload
                    a cut, and invite a client to review it.
                  </p>
                ),
              },
            ]}
          />
        </Section>

        <Section eyebrow="Keep reading" title="Guides on video review and delivery">
          <RelatedReading slugs={PAGE.relatedArticles} />
        </Section>

        <Section eyebrow="More of ShootPortal" title="Around the review" tone="cloud">
          <RelatedSolutions keys={["media-delivery", "drone-software", "invoicing"]} />
        </Section>

        <FinalCta
          ctaId={cta("final")}
          ctx={ctx}
          title="Make your next revision round the easy part"
          body="Upload a cut, send it for review, and get feedback your editor can act on, with approval, payment, and delivery on the same project."
        />
      </MarketingShell>
    </BrandProvider>
  );
}

