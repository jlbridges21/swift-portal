# Phase 2: Questions, answers and decisions

> Internal only. Running log of every Phase 2 question, your answer, and the decision it produced.
> "Default" is my recommendation. Answering "Qn: default" accepts it.
> **[GENO]** means the answer needs SkyyTask's input. Those questions also go on the list at the bottom.

## Standing decisions
- **Branching:** production deploys from `main`, and all changes go straight to `main`. Ignore `saas-multi-tenant`, except for its one unmerged commit (see C2). Every push is a production deploy, so I ask before each push.
- **Adjustable from `/platform`:** every pricing, storage, retention, free-period and cap value is editable by the super admin in a new **"API" tab** at `/platform`. None of them live in code.

## Round 1: security fix and business model (answered 2026-11-03)

| # | Topic | Answer | Decision |
|---|---|---|---|
| S1 | Verify live DB | default | Jackson runs the read-only SQL and pastes the output. |
| S2 | Profile self-update fix | default | Guard trigger. **Tightened after the audit:** only the service role may change privileged columns, because no app path needs admin-session writes. See `security-fix-plan.md`. |
| S3 | Signup trigger fix | default | The trigger ignores role/business metadata, and server code promotes the user. New signups still become business owners. |
| S4 | Scope and branch | Fix #1 and #2 now; #3 and #4 before recipient-link work; straight to `main` | Plan: `security-fix-plan.md`. Awaiting "APPROVED: start Security Fix". |
| B1 | File 05 prices | yes, and adjustable later | Seeded as defaults and editable in `/platform` → API. |
| B2 | Size measurement | default | Decimal GB; uploaded files only; links are free; exactly 5.000 GB is Standard. |
| B3 | Additions after submit | default | 7-day window re-tiers the same delivery. **[GENO]** confirm. |
| B4 | Quote endpoint | default | In v1. |
| B5 | Free launch period | default, cap "$10 worth of storage", editable in `/platform` | Shape: end date + cap, whichever first. **Cap unit needs clarifying (C1).** |
| B6 | Retention and caps | default, editable in `/platform` | `expires_at` from day one; deletion job before the first expiry; 100 GB per session; 1 TB/month alert. |
| B7 | Powered by | default | Footer on upload screen, portal and emails; on; not removable in v1. |
| B8 | Pilot attribution | default | Reuse the affiliate program. Rev-share % **[GENO]**. |

## Round 2: clarifications, data model, access, uploads (asked 2026-11-03)
C1, C2, C3, D1–D12. Questions are in the chat; answers go here.

| # | Topic | Answer | Decision |
|---|---|---|---|
| C1 | Free-period cap | **50 GB delivered, one-time total; $199 minimum waived during the free period** | Free period ends at the end date or after 50 GB, whichever comes first. Both editable in `/platform` → API. |
| C2 | Commit `2a210b3` | default; v109 is applied in prod | Bring `2a210b3` onto `main` before any new work. |
| C3 | Price changes | default | Price frozen at submit. Changes affect new deliveries only and are audit-logged. |
| D1 | Naming | default | "API accounts"; tables use the `api_` prefix. |
| D2 | Account model | default | Business row plus a linked sandbox business. |
| D3 | Delivery-only | default; API accounts default to delivery-only | `projects.delivery_mode` with a business default. |
| D4 | Download gate | default | Unlocks on publish, ignoring payment. |
| D5 | Status mapping | default | created → `scheduled`; submitted → `ready_for_review`; published → `delivered`. |
| D6 | Recipients | yes, matched by email | CRM client, deduplicated per business. |
| D7 | Recipient access | **90-day** passwordless link, renewable through the API; sent by ShootPortal email or the partner's chat; no OTP in v1 unless Geno requires it | See C4 for how this interacts with file expiry. **[GENO]** OTP. |
| D8 | Contributor identity | default | Contact row only; the 24 h upload link is the credential. |
| D9 | Sandbox emails | default, **with on/off toggles for the super admin** | Per-account email toggles in the API tab (see N1–N3). |
| D10 | Key scopes | default | No scopes in v1. |
| D11 | Resumable uploads | **Must work no matter what** | Primary approach plus two fallbacks, proven in the first build chunk (see chat, Round 3 intro). |
| D12 | File types | default | Broad allowlist; executables blocked. |

## Round 3: uploads follow-up, webhooks, notifications, billing ops, operations, timeline (asked 2026-11-03)
| # | Topic | Answer | Decision |
|---|---|---|---|
| U1 | Background upload | default | v1 pauses when the app is backgrounded but always resumes and never loses progress. It keeps the screen awake. A native SDK is a later option. |
| C4 | Link vs file expiry | default | A recipient link never outlives its files. |
| W1 | Event catalog | default | Events: submitted, published, viewed, downloaded, upload_session.expired. Viewed and downloaded fire once per recipient. |
| W2 | Retries | default | Retries run over 3 days with backoff. The endpoint is then auto-disabled and an email is sent. Attempts are logged and can be resent. |
| W3 | Publish timing | default | Per-account setting, auto-publish **on**. **[GENO]** |
| N1 | Who emails clients | default | Per-account setting: ShootPortal, Partner, or Both. Starts at ShootPortal. **[GENO]** |
| N2 | Pilot emails | default | "Delivery received" receipt toggle, **off**. The claim-account email is not in v1; it's **possible in V2** with SkyyTask's consent. |
| N3 | Email controls | default | Sandbox allowlist switch with an editor and an email log. Live accounts get a "pause all emails" switch. |
| M1 | Monthly bill | Statement + CSV, **plus a "Create Stripe invoice" button in v1** | The button creates a **draft** Stripe invoice that you review and send (see R9). Free-credit lines say "covered by launch credit". |
| O1 | Logs | default | Logs are kept 30 days. Bodies are kept only for errors, with masking. You can search by request_id. |
| O2 | Alerts | default | Immediate alerts, plus a daily digest. |
| P1 | Hours / timeline | default | Assume about 10 hours a week, with the proposed Nov–Feb timeline. Re-plan if this changes. |
| P2 | Build gating | yes | Security fix, upload proof and foundations go ahead now. The heavy SkyyTask build waits for Nov 11 and ideally an LOI. **PDFs: two documents**, a one-pager and a multi-page workflow and vision guide (see R1). |

## Round 4: PDFs, brand, learning, URLs (asked 2026-11-03)
| # | Topic | Answer | Decision |
|---|---|---|---|
| R1 | Documents | 3, all beautifully designed and branded | One-pager (1 page), Integration Guide (4–6 pages, workflow and vision), Developer Guide (Phase 5). Shared template and partner config. |
| R2 | Pricing | default; position as an **initial proposal, subject to change** | Separate one-page Pricing Sheet generated from the `/platform` config, labelled "Initial pricing — subject to change." |
| R3 | Early draft | default | "Proposal" edition of the one-pager for Nov 11, stamped "Proposed design — in development"; illustrated mockups. Final edition after the build. Rendered with the existing local Chrome (headless). |
| R4 | Colors | default | Logo used exactly as-is (artwork indigo `#3E2EE7`); PDF accents in UI indigo `#4F46E5` + Midnight `#0F172A`; Inter. The site-wide primary stays unchanged. |
| R5 | Logo format | default | High-res PNG. |
| R6 | Contact | Jackson Bridges · Founder · jackson@shootportal.app · (662) 687-1259 · shootportal.app | |
| R7 | Footer | default | "Prepared for SkyyTask · Confidential · v1.0 · date" |
| L1 | Learning | **No pre-build explainers and no quizzes for now.** | One plain-English reference doc (`concepts-plain-english.md`), written for non-developers. This overrides the kickoff's end-of-phase quiz unless Jackson asks for it again. |
| X1 | Domains | default | Slug subdomain until SkyyTask sets a custom domain. **[GENO]** |
| X2 | API URL | default | `https://api.shootportal.app/v1` → routed to `/api/v1`. Needs one DNS record. |
| R9 | Invoice button | default | Creates a **draft** Stripe invoice. Sandbox accounts and duplicate months are refused. The Stripe invoice ID is stored on the statement. |

## Phase 2 status: complete (2026-11-03)
I have what I need to write the Founder's Guide. Open items:

**Waiting on Jackson**
- S1: output of the two read-only production queries (before the security fix).
- Approval: "APPROVED: start Security Fix", and approval to bring `2a210b3` onto `main` (C2).
- Confirm the Supabase plan is Pro or higher, so files can be raised beyond 2 GB (global limit up to 500 GB), and confirm the storage/egress rates File 05 assumed.

**Decided by testing, not by asking**
- Which resumable-upload approach we use (TUS with signed tokens, S3 multipart, or R2/S3), settled by the upload proof in the first build chunk.

**Needs Geno / SkyyTask:** the 13 items below.

## Running list for the Nov 11 call: needs Geno / SkyyTask's dev team
1. Jobs per month today, and projected after V2.
2. Typical and maximum delivery size per job type (real estate, inspection, mapping).
3. Re-deliveries: how often clients ask for re-edits or more files after delivery (B3).
4. Free launch period: target V2 launch date (B5).
5. Rev-share expectation on pilots who convert to paid ShootPortal (B8).
6. App stack (native iOS/Android, React Native, Flutter); webview vs in-app browser (D11).
7. Who notifies the end client: ShootPortal email, their in-app chat, or both? Is the OTP a hard requirement (D7)?
8. Which event releases pilot payout: submitted, published, viewed or downloaded?
9. Create the ShootPortal project at job *accepted* or at *Complete Job*?
10. Stable IDs and emails for pilots and clients; consent to email pilots.
11. Which enterprise file types they deliver today (thermal, GeoTIFF, LAS/LAZ, KMZ, reports) (D12).
12. Auto-publish on the pilot's submit, or does SkyyTask review first and then call publish (W3)?
13. Can their app keep the screen awake / warn the pilot not to leave during upload? Any plan for a native SDK later (U1)?
14. Custom domain for pilots and clients (e.g. `deliver.skyytask.com`), and who manages their DNS (X1)?
15. Billing contact and legal entity name for the monthly invoice (R9).
