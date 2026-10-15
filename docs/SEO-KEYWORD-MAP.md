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

### Separation between overlapping pages

- **Software (1) vs. CRM (4):** page 1 sells the whole request → deliver business system; page 4 is
  about agents, properties, client history and balances. Page 4 links to page 1 for the full workflow.
- **Client portal (3) vs. Delivery (5):** page 3 is the client's whole journey (estimate, schedule,
  messages, payment, files); page 5 is file handoff (galleries, video, review rounds, download
  options, payment-gated release). Page 3 links to page 5 for delivery depth.
- **Drone (2):** explicitly states it is not flight planning, fleet, logging, LAANC, or mapping
  software, to avoid attracting the wrong queries and to keep bounce low.

## Analytics

CTA ids follow `seo:<page-key>:<placement>` (`hero`, `mid`, `pricing`, `final`), set with `data-sp-cta`.
Landing-page performance appears in `/platform/analytics/acquisition` → "Landing pages" (entrances,
CTA clicks, first/last-touch signups) and "Signup CTAs" (clicks per CTA id).
