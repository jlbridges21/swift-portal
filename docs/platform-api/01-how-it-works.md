# The ShootPortal Platform API: Founder's Guide

> **For:** Jackson. **Status:** design, written **before** any code. This is what we plan to build, not what exists yet. After each build phase, this guide is updated to match what was actually built.
> **Version:** 0.1 (2026-11-03). Decisions come from `00-phase2-questions.md`. Plain-English concepts are explained in `concepts-plain-english.md`.
> **Rule:** nothing in this design names SkyyTask in code. SkyyTask is one **API account**, i.e. rows of data and settings.

## Contents
1. [The big picture](#1-the-big-picture)
2. [A real job, step by step](#2-a-real-job-step-by-step)
3. [The data model](#3-the-data-model)
4. [The full API surface](#4-the-full-api-surface)
5. [Billing mechanics](#5-billing-mechanics)
6. [What a partner's developer experiences](#6-what-a-partners-developer-experiences)
7. [What you see and control as the founder](#7-what-you-see-and-control-as-the-founder)
8. [Build phases](#8-build-phases)
9. [Glossary](#9-glossary)
10. [Testing plan](#10-testing-plan)

---

## 1. The big picture

ShootPortal already delivers media beautifully to clients. The Platform API lets **another company's software** use that delivery engine without a human clicking around in ShootPortal.

There are five actors:

| Actor | Example | What they touch |
|---|---|---|
| **ShootPortal** | us | Stores files, shows portals, sends emails, sends webhooks. |
| **Partner backend** | SkyyTask's servers | Calls our API with a **secret key**. Receives our **webhooks**. |
| **Partner app** | the SkyyTask iPhone/Android app | Opens our **upload screen** for a pilot. Never sees the secret key. |
| **Contributor** | the drone pilot | Uploads files through a one-time **upload link**. No ShootPortal account. |
| **Recipient** | the realtor / end client | Opens a branded portal through a private **access link** or email. |

```mermaid
flowchart LR
    subgraph Partner["Partner (e.g. SkyyTask)"]
        PB[Partner backend]
        PA[Partner app]
    end
    subgraph SP["ShootPortal"]
        API["API<br/>api.shootportal.app/v1"]
        UP["Branded upload screen<br/>partner.shootportal.app/u/…"]
        PORTAL["Branded client portal<br/>partner.shootportal.app/a/…"]
        DB[(Database + file storage)]
        WH[Webhook sender]
    end
    PILOT((Pilot))
    CLIENT((Client))

    PB -- "1 create project, recipient, pilot<br/>2 create upload session" --> API
    API --> DB
    API -- "upload URL" --> PB
    PB -- "upload URL" --> PA
    PA -- "opens" --> UP
    PILOT -- "3 uploads files, taps Submit" --> UP
    UP -- "files go straight to storage" --> DB
    DB --> WH
    WH -- "4 signed webhooks:<br/>submitted, published,<br/>viewed, downloaded" --> PB
    PORTAL -- "branded email or<br/>partner's chat link" --> CLIENT
    CLIENT -- "5 views & downloads" --> PORTAL
```

**Why it's designed this way**
- **A partner is just a business.** Every API account is an ordinary row in `businesses`, plus a twin **sandbox** business for testing. All existing isolation, branding, custom domains and staff logins work unchanged. SkyyTask staff can also log in to the normal ShootPortal UI for hand-run enterprise jobs.
- **Secret keys stay on the partner's server.** The phone app only ever holds a short-lived upload link for one job. If a pilot's phone is compromised, an attacker can upload to one project for a few hours, and nothing else.
- **Files never pass through Vercel.** Pilots upload directly from the phone to Supabase Storage, resumably, and recipients download directly from storage through signed links. That's the only way multi-GB files work reliably.
- **We tell the partner what happened; they don't have to keep asking.** Webhooks push events to their server, so SkyyTask can move a job forward or release a pilot payout the moment something happens.

---

## 2. A real job, step by step

**Scenario (fake data):** SkyyTask job `JOB-10482`. A real estate shoot at *123 Demo Street, Sampletown, FL*. Pilot **Sam Pilot** (`P-4410`). Realtor **Pat Agent** (`C-889`). Everything runs in **test mode** with a sandbox key.

### Step 0: once, at setup (you, in `/platform` → API)
You create the API account "SkyyTask". ShootPortal creates two businesses, `skyytask` (live) and `skyytask-sandbox` (test). You set the logo and colors, add their webhook URL and copy its signing secret, and create a test key `sp_test_…` and send it to their developer (via a password manager, never email).

### Step 1: the job is accepted or completed, and SkyyTask's backend creates the project
*Whether this happens at "job accepted" or "Complete Job" is a SkyyTask choice (on the Geno list). The API works either way.*

```bash
curl https://api.shootportal.app/v1/projects \
  -H "Authorization: Bearer sp_test_4eC39HqLyjWDarjtT1zdp7dc" \
  -H "Idempotency-Key: job-10482-create" \
  -H "Content-Type: application/json" \
  -d '{
    "external_id": "JOB-10482",
    "title": "123 Demo Street – Aerial photo + video",
    "address": { "line1": "123 Demo Street", "city": "Sampletown", "region": "FL", "postal_code": "00000", "country": "US" },
    "metadata": { "job_type": "real_estate" }
  }'
```
```json
{
  "id": "proj_7f3c2a9e1b4d4c0e9a2b5d6e7f8a9b0c",
  "object": "project",
  "external_id": "JOB-10482",
  "title": "123 Demo Street – Aerial photo + video",
  "status": "scheduled",
  "delivery_mode": "delivery_only",
  "livemode": false,
  "metadata": { "job_type": "real_estate" },
  "created": "2026-12-15T15:02:11Z"
}
```

| | |
|---|---|
| **Inside ShootPortal** | The key is checked (hash lookup in `api_keys`). It belongs to `skyytask-sandbox`, so everything happens in that business. A row goes into `projects` with `business_id = skyytask-sandbox`, `external_id = JOB-10482`, `delivery_mode = delivery_only`, status `scheduled`. The response is saved under the idempotency key (`api_idempotency_keys`), and the call is logged in `api_request_logs`. |
| **Webhook** | None. SkyyTask made the call, so it already knows. |
| **Who sees what** | Nobody yet. SkyyTask staff logged into ShootPortal would see the project in their pipeline at "Scheduled." |

### Step 2: SkyyTask adds the realtor and the pilot
```bash
curl https://api.shootportal.app/v1/projects/proj_7f3c…/recipients \
  -H "Authorization: Bearer sp_test_…" -H "Idempotency-Key: job-10482-rcp-C-889" \
  -d '{ "email": "pat.agent@example.com", "name": "Pat Agent", "external_id": "C-889" }'
# → { "id": "rcp_…", "object": "recipient", "email": "pat.agent@example.com", "name": "Pat Agent", "external_id": "C-889" }

curl https://api.shootportal.app/v1/projects/proj_7f3c…/contributors \
  -H "Authorization: Bearer sp_test_…" -H "Idempotency-Key: job-10482-ctb-P-4410" \
  -d '{ "email": "sam.pilot@example.com", "name": "Sam Pilot", "external_id": "P-4410" }'
# → { "id": "ctb_…", "object": "contributor", "name": "Sam Pilot", "external_id": "P-4410" }
```
| | |
|---|---|
| **Inside ShootPortal** | **Recipient:** find or create a `clients` row in that business matched by email, so Pat isn't duplicated across jobs, then link it with `project_clients`. **Contributor:** a row in `api_contributors` (name, email, external ID). Pat and Sam get **no login and no password**. |
| **Webhook** | None. |
| **Who sees what** | Still nothing for Pat or Sam. No emails yet. |

### Step 3: the pilot taps "Transfer deliverables" in the SkyyTask app
SkyyTask's **backend** asks for an upload link for this pilot and job:
```bash
curl https://api.shootportal.app/v1/upload_sessions \
  -H "Authorization: Bearer sp_test_…" -H "Idempotency-Key: job-10482-ups-1" \
  -d '{
    "project": "proj_7f3c…",
    "contributor": "ctb_…",
    "return_url": "skyytask://jobs/JOB-10482/delivered",
    "expires_in": 86400
  }'
```
```json
{
  "id": "ups_2b8e…",
  "object": "upload_session",
  "url": "https://skyytask-sandbox.shootportal.app/u/ups_2b8e…?t=Xk2…",
  "status": "open",
  "expires_at": "2026-12-16T15:05:00Z"
}
```
The backend hands `url` to the app, and the app opens it in an **in-app browser** (SFSafariViewController on iOS, Chrome Custom Tabs on Android).

| | |
|---|---|
| **Inside ShootPortal** | A row in `api_upload_sessions` with a **hash** of the secret `t` token, the expiry, the return URL, and status `open`. |
| **Webhook** | None now. `upload_session.expired` fires later if it runs out unused. |
| **Who sees what** | **Sam** sees a screen branded with SkyyTask's logo and colors: "123 Demo Street · Upload your deliverables". It has Photos, Videos, Documents and Other files sections, an *Add files* button, and "Powered by ShootPortal" in the footer. |

### Step 4: Sam uploads (resumably)
For each file, the upload screen:
1. Asks our server for permission: `POST /api/upload/{session}/files` with name, size and type. The server checks the type allowlist and the 100 GB session cap, chooses the storage path `{business_id}/{project_id}/…`, records the file in `api_upload_files` (status `uploading`), and returns a **signed upload token** for that one path.
2. Uploads **directly to Supabase Storage** in 6 MB chunks using TUS with that token. Progress shows per file. If the connection drops, or Sam's phone locks and he reopens the screen, it asks the server "what's already done?" and continues from the last chunk.
3. Tells our server it finished: `POST /api/upload/{session}/files/{id}/complete`. The server confirms the object really exists in storage, then creates the `media_assets` row (with `file_size`) and marks the file `uploaded`.

| | |
|---|---|
| **Webhook** | None per file (that would be noisy). Totals arrive in `delivery.submitted`. |
| **Who sees what** | Sam sees per-file progress bars and "Keep this screen open while uploading." SkyyTask staff in the ShootPortal UI would see files appear. |

### Step 5: Sam taps "Submit delivery"
A confirmation appears: *"Are you finished with this job? Your client will be notified."* Sam taps **Yes**.

| | |
|---|---|
| **Inside ShootPortal** | A row in `api_deliveries` (`dlv_…`). It sums the bytes of this session's files (e.g. **3.4 GB**), assigns a tier (**Standard**), and reads the price from the account's pricing config (**$3.00**). It applies **launch credit** if any is left (shows `$3.00 covered by launch credit`) and saves a **snapshot of the pricing used**, so later price changes never alter this delivery. It sets `expires_at = now + 90 days`. The project status becomes `ready_for_review`. The upload session status becomes `submitted`. An `api_events` row is written and queued for the webhook. |
| **Webhook** | `delivery.submitted` (see §4.3 for the full payload): file count, total bytes, tier, price, credit applied, expiry. |
| **Who sees what** | Sam sees "Delivered! You can close this screen," and the in-app browser returns to `skyytask://jobs/JOB-10482/delivered`. SkyyTask's backend gets the webhook and can mark the job complete or schedule the pilot payout. |

### Step 6: publishing to the client
The account setting **Auto-publish on submit** is ON (default), so this happens immediately. If SkyyTask turns it off to review first, its backend calls `POST /v1/deliveries/{id}/publish` when ready.

| | |
|---|---|
| **Inside ShootPortal** | The delivery status becomes `published` and the project status `delivered`. In delivery-only projects, `delivered` **unlocks downloads without any payment**. Notifications follow the account's **Notify recipients** setting: **ShootPortal** (default) sends Pat a branded email, "Your deliverables are ready," with a private access link; **Partner** sends nothing; **Both** does both. In the sandbox, the email only goes out if Pat's address is on the allowlist; otherwise it's captured in the email log for you to read. |
| **Webhook** | `delivery.published`. |
| **Who sees what** | Pat gets an email showing **SkyyTask's** name and logo. |

If SkyyTask prefers to message Pat in its own chat, its backend mints the link itself:
```bash
curl https://api.shootportal.app/v1/projects/proj_7f3c…/recipients/rcp_…/access_links \
  -H "Authorization: Bearer sp_test_…" -d '{}'
# → { "object": "access_link", "url": "https://skyytask-sandbox.shootportal.app/a/lnk_…?t=…", "expires_at": "2027-03-15T15:10:00Z" }
```

### Step 7: Pat opens the portal and downloads
| | |
|---|---|
| **Inside ShootPortal** | The access link token is checked (hash in `api_access_links`, not expired, not revoked). The portal renders with **no login**, showing only this project: media sections, no estimates, invoices or payment UI anywhere, and "Available until Mar 15, 2027." The first open stamps `first_viewed_at`, and the first download stamps `first_downloaded_at`. Downloads are **direct signed links to storage**, so a 4 GB video doesn't pass through Vercel. |
| **Webhook** | `delivery.viewed` (first view by this recipient), then `delivery.downloaded` (first download by this recipient). |
| **Who sees what** | **Pat:** a polished SkyyTask-branded gallery with Download buttons. **SkyyTask:** can show "Client viewed ✓ / downloaded ✓" in its app. |

### Step 8: day 90
Files expire as planned (the deletion job is built before the first real expiry date; see §8). Pat's link stops working, and the portal says the delivery has expired.

---

## 3. The data model

**Standing rules** (from `docs/TENANT-ARCHITECTURE.md`):
- Every tenant table has `business_id NOT NULL` (no default).
- RLS is enabled on every table.
- Writes go through `createTenantServiceClient`.
- New tables extend the tenant isolation tests.

**How RLS keeps API accounts apart**
- Every `api_*` table has **RLS on and no policies for logged-in users**. That means the public database API (Door 2) can read **nothing** from them: "fail closed." Only our server, using the service role, touches them.
- The server always filters by the `business_id` that **the API key belongs to**. It's never taken from the request body.
- The existing tables we extend (`projects`, `clients`, `media_assets`) keep their existing policies, so a SkyyTask staff member logged into ShootPortal sees only SkyyTask's projects, exactly like any other business today.

### Changed tables
| Table | New column | Why |
|---|---|---|
| `businesses` | `account_type` (`standard` \| `api`) | Marks the businesses that belong to an API account. |
| `projects` | `delivery_mode` (`standard` \| `delivery_only`) | Hides estimates, proposals, payments and pipeline stages; unlocks downloads on publish. API accounts default to `delivery_only`. |
| `projects` | `external_id` (text), `metadata` (jsonb) | The partner's job number and free-form notes. Unique per business, so `GET ?external_id=JOB-10482` finds it. |
| `clients` | `external_id` (text) | The partner's client ID (e.g. `C-889`). |
| `media_assets` | `upload_session_id`, `delivery_id` | Which upload and which delivery a file came from (billing and webhook totals). |
| `media_assets.media_type` | new value `file` | An "Other files" section for GeoTIFF, LAS/LAZ, KMZ, DNG, etc. They're stored and downloadable, with no preview. |

### New tables
| Table | One row = | Why it exists |
|---|---|---|
| `api_accounts` | one partner (e.g. SkyyTask) | Links the **live** and **sandbox** businesses. Holds every setting you edit in `/platform` → API: pricing, launch credit, retention, caps, notification and publish options, the email allowlist, "pause all emails", and the API on/off switch. |
| `api_keys` | one secret key | Stores only a **hash** of the key plus a short visible prefix (`sp_test_4eC3…`), the mode, a name, last used and revoked. Several can be active at once for rotation. |
| `api_contributors` | a pilot on a project | Name, email, external ID. Not a login. |
| `api_upload_sessions` | one upload link | Token hash, project, contributor, expiry, return URL, status (`open` / `submitted` / `expired`). |
| `api_upload_files` | one file mid-upload | Storage path, size, progress state. This is how uploads **resume** after a reload or a new device session. |
| `api_deliveries` | one priced handoff | Totals, tier, price, credit applied, **pricing snapshot**, status, timestamps (submitted, published, first viewed, first downloaded), `expires_at`, `billable` (always false in sandbox). |
| `api_access_links` | one recipient's link to one project | Token hash, expiry (≤ file expiry), revoked, use count, last used. This is a **dedicated, view-only** link that never logs anyone in. That sidesteps the share-token problem (hole #3) entirely. |
| `api_events` | something that happened | Type, data snapshot, time. The source of every webhook. |
| `api_webhook_endpoints` | one partner URL | URL, encrypted signing secret, enabled, auto-disabled reason. |
| `api_webhook_attempts` | one try to send one event | Status code, response excerpt, duration, next retry time. Powers the log and "Resend." |
| `api_request_logs` | one API call | Method, path, status, duration, key, `request_id`, error code. Error bodies are kept trimmed and masked. Kept 30 days. |
| `api_idempotency_keys` | one remembered POST | Key, a fingerprint of the request, the saved response. Kept 24 hours. |
| `api_email_log` | one notification | Sent or captured (sandbox). Lets you see exactly what would have gone out. |
| `api_invoices` | one monthly invoice | Month, amount, Stripe invoice ID, who created it. Prevents double-invoicing. |

---

## 4. The full API surface

### 4.1 Conventions
- **Base URL:** `https://api.shootportal.app/v1`. One DNS record points at the same Vercel app, which routes it to `/api/v1`.
- **Auth:** `Authorization: Bearer sp_test_…` or `sp_live_…`. The key decides the mode. There's no separate "test" flag.
- **IDs:** prefixed and opaque: `proj_`, `rcp_`, `ctb_`, `ups_`, `file_`, `dlv_`, `lnk_`, `evt_`, `req_`.
- **Idempotency:** every POST accepts `Idempotency-Key`. Retrying with the same key returns the original response. The same key with a different body returns `409 idempotency_conflict`.
- **Errors:**
  ```json
  { "error": { "type": "invalid_request_error", "code": "parameter_missing", "message": "email is required", "param": "email", "request_id": "req_9a…" } }
  ```
  Types: `authentication_error` (401), `permission_error` (403), `invalid_request_error` (400/422), `not_found` (404), `idempotency_error` (409), `rate_limit_error` (429), `api_error` (500).
- **Every response** carries a `Request-Id` header.
- **Lists:** `?limit=` (max 100) plus `starting_after=` cursor, returning `has_more`.
- **Rate limit:** soft limit of 100 requests/minute per key (documented, logged, 429 if exceeded).

### 4.2 Endpoints (v1)
| Method & path | Purpose | Key fields | Notable errors |
|---|---|---|---|
| `GET /v1/ping` | Check your key works | → `{ account, mode }` | 401 |
| `POST /v1/projects` | Create a project | `external_id`, `title`, `address{}`, `metadata{}` | 409 `external_id_taken` |
| `GET /v1/projects/{id}` | Get one | | 404 |
| `GET /v1/projects?external_id=` | Find by your job number; list | `limit`, `starting_after` | |
| `PATCH /v1/projects/{id}` | Update title / address / metadata | | |
| `POST /v1/projects/{id}/recipients` | Add an end client | `email`, `name`, `phone?`, `external_id?` | 422 `invalid_email` |
| `DELETE /v1/projects/{id}/recipients/{rcp}` | Remove access | Also revokes their links | |
| `POST /v1/projects/{id}/recipients/{rcp}/access_links` | Mint a private portal link | `expires_in?` (≤ file expiry) | 409 `delivery_not_published` |
| `POST /v1/projects/{id}/contributors` | Add a pilot | `email`, `name`, `phone?`, `external_id` | |
| `POST /v1/upload_sessions` | Get an upload link | `project`, `contributor`, `return_url?`, `expires_in?` (≤ 24 h) | 409 `contributor_not_on_project` |
| `GET /v1/upload_sessions/{id}` | Status, files so far | | |
| `GET /v1/projects/{id}/files` | List files | section, name, size, type, created | |
| `GET /v1/projects/{id}/deliveries` · `GET /v1/deliveries/{id}` | Delivery status, price, timestamps, view/download counts | | |
| `POST /v1/deliveries/{id}/publish` | Publish (only if auto-publish is off) | `notify?` | 409 `already_published` |
| `POST /v1/deliveries/quote` | Price a job before it runs | `expected_bytes` → `tier`, `price`, `credit_remaining` | |

**Deliberately not in v1** (from Phase 2): archive/delete endpoints, server-side file import, events list/replay (you have "Resend" in the console), organization/usage endpoints (statements live in `/platform`), webhook endpoint management by API (you manage it in `/platform`), key scopes, OAuth connected accounts.

### 4.3 Webhook events
| Event | Fires when | Typical partner use |
|---|---|---|
| `delivery.submitted` | Pilot confirms they're done | Mark job complete; start the payout clock |
| `delivery.published` | Portal is live for recipients | Tell the client in chat |
| `delivery.viewed` | First view **per recipient** | Show "client viewed" |
| `delivery.downloaded` | First download **per recipient** | Release payout; close the job |
| `upload_session.expired` | Link expired with nothing submitted | Nudge the pilot; create a new session |

**Sample payload**
```json
{
  "id": "evt_5c1d…",
  "object": "event",
  "type": "delivery.submitted",
  "created": "2026-12-15T16:40:02Z",
  "livemode": false,
  "api_version": "v1",
  "data": {
    "object": {
      "id": "dlv_8a2f…",
      "object": "delivery",
      "project": "proj_7f3c…",
      "project_external_id": "JOB-10482",
      "contributor_external_id": "P-4410",
      "status": "submitted",
      "file_count": 42,
      "total_bytes": 3400000000,
      "tier": "standard",
      "price": { "amount": 300, "currency": "usd", "credit_applied": 300, "amount_due": 0 },
      "expires_at": "2027-03-15T16:40:02Z"
    }
  }
}
```

### 4.4 How partners verify webhook signatures
Every webhook has a header:
```
ShootPortal-Signature: t=1765816802,v1=5f8e0c…
```
`v1` is an **HMAC-SHA256** of `t + "." + raw_request_body`, using the endpoint's signing secret (`whsec_…`, shown to you once in `/platform`). The partner recomputes it, compares it in constant time, and rejects anything older than 5 minutes.
```js
import crypto from "node:crypto";
function verify(rawBody, header, secret) {
  const { t, v1 } = Object.fromEntries(header.split(",").map(p => p.split("=")));
  if (Math.abs(Date.now() / 1000 - Number(t)) > 300) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
}
```
**Retries:** if the partner doesn't answer `2xx` within 10 s, we retry at 1 min, 5 min, 30 min, 2 h, 6 h, then every 12 h, for **3 days**. After that the endpoint is auto-disabled and you and the partner get an email. Every event ID is unique, so receivers can ignore duplicates.

**How sending works:** events are written to `api_events` in the same step as the change. A **every-minute cron** (the same pattern as today's video-review notifications) sends anything due. Webhooks are **never** sent inside the API request, so a slow partner server can't slow us down.

---

## 5. Billing mechanics

**Where prices live:** in `api_accounts` (per account), seeded with File 05's defaults, editable in `/platform` → API → Settings. Every change is written to the audit log.

| Setting | Default |
|---|---|
| Tiers | Standard ≤ 5 GB **$3** · Large ≤ 25 GB **$12** · XL ≤ 100 GB **$40** · over 100 GB **$40 + $0.40/GB** above 100 |
| Monthly minimum | **$199** |
| Included storage | **90 days** |
| Extended storage | **$0.05/GB-month** (opt-in per delivery) |
| Launch credit | **50 GB** of deliveries, one-time, plus an **end date**; minimum waived meanwhile |
| Session cap / alert | 100 GB per upload session · email you at 1 TB/month |

**Size measurement.** At submit, the delivery's size is the sum of `media_assets.file_size` for the files uploaded in it. Sizes use decimal GB (1 GB = 1,000,000,000 bytes). Links (360 tours, 3D models) count as 0. Exactly 5.000 GB is Standard.

**Price assignment.** Tier and price are calculated once at submit, then a **pricing snapshot** is stored on the delivery. Files added within **7 days** join the same delivery and re-tier it (the price can go up, never charged twice). After 7 days, new files form a new delivery.

**Launch credit.** While the launch period is active (before its end date, and fewer than 50 GB used), a delivery's price is fully covered and recorded as `credit_applied`. The delivery that crosses 50 GB is charged in full. Both the GB amount and the end date are editable.

**Shown to the partner:** the price is in the `delivery.submitted` webhook, in `GET /v1/deliveries/{id}`, and in quotes. SkyyTask never has to wait for an invoice to know a job's cost.

**Monthly invoice** (months run in UTC):
```
amount_due = sum(price − credit_applied) for the month's billable deliveries
invoice    = launch period active at any point in the month ? amount_due
                                                            : max(amount_due, monthly_minimum)
```
In `/platform` → API → Statement you see every delivery line, the totals, and a **CSV export**. **"Create Stripe invoice"** creates a **draft** in your Stripe account (one line per tier, plus a "Monthly minimum adjustment" line if one applies). You review and send it in Stripe. The button refuses sandbox accounts and a second invoice for the same month.

---

## 6. What a partner's developer experiences

1. **Getting test keys.** You send them a `sp_test_…` key through a password manager, plus the Developer Guide PDF, the OpenAPI file and the Postman collection.
2. **First call.**
   ```bash
   curl https://api.shootportal.app/v1/ping -H "Authorization: Bearer sp_test_…"
   # → { "account": "SkyyTask", "mode": "test" }
   ```
   Then they create a project, a recipient and a contributor, following the Postman collection top to bottom.
3. **Opening the upload screen.**
   - Their backend creates an upload session, and the app opens `url` in SFSafariViewController (iOS) or Chrome Custom Tabs (Android).
   - On the web, they open it in a new tab or modal window. When the pilot submits, the screen redirects to `return_url`, so the app knows to close.
   - For web embeds, the page also sends `postMessage({ type: "shootportal.upload.submitted", delivery: "dlv_…" })`.
4. **Receiving webhooks.** They give you a URL and you register it in `/platform`. They add the 10-line signature check and click "Send test event" (you can trigger one for them).
5. **Going live.** They complete the go-live checklist:
   - signature verification on;
   - idempotency keys on every POST;
   - `delivery.*` events handled;
   - "Keep this screen open" copy shown in the app.

   You then issue a `sp_live_…` key. Nothing else changes: same code, different key.

---

## 7. What you see and control as the founder

New tab: **`/platform` → API** (super-admin only).

| Screen | What you do there |
|---|---|
| **Accounts** | List all API accounts. "New API account" creates the live and sandbox businesses, with branding copied to both. |
| **Account → Overview** | API on/off switch (the feature flag), health (last request, failing webhooks), this month's deliveries and amount. |
| **Keys** | Create a test or live key (shown **once**), rename, revoke, see "last used." |
| **Settings** | Pricing tiers, minimum, retention days, extended-storage rate, launch credit (GB + end date), session cap, alert threshold, auto-publish, notify recipients (ShootPortal / Partner / Both), pilot receipt email, sandbox allowlist, "Pause all emails". Each save is audit-logged. |
| **Webhooks** | Endpoint URL and secret, "Send test event," every attempt with status and response, **Resend**. |
| **Logs** | Every API call for 30 days. Filter by status or endpoint, or paste a `request_id`. |
| **Deliveries & Statement** | Each delivery with size, tier, price and credit; monthly totals; CSV; **Create Stripe invoice**. |
| **Email log** | What was sent, and what the sandbox captured instead. |
| **Demo partner** | A built-in fake partner for testing and screen-share demos (see §10). |

**Debugging a failed request** (e.g. SkyyTask says "creating JOB-10777 failed"):
1. Ask for the `request_id` from the error, or search Logs by time and endpoint.
2. The log row shows status, error code and the trimmed error body. Most problems are a 4xx with a clear message, such as a bad email or a missing field.
3. For a 500, the same `request_id` appears in Vercel's function logs, with the stack trace.
4. For webhook problems, open Webhooks, find the event, read the partner's response code, fix with them, then click Resend.

---

## 8. Build phases

Every phase ends with something **you can see and test yourself**. Everything is behind the per-account **API on/off switch**, plus an environment kill switch `PLATFORM_API_ENABLED`, so nothing changes for current customers until you turn it on.

| # | Phase | What's in it | You can test it by… | Main files | Risks |
|---|---|---|---|---|---|
| **0** | Security fix + bring `2a210b3` onto `main` | `security-fix-plan.md` (holes #1 and #2) | Pentest shows the attacks blocked; signup still works | `supabase/migration-v110…`, `scripts/tenant-pentest.ts` | A missed invite path. The audit covers it. |
| **1** | **Upload proof** | Throwaway page: signed-token TUS upload, 5 GB from a phone, kill and resume | Uploading a big video from your phone on cellular, killing the app, resuming | scratch route behind super-admin | If it fails, switch to fallback 1 or 2 **before** building on it |
| **2** | Foundations | `api_accounts`, sandbox business creation, `api_keys`, `/api/v1` gateway (auth, request ID, errors, logging, idempotency), `api.shootportal.app`, API tab (Accounts, Keys, Settings, Logs), `/v1/ping` | Creating an account and key in `/platform`, running `curl /v1/ping`, seeing the log row | `src/lib/platform-api/*`, `src/app/api/v1/*`, `src/app/platform/api/*`, migrations | Proxy/paywall must skip `/api/v1`; API accounts set to comped |
| **3** | Projects, recipients, contributors, delivery-only mode | Endpoints, `external_id`, `delivery_mode` UI hiding, shared `createProject` service | `curl` creating a project, then seeing it in the sandbox business UI with no pricing anywhere | `src/lib/projects/create-project.ts`, project page components | Hiding finance UI in every place it appears |
| **4** | Upload sessions + deliveries + pricing | Hosted upload page, resume state, file-type allowlist, submit, tiers, launch credit, quote | Uploading from your phone via a session URL from Postman; the delivery shows tier and price | `src/app/u/[session]/*`, `src/lib/platform-api/pricing.ts` | Storage limits (raise first); mobile Safari quirks |
| **5** | Holes #3/#4 fixed, then recipient portal + access links + notifications | `api_access_links`, delivery-only portal, signed direct downloads, Powered-by, view/download tracking, notify settings, sandbox email capture | Minting a link, opening it in a private window, downloading, checking the email log | `src/app/a/[link]/*`, `notifications.ts` | Big-file "download all": per-file downloads in v1 |
| **6** | Webhooks | Events, outbox cron, signing, retries, auto-disable, attempt log, Resend, test event | Using the Demo partner's inbox to watch signed events arrive | `src/lib/platform-api/webhooks.ts`, `src/app/api/cron/api-webhooks` | Cron timing; duplicate sends (handled by event IDs) |
| **7** | Billing + operations | Statement, CSV, Create Stripe invoice, alerts and daily digest, log retention | Running a fake month of deliveries and creating a draft invoice in Stripe test mode | `src/lib/platform-api/statements.ts` | Stripe mode must match the deploy |
| **8** | Docs and demo | OpenAPI, Postman, Demo partner page, final PDFs with real screenshots, Operations Manual | Running the full demo end to end on a screen share | `docs/platform-api/*` | |
| *later* | Before first expiry | 90-day deletion job + 14-day warning | Shortening retention on a sandbox delivery and watching it expire | cron | Must ship before ~90 days after go-live |

**Deliberately left out of v1:** OAuth connected accounts, the pilot "claim your workspace" email (possibly V2), key scopes, partner self-serve dashboard, native SDKs (true background upload), server-side previews for TIFF/RAW, download-all ZIP for huge deliveries, virus scanning, SMS, Zapier.

**Timeline target** (about 10 hrs/week):

| When | Phase |
|---|---|
| Nov | 0, 1 |
| Late Nov – mid Dec | 2, 3, giving SkyyTask's developers a sandbox with projects |
| Jan | 4, 5, 6 (after Nov 11 confirms, ideally with an LOI) |
| Feb | 7, 8 |

---

## 9. Glossary
Short definitions. Full plain-English explanations are in `concepts-plain-english.md`.

| Term | Meaning |
|---|---|
| **API** | A way for one company's software to ask another's to do things. |
| **API account** | A partner using our API: one live business, one sandbox business, and settings. |
| **API key** | A long secret password for a partner's server (`sp_live_…`). |
| **Hash** | A one-way fingerprint. We store the key's fingerprint, never the key itself. |
| **Sandbox / test mode** | A separate copy of the account for practice. Nothing is billed, and emails are held. |
| **Endpoint** | One specific API address, such as `POST /v1/projects`. |
| **Idempotency key** | A label on a request so that retrying it never does the work twice. |
| **Webhook** | Us calling the partner's server when something happens. |
| **HMAC signature** | A tamper-proof seal proving a webhook came from us. |
| **Outbox / cron** | A to-do list of messages, and a timer that works through it every minute. |
| **Upload session** | A one-job, short-lived upload link for a pilot. |
| **TUS / resumable upload** | Uploading in small chunks so a dropped connection resumes instead of restarting. |
| **Signed upload token** | Our server's permission slip for uploading one file to one place. |
| **Access link** | A private, expiring link that lets a recipient view one delivery without logging in. |
| **Delivery** | The pilot's submitted set of files for a job, priced as one unit. |
| **Delivery-only mode** | A project with no estimates, invoices or payments. |
| **RLS** | Database rules that decide which rows each user may see or change. |
| **Service role** | Our server's master key to the database. Never leaves the server. |
| **Tenant / business** | One customer's walled-off space in ShootPortal. |
| **external_id** | The partner's own ID for something (e.g. their job number). |
| **Request ID** | A tracking number on every API response, used for support. |
| **Pricing snapshot** | A copy of the prices used for a delivery, so later changes don't alter it. |

---

## 10. Testing plan

### Automated (run before every deploy)
- **Unit checks** (`scripts/verify-platform-api-*.ts`, the same style as today): pricing and tier edges (5.000 GB vs 5.001 GB, the launch-credit crossover, minimum waiver), key hashing, signature generation, idempotency conflicts, file-type allowlist.
- **Isolation tests** (extending `tenant-isolation.sql` and `tenant-pentest.ts`):
  - account A's key can't read or write account B's projects;
  - a **sandbox key can't touch live data**, and vice versa;
  - an upload token can't upload to another project;
  - an access link can't open another project;
  - a logged-in user can't read any `api_*` table through the public database API.
- **End-to-end script** `scripts/verify-platform-api-e2e.ts`: in the sandbox, create project → recipient → contributor → session → upload a small file → submit → assert the webhook was signed and delivered → open the access link → assert view and download events.

### You, by hand, without SkyyTask
1. **Postman collection.** Click through every endpoint in order with a sandbox key.
2. **Demo partner page** (`/platform` → API → Demo partner). A built-in fake partner, "Acme Drone Co":
   - "Create job" fills in fake data and calls the real API with a sandbox key;
   - "Open upload screen" shows a QR code you scan with your phone;
   - a live **webhook inbox** shows each signed event arriving, with "signature valid ✓";
   - "Open client portal" mints an access link.

   This is also what you'll screen-share with Geno and his developer.
3. **Real-phone checklist:**
   - a 5 GB upload over cellular;
   - lock the phone, then resume;
   - airplane mode mid-upload;
   - an iPhone in-app browser and an Android Custom Tab;
   - one file of each type: GeoTIFF, LAS, DNG, PDF.
