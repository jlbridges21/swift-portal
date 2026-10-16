# SEO keyword-to-page map

Owner: marketing. Source of truth for which URL targets which search intent, so pages don't compete
with each other (cannibalization). Page config lives in `src/lib/solutions.ts` (landing pages) and
`src/content/blog/*` (articles).

## Data behind this map (2026-10-15)

- **Search Console** (`sc-domain:shootportal.app`, last 90 days): 33 impressions, 5 clicks, all on
  `/`. Google withheld every query as anonymized. Too little data to prioritize keywords; low
  impressions do **not** mean low demand. Revisit after 60–90 days of indexing.
- **Keyword volume/difficulty tools:** none available. No volumes are claimed anywhere.
- **SERP review** of each head term (see "Intent" column) plus the competitor research behind the
  25 blog articles.

## SERP findings that shape positioning (web search, 2026-10-15)

Not a live Google rank tracker; directional only.

- **real estate photography software:** results lean toward photo *editing* tools (AI/HDR) plus
  "alternatives"/"vs" roundups; business-operations vendors are a minority. → Page states it is
  business software (requests → delivery) that works alongside your editor.
- **drone business management software:** mostly flight-ops/fleet/compliance tools; Dronedesk is the
  main client-side tool. → Page leads with "the client side of drone work" and an explicit scope card.
- **photography client portal:** split between gallery-only portals and full business hubs. → Page
  positions the portal as the client's whole journey, not just a gallery.
- **real estate photography CRM:** diluted by CRMs *for agents*. → Page says up front it's for
  photographers who serve agents.
- **photo and video delivery software:** demand for photos + video together, video review with
  time-coded comments and versions. → Lead with those; do not claim streaming/transcoding.

## Rule: commercial pages vs. articles

| Intent | Owned by | Examples |
| --- | --- | --- |
| Vendor / product ("X software", "X platform", "X portal") | Solution landing pages | `/real-estate-photography-software` |
| Research / comparison ("best X", "X alternatives", "X vs Y") | Comparison articles | `/blog/best-real-estate-photography-software` |
| How-to / problem ("how to deliver…", "how much to charge…") | How-to articles | `/blog/how-to-deliver-real-estate-photos` |

A landing page and an article on the same topic must link to each other with distinct anchors
("real estate photography software" → landing page; "best real estate photography software
compared" → article). Never point two landing pages at the same primary keyword.

## Landing pages

| URL | Primary keyword | Secondary keywords | Intent | Audience | Conversion goal | Closest articles (link both ways) |
| --- | --- | --- | --- | --- | --- | --- |
| `/real-estate-photography-software` | real estate photography software | real estate photography business software; real estate photography management software; real estate media software; software for real estate photographers; real estate media business management | Commercial, vendor evaluation; whole-business platform | Real estate photographers and small RE media teams | Trial (`seo:real-estate-software:*`) | best-real-estate-photography-software, best-aryeo-alternatives, best-hdphotohub-alternatives, shootportal-vs-aryeo-vs-hdphotohub, real-estate-photography-automation, best-real-estate-photography-booking-software |
| `/drone-business-management-software` | drone business management software | drone photography business software; drone client management software; drone photography CRM; software for commercial drone pilots; drone videography business software | Commercial; **business side only** (not flight ops, fleet, LAANC, mapping) | Commercial drone pilots, aerial photo/video businesses | Trial (`seo:drone-software:*`) | best-drone-business-management-software, drone-photography-pricing-guide, how-to-start-drone-photography-business, photography-workflow-automation, best-photography-invoicing-software |
| `/photography-client-portal` | photography client portal | client portal for photographers; branded photography client portal; client portal for videographers; photography client delivery portal | Commercial; client-experience product | Photographers and videographers (any niche) | Trial (`seo:client-portal:*`) | best-photography-client-portals, how-to-create-photography-client-portal, how-to-deliver-real-estate-photos, best-photo-video-delivery-platforms |
| `/real-estate-photography-crm` | real estate photography CRM | CRM for real estate photographers; real estate photography client management; real estate media client management; photographer CRM software | Commercial; relationship + project tracking (agents, properties) | RE photographers managing many agents | Trial (`seo:crm:*`) | best-photography-crm-software, real-estate-photography-client-management, real-estate-photography-automation, how-to-get-real-estate-photography-clients |
| `/photo-video-delivery-software` | photo and video delivery software | photo delivery software; video delivery platform; photography client delivery software; professional photo delivery; media delivery platform | Commercial; delivery product | Photographers, videographers, drone operators, RE media | Trial (`seo:media-delivery:*`) | best-photo-video-delivery-platforms, best-real-estate-photography-delivery-software, google-drive-vs-dropbox-photo-delivery, how-to-send-large-video-files-to-clients, best-video-review-approval-software |

| `/photography-booking-software` | photography booking software | photography scheduling software; photographer scheduling software; photography appointment booking; client booking software for photographers | Commercial; request-to-confirmed-shoot booking (**not** self-scheduling into open slots) | Photographers taking client-commissioned shoots | Trial (`seo:booking:*`) | best-real-estate-photography-booking-software, photography-workflow-automation, how-to-get-real-estate-photography-clients |
| `/photography-invoicing-software` | photography invoicing software | photography payment software; invoicing software for photographers; photographer invoice management; real estate photography invoicing; drone photography invoicing software | Commercial; estimates → deposit → payment request → receipt on the project | Photographers and drone pilots | Trial (`seo:invoicing:*`) | best-photography-invoicing-software, get-paid-before-delivering-real-estate-photos, real-estate-photography-pricing-guide |
| `/video-review-approval-software` | video review software | video approval software; client video review platform; video feedback software; time-stamped video comments; video review software for videographers | Commercial; client feedback + versions + delivery (not an editor, not a frame.io replacement for post teams) | Videographers, drone video, RE media | Trial (`seo:video-review:*`) | best-video-review-approval-software, how-to-send-large-video-files-to-clients, best-photo-video-delivery-platforms |
| `/real-estate-photography-workflow-software` | real estate photography workflow software | real estate photography workflow automation; automated real estate photography workflow; real estate media workflow software; photography business automation | Commercial; what is automated vs. centralized | RE photographers / growing media teams | Trial (`seo:workflow:*`) | real-estate-photography-automation, photography-workflow-automation, best-real-estate-photography-software |
| `/photography-business-management-software` | photography business management software | all-in-one photography business software; photography studio management software; photographer business software; photography project management software; business management for photographers | Commercial; whole business for client-commissioned photo/video work (any niche) | Photographers, videographers, drone pilots, small media teams | Trial (`seo:business-management:*`) | best-photography-crm-software, how-to-start-real-estate-photography-business, how-to-start-drone-photography-business |

### Pages 6–10: intent decisions (2026-10-15)

- **Automation page URL changed** from the suggested `/real-estate-photography-automation` to
  `/real-estate-photography-workflow-software`. The article `/blog/real-estate-photography-automation`
  already owns "real estate photography automation" as an informational how-to; a landing page on the
  same head term would compete with it. The landing page owns the vendor phrasing ("workflow software")
  and the article links to it.
- **Same primary keyword as a "best X" article** (invoicing, video review): same precedent as pages 1
  and 2. The landing page is the vendor page; the article's title/H1 lead with "Best … (2026)" for
  comparison intent. They link to each other with distinct anchors.
- **Booking:** "real estate photography booking software" stays with the booking comparison article,
  not the landing page. SERP is dominated by self-scheduling engines (Appointy, Cal.com, Wix); the
  page says up front that clients request and respond to proposed times rather than picking open slots.
- **Business management vs. real estate software (1) vs. CRM (4):** page 10 speaks to any
  client-commissioned photo/video business; page 1 is listing-specific (agents, MLS); page 4 is the
  relationship record. "photography client management software" was dropped from page 10 to avoid
  overlap with page 4. SERP is wedding/portrait studio CRMs with contracts; the page states that
  ShootPortal has no contracts/e-sign, questionnaires, or print sales.
- **Workflow software:** SERP is editing tools again; the page clarifies it covers the business workflow.

### Separation between overlapping pages

- **Software (1) vs. CRM (4):** page 1 sells the whole request → deliver business system; page 4 is
  about agents, properties, client history and balances. Page 4 links to page 1 for the full workflow.
- **Client portal (3) vs. Delivery (5):** page 3 is the client's whole journey (estimate, schedule,
  messages, payment, files); page 5 is file handoff (galleries, video, review rounds, download
  options, payment-gated release). Page 3 links to page 5 for delivery depth.
- **Drone (2):** explicitly states it is not flight planning, fleet, logging, LAANC, or mapping
  software, to avoid attracting the wrong queries and to keep bounce low.

## Analytics

CTA ids follow `seo:<page-key>:<placement>` (`hero`, `demo`, `mid`, `pricing`, `final`), set with `data-sp-cta`.
All Solutions pages: `/platform/analytics/acquisition` → "SEO landing pages" (entrances, visitors, signup clicks,
registrations, trials, activated, paid, revenue; follows the first/last-touch toggle).
Landing-page performance appears in `/platform/analytics/acquisition` → "Landing pages" (entrances,
CTA clicks, first/last-touch signups) and "Signup CTAs" (clicks per CTA id).

## Free tools and templates (2026-10-15)

Tools own **calculator / generator** intent; templates own **template / checklist / sample** intent.
Neither competes with the "best X" articles (comparison intent) or solution pages (vendor intent).

| URL | Primary keyword | Intent | Next step |
| --- | --- | --- | --- |
| `/tools` | free tools for photographers | Hub | Each tool |
| `/tools/drone-photography-pricing-calculator` | drone photography pricing calculator | Do: price a job | `/drone-business-management-software` → trial |
| `/tools/real-estate-photography-pricing-calculator` | real estate photography pricing calculator | Do: price a listing, build a price list | `/real-estate-photography-software` → trial |
| `/tools/photography-quote-builder` | photography quote generator | Do: create a client quote PDF | `/photography-business-management-software` → trial |
| `/resources` | photography business templates | Hub | Each template |
| `/resources/real-estate-photography-pricing-template` | real estate photography pricing template | Download | RE software / RE calculator |
| `/resources/drone-photography-quote-template` | drone photography quote template | Download | Drone software / quote builder |
| `/resources/photography-invoice-template` | photography invoice template | Download | `/photography-invoicing-software` |
| `/resources/real-estate-photography-shot-list` | real estate photography shot list | Download | RE software |
| `/resources/drone-photography-business-plan-template` | drone photography business plan template | Download | Drone software |
| `/resources/photography-client-questionnaire` | photography client questionnaire | Download | `/photography-client-portal` |
| `/resources/photography-workflow-checklist` | photography workflow checklist | Download | `/real-estate-photography-workflow-software` |

Overlap guard: the pricing guides (`/blog/*-pricing-guide`) own "how much to charge" research intent
and link to the calculators; the calculators own the interactive "calculator" intent and link back.

## Topic clusters

| Cluster | Commercial page (destination) | Supporting pages |
| --- | --- | --- |
| Real estate photography business | `/real-estate-photography-software` | RE pricing guide, start-a-business, RE calculator, pricing sheet, shot list, Aryeo/HDPhotoHub comparisons |
| Drone business | `/drone-business-management-software` | Drone pricing guide, start-a-drone-business, drone calculator, drone quote template, business plan |
| Client management | `/real-estate-photography-crm` | Client management guide, CRM comparison, client questionnaire |
| Client portal | `/photography-client-portal` | Client portal guides, client questionnaire |
| Media delivery | `/photo-video-delivery-software` | Delivery guides, Drive vs Dropbox, large video files |
| Booking and scheduling | `/photography-booking-software` | Booking software comparison, getting clients |
| Invoicing and payments | `/photography-invoicing-software` | Invoicing comparison, get paid before delivering, invoice template, quote builder |
| Video review | `/video-review-approval-software` | Video review comparison |
| Pricing | Tools (calculators) | Both pricing guides, pricing sheet, quote template |
| Workflow automation | `/real-estate-photography-workflow-software` | Automation guides, workflow checklist |
| Business management | `/photography-business-management-software` | CRM comparison, start-a-business guides, quote builder |

Links are registry-driven where possible (`src/lib/solutions.ts`, `src/lib/tools/registry.ts`,
`src/lib/resources/registry.ts`); article → tool/template links use `<FreeResourceCallout>`.

Analytics: tool/template interactions are `cta_click` events with ids `tool:<tool>:<action>` and
`resource:<resource>:<format>`, reported in Acquisition → "Free tools & templates" and excluded from
signup CTA metrics. Signup buttons on these pages use `toolpage:*` / `resourcepage:*` ids.
