# Marketing Kit — Property Website + Social Media Kit

Two products built automatically from a project's approved media and details, sharing one body of
marketing information:

| Product | What the client gets |
|---|---|
| **Property Website** | A public, responsive single-property site (Modern / Luxury / Coastal) at `listings.yourstudio.com/{slug}` or the ShootPortal fallback `{portal}/l/{slug}` |
| **Social Media Kit** | 5 square posts (1080²), 3 Stories (1080×1920), an Instagram carousel (1080×1350, up to 10 slides) and a Letter print flyer (PDF, 300 dpi, three photo layouts) — individually or as a ZIP |

## Where to find it

- **Business:** project page → **Marketing Kit** button (header) and the **Marketing Kit** card above Payments → full-screen editor `/admin/projects/{id}/marketing`.
- **Client:** delivered project page → “Take your listing marketing further” card → `/dashboard/projects/{id}/marketing`.
- **Settings → Marketing Kit:** offer on/off per product, Included vs Paid, prices ($49 / $29 defaults), optional bundle price, client permissions, default design, photography credit, and the master **Offer the Marketing Kit to clients** switch (off by default — clients never see a surprise offer).
- **Settings → Use your own web address → Property Website Address:** listing subdomain (below the client portal address).

## Social Media Kit workspace

Three columns, each scrolling on its own (`components/marketing/editor/social-workspace.tsx`):

1. **Kit settings** (left): design, which graphics the Download Kit includes, property details, agent & branding.
   Below 1280 px this becomes a slide-over (“Kit settings” button); on phones, the bottom sheet.
2. **Choose an asset to edit** (middle): Posts / Stories / Carousel / Flyers, a horizontal thumbnail strip
   (trackpad, mouse wheel or arrows), then controls for the selected asset only
   (`social-controls.tsx`: headline, featured photo, open house; carousel slide order/photos/captions;
   flyer layout, cover, photos, sections).
3. **Live preview** (right): the selected asset fitted to the panel at its true aspect ratio, with
   previous/next, expand (full screen, arrow keys) and Download PNG/PDF. Phones show it above the browser.

Assets that need missing details (Open House without a date) show what's missing and a button to add it.

### Property flyer

`social.flyer` (in the same `marketing_kits.content` overrides — no migration): `layout`
(`grid` Classic Grid · 6 photos, `showcase` Large + Grid · 5, `gallery` Gallery · 8), `photoIds`
(null = automatic picks from different rooms; the cover photo is never repeated), and
`showAgent` / `showHighlights` / `showDescription` / `showQr`. The QR code (generated locally with
`qrcode`, drawn as SVG) links to the property website and appears only while the website is published.
Every block has a computed height and text is trimmed to its box, so the page never overflows; missing
facts, highlights or agent details remove their block and the photos take the space.

## Data model (migration `supabase/migration-v118-marketing-kit.sql`, additive)

| Table / columns | Purpose |
|---|---|
| `marketing_kits` | One per project. `content` = only the fields someone changed (overrides); everything else is derived live from the project, so drafts follow new photos, a new hero image, etc. `published_content` = frozen snapshot the public site renders. `site_slug` (unique per business), `website_status` (draft/published/unpublished), `offer_overrides` (per-project Included/Paid/Not offered + price). |
| `marketing_kit_purchases` | Access per project + product: `pending` (linked to an unpaid `payments` row — no access), `paid`, `comped` (business included it), `refunded` / `disputed` / `cancelled` (no access). Price snapshot in `amount_cents`. Unique partial indexes allow one granted + one pending row per product. |
| `marketing_brand_profiles` | Saved realtor branding per client (agent info, headshot, brokerage logo, colors, preferred design). New projects for that client start from it. |
| `businesses.listing_domain*` | Property Website Address. Mirrors `custom_domain*`; a trigger keeps portal and listing hostnames distinct. |

All three tables are server-only (RLS on, no grants to anon/authenticated); every query goes through
`createTenantServiceClient` with the business id. Until v118 is applied, the editor and settings
show a setup notice and nothing else changes.

## How the pieces fit

```
project + approved media + client + brand profile + business branding
        └── lib/marketing/defaults.ts  (no invented facts)
                 + marketing_kits.content (overrides)
                 = MarketingContent (lib/marketing/model.ts)
                        └── lib/marketing/view-model.ts → ListingView
                              ├── components/marketing/website/listing-website.tsx  (editor preview + public /l/[slug])
                              └── components/marketing/social/templates.tsx          (live preview in the browser AND next/og export)
```

- **Live preview = export.** Social templates are plain inline-style JSX rendered by the browser for the
  preview and by `next/og` (Satori) for downloads, with the same font files (`public/marketing-fonts`).
  Websites use container queries, so the editor's desktop/mobile frames show the real responsive site.
- **No stored renders.** Downloads are rendered on demand (`/api/marketing/{project}/export`) — nothing to
  keep in sync, and a file someone already downloaded is never silently changed.
- **Media eligibility.** Only photos/videos clients can already see (visibility client/both, section
  visible, latest video-review version). Business-only or superseded media never reach drafts, previews,
  exports or the public site. Images are served through authorized routes that redirect to short-lived,
  size-capped signed URLs (never originals; exports sign 2400 px copies server-side only).
- **Publishing.** Edits only change the draft. *Publish* freezes a snapshot (including automatic photo
  picks). The public site re-checks on every request: host belongs to the business, kit published, a
  granting website purchase exists, project not hidden, each photo still eligible. Hiding a project
  unpublishes its site (trigger).

## Pricing, purchases and Stripe

- Offer = business default → optional project override. A granting purchase always wins: later price or
  availability changes never revoke access already granted. Publishing an *included* website records a
  `comped` row so a later switch to Paid can't take a live site down.
- **Pay now:** `POST /api/marketing/{project}/purchase` creates a normal project `payments` row for the
  server-computed price (+ pending purchase rows), then the browser calls the existing
  `POST /api/payments/{id}/checkout` (`returnTo: "marketing"`). Same Stripe Connect account, card-fee
  pass-through, ACH, receipts, reconciliation and platform behavior as every other payment.
- **Add to invoice:** same payment row with status `sent`; it appears in the project's Payments list and is
  paid like any invoice. **Nothing unlocks until it is paid.** Businesses can also *Add to client's invoice*
  or *Include free* from the project card, or mark the payment paid manually (existing admin action).
- **Grant:** `handlePaymentSuccess` (webhooks, reconciliation and manual mark-paid all go through it) calls
  `grantPurchasesForPayment` — idempotent, so duplicate webhook events can't double-grant. Add-on payments
  **skip project status automation** (they never move a project to Delivered or unlock downloads the main
  invoice controls). ACH: access waits until the debit clears.
- **Refunds / disputes:** `charge.refunded` (full refund) and `charge.dispute.created` on the Connect webhook
  revoke the add-on access the payment granted and take the website offline. Other payments keep the
  existing policy (refunds handled in Stripe; payment row unchanged).

## Property Website Address (listing domain)

Same code path as the portal custom domain (`lib/custom-domain.ts`, `kind = "listing"`):
Vercel project-domain API (`VERCEL_API_TOKEN`, `VERCEL_PROJECT_ID`, `VERCEL_TEAM_ID`), exact DNS
record from `GET /v6/domains/{domain}/config`, ownership TXT when Vercel requires it, Check status /
Retry DNS lookup / Remove, rate-limited checks, audit log (`listing_domain.*`).

Routing (`lib/host-resolution.ts`): a host equal to a business's **connected** `listing_domain` resolves
to that business with source `listing_domain`; `/` → `/l` (published listings), `/{slug}` → `/l/{slug}`,
everything else → 404. The proxy returns immediately for listing hosts — no portal session, login or
admin UI ever runs there. Pending/removed listing domains fall back to `{portal}/l/{slug}`, which always
works. Portal domain resolution is unchanged (checked first).

## Manual setup

1. **Database:** run `supabase/migration-v118-marketing-kit.sql` in the Supabase SQL editor.
2. **Stripe (Connect webhook):** in the Stripe Dashboard → Developers → Webhooks → the *Connect* endpoint
   (`/api/stripe/webhook/connect`), add the events **`charge.refunded`** and **`charge.dispute.created`**
   (needed only for automatic revoke on refunds/disputes; payments already work with the existing events).
3. **Vercel:** nothing new. The existing `VERCEL_API_TOKEN` / `VERCEL_PROJECT_ID` / `VERCEL_TEAM_ID` register
   listing domains the same way as portal domains. Each connected listing domain is one more domain on the
   project — check your plan's per-project domain limit if you expect many businesses to connect both.
4. **ShootPortal DNS:** no change. `*.shootportal.app` already covers the `/l/{slug}` fallback.
5. **Env vars:** none new.

## Verification

`npm run test:marketing-kit` — pure checks (no DB): sanitizing, offers/access/pricing, slugs, listing-host
routing, view model, and renders all 48 exports (3 styles × 16 assets) through the production renderer,
asserting exact pixel sizes and a one-page Letter PDF. Pass an output folder to inspect the files.
