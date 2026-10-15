import type { BlogArticle } from "@/lib/blog/types";
import {
  BlogLink,
  Callout,
  ComparisonTable,
  Ext,
  Figure,
  KeyTakeaways,
  No,
  PickGrid,
  SiteLink,
  ToolCard,
  Yes,
} from "@/components/blog/article-parts";
import { DeliveryPathDiagram, WorkflowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";

export const article: BlogArticle = {
  slug: "best-real-estate-photography-delivery-software",
  title: "Best Real Estate Photography Client Delivery Software: 10 Platforms Compared",
  seoTitle: "Real Estate Photography Delivery Software: 10 Compared",
  description:
    "Compare 10 real estate photography delivery platforms on MLS sizing, video, 3D tours, branded links, mobile downloads, and pay-to-download, with 2026 pricing.",
  excerpt:
    "How the listing hand-off actually works on Aryeo, HDPhotoHub, Tonomo, Rela, Tourbuzz, ShootPortal and four more: MLS sizes, video, tours, branding, and getting paid before the download.",
  category: "media-delivery",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "real estate photography delivery software",
  secondaryKeywords: [
    "listing media delivery",
    "real estate photo delivery platform",
    "MLS photo delivery",
    "pay to download real estate photography",
  ],
  readingMinutes: 14,
  cover: {
    variant: "delivery",
    label: "Delivery Guide",
    alt: "Illustration of listing photos moving from a camera into a branded download page",
  },
  disclosure: true,
  quickAnswer: {
    heading: "Quick answer",
    points: [
      <>
        <strong>Agents list on Zillow Showcase?</strong> Aryeo says it is the only platform that delivers media for
        Showcase listings, and its free Lite plan includes branded delivery pages.
      </>,
      <>
        <strong>Want login-free download pages with automatic MLS resizing and pay-to-download?</strong> HDPhotoHub
        does all three on a per-delivery price.
      </>,
      <>
        <strong>Need branded and unbranded (MLS-friendly) links side by side?</strong> Tourbuzz is built around them.
      </>,
      <>
        <strong>Delivering property websites with the photos?</strong> Rela, Spiro, and HDPhotoHub&apos;s Full Delivery
        bundle them in.
      </>,
      <>
        <strong>Want delivery tied to the estimate, review, and payment for every job, listings and aerials alike?</strong>{" "}
        ShootPortal (our product) puts each job on one project page in your branded portal: Print and MLS downloads,
        ZIPs, per-item approval, and optional unlock-after-payment, with the property&apos;s past shoots on file.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        For a listing agent, your delivery page is the product. They never see your lens choice, your bracketing, or
        the hour you spent pulling a window. They see a link, usually on their phone, usually while standing in another
        listing, and they judge the whole shoot by how fast they can get the right files into the MLS.
      </p>
      <p>
        That&apos;s a narrow, specific job, and it&apos;s why <strong>real estate photography delivery software</strong>{" "}
        is its own category. A wedding gallery is designed for browsing and print sales. A listing delivery needs
        MLS-sized photos next to full-resolution originals, a video file and a branded or unbranded video link, a 3D
        tour embed, a floor plan PDF, and some way to make sure the invoice is paid before the agent walks off with all
        of it.
      </p>
      <p>
        Below we compare ten platforms on exactly that hand-off. We focus on what the agent experiences and what you
        control on the back end, rather than on booking or dispatch (we cover those in a{" "}
        <BlogLink slug="best-real-estate-photography-booking-software">separate booking software guide</BlogLink>).
        Pricing is linked to each vendor&apos;s official page and was checked on October 15, 2026.
      </p>
    </>
  ),
  sections: [
    {
      id: "what-agents-need",
      title: "What listing agents actually need from a delivery",
      tocLabel: "What agents need",
      body: () => (
        <>
          <p>
            Before comparing platforms, it helps to be precise about the job. A good listing delivery answers six
            questions without the agent having to text you.
          </p>
          <h3>Can I upload these straight to the MLS?</h3>
          <p>
            Most MLS systems cap upload dimensions or file size, and agents don&apos;t want to resize forty photos on a
            laptop. Delivery software should offer an MLS-ready size next to the full-resolution original, ideally as
            two clearly labeled downloads rather than one ambiguous &quot;download&quot; button.
          </p>
          <h3>Where&apos;s the video, and which version do I post?</h3>
          <p>
            Listing video usually needs to live in three places: the MLS (often as an unbranded link), the
            agent&apos;s social channels (as a file they can upload natively), and a property page. Delivery should
            give agents both a playable link and the file itself.
          </p>
          <h3>Is the tour and floor plan in the same place?</h3>
          <p>
            3D tours from Matterport, iGUIDE, Zillow 3D Home, or similar tools generate their own share links. If those
            links arrive in a separate email from the photos, someone will lose one. Good platforms let you embed the
            tour on the same delivery page.
          </p>
          <h3>Does it work on my phone?</h3>
          <p>
            Anyone who has delivered a listing late in the evening knows the agent is opening it on a phone. Pages
            should load quickly, show thumbnails cleanly, and let the agent download one photo or the whole set without
            pinching and zooming.
          </p>
          <h3>Do I need yet another login?</h3>
          <p>
            Agents juggle accounts for the MLS, their brokerage, their CRM, and every vendor they use. Some platforms
            deliver on login-free pages; others use an agent portal that keeps a history of every past listing. Both are
            valid, and the right answer depends on whether your agents value convenience today or an archive later.
          </p>
          <h3>Is my branding on it, or theirs, or none?</h3>
          <p>
            Your branded page markets your business. An unbranded link is often required for the MLS. And some agents
            want their own branding on property sites. Know which combinations your market expects before you pick a
            platform.
          </p>
          <p>
            Want the step-by-step process rather than a software comparison? Read{" "}
            <BlogLink slug="how-to-deliver-real-estate-photos">how to deliver real estate photos to realtors</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "delivery-features",
      title: "Delivery features worth comparing",
      tocLabel: "Features to compare",
      body: () => (
        <>
          <p>
            Every platform in this guide can put photos on a page. These are the details that separate them once
            you&apos;re delivering several listings a day.
          </p>
          <h3>Photo galleries and sizing</h3>
          <p>
            Look for automatic MLS resizing rather than uploading two sets yourself. Check whether agents can download
            individual images, a ZIP of everything, or both, and whether photos can be grouped (exterior, interior,
            aerial, twilight) so the agent isn&apos;t scrolling through a single wall of thumbnails.
          </p>
          <h3>Video delivery</h3>
          <p>
            Ask how the platform handles a large video file: can you upload it directly, or do you have to host it on
            Vimeo or YouTube and paste a link? Can the agent download the original? If you shoot a lot of video or
            handle edit revisions, read our{" "}
            <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery platform guide</BlogLink>,
            which goes deeper on review and large-file workflows.
          </p>
          <h3>3D tours, floor plans, and documents</h3>
          <p>
            Matterport, iGUIDE, and Zillow 3D embeds are table stakes for many listing photographers. Floor plan PDFs and
            property documents should sit next to the media, not in a separate email.
          </p>
          <h3>Branding and link types</h3>
          <p>
            Compare custom domains, logo and color control, and whether the platform generates separate branded and
            unbranded links. A handful of platforms advertise full white-label; others show their own name somewhere on
            the page.
          </p>
          <h3>Download functionality and access</h3>
          <p>
            Does the agent need an account? Can you share the delivery with an assistant or a co-listing agent? How long
            do files stay hosted, and what happens after that?
          </p>
          <h3>Payment workflows</h3>
          <p>
            &quot;Pay to download&quot; (sometimes called pay-to-unlock or lock-media-until-paid) lets agents preview
            everything but blocks downloads until the invoice clears. It&apos;s the single biggest collections fix in this
            category. Also check which processors are supported and whether you can still release files manually for
            trusted clients.
          </p>
          <Figure caption="Conceptual diagram: a typical delivery path with an optional payment gate before downloads unlock.">
            <DeliveryPathDiagram showPaywall />
          </Figure>
        </>
      ),
    },
    {
      id: "comparison-table",
      title: "Real estate photography delivery software comparison table",
      tocLabel: "Comparison table",
      body: () => (
        <>
          <p>
            This table sticks to delivery. &quot;Not stated&quot; means we couldn&apos;t confirm the feature on the
            vendor&apos;s official site on October 15, 2026, not that it&apos;s definitely missing.
          </p>
          <ComparisonTable
            caption="Real estate photography delivery software comparison, October 2026"
            columns={[
              "Platform",
              "Delivery pricing",
              "MLS-sized downloads",
              "Pay-to-download",
              "Tours / 3D embeds",
              "Login-free pages",
              "Per-item client approval",
              "Client or property history",
            ]}
            rows={[
              ["ShootPortal", "Flat monthly subscription", <Yes key="a">2048px MLS + full-res</Yes>, <Yes key="b">Optional</Yes>, <Yes key="c">Kuula, Matterport, Polycam &amp; more</Yes>, <Yes key="d">Share links; clients sign in to the portal</Yes>, <Yes key="d1">Approve or request changes</Yes>, <Yes key="d2">Per client and per address</Yes>],
              ["Aryeo", "Lite free; Pro from $49/mo", "Not stated", "Not stated", <Yes key="e">Zillow 3D Home</Yes>, "Agent login portal", "Not stated", <Yes key="e1">Agent portal keeps past listings</Yes>],
              ["HDPhotoHub", "$5 / $10 per delivery", <Yes key="f">Automatic</Yes>, <Yes key="g" />, <Yes key="h">Matterport, iGUIDE, Zillow 3D</Yes>, <Yes key="i" />, "Not stated", <Yes key="i1">Client order history</Yes>],
              ["Spiro", "$5 per listing", "Not stated", "Not stated", "Not stated", "Not stated", "Not stated", <Yes key="i2">Client CRM</Yes>],
              ["Tonomo", "$140 or $250/mo", <Yes key="j">Auto-resize</Yes>, <Yes key="k">Pay-to-unlock</Yes>, "Not stated", "Customer project portal", "Not stated", "Not stated"],
              ["Rela", "$49 or $99/mo + per-site fees", <Yes key="l">Auto-resizing</Yes>, <Yes key="m">With Storefront add-on</Yes>, <Yes key="n">Floor plans (Pro)</Yes>, "White-label customer portal", "Not stated", "Not stated"],
              ["Tourbuzz", "$2.50 per delivery order", "Not stated", "Not stated", <Yes key="o">Native 3D + floor plans</Yes>, <Yes key="p">Branded &amp; unbranded links</Yes>, "Not stated", "Not stated"],
              ["RTV", "$6 or $12 per project", "Not stated", <Yes key="q" />, <Yes key="r">360° tour builder</Yes>, "Not stated", "Not stated", "Not stated"],
              ["Fotello", "Free tier; paid per listing", "Not stated", "Not stated", "Not stated", "Co-branded agent portal", "Not stated", "Not stated"],
              ["Pixieset", "Free to $50/mo", <Yes key="s">Configurable sizes</Yes>, "Sells downloads via its store", "Not stated", "Not stated", <No key="s1">Favorites and proofing instead</No>, "Not stated"],
            ]}
            note={
              <>
                Pricing and features from each vendor&apos;s official site, checked October 15, 2026. Payment
                processor fees are extra on every platform. The last two columns cover what happens around the
                download: whether the agent can sign off on each item, and whether the next order starts with the
                previous one on file. Follow the links in each review below to confirm current details.
              </>
            }
          />
        </>
      ),
    },
    {
      id: "platforms",
      title: "10 real estate photography delivery platforms, reviewed",
      tocLabel: "The 10 platforms",
      body: (ctx) => (
        <>
          <p>
            ShootPortal is ours, so it&apos;s listed first and labeled clearly. The others follow in rough order of how
            central delivery is to the product, ending with a general-purpose gallery many photographers already know.
          </p>

          <ToolCard
            rank={1}
            id="delivery-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="One project page per job: estimate, approvals, payment, and listing downloads behind your brand"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month
                  {ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}. No per-listing fees;
                  Stripe&apos;s standard processing fees apply.{" "}
                  {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  Flat monthly subscription. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Solo listing photographers and small teams, especially those who also shoot aerial, video, or commercial jobs, who want delivery tied to the estimate, approvals, and payment instead of living on a separate page."
            pros={[
              "Every photo downloads as Print (original full resolution) or MLS (2048px long edge), singly or as a ZIP",
              "Clients approve or reject each deliverable with written feedback, and revision requests stay on the project",
              "Optional unlock-after-payment: agents preview everything, downloads open when the final payment clears through Stripe Checkout",
              "Video files, YouTube embeds, Kuula 360 tours, and 3D embeds from Matterport, Polycam, and others on the same page",
              "Share links and email-invite shares (one-time or reusable, with expiry) for assistants or co-listing agents without an account",
              "Property history per address: past projects and revenue for the house when it relists",
            ]}
            cons={[
              "No separate branded and unbranded MLS tour links",
              "No property websites, flyers, or Zillow Showcase delivery",
              "Clients sign in to the portal; it isn't a fully login-free delivery page",
              "Branded with your logo, colors, and domain, but not full white-label",
            ]}
          >
            <p>
              ShootPortal treats delivery as the last stage of a project rather than a standalone page. Photos, videos,
              tours, and documents upload to the same project that holds the estimate, the shoot time, and the message
              thread, and uploads are resumable, so a dropped connection halfway through a large video file doesn&apos;t
              mean starting over. You choose which media sections the client sees, and photos can be organized into
              folders.
            </p>
            <p>
              The client side lives at your own subdomain or a custom domain like portal.yourstudio.com, with your logo
              and colors. Agents can approve each item or request a change with a note, then download what they need.
              If you turn on unlock-after-payment, they can review the full set immediately while downloads stay locked
              until the final payment goes through your own Stripe account. You can also have the project move to
              Delivered automatically once it&apos;s paid.
            </p>
            <p>
              A typical listing looks like this: you upload the edited set into folders (exterior, interior, aerial),
              add the walkthrough video and the Matterport embed, and the agent gets an email that the media is ready.
              They open one page, see every photo, the video, the tour, and the balance due, flag the one photo that
              needs a different sky, pay, and pull the MLS-size ZIP from their phone. Their assistant gets a share link
              instead of a password.
            </p>
          </ToolCard>

          <ToolCard
            rank={2}
            id="delivery-aryeo"
            name="Aryeo"
            url="https://www.aryeo.com/pricing"
            tagline="Zillow-owned delivery and ordering platform with a free tier"
            pricing={
              <>
                Lite: free forever. Pro: $49/mo (100 listings/yr), $99/mo (250), $179/mo (500). Enterprise: custom.{" "}
                <Ext href="https://www.aryeo.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Markets where agents use Zillow Showcase, and photographers who want a free branded delivery page to start."
            pros={[
              "Lite includes media delivery, a content dashboard, branded delivery pages, and an agent login portal at no cost",
              "Aryeo says it is the only platform that delivers media for Zillow Showcase listings",
              "Zillow 3D Home integration and an agent portal that keeps past listings and invoices together",
            ]}
            cons={[
              "Pay-to-download and MLS resizing aren't spelled out on the pricing or home page",
              "Paid tiers cap annual listings",
              "Ownership by a listing portal is a concern for some photographers",
            ]}
          >
            <p>
              For pure delivery, Aryeo Lite is hard to argue with on price. The agent login portal is a strength if
              your agents like having an archive of every past shoot in one place. If you&apos;re weighing a move away
              from it, our <BlogLink slug="best-aryeo-alternatives">Aryeo alternatives guide</BlogLink> covers the
              trade-offs.
            </p>
          </ToolCard>

          <ToolCard
            rank={3}
            id="delivery-hdphotohub"
            name="HDPhotoHub"
            url="https://hdphotohub.com/learn-paygpricing"
            tagline="Login-free delivery pages with MLS resizing and pay-to-download"
            pricing={
              <>
                $5 per Basic Delivery, $10 per Full Delivery (adds the Marketing Kit). No subscription.{" "}
                <Ext href="https://hdphotohub.com/learn-paygpricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who want the most complete listing-delivery feature set and pay only when they deliver."
            pros={[
              "Login-free download pages with automatic MLS resizing",
              "Delivers photos, video, PDFs, Matterport, iGUIDE, Zillow 3D, and any embed URL",
              "Pay to Download with Stripe or Square",
            ]}
            cons={[
              "Cost rises one-for-one with listing volume",
              "Property sites and flyers cost double per delivery",
              "Free trial terms aren't published",
            ]}
          >
            <p>
              HDPhotoHub is, feature for feature, one of the most delivery-focused platforms here. Integrations with
              Dropbox and Vimeo help if your files already live there. See our{" "}
              <BlogLink slug="best-hdphotohub-alternatives">HDPhotoHub alternatives</BlogLink> for how it stacks up.
            </p>
          </ToolCard>

          <ToolCard
            rank={4}
            id="delivery-tonomo"
            name="Tonomo"
            url="https://www.tonomo.io/pricing"
            tagline="Team operations platform with branded portals and pay-to-unlock files"
            pricing={
              <>
                $140/mo (200 listings/yr, &quot;Powered by Tonomo&quot; footer) or $250/mo (425 listings, white-label).{" "}
                <Ext href="https://www.tonomo.io/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Multi-photographer teams that want delivery locked to payment and automated across the whole operation."
            pros={["Branded delivery portals with MLS auto-resize", "Pay-to-unlock files and auto watermarking", "Customer project portal"]}
            cons={["Highest entry price here", "Demo only, no free trial", "Tour embeds and property websites aren't mentioned"]}
          />

          <ToolCard
            rank={5}
            id="delivery-rela"
            name="Rela"
            url="https://www.relahq.com/pricing/photographers"
            tagline="Property websites and media delivery in a white-labeled customer portal"
            pricing={
              <>
                Starter $49/mo (5 free media deliveries/mo, 1 TB storage), Pro $99/mo, plus per-property-site fees.
                Lock-media-until-paid requires the Storefront add-on (+$25/mo).{" "}
                <Ext href="https://www.relahq.com/pricing/photographers">Official pricing</Ext>
              </>
            }
            bestFor="Photographers whose delivery is really a property website with photos, tours, and floor plans."
            pros={["14-day free trial, no credit card", "Auto-resizing and a white-label customer portal", "Interactive floor plans on Pro"]}
            cons={["Payment gating is a paid add-on", "Per-site and per-tour fees on top of the subscription"]}
          />

          <ToolCard
            rank={6}
            id="delivery-tourbuzz"
            name="Tourbuzz"
            url="https://www.tourbuzz.com/pricing"
            tagline="Pay-per-item delivery with branded and unbranded links"
            pricing={
              <>
                No monthly platform fee. Media delivery $2.50/order; video $3, or $5 for branded + unbranded; 12 months
                of hosting included. <Ext href="https://www.tourbuzz.com/pricing">Official pricing</Ext>
              </>
            }
            bestFor="Photographers in MLS markets that require unbranded links, and tour-heavy businesses."
            pros={["Branded and unbranded (MLS-friendly) links", "Native 3D tour and floor plan product", "Low per-delivery fee"]}
            cons={["Hosting fees after the first year", "Many line-item fees make the monthly total harder to predict"]}
          />

          <ToolCard
            rank={7}
            id="delivery-spiro"
            name="Spiro"
            url="https://www.spiro.media"
            tagline="Per-listing platform with delivery, property websites, and white labeling"
            pricing={
              <>
                $5 per listing, everything included, no subscription.{" "}
                <Ext href="https://www.spiro.media">Official site</Ext>
              </>
            }
            bestFor="Businesses that want delivery bundled with property sites and brokerage billing at a flat per-listing price."
            pros={["Property websites and marketing kits included", "White labeling", "Brokerage billing and pay-at-close options"]}
            cons={["MLS resizing, pay-to-download, and tour embeds aren't detailed on the site", "Trial terms not stated"]}
          />

          <ToolCard
            rank={8}
            id="delivery-rtv"
            name="RTV (Real Tour Vision)"
            url="https://realtourvision.com/real-estate-photography-system/"
            tagline="Per-project delivery with 4K video, 360° tours, and pay-to-download"
            pricing={
              <>
                $6 per project (media only) or $12 with marketing, plus a one-time $99 setup fee.{" "}
                <Ext href="https://realtourvision.com/real-estate-photography-system/">Official site</Ext>
              </>
            }
            bestFor="360° tour photographers who want cheap per-project delivery."
            pros={["4K video delivery and unlimited storage", "Pay-to-download via Stripe, PayPal, or Square", "MLS/IDX-compliant tours, custom domain, white-label"]}
            cons={["FAQ credit pricing differs from the plan prices, so confirm before buying", "Fewer team features confirmed"]}
          />

          <ToolCard
            rank={9}
            id="delivery-fotello"
            name="Fotello"
            url="https://www.fotello.co/pricing"
            tagline="Free delivery and booking bundled with AI editing"
            pricing={
              <>
                Free tier at $0 per listing with Fotello branding; paid tiers priced per listing around editing volume.
                Pricing shifted during our research, so check the <Ext href="https://www.fotello.co/pricing">official page</Ext>.
              </>
            }
            bestFor="Photographers already using (or open to) AI editing who want delivery from the same vendor."
            pros={["Unlimited delivery on the free tier", "Property website and co-branded agent portal included"]}
            cons={["Free tier carries Fotello branding", "Paid plans are priced around editing, not delivery"]}
          />

          <ToolCard
            rank={10}
            id="delivery-pixieset"
            name="Pixieset Client Gallery"
            url="https://pixieset.com/pricing/"
            tagline="General-purpose photo gallery, not built for listings"
            pricing={
              <>
                Free (3 GB), Basic $10/mo, Plus $20/mo, Pro $30/mo, Ultimate $50/mo; lower if billed annually.{" "}
                <Ext href="https://pixieset.com/pricing/">Official pricing</Ext>
              </>
            }
            bestFor="Photographers who mostly shoot portraits or events and deliver an occasional listing."
            pros={["Client galleries with favorites and proofing", "Configurable download sizes and custom domain from Basic", "Integrated store for prints and downloads"]}
            cons={["No MLS-specific workflow, tour embeds, or delivery paywall mentioned", "Video minutes are capped by plan"]}
          >
            <p>
              Pixieset is here as a benchmark. Plenty of photographers start on a wedding-style gallery and then add
              listings. It works, but you&apos;ll be handling MLS sizing, tour links, and payment separately. Compare it
              with the other gallery tools in our{" "}
              <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery guide</BlogLink>.
            </p>
          </ToolCard>

        </>
      ),
    },
    {
      id: "pay-to-download",
      title: "Pay-to-download without annoying your agents",
      tocLabel: "Pay-to-download tips",
      body: () => (
        <>
          <p>
            Locking downloads until payment is the most effective way to stop chasing invoices, but it can backfire if
            it feels like a hostage situation. A few habits keep it professional:
          </p>
          <ul>
            <li>
              <strong>Let agents preview everything.</strong> Seeing the finished set builds confidence and lets them
              flag problems before paying. Every gated platform in this guide shows previews; make sure yours is set up
              that way.
            </li>
            <li>
              <strong>Tell them up front.</strong> Put &quot;downloads unlock on payment&quot; in your booking
              confirmation and estimate, so the delivery email isn&apos;t the first time they hear it.
            </li>
            <li>
              <strong>Make paying one tap.</strong> The payment button should sit on the delivery page, not in a
              separate invoice email.
            </li>
            <li>
              <strong>Keep a manual override.</strong> Long-standing agents and brokerages on monthly terms shouldn&apos;t
              hit the gate. Check that you can release files or mark a job paid by hand.
            </li>
          </ul>
          <ProductCallout title="Previews open, downloads locked, and a manual override">
            <p>
              With unlock-after-payment on, agents see the full set immediately and the payment button sits on the same
              project page. Downloads open when the project reaches Delivered, which can happen automatically once the
              final payment is made. For an agent on account, move the project to Delivered yourself. If you prefer to
              collect part up front, request a deposit when the estimate is approved and the balance at delivery.
            </p>
          </ProductCallout>
          <Callout tone="warning" title="Brokerage billing and pay-at-close change the math">
            <p>
              If a brokerage pays for the media, or the agent pays at closing, a hard paywall won&apos;t fit. Spiro and
              Tonomo advertise pay-at-close options; platforms without them (ShootPortal included) need you to release
              those jobs manually.
            </p>
          </Callout>
          <p>
            For policy wording, deposits, and agents who expect to pay at closing, see{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">how to get paid before delivering real estate photos</BlogLink>.
          </p>
        </>
      ),
    },
    {
      id: "integrated-delivery",
      title: "Why delivery works better inside your business system",
      tocLabel: "Integrated vs. standalone",
      body: () => (
        <>
          <p>
            Some photographers run delivery as a standalone tool and handle booking, invoices, and client notes
            elsewhere. That&apos;s workable, but the delivery page doesn&apos;t know anything about the job: what was
            ordered, what was quoted, whether a reshoot was promised, or whether a deposit was already paid.
          </p>
          <p>When delivery sits inside the same system as the rest of the job, a few things get easier:</p>
          <ul>
            <li>
              <strong>Payment and download are linked automatically.</strong> The balance owed is already known, so
              unlocking after payment needs no extra step.
            </li>
            <li>
              <strong>Revisions stay on the record.</strong> If the agent asks for a different twilight sky, the request
              sits next to the original files and estimate, not in a text thread.
            </li>
            <li>
              <strong>Property history builds up.</strong> When the same house relists two years later, you can see what
              you shot, what you charged, and who ordered it.
            </li>
            <li>
              <strong>Mixed work fits.</strong> An aerial progress shoot for a builder or a commercial video uses the
              same delivery flow as a listing.
            </li>
          </ul>
          <Figure caption="Conceptual diagram: delivery as the final stage of one connected job record.">
            <WorkflowDiagram highlight={["review", "pay", "deliver"]} />
          </Figure>
          <p>
            Here&apos;s what that looks like from the agent&apos;s side in ShootPortal. Instead of one email with the
            estimate, another with a Dropbox link, a third with the tour, and a fourth with an invoice, the agent has one
            project to open. The estimate, shoot date, messages, files, and payment status are all on it, so &quot;did
            you get my note about the kitchen?&quot; and &quot;is this paid?&quot; are answered on the same page.
          </p>
          <Figure caption="Product illustration of the ShootPortal client portal: a project moving through estimate, shoot, media, payment, and files (demo data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <p>
            The trade-off is that all-in-one systems rarely match a dedicated listing-marketing platform on property
            websites or branded/unbranded link handling. If your client records matter as much as the delivery, our{" "}
            <BlogLink slug="best-photography-client-portals">client portal comparison</BlogLink> looks at that side in
            more detail.
          </p>
        </>
      ),
    },
    {
      id: "who-should-choose-shootportal",
      title: "Who should choose ShootPortal for listing delivery",
      tocLabel: "Is ShootPortal a fit?",
      body: (ctx) => (
        <>
          <p>
            Delivery is the moment agents judge the shoot, but it&apos;s only one step of the job. Before it come the
            request, the quote, the shoot time, and any revisions; after it comes getting paid. ShootPortal is our pick
            when you want all of that to land on the same project record, rather than a delivery page that knows
            nothing about the order. It is not the pick for every listing business, and the panel below is honest about
            where it isn&apos;t.
          </p>
          <BestFitPanel
            heading="Where ShootPortal fits best for real estate delivery"
            fits={[
              {
                who: "Photographers tired of chasing invoices",
                why: "Agents preview the full set, pay through Stripe Checkout on the same page, and downloads unlock after payment. Receipts go out by email.",
              },
              {
                who: "Agents who send revision notes",
                why: "Each photo or video can be approved or sent back with written feedback, so the twilight-sky request sits next to the file it's about.",
              },
              {
                who: "Listing plus aerial or video shooters",
                why: "Print and MLS photo sizes, video files, Kuula tours, and 3D embeds from Matterport or DroneDeploy on one project page.",
              },
              {
                who: "Repeat agents and relists",
                why: "Client records show lifetime revenue, outstanding balance, and property history, so a relisted house starts with the last shoot on file.",
              },
            ]}
            notFor={[
              "Your agents need Zillow Showcase delivery (Aryeo) or separate branded and unbranded MLS links (Tourbuzz).",
              "Property websites, flyers, or marketing kits are part of what you sell.",
              "Agents insist on fully login-free download pages for every delivery; ShootPortal clients sign in, with share links for others.",
              "You need brokerage billing or pay-at-close.",
            ]}
          />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Deliver your next listing from one link"
            body="Upload a real set, turn on MLS downloads and unlock-after-payment, add the tour embed, and open the portal on your phone the way an agent would before you send it."
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
        </>
      ),
    },
    {
      id: "how-to-choose",
      title: "Which delivery platform fits your business?",
      tocLabel: "Recommendations",
      body: () => (
        <>
          <PickGrid
            items={[
              {
                who: "Agents ask for Zillow Showcase",
                pick: "Aryeo",
                why: "Aryeo states it's the only platform delivering media for Showcase listings, and Lite is free.",
              },
              {
                who: "Login-free pages, MLS resizing, pay-to-download",
                pick: "HDPhotoHub",
                why: "All three are on the home page, priced per delivery with no subscription.",
              },
              {
                who: "MLS requires unbranded links",
                pick: "Tourbuzz",
                why: "Branded and unbranded links are a core part of its delivery and video pricing.",
              },
              {
                who: "Property websites are the main deliverable",
                pick: "Rela or Spiro",
                why: "Both bundle single-property sites with media delivery.",
              },
              {
                who: "Multi-photographer team",
                pick: "Tonomo",
                why: "Pay-to-unlock delivery sits inside a dispatch and operations platform.",
              },
              {
                who: "Listings plus aerial, video, and commercial",
                pick: "ShootPortal",
                why: "Per-item approval, video review, MLS and Print downloads, and payment in one project portal.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Judge delivery software on the agent's phone, not your desktop.",
              "MLS-sized and full-resolution downloads should be two clear options, not a guess.",
              "Pay-to-download fixes collections, but keep previews open and a manual override handy.",
              "Decide whether you need branded and unbranded links before shortlisting; few platforms do both.",
              <>
                Comparing the big three directly? Read{" "}
                <BlogLink slug="shootportal-vs-aryeo-vs-hdphotohub">ShootPortal vs. Aryeo vs. HDPhotoHub</BlogLink>.
              </>,
            ]}
          />
        </>
      ),
    },
    {
      id: "bottom-line",
      title: "The bottom line",
      body: () => (
        <>
          <p>
            The best real estate photography delivery software is the one your agents stop noticing: they tap the link,
            grab the MLS set, post the video, and pay without a follow-up text. Aryeo wins on Showcase, HDPhotoHub on
            delivery depth per dollar, Tourbuzz on link flexibility, and Rela or Spiro when the property website is the
            product.
          </p>
          <p>
            If you want delivery to be the natural last step of every job, with the estimate, client feedback, and
            payment already attached, <SiteLink href="/how-it-works">see how ShootPortal handles delivery</SiteLink> and
            try it on your next listing.
          </p>
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is real estate photography delivery software?",
      answerText:
        "It's software that hands listing media to agents: MLS-sized and full-resolution photos, video, 3D tours, floor plans, and documents on a branded page or portal, often with downloads locked until the invoice is paid.",
      answer: (
        <p>
          It&apos;s software that hands listing media to agents: MLS-sized and full-resolution photos, video, 3D tours,
          floor plans, and documents on a branded page or portal, often with downloads locked until the invoice is paid.
        </p>
      ),
    },
    {
      question: "What size should real estate photos be for the MLS?",
      answerText:
        "It varies by MLS, so check your local board's rules. Most delivery platforms offer an MLS-ready size alongside the full-resolution file. ShootPortal's MLS download is 2048 pixels on the long edge.",
      answer: (
        <p>
          It varies by MLS, so check your local board&apos;s rules. Most delivery platforms offer an MLS-ready size
          alongside the full-resolution file. ShootPortal&apos;s MLS download is 2048 pixels on the long edge.
        </p>
      ),
    },
    {
      question: "Can I make agents pay before they download photos?",
      answerText:
        "Yes. HDPhotoHub, Tonomo, RTV, Rela (with its Storefront add-on), and ShootPortal can lock downloads until payment while still letting agents preview the media.",
      answer: (
        <p>
          Yes. HDPhotoHub, Tonomo, RTV, Rela (with its Storefront add-on), and ShootPortal can lock downloads until
          payment while still letting agents preview the media.
        </p>
      ),
    },
    {
      question: "Do agents need an account to download listing photos?",
      answerText:
        "It depends on the platform. HDPhotoHub uses login-free download pages. Aryeo and Fotello use agent portals. ShootPortal clients sign in to a branded portal, and you can also create share links for people without an account.",
      answer: (
        <p>
          It depends on the platform. HDPhotoHub uses login-free download pages. Aryeo and Fotello use agent portals.
          ShootPortal clients sign in to a branded portal, and you can also create share links for people without an
          account, such as an agent&apos;s assistant.
        </p>
      ),
    },
    {
      question: "Does ShootPortal create unbranded MLS tour links or property websites?",
      answerText:
        "No. ShootPortal embeds tours and 3D models in the client portal but doesn't generate separate branded and unbranded MLS links or property websites. Tourbuzz, Rela, and HDPhotoHub are stronger there.",
      answer: (
        <p>
          No. ShootPortal embeds tours and 3D models in the client portal but doesn&apos;t generate separate branded and
          unbranded MLS links or property websites. Tourbuzz, Rela, and HDPhotoHub are stronger there.
        </p>
      ),
    },
  ],
  related: ["best-photo-video-delivery-platforms", "best-real-estate-photography-software", "shootportal-vs-aryeo-vs-hdphotohub"],
  cta: {
    title: "Get paid before the MLS upload, not after.",
    body: "Give every listing one project page in your branded portal: MLS and Print downloads, video, 3D tours, per-item approval, and downloads that unlock when the balance is paid.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
