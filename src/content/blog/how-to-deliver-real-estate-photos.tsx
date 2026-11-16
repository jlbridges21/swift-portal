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
  Yes,
  SiteLink,
} from "@/components/blog/article-parts";
import { DeliveryPathDiagram } from "@/components/blog/diagrams";
import { DocumentCard } from "@/components/blog/business-diagrams";
import { ProductPreview } from "@/components/blog/product-preview";
import { ProductCallout, TrialCard } from "@/components/blog/conversion-parts";
import { AllInOnePlatform, AppScreen, PhoneScreen, TwoSidedScreens } from "@/components/blog/app-screen";

export const article: BlogArticle = {
  slug: "how-to-deliver-real-estate-photos",
  title: "How to Deliver Real Estate Photos to Realtors: The Complete Guide",
  seoTitle: "How to Deliver Real Estate Photos to Clients (2026 Guide)",
  description:
    "How to deliver real estate photos to clients: delivery methods, file naming, MLS vs print sizes, video, revisions, payment, and property websites.",
  excerpt:
    "A practical, step-by-step process for handing listing photos, video, and tours to agents: how to organize files by property, which delivery method to use, and how to tie delivery to payment.",
  category: "media-delivery",
  authorId: "jackson-bridges",
  publishedAt: "2026-10-15",
  updatedAt: "2026-11-16",
  primaryKeyword: "how to deliver real estate photos to clients",
  secondaryKeywords: [
    "deliver real estate photos to realtors",
    "real estate photo delivery",
    "MLS photo size",
    "real estate photo file naming",
    "send listing photos to agent",
    "property website for listings",
    "photo editing for real estate",
    "real estate marketing kit",
  ],
  readingMinutes: 15,
  cover: {
    variant: "delivery",
    tint: "teal",
    label: "How-To Guide",
    alt: "Illustration of listing photos moving from a camera to an agent's delivery page",
  },
  quickAnswer: {
    heading: "The short answer",
    points: [
      <>
        <strong>Skip email attachments</strong> for full listing sets. Gmail caps attachments at 25 MB and swaps
        anything larger for a Drive link anyway.
      </>,
      <>
        <strong>Organize by property, then by size.</strong> One folder per address, with an MLS set and a
        full-resolution set, named so an agent can tell them apart at a glance.
      </>,
      <>
        <strong>Deliver everything in one place.</strong> Photos, video, 3D tours, and floor plans for a listing should
        live behind a single link, not four.
      </>,
      <>
        <strong>Decide how payment and download connect</strong> before the first job, and put the rule in writing.
      </>,
      <>
        <strong>Deliver more than photos.</strong> ShootPortal (our product) gives each listing one branded link with
        Print and MLS downloads, video review, and downloads that unlock on payment, then turns the photos into a property
        website and social posts you can sell to the agent.
      </>,
    ],
  },
  intro: () => (
    <>
      <p>
        The shoot is the part of the job agents see you do. The delivery is the part they remember. A listing agent
        opens your link on a phone between showings, needs the MLS photos uploaded before the listing goes live, and
        wants to forward the video to the seller. If that moment is smooth, you look like the most organized vendor
        they work with. If it means unzipping a 600 MB folder of files named DSC_4471.jpg, you look like everyone else.
      </p>
      <p>
        This guide is about <strong>how to deliver real estate photos to clients</strong>: the method you use, how you
        organize files, what sizes to include, how video and tours ride along, and how revisions and payment fit into
        the same handoff. It isn&apos;t a software roundup. If you&apos;re already comparing tools, our{" "}
        <BlogLink slug="best-real-estate-photography-delivery-software">
          real estate photography delivery software comparison
        </BlogLink>{" "}
        covers the platforms side by side. Here, the focus is the process, which you need no matter what you use, with
        a look at how ShootPortal runs the whole handoff (edit, deliver, review, get paid, and market the listing) from
        one project per property.
      </p>
    </>
  ),
  sections: [
    {
      id: "delivery-methods",
      title: "Five ways to deliver real estate photos, and where each one breaks",
      tocLabel: "Delivery methods",
      body: () => (
        <>
          <p>
            Almost every photographer moves through the same progression. Here&apos;s each method, what it&apos;s good
            for, and the point where it stops working.
          </p>
          <h3>1. Email attachments</h3>
          <p>
            Fine for sending one or two quick previews. Not workable for a full set. Google&apos;s own help page says
            personal Gmail accounts can send attachments up to 25 MB, and that Gmail automatically swaps larger files
            for a Google Drive link (
            <Ext href="https://support.google.com/mail/answer/6584">Gmail attachment limits</Ext>). A typical
            listing set at full resolution is well past that, and work email systems set their own limits that you
            can&apos;t see from your side. Attachments also bury the photos in an inbox thread the agent has to dig
            back through every time.
          </p>
          <h3>2. Shared Google Drive or Dropbox folders</h3>
          <p>
            This is where most real estate photographers start, and for good reason: it&apos;s cheap, familiar, and
            agents know how to open a link. The problems arrive with volume. Every folder looks identical, there&apos;s
            nothing branded about the experience, payment happens somewhere else, and you have to remember who has
            access to what. We break down the trade-offs in detail in{" "}
            <BlogLink slug="google-drive-vs-dropbox-photo-delivery">Google Drive vs. Dropbox for photo delivery</BlogLink>.
          </p>
          <h3>3. File transfer services</h3>
          <p>
            Services like WeTransfer and Dropbox Transfer are built for one-time handoffs of large files. They&apos;re
            useful for raw video going to an editor. For agents, the expiring link is the drawback: Dropbox&apos;s
            help center says transfers on its Basic, Family, and Plus plans expire after seven days (
            <Ext href="https://help.dropbox.com/share/dropbox-transfer">Dropbox Transfer</Ext>). Agents come back for
            listing photos weeks later, when a price drops or a listing is relisted.
          </p>
          <h3>4. Client gallery platforms</h3>
          <p>
            Gallery tools such as Pixieset, Pic-Time, and ShootProof look polished and handle download sizes well. They
            were designed for wedding and portrait clients who browse, favorite, and order prints, so the real estate
            pieces (property-based organization, video and 3D tours alongside photos, tying the gallery to the job) are
            usually less of a focus. See our{" "}
            <BlogLink slug="best-photo-video-delivery-platforms">photo and video delivery platform guide</BlogLink> for
            how they compare.
          </p>
          <h3>5. Branded delivery pages and client portals</h3>
          <p>
            Dedicated delivery software gives each listing its own page or project, with every media type, download
            sizes, and often payment in one place. The agent gets one link per property. You get a record of what was
            delivered, when, and whether it&apos;s paid.
          </p>
          <ComparisonTable
            caption="Traditional file sharing versus dedicated delivery for real estate photos"
            columns={["", "Email / shared folders / transfers", "Dedicated delivery page or portal"]}
            highlightColumn={2}
            rows={[
              ["Setup cost", "Low; tools you already have", "Subscription or per-listing fee"],
              ["Your branding", <No key="a">Provider&apos;s interface</No>, <Yes key="b">Your logo and colors</Yes>],
              ["MLS and full-res sizes", <No key="c">You export and upload both</No>, <Yes key="d">Often generated or offered as options</Yes>],
              ["Video and 3D tours with photos", <No key="e">Separate links</No>, <Yes key="f">Same page</Yes>],
              ["Link lifespan", "Transfers expire; folders depend on your storage", "Tied to the listing record"],
              ["Payment tied to download", <No key="g" />, <Yes key="h">On many platforms</Yes>],
              ["Revision requests", "Email or text threads", "Attached to the delivery, depending on platform"],
            ]}
            note="General comparison of categories. Specific features vary by product; check each vendor's documentation."
          />
        </>
      ),
    },
    {
      id: "organize-files",
      title: "How to organize real estate photos before you deliver",
      tocLabel: "Organizing files",
      body: () => (
        <>
          <p>
            Good organization is invisible to the agent, and that&apos;s the point. They should never have to
            figure out which file goes where. Settle these conventions once, write them down, and use them on every
            job.
          </p>
          <h3>Folder structure: one property, one home</h3>
          <p>
            Organize by property address first, because that&apos;s how agents think about their work. Inside each
            property, separate by deliverable type and size. A structure that works for most listings:
          </p>
          <ul>
            <li>
              <strong>123-Main-St-Springfield</strong> (top level, address-first so it sorts sensibly)
            </li>
            <li>
              <strong>01-Photos-MLS</strong>: resized for listing upload
            </li>
            <li>
              <strong>02-Photos-Full-Resolution</strong>: for print, brochures, and signage
            </li>
            <li>
              <strong>03-Video</strong>: the listing film plus any vertical social cuts
            </li>
            <li>
              <strong>04-Aerials</strong>: if you fly, keep drone stills separate so agents can find them
            </li>
            <li>
              <strong>05-Floor-Plans-and-Tours</strong>: PDFs and tour links in a short text file
            </li>
          </ul>
          <h3>File naming that agents can read</h3>
          <p>
            Camera filenames mean nothing to an agent. Rename on export using a pattern like{" "}
            <em>123-Main-St_01_front-exterior.jpg</em>. The address keeps files identifiable after they&apos;re
            downloaded and mixed with other listings. The two-digit sequence number keeps your intended order when the
            agent uploads to the MLS, so the hero exterior stays first. The short room label helps an agent find
            &quot;the kitchen shot&quot; for a social post without opening every file.
          </p>
          <h3>MLS size vs. print size</h3>
          <p>
            Agents usually need two versions of each photo. The MLS version is smaller so it uploads quickly and meets
            the listing service&apos;s requirements. The full-resolution version is for print marketing.
          </p>
          <Callout tone="warning" title="MLS rules vary by MLS">
            <p>
              There is no single national MLS photo spec. Maximum dimensions, file size, photo count, and rules about
              branding or text on images differ from one MLS to the next. Check the photo rules for every MLS your
              agents list in, or ask a trusted agent to pull the current requirements, and build your export presets
              around them.
            </p>
          </Callout>
          <p>
            If your delivery tool generates the smaller size for you, that&apos;s one less export to manage. In
            ShootPortal, for example, clients can download each photo as &quot;Print&quot; (the original full-resolution
            file) or &quot;MLS&quot; (resized to 2048 pixels on the long edge), one at a time or as a ZIP. Confirm that
            size works for your local MLS before relying on it.
          </p>
        </>
      ),
    },
    {
      id: "photos-video-tours",
      title: "Delivering photos, video, and tours together",
      tocLabel: "Photos, video, tours",
      body: () => (
        <>
          <p>
            Once you sell more than stills, delivery gets messy fast. A typical premium listing might include MLS and
            print photos, a branded and unbranded listing video, drone stills, a 3D tour, and a floor plan. If each of
            those arrives through a different link, the agent will inevitably lose one, and you&apos;ll get the
            &quot;can you resend the tour?&quot; message.
          </p>
          <ul>
            <li>
              <strong>Video:</strong> deliver the downloadable file, not only a streaming link. Agents upload video to
              their own social accounts and websites. A hosted embed (YouTube, for example) is a good addition for quick
              sharing, but it shouldn&apos;t be the only copy.
            </li>
            <li>
              <strong>3D and 360 tours:</strong> these usually live on the tour provider&apos;s platform (Matterport,
              Kuula, and so on). Put the link or embed on the same page as the photos so the agent has one place to look.
              If the MLS requires an unbranded tour link, check what your tour provider offers.
            </li>
            <li>
              <strong>Floor plans and documents:</strong> PDFs belong with the listing, clearly labelled.
            </li>
          </ul>
          <p>
            The rule of thumb: <strong>one link per property</strong>. Whatever tool you use, the agent should be able
            to find every deliverable for 123 Main St from a single place, today or three months from now. If large
            video files are a pain point, our guide on{" "}
            <BlogLink slug="how-to-send-large-video-files-to-clients">how to send large video files to clients</BlogLink>{" "}
            goes deeper.
          </p>
          <Figure caption="Real ShootPortal screen: the media library, with every listing's photos and video organized and searchable (sample client data).">
            <ProductPreview view="media" />
          </Figure>
          <Figure caption="Real ShootPortal screen: what the agent sees on their phone when a listing is finished. One link per property, with Download All for the full set.">
            <PhoneScreen view="phone-portal-finished" />
          </Figure>
        </>
      ),
    },
    {
      id: "download-access",
      title: "Managing who can view and download",
      tocLabel: "Download access",
      body: () => (
        <>
          <p>
            Listing photos get passed around. The agent forwards them to an assistant, a transaction coordinator, a
            stager, the seller, and sometimes the builder or the brokerage marketing team. Plan for that instead of
            fighting it.
          </p>
          <h3>Decide who needs an account</h3>
          <p>
            Your client, the agent who ordered and pays, benefits from a login: they can see every listing you&apos;ve
            shot for them, past and present. Everyone else usually just needs a link. Forcing an assistant to create an
            account to grab ten photos creates friction you don&apos;t need.
          </p>
          <h3>Use link settings deliberately</h3>
          <ul>
            <li>
              <strong>Public view links</strong> are easiest to forward, but anyone with the link can see the media.
            </li>
            <li>
              <strong>Invite-based or expiring links</strong> are better when the agent wants to give a specific person
              access for a limited time.
            </li>
            <li>
              <strong>Download permissions</strong> matter when payment is outstanding. Viewing and downloading
              don&apos;t have to unlock at the same time.
            </li>
          </ul>
          <ProductCallout title="The agent logs in; the assistant just gets a link">
            <p>
              Your client signs in to their portal and sees every property you&apos;ve shot for them. When the agent
              says &quot;send it to my assistant too,&quot; you create a share link from the same project: an
              &quot;anyone with the link&quot; view page, or an email invite that&apos;s one-time or reusable and can
              expire. No account, no second upload, no separate Drive folder to keep in sync.
            </p>
          </ProductCallout>
          <h3>Plan for how long media stays available</h3>
          <p>
            Tell agents how long you host delivered media, and keep your own archive regardless. Listings get relisted,
            and the agent will ask for the photos again. Having a clear answer makes you look organized, and it gives
            you a natural moment to offer a reshoot when the season or staging has changed.
          </p>
        </>
      ),
    },
    {
      id: "revisions",
      title: "Handling agent requests and revisions",
      tocLabel: "Revisions",
      body: () => (
        <>
          <p>
            Revision requests are normal: a lamp left on, a sky that needs replacing, a photo the seller wants removed.
            What turns them into a problem is when they arrive as scattered texts with no record of what was changed.
          </p>
          <ul>
            <li>
              <strong>Define what&apos;s included.</strong> Decide which fixes are part of the job (editing corrections)
              and which are new work (reshooting a room after the stager arrives). Put that in your service terms.
            </li>
            <li>
              <strong>Ask for feedback per photo.</strong> &quot;The kitchen looks off&quot; isn&apos;t actionable.
              Ask agents to reference the file number or leave notes on the specific image.
            </li>
            <li>
              <strong>Replace, don&apos;t add.</strong> When you fix an image, replace it in the delivery so the agent
              never uploads the old version by mistake.
            </li>
            <li>
              <strong>Close the loop.</strong> Tell the agent when the revision is up, and keep the request and the
              response together.
            </li>
          </ul>
          <p>
            Dedicated delivery tools help here because feedback stays attached to the files. In ShootPortal, clients
            approve or flag each deliverable with written feedback and submit a revision request. Video gets full
            review: comments pinned to a timestamp and a point on the frame, threaded replies, Resolved and Unresolved
            notes, and numbered versions (V1, V2, Latest). It replaces Dropbox Replay or Frame.io for client feedback,
            on the same project as the delivery and the invoice.
          </p>
          <ProductCallout title="Fix the photo where the agent sees it">
            <p>
              ShootPortal has a built-in photo editor, so a &quot;the kitchen looks dark&quot; note doesn&apos;t mean
              reopening your editing app, exporting, and re-uploading. Adjust exposure, highlights and shadows, white
              balance, or curves, remove a spot, straighten verticals with geometry corrections, or apply one-click Auto.
              Save to Project updates the gallery and downloads instantly, and the original is kept in version history
              if you want it back.
            </p>
          </ProductCallout>
          <Figure caption="Real ShootPortal screen: the built-in photo editor adjusting an interior listing photo. Saving updates the agent's gallery and downloads right away.">
            <AppScreen view="photo-editor" />
          </Figure>
        </>
      ),
    },
    {
      id: "payment-and-delivery",
      title: "Connecting delivery to payment",
      tocLabel: "Payment",
      body: (ctx) => (
        <>
          <p>
            Most real estate photographers have, at some point, delivered a full listing and then spent two weeks
            chasing the invoice. The fix is a clear rule about how delivery and payment relate, applied to every
            client.
          </p>
          <p>Common policies, from most to least protective:</p>
          <ol>
            <li>
              <strong>Pay before download.</strong> The agent can preview everything, but full downloads unlock after
              payment. This keeps the agent moving (they can see the work is done) without handing over the files
              unpaid.
            </li>
            <li>
              <strong>Deposit up front, balance before download.</strong> Useful for larger video or aerial packages.
            </li>
            <li>
              <strong>Deliver, then invoice on terms.</strong> Common with long-standing agents and brokerages. It
              works, but it shifts collection work onto you.
            </li>
          </ol>
          <Figure caption="Conceptual diagram: a delivery flow where clients can review media before downloads unlock after payment.">
            <DeliveryPathDiagram showPaywall />
          </Figure>
          <p>
            The &quot;pay before download&quot; approach works best when it&apos;s automatic rather than personal. If
            the system unlocks the files the moment payment clears, nobody has to have an awkward conversation.
            ShootPortal has an optional &quot;unlock downloads after payment&quot; setting: clients can view and
            preview the media, and downloads unlock once the final payment is made through your Stripe account.
            We cover policy wording and edge cases in{" "}
            <BlogLink slug="get-paid-before-delivering-real-estate-photos">
              how to get paid before delivering real estate photos
            </BlogLink>
            . The pay link opens without a login, agents can pay by card, Apple Pay, or Google Pay, and ShootPortal takes
            0% of the payment.
          </p>
          <InlineCta
            trialDays={ctx.trialDays}
            title="One link per listing, paid before it downloads"
            body="Upload once, let agents preview and comment, and have Print and MLS downloads unlock on their own when the balance is paid. Your brand on every screen."
          />
        </>
      ),
    },
    {
      id: "turnaround",
      title: "Turnaround: setting expectations you can keep",
      tocLabel: "Turnaround",
      body: () => (
        <>
          <p>
            Agents plan listing launches around your delivery. A missed delivery can push back a go-live date, which
            is why reliability matters more than raw speed. A consistent next-morning delivery beats a turnaround that
            is sometimes same-day and sometimes three days.
          </p>
          <ul>
            <li>
              <strong>Publish your standard turnaround</strong> on your service menu, and state what changes it
              (twilight shoots, video, heavy edits, weekends).
            </li>
            <li>
              <strong>Offer rush delivery as a paid add-on</strong> instead of quietly rushing for whoever asks loudest.
            </li>
            <li>
              <strong>Send the delivery notification yourself, or automate it.</strong> The agent should never have to
              ask whether the photos are ready.
            </li>
            <li>
              <strong>Track what&apos;s shot but not delivered.</strong> A pipeline view (shot, in editing, in review,
              delivered) makes it obvious which jobs are at risk before they&apos;re late.
            </li>
          </ul>
          <p>
            If you want those notifications and status changes to happen without you touching them, our guide to{" "}
            <BlogLink slug="real-estate-photography-automation">real estate photography automation</BlogLink> covers
            what&apos;s worth automating.
          </p>
        </>
      ),
    },
    {
      id: "client-experience",
      title: "Creating a professional delivery experience",
      tocLabel: "Client experience",
      body: () => (
        <>
          <p>
            A professional delivery isn&apos;t about flashy design. It&apos;s about the agent never having to think.
            The delivery notification is a big part of that, so it&apos;s worth writing a good template once and reusing
            it. Here&apos;s one you can adapt:
          </p>
          <Figure caption="Example delivery email template. Replace the bracketed fields with your own details.">
            <DocumentCard eyebrow="Email template" title="Your photos for [Property address] are ready">
              <p>Hi [Agent first name],</p>
              <p>
                The media for <strong>[Property address]</strong> is ready. Everything for this listing is in one place
                here: [Delivery link]
              </p>
              <ul>
                <li>MLS-sized photos, ready to upload</li>
                <li>Full-resolution photos for print and signage</li>
                <li>[Listing video / drone stills / 3D tour / floor plan]</li>
              </ul>
              <p>
                Need a change? Leave a note on the specific photo and I&apos;ll turn it around by [time]. [If unpaid:
                Downloads unlock as soon as the balance of [amount] is paid at the same link.]
              </p>
              <p>Good luck with the listing,<br />[Your name], [Business name]</p>
            </DocumentCard>
          </Figure>
          <Figure caption="Real ShootPortal screen: the agent's finished listing gallery in your branded client portal, with favorites, Print and MLS downloads, and every media type in one place.">
            <AppScreen view="portal-gallery" />
          </Figure>
          <p>A few more details that separate a professional delivery from a shared folder:</p>
          <ul>
            <li>
              <strong>Your brand, not the file host&apos;s.</strong> Your logo, colors, and ideally your own domain on
              the delivery page.
            </li>
            <li>
              <strong>Mobile first.</strong> Test every delivery on a phone. That&apos;s where most agents will open it.
            </li>
            <li>
              <strong>Hero image first.</strong> Order photos the way you&apos;d want them on the MLS.
            </li>
            <li>
              <strong>One place for history.</strong> An agent who can log in and see every listing you&apos;ve shot for
              them is an agent who keeps booking you. A{" "}
              <BlogLink slug="best-photography-client-portals">client portal</BlogLink> does this well, and we walk
              through building one in{" "}
              <BlogLink slug="how-to-create-photography-client-portal">how to create a photography client portal</BlogLink>.
            </li>
          </ul>
        </>
      ),
    },
    {
      id: "deliver-more-than-photos",
      title: "Deliver more than photos: property websites and social media kits",
      tocLabel: "Deliver more than photos",
      body: () => (
        <>
          <p>
            The moment you deliver is the moment the agent starts marketing the listing. They need a page to share, a
            Just Listed post, a Story, and often a printed flyer for the open house. Most of them build those from your
            photos anyway, in Canva or a listing-site tool. If you hand them over with the delivery, you save the agent
            an evening and give yourself a reason to be the photographer they rebook.
          </p>
          <ul>
            <li>
              <strong>A property website for the listing.</strong> In ShootPortal it&apos;s built automatically from the
              delivered photos and project details, in Modern, Luxury, or Coastal designs, with key facts, gallery,
              video, floor plans, the virtual tour, open house times, and the agent&apos;s contact card. It lives at
              listings.yourstudio.com, switches status from For Sale to Pending to Sold, and has an unbranded MLS-safe
              version.
            </li>
            <li>
              <strong>A social media kit.</strong> Five square posts (Just Listed, Open House, Just Sold, Highlights,
              Coming Soon), three Stories, an Instagram carousel of up to 10 slides, and a print-ready flyer with a QR code
              to the property site, downloadable as PNG, PDF, or a ZIP.
            </li>
            <li>
              <strong>Sell it or include it.</strong> Set each product as Included or Paid (defaults $49 for the website
              and $29 for the kit, which you change). The agent sees a preview and pays through your Stripe or adds it to
              the invoice. Their headshot, brokerage logo, and colors are saved and reused on every listing.
            </li>
          </ul>
          <Figure caption="Real ShootPortal screens: the social media kit generated from the delivered listing photos (left), and the property website the agent shares, on a phone (right).">
            <TwoSidedScreens business="social-kit" client="phone-property-website" clientLabel="What buyers see" />
          </Figure>
          <p>
            An optional &quot;Photography by&quot; credit on the property website puts your business in front of every
            buyer and agent who opens the link, which is free advertising on every listing you shoot.
          </p>
        </>
      ),
    },
    {
      id: "delivery-is-part-of-the-job",
      title: "Why delivery problems are usually workflow problems",
      tocLabel: "Connected workflow",
      body: () => (
        <>
          <p>
            Look closely at the delivery headaches above and most of them aren&apos;t about file transfer at all. The
            &quot;did you get paid for Oak Ave?&quot; question lives in your invoicing tool. The revision request lives
            in a text thread. The shoot date lives in your calendar, the agent&apos;s phone number in your contacts, and
            the photos in a Drive folder. Delivery is simply the moment all of those disconnected pieces have to line up,
            which is why it feels harder than it should.
          </p>
          <p>The manual stack can work, and plenty of photographers run it well. The trade-offs are predictable:</p>
          <ul>
            <li>
              <strong>Status lives in your head.</strong> To answer &quot;where are we on 123 Main St?&quot; you check
              three apps and your memory.
            </li>
            <li>
              <strong>Payment and files don&apos;t know about each other.</strong> Holding downloads until payment means
              watching for the Stripe email and then manually sharing the folder.
            </li>
            <li>
              <strong>Feedback gets detached from the files.</strong> A revision note in a text message doesn&apos;t
              tell you which version the agent was looking at.
            </li>
            <li>
              <strong>History is scattered.</strong> When the listing is relisted in six months, you hunt for the folder
              link instead of opening the property.
            </li>
          </ul>
          <p>
            The connected alternative is to treat each property as one job record that carries everything: the order,
            the shoot time, the messages, the media, the revision notes, and the payment status. The delivery link is
            then just the client&apos;s view of that record. That&apos;s exactly how ShootPortal is built.
          </p>
        </>
      ),
    },
    {
      id: "one-link-per-property-in-shootportal",
      title: "One link per property: how the handoff works in ShootPortal",
      tocLabel: "One link per property",
      body: (ctx) => (
        <>
          <p>
            Here&apos;s how a single listing, say a twilight-and-aerial package at 123 Main St, runs through ShootPortal
            from the agent&apos;s side and from yours.
          </p>
          <ol>
            <li>
              <strong>The property is a project.</strong> 123 Main St gets one project on the agent&apos;s client
              record, alongside every other address you&apos;ve shot for them. The estimate, the confirmed shoot time,
              your messages, and the media all sit on that project.
            </li>
            <li>
              <strong>Everything for the listing goes in it.</strong> Photos (in folders such as Interior, Exterior, and
              Aerial), the listing video file, a YouTube embed, a Kuula 360 tour, a 3D model embed such as Matterport,
              and the floor plan PDF. Uploads are resumable, so a large video upload doesn&apos;t restart from zero if
              your connection drops. You choose which media sections the agent sees.
            </li>
            <li>
              <strong>The agent picks the size, not you.</strong> Each photo downloads as &quot;Print&quot; (the
              original full-resolution file) or &quot;MLS&quot; (2048 pixels on the long edge), one at a time or as a
              ZIP. You upload one full-resolution set instead of exporting two.
            </li>
            <li>
              <strong>Feedback is attached to the item.</strong> The agent approves each deliverable or requests changes
              with a written note, and video gets time-stamped comments on numbered versions. You fix the photo in the
              built-in editor or upload a new video version in the same project, so the request and the fix stay
              together.
            </li>
            <li>
              <strong>Others get access without accounts.</strong> A share link or email invite covers the assistant,
              stager, or seller.
            </li>
            <li>
              <strong>Payment can gate downloads.</strong> If you turn on &quot;unlock downloads after payment,&quot;
              the agent can view everything right away, and downloads unlock once the final payment is made through your
              own Stripe account.
            </li>
            <li>
              <strong>The listing marketing is one click away.</strong> The property website and social media kit are
              built from the same project&apos;s photos, ready to include or sell.
            </li>
          </ol>
          <h3>What&apos;s automatic, what&apos;s centralized, and what&apos;s still on you</h3>
          <ul>
            <li>
              <strong>Automatic:</strong> the MLS-size version of each photo, ZIP downloads, the download unlock after
              final payment (when enabled), branded Deliverables and Payment emails from your editable templates,
              reminders, and stage changes such as moving a project to Delivered once it&apos;s paid.
            </li>
            <li>
              <strong>Centralized:</strong> the order, shoot time, messages, media, revision notes, payment status, and
              the property&apos;s history on the agent&apos;s client record.
            </li>
            <li>
              <strong>Your call:</strong> culling and your main edit (in your usual editor or ShootPortal&apos;s built-in
              one), checking your MLS&apos;s specific photo rules, uploading the finals, and deciding when a revision
              counts as new work.
            </li>
          </ul>
          <p>
            The portal carries your logo, brand color, and either a yourstudio.shootportal.app address or your own
            custom domain, and agents need nothing but the link: no app to install. To see how it compares with other
            tools, read our{" "}
            <BlogLink slug="best-real-estate-photography-delivery-software">delivery software comparison</BlogLink>.
          </p>
          <AllInOnePlatform intro="Delivery is one step. The same subscription runs your website, booking, proposals, scheduling, photo editing, video review, payments, and the property websites and social kits you sell to agents." />
          <TrialCard
            trialDays={ctx.trialDays}
            title="Deliver your next listing from one branded link, and sell the marketing with it"
            body={
              <>
                Set up your portal, create a project for a property you&apos;ve already shot, upload the set, and open it
                on your phone the way an agent would. Then generate the property website and social kit from the same
                photos and see what you could add to the invoice.
              </>
            }
            secondaryHref="/how-it-works"
            secondaryLabel="See the delivery flow"
          />
          <p>
            Tour the delivery side in more detail on the{" "}
            <SiteLink href="/photo-video-delivery-software">photo delivery software</SiteLink> page.
          </p>
        </>
      ),
    },
    {
      id: "delivery-checklist",
      title: "A repeatable delivery checklist",
      tocLabel: "Checklist",
      body: () => (
        <>
          <p>Run through this on every listing until it&apos;s habit:</p>
          <ol>
            <li>Cull and edit; check verticals, windows, and anything the seller asked you to avoid.</li>
            <li>Export MLS and full-resolution sets using your naming pattern, in MLS order.</li>
            <li>Export video and confirm it plays on a phone.</li>
            <li>Upload everything to one place per property; add tour links and floor plans.</li>
            <li>Set download access and payment rules for this client.</li>
            <li>Open the delivery yourself on a phone before the agent does.</li>
            <li>Offer the property website and social kit, included or as a paid add-on.</li>
            <li>Send the notification with your template.</li>
            <li>Log revisions against the delivery and replace files rather than adding duplicates.</li>
          </ol>
          <KeyTakeaways
            items={[
              <>Email attachments and expiring transfer links don&apos;t suit listing media that agents revisit.</>,
              <>Organize by address, then by type and size, with filenames an agent can read.</>,
              <>Check each MLS&apos;s photo rules; don&apos;t assume one size fits every market.</>,
              <>Deliver photos, video, and tours behind one link per property.</>,
              <>Set a payment rule (such as pay before download) and let the system enforce it.</>,
              <>Deliver more than photos: a property website and social kit turn the handoff into a paid add-on.</>,
              <>Consistent turnaround and a clear notification matter more than design flourishes.</>,
            ]}
          />
        </>
      ),
    },
  ],
  faqs: [
    {
      question: "What is the best way to deliver real estate photos to clients?",
      answerText:
        "Deliver everything for a listing (MLS and full-resolution photos, video, tours, and floor plans) from one link per property in a branded client portal. ShootPortal does this with Print and MLS downloads, video review, and downloads that unlock on payment. Shared Google Drive or Dropbox folders don't tie delivery to payment or carry your branding.",
      answer: (
        <p>
          Deliver everything for a listing (MLS and full-resolution photos, video, tours, and floor plans) from one link
          per property in a branded client portal. ShootPortal does this with Print and MLS downloads, video review, and
          downloads that unlock on payment. Shared Google Drive or Dropbox folders don&apos;t tie delivery to payment or
          carry your branding.
        </p>
      ),
    },
    {
      question: "What size should real estate photos be for the MLS?",
      answerText:
        "It depends on the MLS. Each MLS sets its own limits on dimensions, file size, and photo count. Check your local MLS's photo rules and set your export presets to match. ShootPortal's MLS download option resizes photos to 2048 pixels on the long edge.",
      answer: (
        <p>
          It depends on the MLS. Each MLS sets its own limits on dimensions, file size, and photo count, so check your
          local MLS&apos;s photo rules and set your export presets to match. For reference, ShootPortal&apos;s MLS
          download option resizes photos to 2048 pixels on the long edge.
        </p>
      ),
    },
    {
      question: "Can I email real estate photos to an agent?",
      answerText:
        "Only a few at a time. Personal Gmail accounts can send attachments up to 25 MB, and Gmail converts larger files to a Google Drive link. A full listing set is better delivered through a link.",
      answer: (
        <p>
          Only a few at a time. Google says personal Gmail accounts can send attachments up to 25 MB, and Gmail
          converts larger files into a Google Drive link. A full listing set is better delivered through a link.
        </p>
      ),
    },
    {
      question: "Should I make agents pay before they can download photos?",
      answerText:
        "Many photographers let agents preview the photos but unlock downloads only after payment. It reduces collections work without slowing the agent down, especially when the unlock happens automatically.",
      answer: (
        <p>
          Many photographers let agents preview the photos but unlock downloads only after payment. It cuts down on
          collections work without slowing the agent down, especially when the unlock happens automatically. See{" "}
          <BlogLink slug="get-paid-before-delivering-real-estate-photos">our guide to getting paid before delivery</BlogLink>.
        </p>
      ),
    },
    {
      question: "How should I name real estate photo files?",
      answerText:
        "Use the property address, a two-digit sequence number, and a short room label, for example 123-Main-St_01_front-exterior.jpg. The address keeps files identifiable and the number preserves your MLS order.",
      answer: (
        <p>
          Use the property address, a two-digit sequence number, and a short room label, for example{" "}
          <em>123-Main-St_01_front-exterior.jpg</em>. The address keeps files identifiable after download, and the
          number preserves your intended MLS order.
        </p>
      ),
    },
    {
      question: "Can I deliver a property website with the listing photos?",
      answerText:
        "Yes. ShootPortal builds a single-property website from the delivered photos and project details, in Modern, Luxury, or Coastal designs, with an unbranded MLS-safe version. It comes with a social media kit of posts, Stories, a carousel, and a print flyer. You can include them or sell them to the agent; the defaults are $49 and $29.",
      answer: (
        <p>
          Yes. ShootPortal builds a single-property website from the delivered photos and project details, in Modern,
          Luxury, or Coastal designs, with an unbranded MLS-safe version. It comes with a social media kit of posts,
          Stories, a carousel, and a print flyer. You can include them or sell them to the agent; the defaults are $49 and
          $29.
        </p>
      ),
    },
    {
      question: "Can I edit real estate photos in my delivery platform?",
      answerText:
        "In ShootPortal, yes. The built-in photo editor covers one-click Auto, exposure, highlights and shadows, white balance, curves, crop, HDR and black-and-white looks, spot removal, and geometry and lens corrections. Save to Project updates the agent's gallery and downloads instantly, and originals are never overwritten.",
      answer: (
        <p>
          In ShootPortal, yes. The built-in photo editor covers one-click Auto, exposure, highlights and shadows, white
          balance, curves, crop, HDR and black-and-white looks, spot removal, and geometry and lens corrections. Save to
          Project updates the agent&apos;s gallery and downloads instantly, and originals are never overwritten.
        </p>
      ),
    },
  ],
  related: [
    "best-real-estate-photography-delivery-software",
    "google-drive-vs-dropbox-photo-delivery",
    "get-paid-before-delivering-real-estate-photos",
  ],
  cta: {
    title: "Give every listing one link the agent can't lose",
    body: "One branded project per property: edited photos with Print and MLS downloads, video review, tours, and floor plans, downloads that unlock on payment, and a property website and social kit you can sell to the agent.",
    secondaryHref: "/how-it-works",
    secondaryLabel: "See how delivery works",
  },
};
