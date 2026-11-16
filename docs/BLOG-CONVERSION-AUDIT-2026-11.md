# Blog conversion audit and rewrite (2026-11-16)

I audited and rewrote all 25 articles in `src/content/blog/` for accuracy, sales conversion and SEO. The audit used a feature inventory checked against the code: Business Website, Property Websites, Marketing Kit, Photo Editor, video review and everything else in the platform.

## What was wrong across the blog

1. **False "ShootPortal doesn't…" claims.** The articles were written before the Business Website, Property Websites, Marketing Kit and Photo Editor existed. Examples:
   - "ShootPortal doesn't edit photos" (how to deliver)
   - "No property websites, flyers, or marketing kits" (the hub article, Aryeo alternatives, HDPhotoHub alternatives, delivery software)
   - "doesn't build property websites… compare options" (pricing guide)
   - "no favorites" (photo/video delivery)
   - "ShootPortal doesn't send SMS or build property websites" (getting clients)
2. **Readers sent to competitors.** Most comparison articles did this in several places:
   - In the quick answer, whole reader segments were sent to competitors (often 4 of the 5 bullets).
   - `BestFitPanel notFor` lists told readers "Probably not the right fit if…".
   - Lines such as "skip ahead to Frame.io / Dropbox Replay", "pair it with Rela", "Stay on Aryeo" and "we'd rather you pick it".
   - In the PickGrids, ShootPortal won one card out of six.
   - The ShootPortal ToolCards listed 4–5 cons.
3. **The all-in-one platform was never shown.** Each article sold one slice of the product. None presented ShootPortal as the website-to-marketing platform that replaces Squarespace, booking forms, PDF quotes, Dropbox/Drive, Dropbox Replay/Frame.io, separate invoicing apps and Canva.
4. **Video review wasn't framed as a Dropbox Replay/Frame.io replacement.** The video review article actually recommended Replay/Frame.io/Krock.io to editors.
5. **Weak visuals.** Each article had at most one real screen, and none showed the client's side next to the business's side.
6. **Weak CTA structure.** There was one end-of-article CTA, no mid-article CTA, and few in-context product callouts.
7. **SEO.** The new features had no keywords ("real estate photography website", "property website for listings", "real estate marketing kit", "Dropbox Replay alternative", "Frame.io alternative"). A few descriptions were over 155 characters, and some primary keywords were missing from the first paragraph or every H2.

## What changed

### New components (`src/components/blog/app-screen.tsx`)
- **`AppScreen`, `PhoneScreen`, `TwoSidedScreens`, `ScreenTrio`.** These show real app screens: 29 new captures in `public/blog/screens/`. `TwoSidedScreens` puts "What you see" next to "What your client sees", which shows how easy ShootPortal is for both sides.
- **`AllInOnePlatform`.** A 12-tool grid, each tool labelled with what it replaces. It's used once per article.
- **`WorkflowCoverageMap`.** Now has a ninth "Market" stage and "Your business website" under Request.

### Every article
- False claims fixed.
- `notFor` removed, and readers are no longer steered to competitors. Competitor picks remain only for audiences outside ShootPortal's market: wedding studios, enterprise legal sign-off, and keeping a flight-log app alongside ShootPortal.
- The quick answer and intro lead with ShootPortal.
- Each article mentions video review as the Dropbox Replay/Frame.io replacement and the newer tools wherever they're relevant.
- Each has 3–7 real screenshots, one mid-article `InlineCta`, `ProductCallout`s, and sharper `TrialCard` and `cta` copy.
- The Marketing Kit is presented as upsell revenue ($49/$29 defaults, set by the photographer).
- New secondary keywords and 1–2 new FAQs per article.
- `updatedAt: 2026-11-16` is set on each.

### Solution pages
I also fixed outdated "doesn't" claims on three solution pages: real estate software, business management, and photo/video delivery.

## Scores (conversion potential, 1–10)

These are the writers' self-assessments. I spot-checked them but didn't measure anything.

| Article | Before | After |
|---|---|---|
| best-real-estate-photography-software (hub) | 4 | 8.5 |
| best-aryeo-alternatives | 3.5 | 8.5 |
| best-hdphotohub-alternatives | 3 | 8 |
| shootportal-vs-aryeo-vs-hdphotohub | 3.5 | 8.5 |
| best-drone-business-management-software | 4.5 | 8.5 |
| best-video-review-approval-software | 3 | 8.5 |
| best-real-estate-photography-delivery-software | 3.5 | 8.5 |
| best-photo-video-delivery-platforms | 4 | 8.5 |
| how-to-send-large-video-files-to-clients | 5 | 8 |
| google-drive-vs-dropbox-photo-delivery | 4 | 8 |
| best-photography-crm-software | 4 | 8 |
| best-photography-client-portals | 5 | 8 |
| how-to-create-photography-client-portal | 5 | 8 |
| real-estate-photography-client-management | 4 | 8.5 |
| best-real-estate-photography-booking-software | 3 | 8 |
| best-photography-invoicing-software | 4 | 8.5 |
| get-paid-before-delivering-real-estate-photos | 5 | 8.5 |
| real-estate-photography-pricing-guide | 4 | 8.5 |
| drone-photography-pricing-guide | 5 | 8 |
| how-to-deliver-real-estate-photos | 4 | 8.5 |
| real-estate-photography-automation | 6 | 9 |
| photography-workflow-automation | 5 | 9 |
| how-to-start-drone-photography-business | 5 | 9 |
| how-to-start-real-estate-photography-business | 5 | 9 |
| how-to-get-real-estate-photography-clients | 5 | 9 |

## Guardrails kept
- **Real limits aren't hidden in comparison tables.** Rows such as Zillow Showcase, accounting sync and tips still show what ShootPortal doesn't do. The articles just don't dwell on them or send readers elsewhere because of them.
- **No invented features.** Nothing claims NLE plugins, e-signature, MLS sync, native app-store apps, AI editing or full white-label.
- **Prices come from the live plan** (`ctx`), not hard-coded numbers.
- **Screenshot sources:**
  - Most screens come from the Coastal Light Media demo business.
  - The Marketing Kit, property website and client-phone video review captures come from the masked explainer assets in `Explainer_feedback/assets`. Leftover "Swift Aerial Media" text in the sidebar footer and the address fields was painted over.
  - The photo editor still is a frame from the demo screen recording.
