# Photo Editor (LightCraft engine)

Replaces the retired Property Line tool. Businesses edit one photo, a selection, or a whole folder
inside ShootPortal; clients only ever see the version the business saves to the project.

## Model — "a photo is one photo"

| Piece | Where | Visible to clients |
|---|---|---|
| Delivered file | `media_assets.file_path` / `thumbnail_url` (unchanged columns) | yes — every existing surface reads these |
| Original + saved edits | `media_asset_versions` (v1 = original, snapshotted on first save) | no |
| In-progress adjustments | `media_edit_drafts` (small JSON recipe, auto-saved) | no |
| Opened batch | `photo_edit_sessions` (resume on any device) | no |

**Save to Project** renders the full-size file in the browser, uploads it straight to Storage
(signed URL — no function body limit), records a version, and points the `media_assets` row at
it. Portal, downloads, ZIPs, shares, embeds and covers follow automatically. **Restore original**
(Versions & original) points the row back. The newest 5 edits + the original are kept; older edit
files are removed. Deleting a photo also deletes its version files.

Migration: `supabase/migration-v117-photo-editor.sql` (additive). Without it the editor shows a
setup notice and nothing else changes.

## Engine

- `scripts/lightcraft/install.mjs` downloads the pinned LightCraft web release, checks its
  SHA-256, and extracts runtime + licence files to `public/lightcraft/` (gitignored). Runs before
  `npm run dev` / `npm run build`. `scripts/lightcraft/host.html` is our host page.
- Framed same-origin as `/lightcraft/index.html?host=parent&store=memory&workers=0`:
  - `store=memory` — nothing is written to browser storage (shared computers can't leak photos).
  - `workers=0` — LightCraft's render workers read originals from browser storage, which memory
    mode doesn't have; inline rendering is its supported fallback (previews ≤ 2560 px).
- `src/components/photo-editor/lightcraft-bridge.ts` is the only file that knows LightCraft's
  commands (`catalog.query`, `library.select`, `develop.get/merge/reset`, `app.export`,
  `photo.deletePermanently`, `view.*`) and messages (`lightcraft:ready/failed/save/open`).

### Upgrading LightCraft
1. Bump `LIGHTCRAFT_VERSION` and `LIGHTCRAFT_SHA256` (from the release's `SHA256SUMS.txt`).
2. `npm run lightcraft:install`.
3. Re-test: open a photo, adjust, reload (progress restored), Save to Project, copy/paste across a
   batch. If a release lets workers render memory-mode originals, drop `workers=0`.

## Known limits
- LightCraft's own top toolbar (menu/search) can't be hidden by its embedding API. Its exports are
  delivered to ShootPortal and ignored; its local imports never leave the tab.
- One editor tab per browser at a time (LightCraft holds a Web Lock); a second tab shows a notice.
- HEIC isn't in LightCraft's web build. ShootPortal photos are JPEG/PNG/WebP, all supported.
- Desktop-first: phones/tablets get a "works best on a computer" screen with *Continue anyway*;
  browsers without WebGL 2 get a clear unsupported message.
- Licence: MIT OR Apache-2.0 (`/lightcraft/NOTICE` is served and linked from *About the Photo Editor*).
