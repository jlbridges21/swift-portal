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
import { DeliveryPathDiagram, WorkflowDiagram } from "@/components/blog/diagrams";
import { BestFitPanel, ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { ProductPreview } from "@/components/blog/product-preview";
import { AllInOnePlatform, AppScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "best-real-estate-photography-delivery-software",
  title: "Best Real Estate Photography Client Delivery Software: 10 Platforms Compared",
  seoTitle: "Real Estate Photography Delivery Software: 10 Compared",
  description:
    "Compare 10 real estate photography delivery software platforms on MLS sizing, video, tours, property websites, and pay-to-download, with 2026 pricing.",
  excerpt:
    "How the listing hand-off works on ShootPortal, Aryeo, HDPhotoHub, Tonomo, Rela, Tourbuzz, and four more: MLS sizes, video, tours, property websites and marketing kits, branding, and getting paid before the download.",
  category: "media-delivery",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  factsVerifiedAt: "2026-10-15",
  primaryKeyword: "real estate photography delivery software",
  secondaryKeywords: [
    "listing media delivery",
    "real estate photo delivery platform",
    "MLS photo delivery",
    "pay to download real estate photography",
    "property website for listings",
    "real estate marketing kit",
    "photo editing for real estate",
  ],
  readingMinutes: 15,
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
        <strong>Want one platform for the whole listing job?</strong> ShootPortal (our product) delivers Print and
        MLS-size photos, video, and tour embeds on one branded project page, with downloads that unlock when the agent
        pays.
      </>,
      <>
        <strong>Want to sell more than photos?</strong> ShootPortal builds a property website and a social and print
        marketing kit from the delivered photos. Include it free or sell it to the agent as an add-on.
      </>,
      <>
        <strong>Tired of the edit, upload, chase-payment loop?</strong> Touch up photos in ShootPortal&apos;s built-in
        editor, get video feedback pinned to the frame, and collect payment on the same project.
      </>,
      <>
        <strong>Comparing per-delivery platforms?</strong> Aryeo, HDPhotoHub, Tonomo, Rela, Tourbuzz, Spiro, RTV,
        Fotello, and Pixieset are reviewed below with official pricing.
      </>,
    ],
  },
  intro: (ctx) => (
    <>
      <p>
        For a listing agent, your delivery page is the product. They never see your lens choice, your bracketing, or
        the hour you spent pulling a window. They see a link, usually on their phone, usually while standing in another
        listing, and they judge the whole shoot by how fast they can get the right files into the MLS. That&apos;s the
        moment real estate photography delivery software has to get right.
      </p>
      <p>
        That&apos;s why <strong>real estate photography delivery software</strong> is its own category. A wedding
        gallery is designed for browsing and print sales. A listing delivery needs MLS-sized photos next to
        full-resolution originals, a video file, a 3D tour embed, a floor plan PDF, often a property website, and some
        way to make sure the invoice is paid before the agent walks off with all of it.
      </p>
      <p>
        Our pick is ShootPortal, because it treats delivery as one step in a single branded project: the request and
        proposal come before it, the payment unlocks it, and the property website and marketing kit come after it, all
        on the same link the agent already has.{" "}
        {ctx.studioMonthly ? <>It&apos;s one {ctx.studioMonthly}/month plan with no per-listing fees. </> : null}
        Below we compare it with nine other platforms on exactly that hand-off. Booking and dispatch are covered in a{" "}
        <BlogLink slug="best-real-estate-photography-booking-software">separate booking software guide</BlogLink>.
        Competitor pricing is linked to each vendor&apos;s official page and was checked on October 15, 2026.
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
            deliver on login-free pages; others use an agent portal that keeps a history of every past listing. The
            best setups offer both: a portal with the archive, plus links that open without signing in.
          </p>
          <h3>Is my branding on it, or theirs, or none?</h3>
          <p>
            Your branded page markets your business. An unbranded version is often required for the MLS. And many agents
            want their own branding on the property website. Know which combinations your market expects before you
            pick a platform.
          </p>
          <ProductCallout title="All six answered on one project page">
            <p>
              ShootPortal gives every photo a Print and an MLS (2048px) download, single or ZIP, puts the video file and
              tour embed beside them, opens cleanly on a phone, and works both as a branded client portal and as an
              &quot;Anyone with the link&quot; project link. The property website comes in your branded design or an
              unbranded MLS-safe version, with the agent&apos;s headshot and brokerage logo.
            </p>
          </ProductCallout>
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
          <h3>Editing before delivery</h3>
          <p>
            Most delivery platforms assume the edit happened somewhere else, so every last-minute fix means export,
            re-upload, and resend. A built-in photo editor lets you brighten a dark kitchen or straighten a vertical and
            save it straight back to the gallery the agent is already looking at.
          </p>
          <h3>Video delivery and feedback</h3>
          <p>
            Ask how the platform handles a large video file: can you upload it directly, or do you have to host it on
            Vimeo or YouTube and paste a link? Can the agent download the original, and can they leave notes on a
            specific moment? If you shoot a lot of video, read our{" "}
            <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery platform guide</BlogLink>,
            which goes deeper on review and large-file workflows.
          </p>
          <h3>3D tours, floor plans, and documents</h3>
          <p>
            Matterport, iGUIDE, and Zillow 3D embeds are table stakes for many listing photographers. Floor plan PDFs and
            property documents should sit next to the media, not in a separate email.
          </p>
          <h3>Property websites and marketing</h3>
          <p>
            A single-property website, Just Listed posts, and a print flyer are what agents do next with your photos.
            Platforms that build them from the delivered media turn that next step into something you can sell.
          </p>
          <h3>Branding and link types</h3>
          <p>
            Compare custom domains, logo and color control, and whether the platform offers both branded and unbranded
            versions for the MLS. A handful of platforms advertise full white-label; others show their own name
            somewhere on the page.
          </p>
          <h3>Payment workflows</h3>
          <p>
            &quot;Pay to download&quot; (sometimes called pay-to-unlock or lock-media-until-paid) lets agents preview
            everything but blocks downloads until the invoice clears. It&apos;s the single biggest collections fix in this
            category. Also check which payment methods are supported and whether you can still release files manually
            for trusted clients.
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
      body: (ctx) => (
        <>
          <p>
            This table sticks to delivery and what agents do with it next. &quot;Not stated&quot; means we couldn&apos;t
            confirm the feature on the vendor&apos;s official site on October 15, 2026, not that it&apos;s definitely
            missing.
          </p>
          <ComparisonTable
            caption="Real estate photography delivery software comparison, October 2026"
            columns={[
              "Platform",
              "Delivery pricing",
              "MLS-sized downloads",
              "Pay-to-download",
              "Tours / 3D embeds",
              "Login-free access",
              "Property website / marketing kit",
              "Per-item client approval",
              "Client or property history",
            ]}
            rows={[
              ["ShootPortal", ctx.studioMonthly ? `${ctx.studioMonthly}/mo flat, no per-listing fees` : "Flat monthly plan, no per-listing fees", <Yes key="a">2048px MLS + full-res</Yes>, <Yes key="b">Optional, per project</Yes>, <Yes key="c">Kuula, Matterport, Polycam &amp; more</Yes>, <Yes key="d">&quot;Anyone with the link&quot; project links, plus the client portal</Yes>, <Yes key="d0">Built from the photos; include it or sell it</Yes>, <Yes key="d1">Approve or request changes</Yes>, <Yes key="d2">Per client and per address</Yes>],
              ["Aryeo", "Lite free; Pro from $49/mo", "Not stated", "Not stated", <Yes key="e">Zillow 3D Home</Yes>, "Agent login portal", "Not stated", "Not stated", <Yes key="e1">Agent portal keeps past listings</Yes>],
              ["HDPhotoHub", "$5 / $10 per delivery", <Yes key="f">Automatic</Yes>, <Yes key="g" />, <Yes key="h">Matterport, iGUIDE, Zillow 3D</Yes>, <Yes key="i" />, <Yes key="i0">Full Delivery ($10)</Yes>, "Not stated", <Yes key="i1">Client order history</Yes>],
              ["Spiro", "$5 per listing", "Not stated", "Not stated", "Not stated", "Not stated", <Yes key="i3">Included</Yes>, "Not stated", <Yes key="i2">Client CRM</Yes>],
              ["Tonomo", "$140 or $250/mo", <Yes key="j">Auto-resize</Yes>, <Yes key="k">Pay-to-unlock</Yes>, "Not stated", "Customer project portal", "Not stated", "Not stated", "Not stated"],
              ["Rela", "$49 or $99/mo + per-site fees", <Yes key="l">Auto-resizing</Yes>, <Yes key="m">With Storefront add-on</Yes>, <Yes key="n">Floor plans (Pro)</Yes>, "White-label customer portal", <Yes key="n0">Per-site fees</Yes>, "Not stated", "Not stated"],
              ["Tourbuzz", "$2.50 per delivery order", "Not stated", "Not stated", <Yes key="o">Native 3D + floor plans</Yes>, <Yes key="p">Branded &amp; unbranded links</Yes>, "Not stated", "Not stated", "Not stated"],
              ["RTV", "$6 or $12 per project", "Not stated", <Yes key="q" />, <Yes key="r">360° tour builder</Yes>, "Not stated", <Yes key="r0">$12 tier</Yes>, "Not stated", "Not stated"],
              ["Fotello", "Free tier; paid per listing", "Not stated", "Not stated", "Not stated", "Co-branded agent portal", <Yes key="r1">Property website</Yes>, "Not stated", "Not stated"],
              ["Pixieset", "Free to $50/mo", <Yes key="s">Configurable sizes</Yes>, "Sells downloads via its store", "Not stated", "Not stated", <No key="s0" />, <No key="s1">Favorites and proofing instead</No>, "Not stated"],
            ]}
            note={
              <>
                Competitor pricing and features from each vendor&apos;s official site, checked October 15, 2026. Payment
                processor fees are extra on every platform; ShootPortal takes no cut of client payments. The last columns
                cover what happens around the download: what the agent can market with, whether they can sign off on
                each item, and whether the next order starts with the previous one on file. Follow the links in each
                review below to confirm current details.
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
            ShootPortal is ours, and it&apos;s listed first because it&apos;s our recommendation for real estate
            photographers, drone pilots, and videographers who want the whole job, from request to listing marketing, in
            one branded place. The others follow in rough order of how central delivery is to the product, ending with a
            general-purpose gallery many photographers already know.
          </p>

          <ToolCard
            rank={1}
            id="delivery-shootportal"
            name="ShootPortal"
            url="/"
            isShootPortal
            tagline="One branded project per listing: edit, review, get paid, deliver, and sell the marketing kit"
            pricing={
              ctx.studioMonthly ? (
                <>
                  Studio plan: {ctx.studioMonthly}/month
                  {ctx.studioAnnual ? <> or {ctx.studioAnnual}/month billed annually</> : null}, every feature included.
                  No per-listing or per-delivery fees, and 0% of client payments; Stripe&apos;s standard processing fees
                  apply. {ctx.trialDays > 0 ? <>{ctx.trialDays}-day free trial, no card.</> : null}
                </>
              ) : (
                <>
                  One flat plan with every feature. See <SiteLink href="/pricing">current pricing</SiteLink>.
                </>
              )
            }
            bestFor="Real estate photographers, drone pilots, and videographers who want delivery tied to the proposal, approvals, payment, and listing marketing instead of living on a separate page."
            pros={[
              "Every photo downloads as Print (original full resolution) or MLS (2048px long edge), singly or as a ZIP",
              "Built-in photo editor: Auto, exposure, white balance, HDR looks, healing, and lens corrections, saved straight to the gallery",
              "Clients approve or request changes on each deliverable; video notes are time-stamped and pinned to the frame",
              "Optional unlock-after-payment: agents preview everything, downloads open when they pay by card, Apple Pay, Google Pay, or bank",
              "Property website per listing (Modern, Luxury, or Coastal, with an unbranded MLS-safe version) plus Just Listed posts, Stories, and a print flyer",
              "Sell the marketing kit to the agent as a paid add-on, or include it to win the account",
              "Property history per address: past projects and revenue for the house when it relists",
            ]}
            cons={[
              "Tours and 3D models are embedded from Matterport, Kuula, Polycam, and others rather than hosted, so you keep your existing tour tool",
              "Your logo, colors, and custom domain throughout, with a branded portal rather than full white-label",
            ]}
          >
            <p>
              ShootPortal treats delivery as one stage of a project rather than a standalone page. Photos, videos,
              tours, and documents upload to the same project that holds the proposal, the shoot time, and the message
              thread, and uploads are resumable, so a dropped connection halfway through a large video file doesn&apos;t
              mean starting over. You choose which media sections the client sees, and photos can be organized into
              folders. If one photo needs a lift, open it in the built-in editor and save; the gallery, downloads, and
              shares update instantly, and the original is never overwritten.
            </p>
            <p>
              The client side lives at your own subdomain or a custom domain like portal.yourstudio.com, with your logo
              and colors. Agents approve each item or request a change with a note, then download what they need. With
              unlock-after-payment on, they review the full set immediately while downloads stay locked until the final
              payment goes through your own Stripe account, and the project can move to Delivered automatically once
              it&apos;s paid.
            </p>
            <p>
              Then comes the part most delivery tools don&apos;t touch. From the delivered photos, ShootPortal builds a
              property website at listings.yourstudio.com and a marketing kit: five square posts (Just Listed, Open
              House, Just Sold, Highlights, Coming Soon), three Stories, an Instagram carousel, and a print-ready flyer
              with a QR code to the property site. Offer it free, or turn it on as a paid add-on the agent adds to their
              cart and pays for through your Stripe.
            </p>
            <p>
              A typical listing: you upload the edited set into folders (exterior, interior, aerial), brighten one
              kitchen shot in the editor, add the walkthrough video and the Matterport embed, and the agent gets an email
              that the media is ready. They open one page, see every photo, the video, the tour, and the balance due,
              leave a note on the video at 0:42, pay, pull the MLS-size ZIP from their phone, and add the property
              website and social kit before they leave.
            </p>
          </ToolCard>

          <Figure caption="Real ShootPortal screens: on the left, the listing photos organized on your project's Media tab; on the right, the finished project on the agent's phone with Download All, no app required.">
            <TwoSidedScreens business="project-media" client="phone-portal-finished" />
          </Figure>

          <InlineCta
            trialDays={ctx.trialDays}
            title="Deliver the listing, get paid, and sell the marketing kit"
            body="Put one real listing through ShootPortal: MLS downloads that unlock on payment, a property website built from your photos, and a social kit the agent can buy on the spot."
          />

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
            bestFor="Photographers whose agents use Zillow Showcase, and who want a free branded delivery page to start."
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
              Aryeo Lite is free for basic delivery, and the agent login portal keeps an archive of every past shoot.
              The paid tiers cap listings per year, so the price climbs with your volume. If you&apos;re weighing a move
              away from it, our <BlogLink slug="best-aryeo-alternatives">Aryeo alternatives guide</BlogLink> covers the
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
            bestFor="Photographers who prefer paying per delivery over a subscription."
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
              HDPhotoHub is one of the most delivery-focused platforms here, and integrations with Dropbox and Vimeo help
              if your files already live there. Because every delivery is billed, a busy month costs more. See our{" "}
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
            bestFor="Multi-photographer teams that want delivery automated across a dispatch operation."
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
            bestFor="Photographers whose delivery centers on a property website with photos, tours, and floor plans."
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
            bestFor="Tour-heavy businesses that want per-item pricing."
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
            bestFor="Businesses that want brokerage billing at a flat per-listing price."
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
            bestFor="360° tour photographers who want per-project delivery."
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
            bestFor="Photographers already using AI editing who want delivery from the same vendor."
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
              confirmation and proposal, so the delivery email isn&apos;t the first time they hear it.
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
              With unlock-after-payment on, agents see the full set immediately and the Pay Now button sits on the same
              project page, with card, Apple Pay, Google Pay, and optional bank payments. Downloads unlock automatically
              the moment they pay, and a receipt goes out by email. For an agent on account, turn the lock off for that
              project or mark an offline payment as paid. Prefer part up front? Request a deposit when the proposal is
              approved and the balance at delivery.
            </p>
          </ProductCallout>
          <Figure caption="Real ShootPortal screens: on the left, the project's payments with deposit, balance, and what's outstanding; on the right, the agent's phone showing media ready and a Pay Now button.">
            <TwoSidedScreens business="payments" client="phone-portal-pay" />
          </Figure>
          <Callout tone="note" title="Brokerage billing and pay-at-close">
            <p>
              If a brokerage pays for the media or the agent pays at closing, a hard paywall won&apos;t fit those jobs.
              Turn the download lock off for that project, deliver as normal, and record the payment as paid when it
              arrives.
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
      id: "after-delivery",
      title: "After delivery: property websites and marketing kits you can sell",
      tocLabel: "Property websites & marketing",
      body: () => (
        <>
          <p>
            The moment an agent downloads the photos, their next job is marketing the listing: a property website, Just
            Listed posts, an open house flyer. Usually they piece that together in another tool. If your delivery
            platform builds it for them, it becomes a service you can charge for.
          </p>
          <p>
            In ShootPortal, each project has a Marketing Kit. The property website and social kit are built
            automatically from the delivered photos and the project details, with the agent&apos;s headshot, brokerage
            logo, and colors saved to their client record and reused on every listing. You decide per product whether
            it&apos;s Included or Paid, set your price (defaults are $49 for the website and $29 for the social kit, with
            an optional bundle), and the agent sees a preview, adds it to the cart, and pays through your Stripe or on
            the invoice. An optional &quot;Photography by&quot; credit on the site advertises your business to every
            buyer who visits.
          </p>
          <Figure caption="Real ShootPortal screen: the project's Marketing Kit tab, where you offer the agent a property website and social media kit as included extras or paid add-ons.">
            <AppScreen view="marketing-kit-tab" />
          </Figure>
          <p>
            The property website has Modern, Luxury, and Coastal designs, sections for key facts, gallery, video,
            floor plans, virtual tour, open house, and agent contact, status labels from Coming Soon to Sold, and an
            unbranded MLS-safe version. The offer stays off until you turn it on, so you can start with delivery and add
            marketing when you&apos;re ready.
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
            elsewhere. The delivery page then knows nothing about the job: what was ordered, what was quoted, whether a
            reshoot was promised, or whether a deposit was already paid.
          </p>
          <p>When delivery sits inside the same system as the rest of the job, a few things get easier:</p>
          <ul>
            <li>
              <strong>Payment and download are linked automatically.</strong> The balance owed is already known, so
              unlocking after payment needs no extra step.
            </li>
            <li>
              <strong>Revisions stay on the record.</strong> If the agent asks for a brighter kitchen, the request sits
              next to the original files and proposal, and you fix it in the built-in editor without a re-upload.
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
            project to open. The proposal, shoot date, messages, files, and payment status are all on it, so &quot;did
            you get my note about the kitchen?&quot; and &quot;is this paid?&quot; are answered on the same page.
          </p>
          <Figure caption="Real ShootPortal screen, the client portal: a project moving through estimate, shoot, media, payment, and files (sample client data).">
            <ProductPreview view="client-portal" />
          </Figure>
          <p>
            And it goes further back than the estimate. Your business website, the Book a Shoot request form, proposals,
            and scheduling all feed the same project, so the agent who found you online is the same record you deliver
            to. If client records matter as much as the delivery, our{" "}
            <BlogLink slug="best-photography-client-portals">client portal comparison</BlogLink> looks at that side in
            more detail.
          </p>
          <AllInOnePlatform />
          <p>
            See how a full listing delivery works on our{" "}
            <SiteLink href="/photo-video-delivery-software">photo and video delivery software</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "who-should-choose-shootportal",
      title: "Who should choose ShootPortal for listing delivery",
      tocLabel: "Is ShootPortal a fit?",
      body: () => (
        <>
          <p>
            Delivery is the moment agents judge the shoot, but it&apos;s only one step of the job. Before it come the
            request, the proposal, the shoot time, and any revisions; after it come getting paid and marketing the
            listing. ShootPortal is our pick when you want all of that on the same project record, under your brand,
            with agents needing nothing but a link.
          </p>
          <BestFitPanel
            heading="Where ShootPortal fits best for real estate delivery"
            fits={[
              {
                who: "Photographers tired of chasing invoices",
                why: "Agents preview the full set, pay on the same page by card, wallet, or bank, and downloads unlock automatically. Receipts go out by email.",
              },
              {
                who: "Photographers who want new revenue",
                why: "Sell a property website and social media kit built from your own photos, priced per product, paid through your Stripe.",
              },
              {
                who: "Listing plus aerial or video shooters",
                why: "Print and MLS photo sizes, video with time-stamped review, Kuula tours, and 3D embeds from Matterport or Polycam on one project page.",
              },
              {
                who: "Repeat agents and relists",
                why: "Client records show lifetime revenue, outstanding balance, and property history, and the agent's branding is reused on every marketing kit.",
              },
            ]}
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
                who: "Solo listing photographers",
                pick: "ShootPortal",
                why: "One flat plan covers delivery, payment, and marketing, with no per-listing fees eating into busy months.",
              },
              {
                who: "Delivering steady volume",
                pick: "ShootPortal",
                why: "One flat subscription with no per-delivery fees, so your cost per listing falls as you grow.",
              },
              {
                who: "Listings plus aerial, video, and commercial",
                pick: "ShootPortal",
                why: "Per-item approval, video review, MLS and Print downloads, and payment in one project portal.",
              },
              {
                who: "Want to sell property websites",
                pick: "ShootPortal",
                why: "Property website and social kit built from the delivered photos, sold as an add-on or included.",
              },
              {
                who: "Small teams growing past solo",
                pick: "ShootPortal",
                why: "Unlimited staff accounts with permissions, assigned to projects, on the same plan.",
              },
            ]}
          />
          <KeyTakeaways
            items={[
              "Judge delivery software on the agent's phone, not your desktop.",
              "MLS-sized and full-resolution downloads should be two clear options, not a guess.",
              "Pay-to-download fixes collections, but keep previews open and a manual override handy.",
              "A property website and marketing kit built from your photos is the easiest upsell in listing work.",
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
      body: (ctx) => (
        <>
          <p>
            The best real estate photography delivery software is the one your agents stop noticing: they tap the link,
            grab the MLS set, post the video, and pay without a follow-up text. For most listing photographers,
            that&apos;s ShootPortal, because delivery comes with the edit, the review, the payment, and a property
            website and marketing kit you can sell, all on one branded project and one flat plan.
          </p>
          <p>
            Per-delivery platforms like HDPhotoHub and Tourbuzz and listing tools like Aryeo, Rela, and Spiro are worth
            comparing on price. If you want delivery to be the natural last step of every job,{" "}
            <SiteLink href="/how-it-works">see how ShootPortal handles delivery</SiteLink> and try it on your next
            listing.
          </p>
          <TrialCard
            trialDays={ctx.trialDays}
            title="Deliver your next listing from one link"
            body="Upload a real set, turn on MLS downloads and unlock-after-payment, add the tour embed and a property website, and open the portal on your phone the way an agent would before you send it."
            secondaryHref="/pricing"
            secondaryLabel="See pricing"
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is real estate photography delivery software?",
      answerText:
        "It's software that hands listing media to agents: MLS-sized and full-resolution photos, video, 3D tours, floor plans, and documents on a branded page or portal, often with downloads locked until the invoice is paid. Platforms like ShootPortal also build a property website and marketing kit from the delivered photos.",
      answer: (
        <p>
          It&apos;s software that hands listing media to agents: MLS-sized and full-resolution photos, video, 3D tours,
          floor plans, and documents on a branded page or portal, often with downloads locked until the invoice is paid.
          Platforms like ShootPortal also build a property website and marketing kit from the delivered photos.
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
        "Yes. ShootPortal, HDPhotoHub, Tonomo, RTV, and Rela (with its Storefront add-on) can lock downloads until payment while still letting agents preview the media. In ShootPortal, downloads unlock automatically when the agent pays, and you can turn the lock off for agents on account.",
      answer: (
        <p>
          Yes. ShootPortal, HDPhotoHub, Tonomo, RTV, and Rela (with its Storefront add-on) can lock downloads until
          payment while still letting agents preview the media. In ShootPortal, downloads unlock automatically when the
          agent pays, and you can turn the lock off for agents on account.
        </p>
      ),
    },
    {
      question: "Do agents need an account to download listing photos?",
      answerText:
        "It depends on the platform. HDPhotoHub uses login-free download pages. Aryeo and Fotello use agent portals. ShootPortal offers both: a branded client portal that keeps every past listing, plus 'Anyone with the link' project links and share links for people without an account, such as an agent's assistant.",
      answer: (
        <p>
          It depends on the platform. HDPhotoHub uses login-free download pages. Aryeo and Fotello use agent portals.
          ShootPortal offers both: a branded client portal that keeps every past listing, plus &quot;Anyone with the
          link&quot; project links and share links for people without an account, such as an agent&apos;s assistant.
        </p>
      ),
    },
    {
      question: "Does ShootPortal create property websites for listings?",
      answerText:
        "Yes. ShootPortal builds a property website for each listing from the delivered photos and project details, in Modern, Luxury, or Coastal designs, with an unbranded MLS-safe version, status labels like Coming Soon or Sold, and view tracking. It lives at listings.yourstudio.com, and you can include it free or sell it to the agent.",
      answer: (
        <p>
          Yes. ShootPortal builds a property website for each listing from the delivered photos and project details, in
          Modern, Luxury, or Coastal designs, with an unbranded MLS-safe version, status labels like Coming Soon or Sold,
          and view tracking. It lives at listings.yourstudio.com, and you can include it free or sell it to the agent.
        </p>
      ),
    },
    {
      question: "Can I sell a real estate marketing kit with the photos?",
      answerText:
        "In ShootPortal, yes. The Marketing Kit adds a property website and a social media kit (Just Listed, Open House, Just Sold, Highlights, and Coming Soon posts, Stories, an Instagram carousel, and a print flyer) built from the listing photos. Mark each product Included or Paid, set your price, and the agent pays through your Stripe or on the invoice.",
      answer: (
        <p>
          In ShootPortal, yes. The Marketing Kit adds a property website and a social media kit (Just Listed, Open House,
          Just Sold, Highlights, and Coming Soon posts, Stories, an Instagram carousel, and a print flyer) built from the
          listing photos. Mark each product Included or Paid, set your price, and the agent pays through your Stripe or
          on the invoice.
        </p>
      ),
    },
  ],
  related: ["best-photo-video-delivery-platforms", "best-real-estate-photography-software", "shootportal-vs-aryeo-vs-hdphotohub"],
  cta: {
    title: "Get paid before the MLS upload, then sell the marketing.",
    body: "Give every listing one branded project: MLS and Print downloads, video review, tours, downloads that unlock on payment, and a property website and social kit you can sell.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how it works",
  },
};
