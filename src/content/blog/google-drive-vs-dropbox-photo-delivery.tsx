import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  No,
  PickGrid,
  SiteLink,
  Yes,
} from "@/components/blog/article-parts";
import { BeforeAfter } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { BestFitPanel, TrialCard, WorkflowCoverageMap } from "@/components/blog/conversion-parts";

export const article: BlogArticle = {
  slug: "google-drive-vs-dropbox-photo-delivery",
  title: "Google Drive vs. Dropbox vs. Dedicated Photo Delivery Software: What's Best for Photographers?",
  seoTitle: "Google Drive vs Dropbox vs Photo Delivery Software (2026)",
  description:
    "Need a Google Drive alternative for photographers? Compare Drive, Dropbox, and dedicated photo delivery software on price, branding, payments, and client experience.",
  excerpt:
    "Drive and Dropbox are cheap, reliable storage. Dedicated delivery software is built for the client handoff. Here's how they compare on price, sharing controls, branding, and payments, and when to use both.",
  category: "software-comparisons",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  disclosure: true,
  primaryKeyword: "Google Drive alternative for photographers",
  secondaryKeywords: [
    "Google Drive vs Dropbox for photographers",
    "Dropbox alternative for photographers",
    "photo delivery software",
    "best way to deliver photos to clients",
    "client photo delivery",
  ],
  readingMinutes: 12,
  cover: {
    variant: "folders",
    tint: "indigo",
    label: "Comparison",
    alt: "Illustration of generic cloud folders beside a branded photo delivery page",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>For storage and backup</strong>, Google Drive and Dropbox are hard to beat. Both list 2 TB for $9.99 a
        month on their personal plans.
      </>,
      <>
        <strong>For sharing controls</strong>, Dropbox gates link expiry, passwords, and branding behind its higher
        plans; Drive offers download blocking on personal accounts but access expiry only on eligible work or school
        accounts.
      </>,
      <>
        <strong>For the client handoff</strong>, dedicated delivery software wins: your branding, download sizes,
        proofing or approvals, and payment in the same place.
      </>,
      <>
        <strong>Most working photographers use both</strong>: cloud storage as the archive, a delivery tool as the
        storefront.
      </>,
      <>
        <strong>Pick the delivery tool by niche</strong>: galleries for portrait and wedding, real estate platforms for
        listings, an integrated portal if you want projects, delivery, and payments together.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        Nearly every photographer starts delivering through a shared Google Drive or Dropbox folder. It&apos;s already
        paid for, clients know how to open a link, and it works. The question usually comes later, around the time you
        notice you&apos;re sending the same &quot;here&apos;s the link, let me know once you&apos;ve paid&quot; email
        for the fortieth time, or a client says they can&apos;t find the folder from last month.
      </p>
      <p>
        This comparison looks at three options honestly: <strong>Google Drive</strong>, <strong>Dropbox</strong>, and{" "}
        <strong>dedicated photo delivery software</strong>. We&apos;ll use pricing and sharing limits from each
        company&apos;s own pages, point out where those pages contradict each other, and end with a recommendation by
        business size. If you&apos;re specifically searching for a Google Drive alternative for photographers, the short
        version is that you probably don&apos;t need to replace Drive. You need to stop asking it to be your client
        experience.
      </p>
    </>
  ),
  sections: [
    {
      id: "storage-vs-delivery",
      title: "Storage and delivery are two different jobs",
      tocLabel: "Storage vs delivery",
      body: () => (
        <>
          <p>
            Before comparing features, separate the two jobs a &quot;file sharing&quot; tool does for a photographer:
          </p>
          <ul>
            <li>
              <strong>Storage:</strong> keeping originals, edits, and exports safe, synced across devices, and
              recoverable. Price per terabyte and reliability matter most. Clients never see it.
            </li>
            <li>
              <strong>Delivery:</strong> the moment a client receives finished work. Presentation, download options,
              feedback, and payment matter most. It&apos;s part of your product.
            </li>
          </ul>
          <p>
            Google Drive and Dropbox are storage products with sharing features added on. Dedicated delivery platforms
            are client-facing products that happen to store files. Most of the frustration photographers have with Drive
            and Dropbox comes from using a storage tool for a delivery job.
          </p>
          <Figure caption="Conceptual comparison: delivering through generic shared folders versus a dedicated delivery page. Illustrative only.">
            <BeforeAfter
              beforeTitle="Shared folder delivery"
              afterTitle="Dedicated delivery"
              before={[
                "Same generic interface for every client",
                "You export web and full-res sets separately",
                "Feedback arrives by email or text",
                "Invoice sent from a different app",
                "Downloads available whether or not you're paid",
                "Clients search their inbox for old links",
              ]}
              after={[
                "Your logo, colors, and often your domain",
                "Download size options built in (varies by platform)",
                "Approvals, proofing, or comments on the files",
                "Payment collected in the same flow on many platforms",
                "Downloads can wait for payment on some platforms",
                "Past deliveries in one client login or gallery list",
              ]}
            />
          </Figure>
        </>
      ),
    },
    {
      id: "google-drive",
      title: "Google Drive for photographers: pros and cons",
      tocLabel: "Google Drive",
      body: () => (
        <>
          <p>
            For personal accounts, Drive storage comes through Google One. Google lists these plans (
            <Ext href="https://one.google.com/about/plans">Google One plans</Ext>):
          </p>
          <ul>
            <li>Free: 15 GB</li>
            <li>Basic: 100 GB for $1.99/month</li>
            <li>Google AI Plus: 2 TB for $9.99/month</li>
            <li>Google AI Pro: 5 TB for $19.99/month</li>
          </ul>
          <p>
            Google says annual billing saves up to 16%. If you want business email and shared team storage, Google
            Workspace lists Business Starter at $7, Business Standard at $14, and Business Plus at $22 per user per month
            on monthly billing, with 30 GB, 2 TB, and 5 TB of pooled storage per user respectively (
            <Ext href="https://workspace.google.com/pricing">Google Workspace pricing</Ext>). Google runs promotions on
            Workspace regularly, so check the page for current offers.
          </p>
          <h3>What Drive does well</h3>
          <ul>
            <li>
              <strong>Cheap, generous storage.</strong> 2 TB for $9.99 a month is a strong price for archiving RAW files.
            </li>
            <li>
              <strong>Huge file limits.</strong> Individual files can be up to 5 TB, with a 750 GB per-user daily upload
              limit (<Ext href="https://support.google.com/drive/answer/37603">Drive file limits</Ext>).
            </li>
            <li>
              <strong>Everyone already has it.</strong> Most clients have a Google account and know the interface.
            </li>
            <li>
              <strong>Download blocking on personal accounts.</strong> File owners can stop viewers and commenters from
              downloading, printing, or copying (
              <Ext href="https://support.google.com/drive/answer/2494822">Drive sharing settings</Ext>).
            </li>
          </ul>
          <h3>Where Drive falls short for delivery</h3>
          <ul>
            <li>
              <strong>Access expiry is limited to work or school accounts.</strong> Google says expiration dates are
              &quot;only available for eligible work or school accounts,&quot; so a personal Google One plan can&apos;t
              set a link to expire.
            </li>
            <li>
              <strong>No branding.</strong> Every delivery looks like Google Drive.
            </li>
            <li>
              <strong>No built-in web/print sizes.</strong> You export and upload each size yourself.
            </li>
            <li>
              <strong>Download blocking is manual.</strong> You can block downloads while a client is unpaid, but you have
              to remember to turn it back on after they pay. Nothing connects it to an invoice.
            </li>
            <li>
              <strong>Feedback is generic.</strong> Comments exist, but there&apos;s no photo proofing, approval status, or
              time-stamped video review.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "dropbox",
      title: "Dropbox for photographers: pros and cons",
      tocLabel: "Dropbox",
      body: () => (
        <>
          <p>
            Dropbox&apos;s plans page shows prices with yearly billing selected by default (
            <Ext href="https://www.dropbox.com/plans">Dropbox plans</Ext>):
          </p>
          <ul>
            <li>Plus: $9.99/month for one person, 2 TB, 50 GB transfers</li>
            <li>Standard: $15 per user/month, starting at 3 TB for the team, 100 GB transfers</li>
            <li>Advanced: $24 per user/month (3+ users), starting at 15 TB, 100 GB transfers</li>
          </ul>
          <p>
            Monthly billing costs more; check the plans page for current monthly figures.
          </p>
          <h3>What Dropbox does well</h3>
          <ul>
            <li>
              <strong>Excellent desktop sync.</strong> Many photographers prefer Dropbox&apos;s sync for working files and
              editor handoffs.
            </li>
            <li>
              <strong>Dropbox Transfer</strong> for one-off sends: 50 GB on Plus and 100 GB on Standard and Advanced, per
              Dropbox&apos;s help center (<Ext href="https://help.dropbox.com/share/dropbox-transfer">Dropbox Transfer</Ext>).
            </li>
            <li>
              <strong>Sharing controls on higher plans.</strong> Standard and Advanced list password protection and the
              ability to brand files you share.
            </li>
            <li>
              <strong>Dropbox Replay</strong> as an add-on for video review with frame-accurate comments (
              <Ext href="https://www.dropbox.com/replay">Dropbox Replay</Ext>).
            </li>
          </ul>
          <h3>Where Dropbox falls short for delivery</h3>
          <ul>
            <li>
              <strong>Plus lacks the controls photographers want most.</strong> Dropbox&apos;s help center says link
              expiration isn&apos;t available on Basic or Plus (
              <Ext href="https://help.dropbox.com/share/set-link-permissions">Dropbox link permissions</Ext>), and branded
              sharing isn&apos;t available on Plus (
              <Ext href="https://help.dropbox.com/share/branded-sharing">Dropbox branded sharing</Ext>).
            </li>
            <li>
              <strong>Transfers expire.</strong> On Basic, Plus, and Family, transfers expire after 7 days; higher plans
              default to 30 days with custom expiry. Clients often come back for files after that.
            </li>
            <li>
              <strong>Branding is limited.</strong> Where available, it adds a logo and background to shared links, but
              Dropbox notes branding shows only on certain file types.
            </li>
            <li>
              <strong>No payments or proofing.</strong> Like Drive, there&apos;s no link between a delivery and an invoice.
            </li>
          </ul>
          <Callout tone="note" title="Dropbox's own pages don't fully agree">
            <p>
              The current US plans page lists Basic, Plus, Standard, Advanced, and Enterprise, but several help-center
              articles still reference Essentials, Business, and Business Plus, and they disagree on which of those
              include password-protected links. If a specific sharing feature matters to you, confirm it on your own
              account before you build your delivery process around it.
            </p>
          </Callout>
        </>
      ),
    },
    {
      id: "drive-vs-dropbox",
      title: "Google Drive vs. Dropbox for photographers: head to head",
      tocLabel: "Drive vs Dropbox",
      body: () => (
        <>
          <p>
            At the 2 TB personal tier, the two cost the same. The differences are in sharing controls and workflow
            preference.
          </p>
          <ComparisonTable
            caption="Google Drive versus Dropbox for photographers, personal and business tiers"
            columns={["", "Google Drive", "Dropbox"]}
            rows={[
              ["2 TB personal plan", "Google AI Plus, $9.99/mo", "Plus, $9.99/mo (billed yearly)"],
              ["Business/team plans", "Workspace from $7/user/mo (30 GB)", "Standard $15/user/mo (billed yearly)"],
              ["Sending large files", "Files up to 5 TB", "Transfer: 50 GB (Plus), 100 GB (Standard)"],
              ["Block downloads for viewers", <Yes key="a">Personal accounts too</Yes>, "See plan details"],
              ["Link expiry", <No key="b">Work/school accounts only</No>, <No key="c">Not on Basic or Plus</No>],
              ["Password links", <No key="d">No link passwords</No>, <Yes key="e">Standard and up</Yes>],
              ["Branded sharing", <No key="f" />, <Yes key="g">Higher plans; not Plus</Yes>],
              ["Payments tied to delivery", <No key="h" />, <No key="i" />],
              ["Photo proofing / approvals", <No key="j" />, <No key="k" />],
            ]}
            note="From Google and Dropbox pricing and help pages, checked 2026-10-15. Dropbox help articles conflict on some plan features; verify on your account."
          />
          <p>
            <strong>Verdict:</strong> if you already pay for one of them, keep it. Neither is a meaningfully better
            delivery tool than the other at the personal tier. Dropbox&apos;s business plans add useful sharing controls;
            Drive&apos;s download blocking on personal accounts is handy. Both stop short of payments, proofing, and a
            branded client experience.
          </p>
        </>
      ),
    },
    {
      id: "dedicated-delivery",
      title: "Dedicated photo delivery software: three kinds",
      tocLabel: "Dedicated delivery",
      body: (ctx) => (
        <>
          <p>
            &quot;Photo delivery software&quot; covers several different product types. Which one fits depends on who
            your clients are.
          </p>
          <h3>1. Client gallery platforms (portrait, wedding, events)</h3>
          <p>
            Pixieset, Pic-Time, and ShootProof are built for clients who browse, favorite, share, and order prints. They
            handle download sizes, watermarks, and print stores well, and all three have free tiers. On paid plans:
          </p>
          <ul>
            <li>
              <strong>Pixieset</strong> lists Basic at $10/month ($8 billed annually) with 10 GB, up to Ultimate at
              $50/month with unlimited storage (<Ext href="https://pixieset.com/pricing/">Pixieset pricing</Ext>).
            </li>
            <li>
              <strong>Pic-Time</strong> lists Beginner at $8/month and Professional at $25/month, with separate photo and
              video storage allowances (<Ext href="https://www.pic-time.com/pricing">Pic-Time pricing</Ext>).
            </li>
            <li>
              <strong>ShootProof</strong> lists Starter at $9.99/month up to Premium at $60/month, with commission-free
              sales on all plans (<Ext href="https://www.shootproof.com/pricing/">ShootProof pricing</Ext>).
            </li>
          </ul>
          <h3>2. Real estate delivery platforms</h3>
          <p>
            Aryeo and HDPhotoHub are built around listings: property-based delivery, MLS sizes, and marketing extras.
            Aryeo&apos;s Lite plan is free and includes branded delivery pages, with Pro from $49/month (
            <Ext href="https://www.aryeo.com/pricing">Aryeo pricing</Ext>). HDPhotoHub uses credits instead of a
            subscription; delivery-only for a property costs 5 credits, and a property with a marketing kit costs 15 (
            <Ext href="https://www.learn.hdphotohub.com/copy-of-pricing">HDPhotoHub pricing</Ext>). If you shoot
            listings, our{" "}
            <BlogLink slug="best-real-estate-photography-delivery-software">real estate photography delivery software</BlogLink>{" "}
            comparison covers these in depth.
          </p>
          <h3>3. Integrated client portals</h3>
          <p>
            The third approach treats delivery as one stage of a project that also includes the estimate, scheduling,
            messages, and payment. ShootPortal is our product in this category. Each project holds photos in folders,
            video files, YouTube embeds, Kuula 360 tours, 3D model embeds such as Matterport, and documents. Clients
            download photos as &quot;Print&quot; (original full-resolution) or &quot;MLS&quot; (2048 px on the long edge),
            one at a time or as a ZIP, and approve or reject each deliverable with written feedback. Payment requests go
            through your own Stripe account, and an optional setting keeps downloads locked until the final payment while
            clients can still view the work.{" "}
            {ctx.studioMonthly ? (
              <>
                The Studio plan is {ctx.studioMonthly}/month
                {ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}, a flat subscription with no
                per-listing fees; Stripe&apos;s standard processing fees apply.
              </>
            ) : (
              <>
                See <SiteLink href="/pricing">current pricing</SiteLink>; it&apos;s a flat subscription, and Stripe&apos;s
                standard processing fees apply.
              </>
            )}
          </p>
          <p>
            The honest limits: ShootPortal has no print store, favorites, or gallery e-commerce, so portrait and wedding
            photographers who sell prints will be better served by a gallery platform. It doesn&apos;t build
            single-property websites or deliver to Zillow Showcase, which some real estate platforms do. Branding is your
            logo, colors, and your own subdomain or custom domain, not a full white-label.
          </p>
          <Figure caption="Product illustration: a ShootPortal project's media view, with a job's photos organized for the client (demo data).">
            <ProductPreview view="media" />
          </Figure>
          <p>
            For a broader roundup across all three categories, see{" "}
            <BlogLink slug="best-photo-video-delivery-platforms">the best photo and video delivery platforms</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "feature-comparison",
      title: "Feature comparison: Drive, Dropbox, and dedicated delivery",
      tocLabel: "Feature comparison",
      body: () => (
        <>
          <p>
            Here&apos;s how the three approaches compare on the things clients actually notice. &quot;Dedicated&quot;
            describes the category; individual products vary, so treat it as &quot;commonly available&quot; rather than
            guaranteed.
          </p>
          <ComparisonTable
            caption="Google Drive, Dropbox, and dedicated photo delivery software compared for client delivery"
            columns={["", "Google Drive", "Dropbox", "Dedicated delivery software", "ShootPortal (ours)"]}
            highlightColumn={3}
            rows={[
              ["Cost of storage per TB", <Yes key="a">Low</Yes>, <Yes key="b">Low</Yes>, "Usually higher; you pay for the client experience", "Flat subscription; not priced as a storage plan"],
              ["Archive and backup", <Yes key="c">Excellent</Yes>, <Yes key="d">Excellent</Yes>, <No key="e">Not the purpose; keep a separate archive</No>, <No key="e2">Keep Drive or Dropbox as the archive</No>],
              ["Your branding", <No key="f" />, "Higher plans; limited", <Yes key="g">Logo, colors, often custom domain</Yes>, <Yes key="g2">Logo, color, theme, custom domain (not white-label)</Yes>],
              ["Web and print download sizes", <No key="h">Export each yourself</No>, <No key="i">Export each yourself</No>, <Yes key="j">Common</Yes>, <Yes key="j2">Print (original) or MLS (2048 px), single or ZIP</Yes>],
              ["Client proofing or approvals", <No key="k" />, <No key="l" />, <Yes key="m">Favorites (galleries) or approve/reject (portals)</Yes>, <Yes key="m2">Approve or reject each item with feedback</Yes>],
              ["Payment tied to downloads", <No key="n" />, <No key="o" />, "Many platforms; check each", <Yes key="o2">Optional unlock after final payment</Yes>],
              ["Print store", <No key="p" />, <No key="q" />, "Gallery platforms, yes; portals and RE tools vary", <No key="q2" />],
              ["Video alongside photos", "Files only", "Files; Replay add-on for review", "Varies; check video limits per plan", <Yes key="q3">Video files plus time-stamped review</Yes>],
              ["Estimate, schedule, and messages with the delivery", <No key="q4" />, <No key="q5" />, "Integrated portals only", <Yes key="q6">Same project</Yes>],
              ["Client history in one place", <No key="r">Folders and inbox links</No>, <No key="s">Folders and inbox links</No>, <Yes key="t">Client login or gallery list</Yes>, <Yes key="t2">Client login with every project</Yes>],
              ["Learning curve for clients", "Familiar", "Familiar", "New, but built for them", "Client sign-in; share links for others"],
            ]}
            note="Category-level comparison based on Google and Dropbox documentation and vendor pages checked 2026-10-15. Features vary by product and plan. The ShootPortal column describes our own product."
          />
          <p>
            Drive and Dropbox win the first two rows outright, and that&apos;s not a small thing. Everything below them is
            where a dedicated tool earns its higher price.
          </p>
        </>
      ),
    },
    {
      id: "client-experience",
      title: "Client experience, branding, and professionalism",
      tocLabel: "Client experience",
      body: () => (
        <>
          <p>
            Clients rarely complain about a Drive link. They just don&apos;t remember it. The case for dedicated delivery
            isn&apos;t that Drive is bad; it&apos;s that the delivery is the most visible moment of the job, and a
            generic folder spends it on someone else&apos;s brand.
          </p>
          <h3>Download experience</h3>
          <p>
            A shared folder of 60 full-resolution JPEGs asks the client to select all, wait for a ZIP, and then figure out
            which size to post where. A delivery page can offer web-sized and full-size downloads, single images or the
            whole set, and work on a phone. That last part matters: real estate agents and event clients often open the
            link on their phone first.
          </p>
          <h3>File organization</h3>
          <p>
            In Drive or Dropbox, organization is your job: folder naming, subfolders by size, a read-me for which is which.
            Dedicated tools organize around the job or client instead of a folder tree, so a returning client sees their
            history rather than a link from their inbox. For listing work, our guide on{" "}
            <BlogLink slug="how-to-deliver-real-estate-photos">how to deliver real estate photos</BlogLink> covers a
            folder and naming structure that works in any tool.
          </p>
          <h3>Video</h3>
          <p>
            If you deliver video, the gap widens. Drive and Dropbox will hold the file, but feedback on a cut happens in
            email unless you add a review tool such as Dropbox Replay. We cover the options and the file-size math in{" "}
            <BlogLink slug="how-to-send-large-video-files-to-clients">how to send large video files to clients</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "storage-to-workflow",
      title: "From a shared folder to a client workflow",
      tocLabel: "Storage to workflow",
      body: () => (
        <>
          <p>
            Here&apos;s the part a storage-versus-storage comparison misses. A Drive or Dropbox link only covers the last
            step of a job. Before it, there was an inquiry, a quote, a back-and-forth about the shoot date, maybe a
            deposit, then a round of feedback. After it, there&apos;s a payment to chase. Each of those lives somewhere
            else: your inbox, your texts, a payment app, a spreadsheet. The folder is fine; it&apos;s the six places
            around it that cost you time.
          </p>
          <p>
            Moving from storage to a client workflow means those steps share one record. In ShootPortal, the request,
            the estimate, the proposed shoot time, the messages, the files, and the payment status all sit on the same
            project. When a client asks &quot;where are we?&quot;, you open one page, and so can they.
          </p>
          <Figure caption="ShootPortal's verified features at each stage of a job.">
            <WorkflowCoverageMap highlight={["review", "pay", "deliver"]} />
          </Figure>
          <p>
            The highlighted stages are the ones that replace what a shared folder does today. To be specific about what
            changes:
          </p>
          <ul>
            <li>
              <strong>Automated:</strong> downloads can unlock when the final payment lands, the project can move to
              Delivered after payment, and clients get email notifications and receipts without you writing them.
            </li>
            <li>
              <strong>Centralized:</strong> approvals, revision requests, video comments, messages, and payment status
              sit with the files, and every past job is in the client&apos;s login instead of an old email.
            </li>
            <li>
              <strong>Still manual:</strong> editing, uploading the finals, choosing which media sections the client
              sees, and keeping your archive in Drive or Dropbox. If someone without an account needs the files, such
              as an agent&apos;s assistant, you create a share link (view-only, or an email invite with an expiry).
            </li>
          </ul>
          <BestFitPanel
            heading="When it's time to move delivery out of Drive or Dropbox"
            fits={[
              {
                who: "You deliver every week",
                why: "Repeat clients find every past job in one login instead of searching their inbox for last month's folder.",
              },
              {
                who: "You've delivered before getting paid",
                why: "Clients can view the work while downloads stay locked until the final Stripe payment, with no folder permissions to flip back.",
              },
              {
                who: "Your clients need two sizes",
                why: "Print and MLS sizes come from the same upload, so you stop exporting and labeling two folders.",
              },
              {
                who: "You deliver photos, video, and tours together",
                why: "Video with time-stamped comments, Kuula 360 tours, and Matterport or other 3D embeds sit beside the photos on one project.",
              },
            ]}
            notFor={[
              "You deliver a few jobs a month and clients pay reliably; a well-organized Drive folder is fine.",
              "You sell prints or need favorites and a gallery store; a gallery platform fits better.",
              "You want the cheapest possible storage per terabyte; that's still Drive or Dropbox.",
            ]}
          />
          <p>
            Here&apos;s what that looks like in practice:{" "}
            <SiteLink href="/photo-video-delivery-software">photo and video delivery software</SiteLink> built for client work.
          </p>
        </>
      ),
    },
    {
      id: "payments-and-pricing",
      title: "Payment workflows and the real cost comparison",
      tocLabel: "Payments & pricing",
      body: (ctx) => (
        <>
          <p>
            The biggest functional gap between cloud storage and delivery software is money. With Drive or Dropbox, the
            delivery and the invoice are two separate events, and you&apos;re the one connecting them: send the link,
            send the invoice, follow up, and decide whether to share before or after payment.
          </p>
          <p>Dedicated tools approach it in a few ways:</p>
          <ul>
            <li>
              <strong>Print and download sales</strong> through a gallery store, common on portrait and wedding
              platforms.
            </li>
            <li>
              <strong>Pay to unlock downloads</strong>, where the client sees the work but downloads wait for payment.
            </li>
            <li>
              <strong>Deposits and balances</strong> collected on the project, with delivery as the last step.
            </li>
          </ul>
          <h3>Comparing costs fairly</h3>
          <p>
            Comparing a $9.99 storage plan with a delivery subscription isn&apos;t apples to apples, because most
            photographers keep the storage plan either way. The real question is whether the delivery tool pays for itself
            in time saved on follow-ups, fewer late payments, and repeat bookings from a better experience. A useful way
            to frame it: estimate the hours you spend each month resending links, chasing invoices, and answering
            &quot;which file do I use?&quot; and put a value on that time.
          </p>
          <p>
            Also watch for pricing structures: some platforms charge a flat subscription, others charge per listing or
            per credit, and gallery platforms may take a commission on store sales on lower tiers. Check each pricing page
            for the model, not just the headline price.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Keep your Drive. Upgrade the handoff."
            body={
              <>
                Leave your archive where it is and send your next delivery through a ShootPortal project instead: your
                logo and colors, Print and MLS downloads, approvals, and payment in one place. The guided setup walks
                you through branding and connecting your own Stripe account.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "recommendations",
      title: "Recommendations by business size",
      tocLabel: "Recommendations",
      body: () => (
        <>
          <p>
            There&apos;s no single right answer, but there is a common pattern: storage stays cheap and generic, delivery
            gets more specialized as volume grows.
          </p>
          <PickGrid
            items={[
              {
                who: "Just starting, a few clients a month",
                pick: "Google Drive or Dropbox",
                why: "Use what you already pay for. Organize folders carefully, block downloads manually until paid if needed, and invest the savings in gear or marketing.",
              },
              {
                who: "Portrait, wedding, or events",
                pick: "A client gallery platform + cloud backup",
                why: "Galleries handle favorites, print sales, and polished presentation. Keep RAW files and archives in Drive or Dropbox.",
              },
              {
                who: "Real estate, steady weekly volume",
                pick: "A real estate delivery platform or integrated portal",
                why: "Property-based delivery, MLS sizes, and payment tied to download matter at volume. Compare marketing extras like property websites against an all-in-one workflow.",
              },
              {
                who: "Drone, video, or mixed media",
                pick: "An integrated client portal + cloud archive",
                why: "Photos, video, tours, review comments, and payment in one project beat a stack of separate links. Use Drive or Dropbox for masters and archives.",
              },
            ]}
          />
          <ComparisonTable
            caption="Decision matrix: what to use for storage and delivery by business size"
            columns={["Business stage", "Storage / archive", "Client delivery", "Why"]}
            rows={[
              ["Hobby or first clients", "Drive or Dropbox", "Same, via shared links", "Lowest cost; volume doesn't justify more yet"],
              ["Solo, growing (weekly jobs)", "Drive or Dropbox", "Dedicated delivery tool", "Branding and payment-linked downloads start saving time"],
              ["Established solo or small team", "Drive/Dropbox business plan or local NAS", "Delivery platform or integrated portal", "Team access, client history, and fewer follow-ups"],
              ["Multi-shooter studio", "Business cloud plan with admin controls", "Platform with team permissions", "Consistency across shooters and clients"],
            ]}
            note="Editorial guidance, not a ranking. Match it to your niche and budget."
          />
          <p>
            If you&apos;re leaning toward an integrated portal, you can see how projects, delivery, and payment fit together
            on <SiteLink href="/how-it-works">how ShootPortal works</SiteLink>.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "Is Google Drive or Dropbox better for photographers?",
      answerText:
        "For storage, they're comparable: both list 2 TB for $9.99 a month on their personal plans. Dropbox's higher plans add password links, link expiry, and branding; Drive lets personal accounts block downloads but limits access expiry to work or school accounts. Neither ties delivery to payment.",
      answer: (
        <p>
          For storage, they&apos;re comparable: both list 2 TB for $9.99 a month on their personal plans. Dropbox&apos;s
          higher plans add password links, link expiry, and branding; Drive lets personal accounts block downloads but
          limits access expiry to work or school accounts. Neither ties delivery to payment.
        </p>
      ),
    },
    {
      question: "What is the best Google Drive alternative for photographers?",
      answerText:
        "It depends on your niche. Portrait and wedding photographers usually choose a gallery platform such as Pixieset, Pic-Time, or ShootProof. Real estate photographers often use Aryeo, HDPhotoHub, or an integrated portal such as ShootPortal. Most keep Drive or Dropbox for backup.",
      answer: (
        <p>
          It depends on your niche. Portrait and wedding photographers usually choose a gallery platform such as
          Pixieset, Pic-Time, or ShootProof. Real estate photographers often use Aryeo, HDPhotoHub, or an integrated
          portal such as ShootPortal. Most keep Drive or Dropbox for backup.
        </p>
      ),
    },
    {
      question: "Can I make Google Drive links expire?",
      answerText:
        "Only on eligible work or school accounts. Google's help center says access expiration dates are not available on personal accounts. Personal accounts can still stop viewers and commenters from downloading, printing, or copying.",
      answer: (
        <p>
          Only on eligible work or school accounts. Google&apos;s help center says access expiration dates aren&apos;t
          available on personal accounts. Personal accounts can still stop viewers and commenters from downloading,
          printing, or copying.
        </p>
      ),
    },
    {
      question: "Does Dropbox Plus include password-protected or expiring links?",
      answerText:
        "Dropbox's help center says link expiration is not available on Basic or Plus, and branded sharing is not available on Plus. Password protection is listed on Standard and Advanced. Dropbox's help pages are not fully consistent across plan names, so verify on your account.",
      answer: (
        <p>
          Dropbox&apos;s help center says link expiration isn&apos;t available on Basic or Plus, and branded sharing
          isn&apos;t available on Plus. Password protection is listed on Standard and Advanced. Dropbox&apos;s help pages
          aren&apos;t fully consistent across plan names, so verify on your account.
        </p>
      ),
    },
    {
      question: "Should I stop using Google Drive if I switch to delivery software?",
      answerText:
        "Usually not. Cloud storage is inexpensive and reliable for archiving originals and masters. Many photographers keep Drive or Dropbox as the archive and use dedicated delivery software for the client-facing handoff.",
      answer: (
        <p>
          Usually not. Cloud storage is inexpensive and reliable for archiving originals and masters. Many photographers
          keep Drive or Dropbox as the archive and use dedicated delivery software for the client-facing handoff.
        </p>
      ),
    },
  ],
  related: [
    "best-photo-video-delivery-platforms",
    "how-to-deliver-real-estate-photos",
    "best-real-estate-photography-delivery-software",
  ],
  cta: {
    title: "Still sending Google Drive links?",
    body: "Keep your cloud storage for backups. Give clients one branded project with the estimate, messages, approvals, payment, and downloads together.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how delivery works",
  },
};
