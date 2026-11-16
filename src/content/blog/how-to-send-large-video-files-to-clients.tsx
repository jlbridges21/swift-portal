import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  InlineCta,
  KeyTakeaways,
  No,
  SiteLink,
  Yes,
} from "@/components/blog/article-parts";
import { DeliveryPathDiagram, VideoReviewDiagram } from "@/components/blog/diagrams";
import { FileSizeChart } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, PhoneScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "how-to-send-large-video-files-to-clients",
  title: "Best Ways to Send Large Video Files to Clients Without Losing Quality",
  seoTitle: "How to Send Large Video Files to Clients (2026 Guide)",
  description:
    "How to send large video files to clients: why 4K outgrows email, masters vs delivery files, Drive, Dropbox, WeTransfer and MASV limits, and client review.",
  excerpt:
    "Bitrate math, real sending limits, and a decision table for videographers and drone pilots who need to get big video files to clients intact, reviewed, and paid for.",
  category: "media-delivery",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  disclosure: true,
  primaryKeyword: "how to send large video files to clients",
  secondaryKeywords: [
    "send large video files",
    "send 4K video to client",
    "best way to share video files with clients",
    "video file transfer for videographers",
    "deliver drone footage to clients",
    "client video review",
    "Dropbox Replay alternative",
    "real estate video delivery",
  ],
  readingMinutes: 14,
  cover: {
    variant: "bigfile",
    tint: "indigo",
    label: "How-To Guide",
    alt: "Illustration of a large video file moving from an editing timeline to a client's delivery page",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Email is out.</strong> One minute of 150 Mbps drone footage is about 1.1 GB; Gmail&apos;s attachment
        limit is 25 MB.
      </>,
      <>
        <strong>Send a delivery file, not your master</strong>, unless the client is paying for the master. A
        well-exported H.264 or H.265 file is what most clients actually play and post.
      </>,
      <>
        <strong>For client work, use one branded project instead of three links.</strong> ShootPortal (our product)
        takes the upload, the time-stamped review, the numbered versions, the approval, the payment, and the final
        download on the same page, with downloads that can unlock when the client pays.
      </>,
      <>
        <strong>For client feedback</strong>, skip the email thread and the separate Dropbox Replay or Frame.io
        subscription: ShootPortal&apos;s comments pin to the moment and the spot on the frame, included in the plan.
      </>,
      <>
        <strong>For a one-off raw handoff to an editor</strong>, a cloud link or transfer service (Google Drive, Dropbox
        Transfer, WeTransfer, MASV) is fine. Check the size cap and expiry first.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Photographers can get away with a zipped folder. Videographers and drone pilots can&apos;t. A two-minute listing
        film, a construction progress reel, or a raw aerial pull for an editor is measured in gigabytes, and the client
        on the other end usually wants three things: to watch it without downloading anything, to tell you what to
        change, and eventually to get a clean file they can post or hand to someone else. Knowing how to send large
        video files to clients means handling all three.
      </p>
      <p>
        This guide covers <strong>how to send large video files to clients</strong> without crushing the quality or
        sending people on a scavenger hunt through expired links. We&apos;ll do the file-size math with real camera
        bitrates, list the actual limits of the common sending options (with sources), and separate the three jobs that
        often get lumped together: <em>transferring</em> a file, <em>reviewing</em> a cut, and <em>delivering</em> the
        final. For client work, our recommendation is to run all three on one project in{" "}
        <SiteLink href="/photo-video-delivery-software">ShootPortal</SiteLink>, so the client watches, comments,
        approves, pays, and downloads from a single branded link. If you deliver listing photos as well, our guide to{" "}
        <BlogLink slug="how-to-deliver-real-estate-photos">delivering real estate photos</BlogLink> covers the stills
        side.
      </p>
    </>
  ),
  sections: [
    {
      id: "why-video-files-are-big",
      title: "Why video files are so hard to send: the bitrate math",
      tocLabel: "Bitrate math",
      body: () => (
        <>
          <p>
            File size is mostly a function of bitrate and duration. Cameras and drones list their maximum video bitrate
            in megabits per second (Mbps). To turn that into storage, multiply by 60 seconds, divide by 8 (bits to
            bytes), and divide by 1,000 (megabytes to gigabytes):
          </p>
          <p>
            <strong>GB per minute = Mbps × 60 ÷ 8 ÷ 1,000</strong>
          </p>
          <h3>Example 1: a consumer drone</h3>
          <p>
            DJI lists the Air 3&apos;s maximum video bitrate as 150 Mbps for H.264 and H.265 (
            <Ext href="https://www.dji.com/air-3/specs">DJI Air 3 specs</Ext>). That works out to:
          </p>
          <ul>
            <li>150 × 60 ÷ 8 ÷ 1,000 = <strong>about 1.125 GB per minute</strong></li>
            <li>A 10-minute flight at that bitrate: <strong>about 11.25 GB</strong></li>
            <li>An hour of footage: <strong>about 67.5 GB</strong></li>
          </ul>
          <p>
            Real files can come in smaller, because the figure is a maximum and some modes record at lower rates. But
            it&apos;s the right number to plan around.
          </p>
          <h3>Example 2: a ProRes master</h3>
          <p>
            Apple&apos;s ProRes white paper lists target data rates by resolution and frame rate. For UHD (3840 × 2160)
            at 24p, ProRes 422 HQ is 707 Mb/s, which Apple lists as about 318 GB per hour; at 30p it&apos;s 884 Mb/s, or
            about 398 GB per hour (
            <Ext href="https://www.apple.com/final-cut-pro/docs/Apple_ProRes.pdf">Apple ProRes White Paper</Ext>). So:
          </p>
          <ul>
            <li>707 × 60 ÷ 8 ÷ 1,000 = <strong>about 5.3 GB per minute</strong> (UHD 24p, 422 HQ)</li>
            <li>A 10-minute UHD 24p master: <strong>about 53 GB</strong></li>
          </ul>
          <Figure caption="Approximate sizes from published bitrates (DJI Air 3 specs at its 150 Mbps maximum; Apple ProRes White Paper, UHD 24p ProRes 422 HQ) compared with common sending limits from each provider's help pages. Decimal GB.">
            <FileSizeChart
              files={[
                { label: "1 min drone footage", size: 1.125, note: "150 Mbps" },
                { label: "10 min drone footage", size: 11.25, note: "150 Mbps" },
                { label: "1 min ProRes 422 HQ", size: 5.3, note: "UHD 24p" },
                { label: "10 min ProRes 422 HQ", size: 53, note: "UHD 24p" },
              ]}
              limits={[
                { label: "Gmail attachment", size: 0.025 },
                { label: "Outlook.com via OneDrive", size: 2 },
                { label: "WeTransfer Free", size: 3 },
                { label: "iCloud Mail Drop", size: 5 },
                { label: "Dropbox Transfer (Plus)", size: 50 },
                { label: "Dropbox Transfer (Standard)", size: 100 },
              ]}
            />
          </Figure>
          <p>
            The takeaway: a single minute of ordinary drone footage is already roughly 45 times Gmail&apos;s attachment
            limit, and a short ProRes master is bigger than most free transfer tiers allow. You need a link-based method,
            and you need to decide which version of the file the client actually needs.
          </p>
        </>
      ),
    },
    {
      id: "email-limits",
      title: "Email attachment limits (and why they don't matter for video)",
      tocLabel: "Email limits",
      body: () => (
        <>
          <p>
            Email is still how most clients expect to hear that their video is ready. It&apos;s just not how the video
            should travel. The published limits:
          </p>
          <ul>
            <li>
              <strong>Gmail:</strong> 25 MB per message on personal accounts. Above that, Gmail removes the attachment
              and adds a Google Drive link instead (
              <Ext href="https://support.google.com/mail/answer/6584">Gmail attachment limits</Ext>). At 150 Mbps, 25 MB
              holds roughly 1.3 seconds of footage.
            </li>
            <li>
              <strong>Outlook.com:</strong> 25 MB for attachments; files shared through OneDrive can be up to 2 GB (
              <Ext href="https://support.microsoft.com/en-us/outlook/sending-limits-in-outlook-com">Outlook.com sending limits</Ext>).
            </li>
            <li>
              <strong>iCloud Mail Drop:</strong> up to 5 GB per message, with attachments available for 30 days (
              <Ext href="https://support.apple.com/en-us/108329">Apple Mail Drop limits</Ext>). That&apos;s about 4.4
              minutes of 150 Mbps footage, and the link disappears after a month.
            </li>
          </ul>
          <p>
            Notice that every option above eventually becomes &quot;a link to cloud storage.&quot; That&apos;s the honest
            answer to the email question: the email carries the message and the link; the file lives somewhere built
            for large files. The rest of this guide is about choosing that somewhere.
          </p>
        </>
      ),
    },
    {
      id: "masters-vs-delivery-files",
      title: "Delivery files vs. masters: send the right version",
      tocLabel: "Masters vs delivery files",
      body: () => (
        <>
          <p>
            &quot;Without losing quality&quot; doesn&apos;t mean &quot;send the biggest file you have.&quot; It means
            sending each client the version that looks right on the screen they&apos;ll use, without re-compressing it
            through some tool that quietly makes it worse. Most video businesses end up with three tiers of file:
          </p>
          <h3>1. The master</h3>
          <p>
            A high-bitrate export, often in an editing-friendly codec such as Apple ProRes, intended for archiving,
            further editing, color work, or broadcast. Masters are large by design. As the math above shows, minutes of
            UHD ProRes run into tens of gigabytes. Most clients never need one, and many can&apos;t even play one
            smoothly on a laptop. Send masters when the client or their editor has asked for them, or when your contract
            says they&apos;re part of the deliverable.
          </p>
          <h3>2. The delivery file</h3>
          <p>
            A high-quality export in a widely playable format, usually an MP4 using H.264 or H.265 (HEVC). This is the
            file a realtor puts on their website, a builder shows in a meeting, or a marketing team uploads to social.
            H.264 plays nearly everywhere. H.265 typically reaches similar visual quality at a smaller size, but some
            older devices and software handle it less reliably, so H.264 is the safer default when you don&apos;t know
            where the file will end up.
          </p>
          <h3>3. Web and social versions</h3>
          <p>
            Shorter cuts, vertical crops, or lighter exports made for a specific platform. Each major platform publishes
            its own upload recommendations, and they change; check the platform&apos;s current help page rather than
            relying on a preset you saved two years ago.
          </p>
          <Callout tone="tip" title="Don't let the delivery tool decide your quality">
            <p>
              Many streaming and social platforms re-encode what you upload. That&apos;s fine for a preview, but it
              means the &quot;download&quot; a client grabs from a streaming page may not be your original export.
              When quality matters, deliver your own exported file as a download, alongside any streaming link.
            </p>
          </Callout>
          <p>
            A practical habit: name exports so the tier is obvious, for example{" "}
            <em>OakSt_ListingFilm_v3_DELIVERY_UHD.mp4</em> and <em>OakSt_ListingFilm_v3_MASTER_ProRes422HQ.mov</em>.
            When the client forwards files to their web person, nobody has to guess which one to use.
          </p>
        </>
      ),
    },
    {
      id: "sending-options",
      title: "Cloud links and transfer services: real limits compared",
      tocLabel: "Sending options",
      body: () => (
        <>
          <p>
            For a one-time handoff (raw footage to an editor, a master to an ad agency, a final file to a client who
            just wants it in their downloads folder), a cloud link or transfer service is simple and cheap. Here&apos;s
            what each one actually allows, according to its own documentation.
          </p>
          <h3>Google Drive</h3>
          <p>
            Drive accepts individual files up to 5 TB, and each user can upload or copy 750 GB within 24 hours (
            <Ext href="https://support.google.com/drive/answer/37603">Drive file limits</Ext>,{" "}
            <Ext href="https://support.google.com/a/answer/172541">Drive upload limits</Ext>). Size won&apos;t stop you;
            your storage plan and upload speed will. Drive&apos;s built-in player is fine for a quick preview, but it
            isn&apos;t a review tool, and a shared folder looks the same for every client.
          </p>
          <h3>Dropbox Transfer</h3>
          <p>
            Dropbox Transfer sends a copy of files without sharing a folder. Size limits depend on plan: 2 GB on Basic,
            50 GB on Plus and Family, 100 GB on Standard, Professional, Essentials, Advanced, and Business, and 250 GB on
            Business Plus, Enterprise, or with the Replay add-on. Transfers on Basic, Plus, and Family expire after 7
            days; higher plans default to 30 days and can set custom expiry and passwords (
            <Ext href="https://help.dropbox.com/share/dropbox-transfer">Dropbox Transfer help</Ext>).
          </p>
          <h3>WeTransfer</h3>
          <p>
            WeTransfer&apos;s free tier allows 3 GB and 10 transfers per rolling 30 days, with links expiring after 3
            days (
            <Ext href="https://wetransfer.com/resources/free-file-transfer/start-sending-files-for-free">WeTransfer free</Ext>).
            WeTransfer&apos;s own pages aren&apos;t consistent on whether 3 GB is per transfer or a total, so treat 3 GB
            as the ceiling. Paid plans raise limits and add custom expiry, passwords, and branded pages; see{" "}
            <Ext href="https://wetransfer.com/pricing">WeTransfer pricing</Ext> for current prices.
          </p>
          <h3>MASV</h3>
          <p>
            MASV is built for very large media files and charges by the gigabyte: $0.25 per GB pay-as-you-go, with the
            first 15 GB each month free (a card is required). Files are stored free for 5 days, then billed for storage (
            <Ext href="https://masv.io/pricing">MASV pricing</Ext>). Sending that 53 GB ProRes master would cost roughly
            $13 at the pay-as-you-go rate, before any free allowance. It&apos;s a good fit for occasional huge handoffs
            to post houses and agencies.
          </p>
          <ComparisonTable
            caption="Large video file sending options compared by size limit, expiry, and review features"
            columns={["", "Size limit (per provider)", "Link expiry", "Time-stamped review", "Best use"]}
            rows={[
              ["Email (Gmail / Outlook.com)", "25 MB attachment", "n/a", <No key="a" />, "The notification, not the file"],
              ["iCloud Mail Drop", "5 GB per message", "30 days", <No key="b" />, "Short clips to Apple users"],
              ["Google Drive", "5 TB per file; 750 GB uploaded per day", "Expiry on eligible work/school accounts", <No key="c" />, "Storage, archives, simple links"],
              ["Dropbox Transfer", "2 GB to 250 GB by plan", "7 days on Basic/Plus; custom on higher plans", <No key="d">Replay is a separate add-on</No>, "One-off handoffs"],
              ["WeTransfer Free", "3 GB, 10 transfers per 30 days", "3 days", <No key="e" />, "Small, quick sends"],
              ["MASV", "Pay per GB ($0.25/GB PAYG)", "Free storage 5 days", <No key="f" />, "Very large masters to post houses"],
              ["Review platforms (Frame.io, Vimeo, Dropbox Replay)", "Large; see each vendor", "Configurable on paid plans", <Yes key="g" />, "Editor and team feedback"],
              ["ShootPortal client project", "Per-file limit not published; resumable uploads", "No expiry on the client's project; share links can expire", <Yes key="h">Pinned to the frame, numbered versions</Yes>, "Client review, approval, payment, and final delivery"],
            ]}
            note="Limits from each provider's help or pricing pages, checked 2026-10-15. Plans and limits change; confirm before relying on a number."
          />
          <p>
            None of the pure transfer tools above help with the next part of the job: getting clear feedback on a cut,
            recording who approved what, and getting paid. That&apos;s where review and client delivery come in. For a
            broader look at storage and
            sharing services side by side, see{" "}
            <BlogLink slug="google-drive-vs-dropbox-photo-delivery">Google Drive vs. Dropbox vs. dedicated delivery software</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "review-platforms",
      title: "Review links: getting feedback without the email thread",
      tocLabel: "Client review",
      body: () => (
        <>
          <p>
            &quot;Can you make the part near the end a little shorter?&quot; is the classic video revision note. Which
            part? Which version? A proper review link fixes that by letting the client pause, click, and leave a comment
            tied to a timecode, so the note arrives already pointed at the exact moment.
          </p>
          <Figure caption="Conceptual diagram: time-stamped comments on a video timeline, with numbered versions. Illustrative only.">
            <VideoReviewDiagram />
          </Figure>
          <p>The established options, briefly:</p>
          <ul>
            <li>
              <strong>Frame.io</strong> (Adobe): frame-accurate and range-based comments, on-frame annotations, version
              stacks, and reviewers without accounts. Its help center lists uploads up to 5 TB per asset via the web app (
              <Ext href="https://help.frame.io/en/articles/9101026-uploading-your-media">Frame.io uploads</Ext>), and paid
              plans add branded, passphrase-protected, expiring shares with downloads disabled if you choose (
              <Ext href="https://frame.io/pricing">Frame.io pricing</Ext>).
            </li>
            <li>
              <strong>Vimeo</strong>: review links with time-coded comments, approval statuses, and new versions that keep
              the same URL and comment history (
              <Ext href="https://vimeo.com/product/time-coded-video-feedback">Vimeo review</Ext>). Vimeo lists a per-video
              cap of 300 GB on its plans; check{" "}
              <Ext href="https://vimeo.com/pricing">Vimeo pricing</Ext> for which review features each plan includes.
            </li>
            <li>
              <strong>Dropbox Replay</strong>: an add-on with frame-accurate comments, markup, version comparison, and
              uploads up to 150 GB and 12 hours long (
              <Ext href="https://www.dropbox.com/replay">Dropbox Replay</Ext>).
            </li>
          </ul>
          <p>
            These tools are built for post-production teams, and each is another subscription priced per user or
            member. For a small video or drone business delivering to clients, the bigger problem is that review lives in
            one tool, delivery in another, and invoicing in a third, and the client has to keep track of all three.
          </p>
          <h3>The client-facing option: review on the project</h3>
          <p>
            ShootPortal replaces Dropbox Replay or Frame.io for client feedback. The client opens the cut from a
            one-click email link into your branded portal, pins comments to a timestamp and a spot on the frame, and
            sees your threaded replies and resolved notes. New cuts become numbered versions (V1, V2 · Latest), and the
            client approves or requests changes on the same page where the invoice and the final download live. Video
            review is included in the plan, with no per-user add-on. See how our{" "}
            <SiteLink href="/video-review-approval-software">video review and approval software</SiteLink> works, or
            compare every option in{" "}
            <BlogLink slug="best-video-review-approval-software">the best video review and approval software</BlogLink>.
          </p>
          <Figure caption="Real ShootPortal screen: a client reviewing a listing film on their phone and leaving a time-stamped comment, with no app to install and no Dropbox or Frame.io account.">
            <PhoneScreen view="phone-video-review" />
          </Figure>
        </>
      ),
    },
    {
      id: "versions-and-revisions",
      title: "Organizing versions, revisions, and approvals",
      tocLabel: "Versions & revisions",
      body: () => (
        <>
          <p>
            Big files make version confusion expensive. If a client downloads the wrong 4 GB file and posts it, fixing
            that costs everyone a day. A few rules keep versions straight regardless of the tool:
          </p>
          <ul>
            <li>
              <strong>Number every version and never reuse a number.</strong> v1, v2, v3. &quot;Final,&quot;
              &quot;final2,&quot; and &quot;FINAL-really&quot; are how wrong files get published.
            </li>
            <li>
              <strong>Keep comments with the version they were left on.</strong> When you post v3, the client should be
              able to see what was asked on v2 and whether it was addressed.
            </li>
            <li>
              <strong>Mark comments resolved</strong> as you work through them, so the client can check your changes
              against their list.
            </li>
            <li>
              <strong>Get an explicit approval.</strong> A thumbs-up emoji in a text thread is not an approval record.
              Ask the client to approve the specific version, and only export masters after that.
            </li>
            <li>
              <strong>Agree on revision rounds up front.</strong> Spell out how many rounds are included and what counts
              as a new request (a new shot list, a re-fly) versus a revision.
            </li>
          </ul>
          <ProductCallout title="&quot;The part near the end&quot; becomes a pin at 1:42 on v2">
            <p>
              In ShootPortal, the client reviews the cut inside their project. They pause, click, and leave a
              time-stamped comment that can be pinned to a spot on the frame. You reply in a thread and mark it
              resolved when it&apos;s fixed. Upload the next cut and it becomes v3, with v2&apos;s comments still attached
              to v2. The client approves the version or requests changes, and live updates mean you see new notes as
              they arrive, without ten separate emails.
            </p>
          </ProductCallout>
        </>
      ),
    },
    {
      id: "delivering-finals",
      title: "Sharing the final files professionally",
      tocLabel: "Delivering finals",
      body: () => (
        <>
          <p>
            Once a cut is approved, the final delivery is about access: who can watch it, who can download it, for how
            long, and whether downloading depends on payment.
          </p>
          <h3>Download permissions and expiring links</h3>
          <ul>
            <li>
              <strong>Separate watching from downloading.</strong> Most clients need to watch and share a preview
              immediately; the full-quality download can wait for approval or payment.
            </li>
            <li>
              <strong>Use expiring links for third parties.</strong> An agency editor or a seller who needs one file
              doesn&apos;t need permanent access to the whole project. Note that not every service supports expiry on
              every plan: Google Drive limits access expiration to eligible work or school accounts (
              <Ext href="https://support.google.com/drive/answer/2494822">Drive sharing</Ext>), and Dropbox Transfer only
              offers custom expiry on its higher plans.
            </li>
            <li>
              <strong>Keep the client&apos;s copy permanent.</strong> The paying client should be able to come back in
              six months and find the file, which a 3-day or 7-day transfer link can&apos;t offer.
            </li>
          </ul>
          <h3>Tie the download to payment</h3>
          <p>
            For video, the risk of delivering before payment is real: once a client has the file, the invoice slides
            down their list. A cleaner approach is to let the client watch the approved cut right away and unlock
            downloads when the final payment clears. We go deeper on policy wording in{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">how to get paid before delivering</BlogLink>.
          </p>
          <Figure caption="Conceptual diagram: upload, client review, optional payment step, then download. Illustrative only.">
            <DeliveryPathDiagram showPaywall />
          </Figure>
          <ProductCallout title="Watch now, download when paid, share anywhere">
            <p>
              In ShootPortal, the approved video stays on the client&apos;s project for good. Turn on the download lock
              and the client can watch and share it right away while the file unlocks automatically when they pay. For
              everyone else, email shares can expire, and a public watch page or an embeddable player puts the film on
              the agent&apos;s or brand&apos;s own website without sending the file at all.
            </p>
          </ProductCallout>
        </>
      ),
    },
    {
      id: "review-to-delivery-loop",
      title: "Review, version, pay, deliver: running the whole loop in one project",
      tocLabel: "The full loop",
      body: (ctx) => (
        <>
          <p>
            Each tool above does its own job well. The cost shows up between them. A typical small-business video job
            with separate tools looks like this: upload to a review platform, paste the link into an email, collect
            notes, upload v2 and send a new link, chase an approval, send an invoice from your accounting app, watch for
            the payment, then upload the final to Drive or a transfer service and send a third link. The client has
            three links to keep track of, and you&apos;re the only one who knows whether the job is approved, paid,
            and delivered.
          </p>
          <p>
            The alternative is to keep the cut, the comments, the approval, the payment, and the final file on the same
            project, so one page answers &quot;where are we?&quot; for both of you. Here&apos;s how that loop runs in
            ShootPortal for a two-minute listing film at Oak St:
          </p>
          <ol>
            <li>
              <strong>Upload the cut to the project.</strong> Uploads are resumable (ShootPortal uses the open tus
              protocol), so a dropped connection partway through a multi-gigabyte file picks up where it left off
              instead of starting over.
            </li>
            <li>
              <strong>The client reviews in their portal.</strong> They watch v1, leave time-stamped comments pinned to
              the frame, and you reply in threads. Comment notifications are batched rather than sent one by one.
            </li>
            <li>
              <strong>Post the next version.</strong> v2 sits next to v1 with each version&apos;s comments kept
              separately, and you resolve or reopen comments as you work through them.
            </li>
            <li>
              <strong>Get the approval on record.</strong> The client approves the deliverable, or requests changes
              with written feedback, in the same place.
            </li>
            <li>
              <strong>Request payment from the project.</strong> The client pays by card, Apple Pay, Google Pay, or
              optional bank payment, and the money goes to your own connected Stripe account. ShootPortal takes no cut,
              and a receipt goes out by email.
            </li>
            <li>
              <strong>Deliver the final.</strong> The approved file is already in the project. With &quot;unlock
              downloads after payment&quot; turned on, the client can watch it right away and download it (single file or
              ZIP) once the final payment is made. Share links or email invites, one-time or reusable with expiry, cover
              the seller or the agency editor.
            </li>
          </ol>
          <Figure caption="Real ShootPortal screen: the media library, with every listing's photos and video organized and searchable (sample client data).">
            <ProductPreview view="media" />
          </Figure>
          <Figure caption="Real ShootPortal screens: on the left, the workflow automation that unlocks downloads, moves the project, and sends the receipt when a payment lands; on the right, what the client sees: media ready, deliverables to approve, and a Pay Now button.">
            <TwoSidedScreens business="automation" client="portal-pay" />
          </Figure>
          <h3>What runs on its own, and what you still do</h3>
          <ul>
            <li>
              <strong>Automatic:</strong> resuming interrupted uploads, version numbering, batched comment
              notifications, branded emails at each step, reminders for an outstanding review or payment, emailed
              receipts, the download unlock after final payment (if you enable it), and project stage changes, including
              an optional move to Delivered once paid.
            </li>
            <li>
              <strong>Centralized:</strong> every version, comment thread, approval, message, payment status, and final
              file for the job, on the client&apos;s record.
            </li>
            <li>
              <strong>Your part:</strong> editing and exporting in your NLE, and choosing which export to upload.
              Upload the delivery export clients should watch, and add masters for clients who&apos;ve asked for them.
              For a one-off raw-footage handoff to an outside editor, a transfer link is fine; anything client-facing
              belongs on the project.
            </li>
          </ul>
          <InlineCta
            trialDays={ctx.trialDays}
            title="Stop sending three links for one video"
            body="Upload your next cut to a ShootPortal project. Your client comments on the frame, approves V2, pays, and downloads from one branded page, with no Replay or Frame.io seat to pay for."
          />
          <p>
            Video is one part of the job. The same plan runs your business website and request form, proposals,
            scheduling, a built-in photo editor for the stills, and, for listings, a property website and marketing kit
            built from your photos.
          </p>
          <AllInOnePlatform />
          <p>
            See the whole review-and-delivery loop on our{" "}
            <SiteLink href="/photo-video-delivery-software">video delivery platform</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "4k-considerations",
      title: "4K-specific considerations",
      tocLabel: "4K tips",
      body: () => (
        <>
          <p>4K makes every step above heavier. A few things to plan for specifically:</p>
          <ul>
            <li>
              <strong>Upload time is the real bottleneck.</strong> A 50 GB master on a typical home upload connection can
              take hours. Start uploads before you need them, use tools with resumable uploads, and avoid uploading over
              mobile hotspots from the field unless you have to.
            </li>
            <li>
              <strong>Daily caps add up.</strong> Google Drive&apos;s 750 GB-per-day upload limit sounds generous until
              you&apos;re archiving several days of UHD ProRes at once.
            </li>
            <li>
              <strong>Playback depends on the viewer&apos;s device.</strong> A high-bitrate 4K file can stutter on an older
              laptop or over hotel Wi-Fi, even if it&apos;s perfect on your editing machine. Test your delivery file on a
              phone and an ordinary laptop before sending.
            </li>
            <li>
              <strong>10-bit and log footage needs context.</strong> If you send ungraded D-Log M or HLG footage (the Air
              3 records these in 10-bit H.265, per DJI&apos;s specs), tell the recipient. Ungraded log footage looks flat
              and washed out, which an unprepared client can easily read as an error.
            </li>
            <li>
              <strong>Keep your own archive.</strong> Transfer links expire and review-platform storage fills up. Your
              master archive should live on drives or storage you control, independent of delivery.
            </li>
          </ul>
          <p>
            If you run a drone business and want the rest of the operation (booking, quoting, invoicing) to be as
            organized as your file handling, see our roundup of{" "}
            <BlogLink slug="best-drone-business-management-software">drone business management software</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "which-method",
      title: "How to send large video files to clients: a decision table",
      tocLabel: "Decision table",
      body: (ctx) => (
        <>
          <p>Match the method to the job, not the other way around:</p>
          <ComparisonTable
            caption="If you need to do X, use Y: choosing a way to send large video files"
            columns={["If you need to…", "Use", "Why"]}
            rows={[
              ["Send a 20-second preview clip", "Email or a quick cloud link", "Small enough; low ceremony"],
              ["Hand raw footage to an editor once", "Dropbox Transfer, WeTransfer (paid), or MASV", "Built for one-off large sends; check plan caps"],
              ["Send a 50+ GB ProRes master to an agency", "MASV or a high-tier Dropbox Transfer", "Pay-per-GB or 100 GB+ caps; no ongoing storage needed"],
              ["Collect feedback from a client", "ShootPortal video review", "Notes land on the exact frame and version, included in the plan"],
              ["Deliver finals tied to payment and a client record", "A ShootPortal client project", "Approval, download access, and payment in one branded place"],
              ["Put the film on an agent's or brand's website", "ShootPortal's embeddable player or public watch page", "No file to send; plays on their site"],
              ["Archive everything long-term", "Storage you control (Drive, Dropbox, or local drives)", "Delivery links expire; archives shouldn't"],
            ]}
            note="General guidance. Check each provider's current limits and plan features before choosing."
          />
          <p>
            For a wider comparison of platforms that combine delivery and presentation, including gallery tools that
            handle video, see our guide to the{" "}
            <BlogLink slug="best-photo-video-delivery-platforms">best photo and video delivery platforms</BlogLink>. To
            see how review, delivery, and payment connect in one project, look at{" "}
            <SiteLink href="/how-it-works">how ShootPortal works</SiteLink>.
          </p>
          <KeyTakeaways
            items={[
              <>Do the math: GB per minute = Mbps × 60 ÷ 8 ÷ 1,000. A 150 Mbps drone clip is about 1.1 GB per minute.</>,
              <>Email carries the notification; a link carries the file.</>,
              <>Send most clients a delivery file (H.264/H.265 MP4); send masters only when they&apos;re part of the job.</>,
              <>Transfer services are for one-off handoffs; check size caps and expiry by plan.</>,
              <>Use time-stamped review and numbered versions instead of email threads for revisions.</>,
              <>Keep finals, approvals, and payment status on one client project, and keep your own archive.</>,
            ]}
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Send your next cut through one project"
            body={
              <>
                Upload a real cut, open it as your client, leave a pinned comment, post V2, and see the approve, pay, and
                download steps from their side. One link replaces the review add-on, the invoice, and the transfer.
              </>
            }
            secondaryHref="/how-it-works"
            secondaryLabel="See how review and delivery work"
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best way to send large video files to clients?",
      answerText:
        "Use a link instead of an attachment. For client work, a client portal such as ShootPortal keeps the video, time-stamped comments, numbered versions, approval, payment, and controlled downloads on one branded project. For one-off raw handoffs, Google Drive, Dropbox Transfer, WeTransfer, or MASV work, depending on file size.",
      answer: (
        <p>
          Use a link instead of an attachment. For client work, a client portal such as ShootPortal keeps the video,
          time-stamped comments, numbered versions, approval, payment, and controlled downloads on one branded project.
          For one-off raw handoffs, Google Drive, Dropbox Transfer, WeTransfer, or MASV work, depending on file size.
        </p>
      ),
    },
    {
      question: "How do I get client feedback on a video without Dropbox Replay or Frame.io?",
      answerText:
        "Upload the cut to the client's project in ShootPortal. The client opens it from an email link, leaves comments pinned to a timestamp and a spot on the frame, and approves or requests changes. You reply in threads, resolve notes, and upload new cuts as numbered versions. Video review is included in the plan, so there's no per-user add-on.",
      answer: (
        <p>
          Upload the cut to the client&apos;s project in ShootPortal. The client opens it from an email link, leaves
          comments pinned to a timestamp and a spot on the frame, and approves or requests changes. You reply in threads,
          resolve notes, and upload new cuts as numbered versions. Video review is included in the plan, so there&apos;s
          no per-user add-on.
        </p>
      ),
    },
    {
      question: "How big is a minute of 4K drone footage?",
      answerText:
        "It depends on bitrate. At the DJI Air 3's 150 Mbps maximum, one minute is about 1.125 GB (150 × 60 ÷ 8 ÷ 1,000). A UHD 24p ProRes 422 HQ master runs about 5.3 GB per minute based on Apple's published data rate.",
      answer: (
        <p>
          It depends on bitrate. At the DJI Air 3&apos;s 150 Mbps maximum, one minute is about 1.125 GB (150 × 60 ÷ 8 ÷
          1,000). A UHD 24p ProRes 422 HQ master runs about 5.3 GB per minute based on Apple&apos;s published data rate.
        </p>
      ),
    },
    {
      question: "Can I email a 4K video?",
      answerText:
        "Not as an attachment. Gmail and Outlook.com cap attachments at 25 MB, which holds only about a second of 150 Mbps footage. iCloud Mail Drop allows 5 GB for 30 days. Send a link to cloud storage, a transfer, or a review page instead.",
      answer: (
        <p>
          Not as an attachment. Gmail and Outlook.com cap attachments at 25 MB, which holds only about a second of 150
          Mbps footage. iCloud Mail Drop allows 5 GB for 30 days. Send a link to cloud storage, a transfer, or a review
          page instead.
        </p>
      ),
    },
    {
      question: "Does compressing video for delivery reduce quality?",
      answerText:
        "Any lossy export discards some data, but a well-made H.264 or H.265 delivery file looks excellent on the screens most clients use. Keep a high-quality master for archiving and re-editing, and deliver masters only when the client needs them.",
      answer: (
        <p>
          Any lossy export discards some data, but a well-made H.264 or H.265 delivery file looks excellent on the
          screens most clients use. Keep a high-quality master for archiving and re-editing, and deliver masters only
          when the client needs them.
        </p>
      ),
    },
    {
      question: "How do I stop clients downloading video before they pay?",
      answerText:
        "Let clients watch the approved video but keep downloads locked until the final payment clears. Some review platforms let you disable downloads on a share link manually; client portals such as ShootPortal offer an optional setting that unlocks downloads automatically after payment.",
      answer: (
        <p>
          Let clients watch the approved video but keep downloads locked until the final payment clears. Some review
          platforms let you disable downloads on a share link manually; client portals such as ShootPortal offer an
          optional setting that unlocks downloads automatically after payment.
        </p>
      ),
    },
  ],
  related: [
    "best-video-review-approval-software",
    "best-photo-video-delivery-platforms",
    "google-drive-vs-dropbox-photo-delivery",
  ],
  cta: {
    title: "One link for the cut, the comments, the payment, and the final.",
    body: "Resumable uploads, time-stamped comments pinned to the frame, numbered versions, approvals, and payment to your own Stripe, with downloads that unlock when the client pays. No review add-on needed.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how review works",
  },
};
