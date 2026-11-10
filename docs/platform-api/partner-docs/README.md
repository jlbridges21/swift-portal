# Partner documents (one-pager, Integration Guide, Developer Guide, Pricing Sheet)

Generic, branded templates plus one config file per partner. SkyyTask is only data: `partners/skyytask/`.

## Make or update a partner's PDFs
```bash
node docs/platform-api/partner-docs/build.mjs skyytask            # all four documents
node docs/platform-api/partner-docs/build.mjs skyytask onepager   # just one
```
- **Output:** PDFs go to `docs/platform-api/`; page previews (PNG) go to `partners/<slug>/previews/`.
- **Requirements:** uses the Google Chrome already installed on this Mac. Nothing to install.
- **Automatic checks:** the build fails with ✗ if any page overflows or any code block is clipped. Fix the layout and rebuild.

## Add a new partner
1. Copy `partners/skyytask/` to `partners/<new-slug>/`.
2. Replace `assets/logo.png` with the partner's logo, exactly as provided.
3. Edit `config.json`:
   - Name, colors (`g1`/`g2`/`g3` gradient and `primary`).
   - The words they use: `contributor` (pilot / photographer), `recipient`, button label.
   - Their current flow (`today`), example fake data, domains, timeline, pricing, output file names.
4. Run the build and look at the previews.

## Rules
- **Accuracy:** while a feature isn't built, keep `edition.label` = "Proposal" and the "Proposed design — in development" stamp. After the build, switch to real screenshots and a "v1.0" edition.
- **Confidentiality:** never put internal strategy, costs/margins, other partners, or a partner's confidential business details in a config.
- **Pricing:** pricing appears only in the Pricing Sheet. Remove it from `documents` to skip it.

## Where things live
| Path | What |
|---|---|
| `template/styles.css` | Brand system: Portal Indigo `#4F46E5`, Midnight `#0F172A`, Inter |
| `template/*.html` | The four documents |
| `template/partials/` | Shared pieces: phone upload mockup, client portal, status card, email, footer |
| `template/assets/` | ShootPortal logos (trimmed copies of `public/icons/sp-logo-*.png`) and Inter |
| `build.mjs` | Tiny template engine + Chrome print-to-PDF + preview + layout checks |
