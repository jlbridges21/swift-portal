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
  PickGrid,
  SiteLink,
  ToolCard,
  Yes,
} from "@/components/blog/article-parts";
import { DeliveryPathDiagram, VideoReviewDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-photo-video-delivery-platforms",
  title: "Best Photo and Video Delivery Platforms for Professional Photographers in 2026",
  seoTitle: "Best Photo and Video Delivery Platforms in 2026",
  description:
    "Photo and video delivery platforms compared for photographers, videographers, and drone pilots: galleries, video review, file limits, and pricing.",
  excerpt:
    "ShootPortal, Pixieset, Pic-Time, ShootProof, SmugMug, Zenfolio, Frame.io, Vimeo, Dropbox, and WeTransfer compared on large video files, revisions, branding, payment, and the client's download experience.",
  category: "media-delivery",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "photo and video delivery platform",
  secondaryKeywords: [
    "client video delivery",
    "photo delivery software",
    "video review software for photographers",
    "deliver large video files to clients",
    "Dropbox Replay alternative",
    "Frame.io alternative",
    "real estate video delivery",
    "photo editing for real estate",
  ],
  readingMinutes: 12,
  cover: {
    variant: "media",
    label: "2026 Guide",
    alt: "Illustration of a photo gallery and a video timeline with comment markers",
  },
  disclosure: true,
  quickAnswer: {
    heading: "Quick answer",
    points: [
      <>
        <strong>Real estate, drone, or commercial photographer and videographer?</strong> Our pick is ShootPortal (our
        product): photos, video, tours, and 3D or map embeds on one project in your branded portal, with the invoice and
        downloads that unlock on payment.
      </>,
      <>
        <strong>Video with several rounds of edits?</strong> ShootPortal&apos;s video review replaces Dropbox Replay or
        Frame.io for client feedback: comments pinned to the frame, numbered versions, and approvals, included in the
        plan.
      </>,
      <>
        <strong>Want to fix photos without leaving the delivery?</strong> ShootPortal&apos;s built-in photo editor saves
        straight back to the client&apos;s gallery and downloads.
      </>,
      <>
        <strong>Comparing galleries and transfer tools?</strong> Pixieset, Pic-Time, ShootProof, SmugMug, Zenfolio,
        Frame.io, Vimeo, Wipster, Dropbox, WeTransfer, and Google Drive are covered below. Check per-file video limits
        first: they range from 3 GB to multiple terabytes.
      </>,
    ],
  },
  intro: (ctx) => (
    <>
      <p>
        Delivering a still photo is a solved problem. Delivering a four-minute 4K brand film, thirty edited stills, a
        drone orthomosaic, and a revised cut two days later, to a client who wants to comment on the second version and
        pay before downloading, is not. That&apos;s where most photographers, videographers, and drone operators end up
        stitching together three or four tools instead of one photo and video delivery platform.
      </p>
      <p>
        A good <strong>photo and video delivery platform</strong> handles the whole hand-off: big files, a clean viewing
        experience, feedback on specific moments, your branding, and a download that just works. Most products were built
        for one slice of that. Gallery platforms grew up around weddings and portraits. Video review tools grew up around
        post-production teams. File transfer services were built to move bytes, not to impress clients.
      </p>
      <p>
        ShootPortal was built for the whole hand-off. Review, payment, and download live on one project in your branded
        portal, next to the proposal and messages, so the client gets one link instead of a gallery, a review link, a
        transfer, and an invoice.{" "}
        {ctx.studioMonthly ? <>It&apos;s one {ctx.studioMonthly}/month plan with every feature included. </> : null}
        Below we compare it with the three other categories. If you deliver mainly listing media, our{" "}
        <BlogLink slug="best-real-estate-photography-delivery-software">real estate delivery software comparison</BlogLink>{" "}
        is the more specific read. Competitor prices and file limits come from official vendor pages, checked October
        15, 2026.
      </p>
    </>
  ),
  sections: [
    {
      id: "generic-tools",
      title: "Where email, Google Drive, Dropbox, and WeTransfer fall short",
      tocLabel: "Limits of generic tools",
      body: () => (
        <>
          <p>
            Almost everyone starts with tools they already pay for. They&apos;re reliable at moving files. They just
            aren&apos;t delivery platforms.
          </p>
          <h3>Email attachments</h3>
          <p>
            Fine for a single headshot, useless for anything else. Mail providers cap attachment sizes, clients&apos;
            inboxes compress or block large files, and there&apos;s no way to tell which version is current.
          </p>
          <h3>Google Drive</h3>
          <p>
            Drive handles very large files (Google states up to 5 TB per file) and storage is inexpensive through{" "}
            <Ext href="https://one.google.com/about/plans">Google One plans</Ext>, from 15 GB free to 5 TB. But the client
            sees Google&apos;s interface, not yours, and there are no approvals, time-stamped video comments, or payment
            gate. Permission mistakes (&quot;request access&quot;) are a common first impression.
          </p>
          <h3>Dropbox, Dropbox Transfer, and Replay</h3>
          <p>
            Dropbox Transfer is a step up for delivery: Standard and higher plans add custom expiration, passwords, and
            custom logos and backgrounds. Transfer sizes range from 2 GB on Basic to 100 GB on Standard, and Transfers on
            Basic and Plus expire after 7 days. Dropbox Replay, a separate add-on, adds frame-level comments and
            approvals for video. See <Ext href="https://www.dropbox.com/plans">Dropbox plans</Ext> and{" "}
            <Ext href="https://www.dropbox.com/replay">Replay pricing</Ext>.
          </p>
          <h3>WeTransfer</h3>
          <p>
            WeTransfer is the default for &quot;just send the file.&quot; The free plan allows 10 transfers or 3 GB per
            rolling 30 days; the top Ultimate plan allows transfers up to 1 TB with branded pages, passwords, and custom
            expiration. We couldn&apos;t verify current prices, so check{" "}
            <Ext href="https://wetransfer.com/pricing">WeTransfer&apos;s pricing page</Ext>. The catch is that every
            transfer expires and nothing ties it to the job, the invoice, or the feedback.
          </p>
          <Callout tone="note" title="The real cost of generic tools">
            <p>
              None of these are bad products. The cost is in what happens around them: a separate payment link, feedback
              in an email thread, and a client who can&apos;t find last month&apos;s link when they need the files again.
            </p>
          </Callout>
          <ProductCallout title="Files that stay put, on a page with your name on it">
            <p>
              In ShootPortal, every delivery lives on the client&apos;s project in your branded portal, so it doesn&apos;t
              expire and the client can find it next month. Uploads are resumable, the payment button sits beside the
              files, and downloads can stay locked until the invoice is paid.
            </p>
          </ProductCallout>
          <p>
            For a deeper head-to-head on cloud storage, see{" "}
            <BlogLink slug="google-drive-vs-dropbox-photo-delivery">Google Drive vs. Dropbox vs. dedicated delivery software</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "gallery-platforms",
      title: "Gallery platforms: built for browsing, proofing, and selling",
      tocLabel: "Gallery platforms",
      body: () => (
        <>
          <p>
            Client gallery platforms are the natural home for portrait, wedding, and event photographers. They&apos;re
            polished, client-friendly, and most include a store for prints and digital downloads. Video support has
            improved but still comes with per-plan limits, and none of them handle a paid project with video revisions.
          </p>
          <ToolCard
            id="pv-pixieset"
            name="Pixieset Client Gallery"
            url="https://pixieset.com/pricing/"
            tagline="The most widely recognized gallery for portrait and wedding photographers"
            pricing={
              <>
                Free (3 GB), Basic $10/mo (10 GB), Plus $20/mo (100 GB), Pro $30/mo (1 TB), Ultimate $50/mo (unlimited);
                about 20% less billed annually. <Ext href="https://pixieset.com/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Photographers selling prints and downloads who deliver some video."
            pros={["Integrated store with lab fulfillment", "Configurable download sizes; custom domain from Basic", "No stated per-file video size limit"]}
            cons={["Video is metered in minutes by plan (Basic: 30 minutes HD)", "4K downloads only on Pro and Ultimate", "No time-stamped video comments found"]}
          />
          <ToolCard
            id="pv-pictime"
            name="Pic-Time"
            url="https://www.pic-time.com/pricing"
            tagline="Gallery and print-sales platform with generous long-form video"
            pricing={
              <>
                Free, Beginner $8/mo, Professional $25/mo, Advanced $50/mo (lower billed annually).{" "}
                <Ext href="https://www.pic-time.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who deliver highlight films alongside galleries."
            pros={["Featured videos up to 90 minutes / 20 GB, up to 4K", "Custom branding from Beginner; custom domain from Professional"]}
            cons={["Regular clips capped at 3 minutes / 3 GB", "Commission applies to payments Pic-Time collects on some tiers"]}
          />
          <ToolCard
            id="pv-shootproof"
            name="ShootProof"
            url="https://www.shootproof.com/pricing/"
            tagline="Galleries plus contracts and invoicing, commission-free sales"
            pricing={
              <>
                Free (3 GB, photos only), Starter $9.99/mo, Standard $19.99/mo, Professional $31.99/mo, Premium $60/mo.{" "}
                <Ext href="https://www.shootproof.com/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Portrait and event studios that want galleries, contracts, and invoices from one vendor."
            pros={["Commission-free sales on every plan", "Video up to 4K on paid plans; help docs list files up to 20 GB / 60 minutes"]}
            cons={["Video uploads via the web uploader only", "Download All is disabled above 2,500 files"]}
          />
          <ToolCard
            id="pv-smugmug"
            name="SmugMug"
            url="https://www.smugmug.com/plans"
            tagline="Unlimited photo storage with portfolio sites and sales"
            pricing={
              <>
                Direct $20/mo, Portfolio $23.50/mo, Pro $37/mo (billed annually); 14-day free trial.{" "}
                <Ext href="https://www.smugmug.com/plans">Official pricing</Ext>
              </>
            }
            bestFor="Photographers with large archives who mainly deliver stills."
            pros={["Unlimited photo storage on all plans", "Client favoriting and download limits on Pro"]}
            cons={["Video capped at 20 minutes and 3 GB per file", "Video display copies top out at 1080p"]}
          />
          <ToolCard
            id="pv-zenfolio"
            name="Zenfolio"
            url="https://zenfolio.com/plans/"
            tagline="Portfolio, galleries, and selling with an optional booking add-on"
            pricing={
              <>
                Basic $9/mo, Professional $23/mo, Advanced $40/mo (lower billed annually; an annual promo ran through
                October 15, 2026). <Ext href="https://zenfolio.com/plans/">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who want a portfolio site and galleries in one subscription."
            pros={["4K video on Advanced", "Booking and scheduling included on Advanced"]}
            cons={["7% commerce fee per order on selling plans", "Zenfolio's own pages give conflicting video size limits, so confirm"]}
          />
        </>
      ),
    },
    {
      id: "video-review-tools",
      title: "Video review tools: built for feedback, not for clients",
      tocLabel: "Video review tools",
      body: () => (
        <>
          <p>
            Post-production teams solved the revision problem years ago with time-coded comments: the reviewer pauses at
            0:23, types a note, and the editor sees exactly which frame it refers to. These tools are good at that, but
            they have no payment step, no stills-gallery experience, and no concept of the project around the video.
            They&apos;re also another subscription, usually priced per member or per user.
          </p>
          <ToolCard
            id="pv-frameio"
            name="Frame.io"
            url="https://frame.io/pricing"
            tagline="Adobe's review and approval platform for video teams"
            pricing={
              <>
                Free (2 GB), Pro $15/member/mo, Team $25/member/mo, Enterprise custom; annual saves 13%.{" "}
                <Ext href="https://frame.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Editing teams and agencies trading notes inside Premiere Pro or Final Cut Pro."
            pros={[
              "Frame-accurate and range-based comments with annotations",
              "Files up to 5 TB per asset",
              "Branded, passphrase-protected, expiring shares on Pro",
              "Premiere Pro and Final Cut Pro integrations, so editors can work on comments from the timeline",
            ]}
            cons={["No proposals, payments, or photo gallery", "Priced per member, which adds up for small teams"]}
          />
          <ToolCard
            id="pv-vimeo"
            name="Vimeo review links"
            url="https://vimeo.com/upgrade-plan"
            tagline="Time-coded review built into a video host"
            pricing={
              <>
                We couldn&apos;t verify current plan prices. See{" "}
                <Ext href="https://vimeo.com/upgrade-plan">Vimeo&apos;s plans page</Ext>.
              </>
            }
            bestFor="Videographers who already host on Vimeo."
            pros={["Time-coded comments on the timeline; reviewers don't need an account", "New versions keep the same link and comment history"]}
            cons={["Free plans get one review link per video and no password protection", "Custom branding is paid-only"]}
          />
          <ToolCard
            id="pv-wipster"
            name="Wipster"
            url="https://wipster.io/pricing"
            tagline="Simple review and approval for small creative teams"
            pricing={
              <>
                Light $9.95/mo billed annually ($11.95 monthly, 50 GB); Team $19.95/user/mo annually.{" "}
                <Ext href="https://wipster.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Small video teams wanting a review-only tool."
            pros={["Free trial with no credit card", "Custom branding and team-only comments on Team"]}
            cons={["No payments or client gallery", "Branding requires the per-user Team plan"]}
          />
          <p>
            Dropbox Replay belongs in this group too: it supports uploads up to 150 GB, media up to 12 hours, real-time
            comments and markup, and approvals, as a per-user add-on to a Dropbox plan.
          </p>
          <h3>The client-facing alternative: review inside the project</h3>
          <p>
            If your reviewers are clients rather than editors, you don&apos;t need a separate review suite. ShootPortal
            works as a Dropbox Replay or Frame.io alternative for client feedback: the client opens the video in your
            portal, pins comments to a moment and a spot on the frame, you reply in threads and resolve them, and new
            cuts land as numbered versions. When they approve, the invoice and the download are already on the same
            page. It&apos;s included in the plan, with no per-user add-on.
          </p>
          <Figure caption="Real ShootPortal screens: on the left, your review of version 2 with time-stamped comments, replies, and Resolve buttons; on the right, the client commenting on the film from a phone, with no app or extra account.">
            <TwoSidedScreens business="video-review" client="phone-video-review" />
          </Figure>
          <p>
            For a fuller comparison of review tools, see our{" "}
            <BlogLink slug="best-video-review-approval-software">video review and approval software guide</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "large-files-and-branding",
      title: "Large video files, downloads, and branding",
      tocLabel: "File limits & branding",
      body: () => (
        <>
          <p>
            The quickest way to rule platforms out is to check their per-file video limits against your longest
            deliverable. A 4K drone reel or an unedited event recording can blow past a 3 GB cap easily.
          </p>
          <ComparisonTable
            caption="Published video and transfer limits, October 2026"
            columns={["Platform", "Published per-file limit", "Notes"]}
            rows={[
              ["ShootPortal", "Per-file limit not published", "Resumable uploads recover from a dropped connection"],
              ["Google Drive", "Up to 5 TB", "Storage limited by your Google One plan"],
              ["Frame.io", "Up to 5 TB per asset (web app)", "Storage by plan and member count"],
              ["Dropbox Transfer", "2 GB (Basic) to 100 GB (Standard+)", "250 GB on Business Plus/Enterprise or with Replay"],
              ["Dropbox Replay", "150 GB uploads, up to 12 hr media", "Paid add-on"],
              ["WeTransfer", "3 GB per 30 days free; up to 1 TB per transfer (Ultimate)", "Transfers expire"],
              ["Pic-Time", "3 GB clips; 20 GB / 90 min featured videos", "Mobile app uploads capped at 1 GB"],
              ["ShootProof", "Up to 20 GB / 60 min", "Per an older help article"],
              ["SmugMug", "3 GB / 20 min", "Display copies up to 1080p"],
              ["Pixieset", "No per-file limit stated", "Metered by plan video minutes"],
            ]}
            note={
              <>
                Competitor limits from each vendor&apos;s official help or pricing pages, checked October 15, 2026.
                Zenfolio&apos;s pages conflict (3 GB vs. 20 GB), so it&apos;s omitted; confirm on{" "}
                <Ext href="https://zenfolio.com/plans/">Zenfolio&apos;s site</Ext>.
              </>
            }
          />
          <h3>The download experience</h3>
          <p>
            Clients judge delivery by the download, not the upload. Check three things on every platform you trial:
            whether a client can grab one file or a ZIP of the whole set, whether they can pick a web size or the full
            original, and what happens when they open the link on a phone over cellular data. Expiring links are a
            hidden cost here: a client who needs a file six months later shouldn&apos;t have to email you.
          </p>
          <h3>Client branding</h3>
          <p>
            Branding ranges from a logo on a third-party page to a custom domain. File transfer tools reserve branding
            for upper tiers (Dropbox Standard and up, WeTransfer Ultimate), and video review tools tend to gate it behind
            paid or per-member plans. ShootPortal puts your logo and colors on the portal, emails, and checkout on every
            account, with custom domains for the portal, your website, and property sites.
          </p>
          <p>
            We cover bitrate math, email limits, and transfer options in{" "}
            <BlogLink slug="how-to-send-large-video-files-to-clients">how to send large video files to clients</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "managing-revisions",
      title: "Managing revisions without the email thread",
      tocLabel: "Managing revisions",
      body: () => (
        <>
          <p>
            Revisions are where delivery breaks down for most creative businesses. A client watches the cut on their
            phone, sends &quot;can we change the part near the beginning with the drone shot?&quot;, and you spend the
            next ten minutes scrubbing to guess which part they mean. Multiply that by two rounds and three
            stakeholders.
          </p>
          <p>A workable revision process has four parts:</p>
          <ol>
            <li>
              <strong>Feedback anchored to a moment.</strong> Comments tied to a timestamp (and ideally a spot on the
              frame) remove the guessing.
            </li>
            <li>
              <strong>Numbered versions.</strong> Everyone should know whether they&apos;re looking at v2 or v3, and old
              comments should stay attached to the version they were written on.
            </li>
            <li>
              <strong>Resolve and reopen.</strong> You need to mark a note as handled and have the client confirm.
            </li>
            <li>
              <strong>Explicit approval.</strong> A clear &quot;approved&quot; replaces &quot;looks good I think?&quot;
              and tells you when to send the final invoice.
            </li>
          </ol>
          <Figure caption="Conceptual diagram: time-stamped comments pinned to points in a video, across numbered versions.">
            <VideoReviewDiagram />
          </Figure>
          <p>
            ShootPortal covers all four inside the client portal: comments are time-stamped and pinned to a spot on the
            frame, replies are threaded, notes can be resolved and reopened, videos carry numbered versions, and the
            client approves or requests changes on each deliverable. Comment notifications are batched, so the client
            isn&apos;t flooded with emails. Photos get the same approve-or-request-changes step with a written note, and
            when a photo needs a fix you make it in the built-in editor and save it straight back to the gallery. The{" "}
            <SiteLink href="/video-review-approval-software">video review and approval software</SiteLink> page walks
            through a full review round.
          </p>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Photo and video delivery platforms compared",
      tocLabel: "Comparison table",
      body: (ctx) => (
        <>
          <p>
            A side-by-side view of the categories. &quot;Not stated&quot; means we couldn&apos;t confirm it on an
            official page.
          </p>
          <ComparisonTable
            caption="Photo and video delivery platform comparison, October 2026"
            columns={[
              "Platform",
              "Category",
              "Time-coded video comments",
              "Client approval step",
              "Takes client payment",
              "Print store / favorites",
              "Starting paid price",
            ]}
            rows={[
              ["ShootPortal", "All-in-one client portal", <Yes key="a">Pinned to frame, versions</Yes>, <Yes key="a1">Approve or request changes per item</Yes>, <Yes key="b">Project payments via your Stripe; optional download lock</Yes>, <Yes key="b1">Favorites (no print store)</Yes>, ctx.studioMonthly ? `${ctx.studioMonthly}/mo, all features` : <SiteLink key="c" href="/pricing">See pricing</SiteLink>],
              ["Pixieset", "Gallery", <No key="d">Not found</No>, <Yes key="d1">Favorites / proofing</Yes>, <Yes key="e">Store</Yes>, <Yes key="e1" />, "$10/mo"],
              ["Pic-Time", "Gallery", <No key="f">Not found</No>, "Not stated", <Yes key="g">Store</Yes>, <Yes key="g1">Print store</Yes>, "$8/mo"],
              ["ShootProof", "Gallery", <No key="h">Not found</No>, "Not stated", <Yes key="i">Store, invoices</Yes>, <Yes key="i1">Store</Yes>, "$9.99/mo"],
              ["SmugMug", "Gallery", <No key="j">Not found</No>, <Yes key="j1">Favoriting (Pro)</Yes>, <Yes key="k">Portfolio plan+</Yes>, <Yes key="k1" />, "$20/mo (annual)"],
              ["Zenfolio", "Gallery", <No key="l">Not found</No>, "Not stated", <Yes key="m">Professional+</Yes>, <Yes key="m1">Selling on Pro+</Yes>, "$9/mo"],
              ["Frame.io", "Video review", <Yes key="n">Frame-accurate</Yes>, "Not confirmed on pricing page", <No key="o" />, <No key="o1" />, "$15/member/mo"],
              ["Vimeo review", "Video review", <Yes key="p" />, <Yes key="p1">&quot;Approved&quot; status</Yes>, <No key="q">Not stated</No>, <No key="q1" />, "Not verified"],
              ["Wipster", "Video review", "Not stated on pricing page", "Not stated", <No key="r" />, <No key="r1" />, "$9.95/mo (annual)"],
              ["Dropbox + Replay", "Storage / review", <Yes key="s">With Replay</Yes>, <Yes key="s1">With Replay</Yes>, <No key="t" />, <No key="t1" />, "$9.99/mo (Plus)"],
              ["WeTransfer", "File transfer", <No key="u" />, <No key="u1" />, <No key="v" />, <No key="v1" />, "Not verified"],
              ["Google Drive", "Storage", <No key="w" />, <No key="w1" />, <No key="x" />, <No key="x1" />, "$1.99/mo (100 GB)"],
            ]}
            note={
              <>
                Read across a row: ShootPortal is the only platform here that covers video comments, an approval step,
                and payment on the same project. Prices are monthly list prices from official pages on October 15, 2026
                (Pixieset, Pic-Time, ShootProof, SmugMug, Zenfolio, Frame.io, Wipster, Dropbox, Google One). Vimeo and
                WeTransfer prices could not be verified; see <Ext href="https://vimeo.com/upgrade-plan">Vimeo</Ext> and{" "}
                <Ext href="https://wetransfer.com/pricing">WeTransfer</Ext>.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "shootportal-delivery",
      title: "How ShootPortal handles photo and video delivery",
      tocLabel: "ShootPortal delivery",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is our product, built by the owner of a drone photography business. It&apos;s a branded client
            portal where delivery is one stage of a project that already holds the proposal, the shoot date, the message
            thread, and the payment status. That&apos;s the difference from every category above: the files don&apos;t
            live on a page by themselves, so the review and the invoice don&apos;t either. For the client, it&apos;s one
            link to watch, comment, approve, pay, and download, with nothing to install.
          </p>
          <ul>
            <li>
              <strong>Mixed media in one place:</strong> photos in folders, video files, YouTube embeds, Kuula 360
              tours, documents, and 3D or mapping embeds from Matterport, Polycam, Sketchfab, DroneDeploy, Pix4D, and
              others. That last part matters for drone operators delivering models and maps, not just footage.
            </li>
            <li>
              <strong>Large uploads:</strong> resumable uploads, so a big file can recover from a dropped connection.
            </li>
            <li>
              <strong>Editing:</strong> a built-in photo editor with one-click Auto, exposure, white balance, curves,
              HDR and B&amp;W looks, healing, and lens corrections. Copy adjustments across a set, and save straight back
              to the gallery; originals are never overwritten.
            </li>
            <li>
              <strong>Review:</strong> time-stamped, frame-pinned video comments with numbered versions; approve or
              request changes on every deliverable with written feedback, and client favorites on photos.
            </li>
            <li>
              <strong>Downloads:</strong> single files or a ZIP, with photos available as Print (original) or MLS
              (2048px) sizes.
            </li>
            <li>
              <strong>Payment:</strong> request payment from the project through your own Stripe account (card, Apple
              Pay, Google Pay, optional bank payments), and optionally keep downloads locked until the final payment
              clears. ShootPortal takes no cut.
            </li>
            <li>
              <strong>Sharing and branding:</strong> your logo, colors, and a custom domain; &quot;Anyone with the
              link&quot; project links, single photo and folder links, a public video watch page, and an embeddable video
              player for other websites.
            </li>
            <li>
              <strong>Listing marketing:</strong> for real estate jobs, a property website and a social and print
              marketing kit built from the delivered photos, which you can include or sell to the agent.
            </li>
          </ul>
          <Figure caption="Real ShootPortal screen: the built-in photo editor adjusting exposure, highlights, and shadows on a listing interior. Save, and the client's gallery and downloads update instantly.">
            <AppScreen view="photo-editor" />
          </Figure>
          <Figure caption="Conceptual diagram: upload, client review, optional payment, then download.">
            <DeliveryPathDiagram />
          </Figure>
          <h3>A delivery, start to finish</h3>
          <p>
            Take a commercial drone job for a builder: a two-minute progress film, forty stills, and a Pix4D model.
            You upload v1 of the film, the stills in folders, and the model embed to the project. The site manager
            pauses at 0:42, pins a comment on the crane they want cropped out, and approves the stills. You resolve the
            note and post v2 as the next numbered version. They approve v2, pay the balance on the same project, and the
            download buttons unlock: the film file, a ZIP of the stills at full resolution, and the model still embedded
            for their team to open.
          </p>
          <p>
            Most of it runs on its own: video-comment notifications are batched, client emails come from editable
            branded templates, reminders nudge an outstanding review or payment, and the project can move to Delivered
            and send the receipt once it&apos;s paid. You export from your editor and upload each version; ShootPortal
            handles the rest of the conversation.
          </p>
          <Figure caption="Real ShootPortal screen, the studio view: project board, client message, upload, and payment status (sample client data).">
            <ProductPreview view="studio" />
          </Figure>
          <InlineCta
            trialDays={ctx.trialDays}
            title="One link for the gallery, the review, the invoice, and the download"
            body="Put one real job through ShootPortal: upload the cut and the stills, collect comments on the frame, post V2, and let downloads unlock when the balance is paid."
          />
          <p>
            For galleries, review rounds, and download options in detail, see{" "}
            <SiteLink href="/photo-video-delivery-software">ShootPortal photo and video delivery software</SiteLink>.
          </p>
        </>
      ),
    },
    {
      id: "who-should-choose-shootportal",
      title: "When ShootPortal is the right delivery platform",
      tocLabel: "Is ShootPortal a fit?",
      body: () => (
        <>
          <p>
            The categories in this guide each own one piece: galleries own browsing, review tools own frame-level
            feedback, transfer services own raw size. If your client needs all of that on the same job, plus an invoice,
            you either stitch tools together or use one portal that holds the whole project. That&apos;s the case
            ShootPortal is built for, and we recommend it for the profiles below.
          </p>
          <BestFitPanel
            heading="Who should choose ShootPortal for delivery"
            fits={[
              {
                who: "Videographers selling to businesses",
                why: "Time-stamped comments pinned to the frame, numbered versions, and resolve or reopen, with the balance collected on the same project before the final file downloads.",
              },
              {
                who: "Drone operators with mixed deliverables",
                why: "Video, stills, Kuula tours, and DroneDeploy, Pix4D, or Matterport embeds on one project, so the client opens one link instead of three.",
              },
              {
                who: "Real estate photographers and videographers",
                why: "Print and MLS downloads, listing video review, and a property website and marketing kit you can sell to the agent.",
              },
              {
                who: "Anyone tired of chasing final payments",
                why: "Clients can view everything, but downloads can stay locked until the final payment clears through your own Stripe account.",
              },
            ]}
          />
          <p>
            Delivery is also only the last step. The same plan runs the website clients find you on, the request form,
            proposals, scheduling, and the automated emails in between.
          </p>
          <AllInOnePlatform />
        </>
      ),
    },
    {
      id: "how-to-choose",
      title: "Choosing the right platform for your work",
      tocLabel: "Recommendations",
      body: () => (
        <>
          <PickGrid
            items={[
              {
                who: "Photo, video, and drone deliverables per client",
                pick: "ShootPortal",
                why: "One portal for review, payment, and download across every media type.",
              },
              {
                who: "Real estate listings",
                pick: "ShootPortal",
                why: "MLS and Print sizes, tour embeds, pay-to-download, and a property website per listing.",
              },
              {
                who: "Replacing Dropbox Replay or Frame.io for clients",
                pick: "ShootPortal",
                why: "Frame-pinned comments, versions, and approvals included in the plan, beside the invoice.",
              },
              {
                who: "Commercial video for brands",
                pick: "ShootPortal",
                why: "Proposal, revision rounds, balance payment, and the master download on one project.",
              },
              {
                who: "Weddings and portraits with print sales",
                pick: "Pixieset, Pic-Time, or ShootProof",
                why: "Print stores are the core product; video and paid project delivery are secondary.",
              },
              {
                who: "One-off large transfers",
                pick: "Dropbox Transfer or WeTransfer",
                why: "Fast and familiar for a single file; no review, branding on lower tiers, or payment step.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Check per-file video limits against your longest deliverable before anything else.",
              "Gallery platforms are built for browsing and print sales; review tools for revisions. ShootPortal puts review, payment, and delivery on one project.",
              "Expiring transfer links are a hidden support cost months later.",
              <>
                If clients also need proposals and messages in the same place, see our{" "}
                <BlogLink slug="best-photography-client-portals">client portal comparison</BlogLink>.
              </>,
              <>
                Drone operators should also read{" "}
                <BlogLink slug="best-drone-business-management-software">drone business management software</BlogLink>.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "bottom-line",
      title: "The bottom line",
      body: (ctx) => (
        <>
          <p>
            &quot;Delivery&quot; means different things across niches. A wedding photographer selling albums wants a
            gallery store. But a real estate photographer, drone operator, or videographer handing over footage, stills,
            and a tour or 3D model needs all of it in one place, with the review and the invoice attached. For that
            work, the best photo and video delivery platform is ShootPortal.
          </p>
          <p>
            <SiteLink href="/how-it-works">See how ShootPortal&apos;s delivery and review work</SiteLink>, or keep
            comparing in our <BlogLink slug="best-photography-crm-software">photography CRM guide</BlogLink>.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Run one delivery through it"
            body="Upload a real cut and the stills from the same job, touch up a photo in the editor, collect time-stamped feedback, post V2, and let the download unlock when the balance is paid."
            secondaryHref="/#product-demo"
            secondaryLabel="Watch the demo"
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best way to deliver large video files to clients?",
      answerText:
        "Use a platform with a high per-file limit, resumable uploads, and a client-friendly page that doesn't expire. ShootPortal puts the video on the client's branded project with time-stamped review and an optional payment lock. For raw size, Frame.io and Google Drive accept files up to 5 TB, Dropbox Replay up to 150 GB, and Pic-Time featured videos up to 20 GB.",
      answer: (
        <p>
          Use a platform with a high per-file limit, resumable uploads, and a client-friendly page that doesn&apos;t
          expire. ShootPortal puts the video on the client&apos;s branded project with time-stamped review and an
          optional payment lock. For raw size, Frame.io and Google Drive accept files up to 5 TB, Dropbox Replay up to
          150 GB, and Pic-Time featured videos up to 20 GB.
        </p>
      ),
    },
    {
      question: "Is WeTransfer good enough for professional delivery?",
      answerText:
        "For a single transfer, yes. But transfers expire, branding needs a paid plan, and there's no approval, revision, or payment step. A delivery platform like ShootPortal keeps files on the client's project, with review and payment attached.",
      answer: (
        <p>
          For a single transfer, yes. But transfers expire, branding needs a paid plan, and there&apos;s no approval,
          revision, or payment step. A delivery platform like ShootPortal keeps files on the client&apos;s project, with
          review and payment attached.
        </p>
      ),
    },
    {
      question: "Which platforms support time-stamped video comments?",
      answerText:
        "ShootPortal, Frame.io, Vimeo review links, Dropbox Replay, and Filestage support time-coded video comments. We found no evidence of the feature in Pixieset, Pic-Time, ShootProof, SmugMug, or Zenfolio.",
      answer: (
        <p>
          ShootPortal, Frame.io, Vimeo review links, Dropbox Replay, and Filestage support time-coded video comments. We
          found no evidence of the feature in Pixieset, Pic-Time, ShootProof, SmugMug, or Zenfolio.
        </p>
      ),
    },
    {
      question: "What is a good Dropbox Replay alternative for client video review?",
      answerText:
        "ShootPortal. Clients leave comments pinned to a timestamp and a spot on the frame, you reply in threads and resolve them, new cuts become numbered versions, and the client approves, pays, and downloads on the same project. It's included in the plan instead of a per-user add-on.",
      answer: (
        <p>
          ShootPortal. Clients leave comments pinned to a timestamp and a spot on the frame, you reply in threads and
          resolve them, new cuts become numbered versions, and the client approves, pays, and downloads on the same
          project. It&apos;s included in the plan instead of a per-user add-on.
        </p>
      ),
    },
    {
      question: "Can clients pay before downloading their photos and videos?",
      answerText:
        "Gallery platforms sell prints and downloads through a store. ShootPortal can keep downloads locked until the final project payment clears, while clients still view everything, and unlocks them automatically when they pay. File transfer and video review tools generally have no payment step.",
      answer: (
        <p>
          Gallery platforms sell prints and downloads through a store. ShootPortal can keep downloads locked until the
          final project payment clears, while clients still view everything, and unlocks them automatically when they
          pay. File transfer and video review tools generally have no payment step.
        </p>
      ),
    },
    {
      question: "Does ShootPortal have client favorites or a print store?",
      answerText:
        "Clients can heart their favorite photos in the ShootPortal portal. ShootPortal doesn't run a print store; it's built for paid project delivery, where the client pays for the job and downloads Print or MLS-size files, with video review, a built-in photo editor, and listing marketing on the same project.",
      answer: (
        <p>
          Clients can heart their favorite photos in the ShootPortal portal. ShootPortal doesn&apos;t run a print store;
          it&apos;s built for paid project delivery, where the client pays for the job and downloads Print or MLS-size
          files, with video review, a built-in photo editor, and listing marketing on the same project.
        </p>
      ),
    },
  ],
  related: ["best-real-estate-photography-delivery-software", "best-photography-client-portals", "best-drone-business-management-software"],
  cta: {
    title: "One link for review, payment, and delivery.",
    body: "Upload photos, video, and 3D or map embeds, collect time-stamped comments across versions, take payment through your own Stripe, and unlock downloads clients can find again.",
    secondaryHref: "/#product-demo",
    secondaryLabel: "Watch the demo",
  },
};
