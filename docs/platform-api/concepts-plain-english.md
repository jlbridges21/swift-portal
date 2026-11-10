# The ShootPortal Platform API, in plain English

> **For:** Jackson, as a reference to read whenever you need it.
> **Written for:** someone who is *not* a software developer. No code, no jargon without an explanation.
> **Companion to:** `01-how-it-works.md`, the Founder's Guide, which has the technical detail. Every name used here matches that guide.

## How to use this document

- Each section explains one idea. You don't need to read them in order.
- Every section follows the same five parts:
  1. **What it is:** one sentence.
  2. **Think of it like…:** an everyday comparison.
  3. **How ShootPortal uses it:** with our example job.
  4. **Why it matters:** what would go wrong without it.
  5. **How you'd explain it to Geno:** a line or two you can say out loud.
- **The example job used throughout** (all fake data):
  - SkyyTask job **JOB-10482**, a real estate shoot at **123 Demo Street, Sampletown, FL**.
  - The pilot is **Sam Pilot**.
  - The client is a realtor named **Pat Agent**.

---

## The whole thing in 60 seconds

SkyyTask has a job. Its computer system sends ShootPortal a message: *"Here's job JOB-10482, here's the client Pat, here's the pilot Sam."* ShootPortal sets up a project and hands back a **one-time upload link**.

Sam opens that link inside the SkyyTask app. He sees an upload screen with SkyyTask's logo, uploads his photos and videos (it survives bad signal), and taps **Submit delivery**.

ShootPortal measures how big the delivery is, works out its price from a price list, and opens a **private, SkyyTask-branded gallery** for Pat, with no quotes or invoices in sight.

At every step, ShootPortal **taps SkyyTask's system on the shoulder** ("submitted", "client viewed", "client downloaded") so SkyyTask can update the job and pay the pilot.

At month end, you see a statement and click **Create Stripe invoice**.

Everything else in this document is about making that simple story **safe, reliable and fair**.

---

## 1. API, endpoint, request/response, JSON

**What it is:** an **API** is a set of doors that lets one company's software ask another company's software to do things, without a person clicking buttons.

**Think of it like…** a restaurant's takeout window:
- The **menu** is the API: a list of what you're allowed to order.
- Each item on the menu is an **endpoint**, like "create a project" or "add a client".
- You place an order: that's the **request**. The kitchen hands back your food: that's the **response**.
- **JSON** is simply the agreed way of writing the order slip, so both sides read it the same way. It's a tidy list of labels and values, like `name: Pat Agent`, `email: pat.agent@example.com`.

**How ShootPortal uses it:** SkyyTask's system sends a request to the "create a project" endpoint, at the address `api.shootportal.app/v1/projects`. The request says the job number is JOB-10482 and gives the address. ShootPortal answers with the new project's ID and its status, "scheduled".

**Why it matters:** without an API, someone at SkyyTask would have to log into ShootPortal and set up every job by hand. With it, thousands of jobs can flow automatically.

**How you'd explain it to Geno:** "It's the door you asked for. Your system knocks with a key, tells us about the job, and we take it from there."

---

## 2. API keys and hashing

**What it is:** an **API key** is a long secret password that only SkyyTask's servers hold. It proves a request really comes from SkyyTask.

**Think of it like…** a key card for an office building:
- The card opens SkyyTask's floor and nobody else's.
- The front desk doesn't keep a copy of the card. It keeps a **fingerprint** of it, which is enough to recognize the card when it's swiped. Nobody can rebuild the card from the fingerprint.
- That fingerprint is called a **hash**.

**How ShootPortal uses it:**
- Keys look like `sp_test_…` (practice) or `sp_live_…` (real).
- You create keys in `/platform` → API → Keys. The full key is shown **once**. We store only its hash plus the first few characters, so you can tell keys apart.
- When a request arrives, we fingerprint the key it carries and look for a match. The match tells us which **API account** it is, and whether it's test or live.
- SkyyTask can hold two keys at once. That lets them switch to a new key before you switch off the old one. This is called **rotation**.

**Why it matters:**
- If our database were ever leaked, the attacker would find fingerprints, not usable keys.
- If a key leaks from SkyyTask's side, you click **Revoke** and it stops working instantly.

**How you'd explain it to Geno:** "You get a secret key for your servers. We never store the key itself, only a fingerprint of it, and either of us can cancel it in seconds."

---

## 3. Sandbox vs live

**What it is:** every API account has two separate copies:
- a **sandbox** for practice;
- a **live** account for real jobs.

**Think of it like…** a flight simulator and a real plane. Same controls, same buttons, but nothing in the simulator can crash a real plane.

**How ShootPortal uses it:**
- Each API account is really two businesses inside ShootPortal, for example `skyytask-sandbox` and `skyytask`.
- A `sp_test_…` key only ever touches the sandbox. A `sp_live_…` key only ever touches live.
- In the sandbox:
  - Nothing is billed.
  - Emails only go to people on an **allowlist** you control, such as SkyyTask's developer and you. Everything else is held in an **email log** so you can read what *would* have been sent.
- SkyyTask's developer can create JOB-10482 a hundred times in the sandbox while testing, and Pat never gets a single email.

**Why it matters:** developers make mistakes while building. The sandbox means those mistakes never reach real clients and never show up on an invoice. Going live is just swapping one key for another.

**How you'd explain it to Geno:** "Your team gets a full practice copy. When it all works, you swap one key and you're live, with no code changes."

---

## 4. Tenants, businesses and RLS (and the "two front doors")

**What it is:**
- Every ShootPortal customer is a **tenant**, called a **business** in our database.
- **RLS (row-level security)** is a set of rules *inside the database itself* that decides which rows each user can see or change.

**Think of it like…** an apartment building:
- Every tenant has their own unit.
- The building's locks (RLS) make sure your key opens your unit only, even though everyone shares the same hallways and plumbing (the same database).

**How ShootPortal uses it:**
- SkyyTask's live and sandbox businesses are just two more apartments.
- A SkyyTask staff member who logs in sees only SkyyTask's projects, exactly like every other business today.
- All the new API tables (keys, deliveries, webhook logs and so on) are locked so that **no logged-in user can read them at all**. Only our own server can.

### The two front doors

ShootPortal has two ways in:

1. **Door 1: your app.** The website and its screens. Your code checks who you are and what you're allowed to do before every action. This door is well locked.
2. **Door 2: Supabase's public database door.** Every Supabase project automatically has a second entrance that talks straight to the database. Anyone who is logged in can use it, for example by typing commands into the browser's developer console. Your app's checks **don't run here**. The *only* guard at Door 2 is RLS.

So the right question is never just "does my app allow this?" It's also "does RLS allow this at Door 2?"

### The privilege-escalation holes (found Nov 3, 2026, confirmed live)

1. **Hole 1: users could rewrite their own profile.** The RLS rule said "you may edit your own profile row", but it didn't say *which parts*. So through Door 2, any logged-in user, even a client, could change their own role to **admin** or **super admin**, or move themselves into another business.
2. **Hole 2: signup believed whatever it was told.** When someone signs up, a database step creates their profile. It trusted the role and business that came with the signup, so someone could sign up claiming "I'm an admin of business X."

### How the fix closes them

1. **A guard on the profile table.** Only our own server may change the important parts of a profile: role, business, client link, email, staff permissions, disabled status. Users can still edit their name, phone and photo.
2. **Signup stops believing the form.** Every new person starts as a plain account with no business. Then our server, which just created their business, makes them its owner.

Real signups work exactly as before. Fake ones get nothing.

**Why it matters:** it's the difference between "one customer's data is private" and "anyone who signs up can read everyone's data." The API sits on top of these locks, so they have to be solid first.

**How you'd explain it to Geno:** "Every partner lives in its own locked unit inside our database. The locks are enforced by the database itself, not just by our website."

---

## 5. Service role

**What it is:** the **service role** is our server's master key to the database. It can open every apartment.

**Think of it like…** the building manager's master key. It never leaves the manager's office, and the manager only uses it for jobs that the rules say are allowed.

**How ShootPortal uses it:**
- When SkyyTask's request to create JOB-10482 arrives, our server checks the API key first.
- Only after that check does it use the master key, and it is careful to act only inside SkyyTask's business.
- The master key lives only on our servers. It is never sent to a browser or a phone.

**Why it matters:**
- Some work genuinely needs the master key, such as creating a client for a partner or reading webhook logs.
- The rule is simple: **check first, then act, and only inside the right business.**

**How you'd explain it to Geno:** "Our servers have a master key that never leaves them. Your key just tells our servers which unit to work in."

---

## 6. Idempotency (the "don't do it twice" label)

**What it is:** an **idempotency key** is a label attached to a request, so that if the same request arrives twice, the work is only done once.

**Think of it like…** writing a check number on a payment. If the bank sees check #1042 twice, it knows not to pay twice.

**How ShootPortal uses it:**
1. SkyyTask sends "create project for JOB-10482" with the label `job-10482-create`.
2. Their Wi-Fi drops before they hear back, so they send it again.
3. ShootPortal sees the same label, doesn't create a second project, and returns the original answer.

We remember these labels for 24 hours. If someone reuses a label for a *different* request, we refuse with a clear error rather than guess.

**Why it matters:** networks fail all the time. Without this, retries would create duplicate projects, duplicate clients and duplicate charges.

**How you'd explain it to Geno:** "Your system can safely retry anything. Tag it with your job number and we'll never do it twice."

---

## 7. Webhooks

**What it is:** a **webhook** is ShootPortal calling SkyyTask's system to say "something just happened", instead of SkyyTask having to keep asking.

**Think of it like…**
- **Without webhooks:** a kid in the back seat asking "are we there yet?" every 5 minutes.
- **With webhooks:** the driver simply announces "we're here".

**How ShootPortal uses it:** for JOB-10482, SkyyTask's system receives these messages:
- `delivery.submitted`: Sam finished uploading. Includes file count, size, tier and price.
- `delivery.published`: Pat's gallery is live.
- `delivery.viewed`: Pat opened it for the first time.
- `delivery.downloaded`: Pat downloaded something for the first time.
- `upload_session.expired`: Sam's upload link ran out before he submitted.

SkyyTask can use these to mark the job complete, message the client, or release Sam's payout.

**Why it matters:** this is how the two products feel like one. SkyyTask's app can show "Client viewed ✓" seconds after Pat opens the gallery.

**How you'd explain it to Geno:** "We'll ping your servers at each step (submitted, published, viewed, downloaded), so you can trigger payouts and update the job automatically."

---

## 8. HMAC signatures (the tamper-proof seal)

**What it is:** an **HMAC signature** is a seal on every webhook that proves it came from ShootPortal and wasn't altered on the way.

**Think of it like…** a wax seal on a letter:
- Only someone with the right stamp can make the seal.
- The stamp here is a secret shared between ShootPortal and SkyyTask, called the **signing secret**. It starts with `whsec_`.
- If anyone changes even one letter of the message, the seal no longer matches.

**How ShootPortal uses it:**
1. Every webhook carries a header containing the seal and the time it was sent.
2. SkyyTask's system recomputes the seal using its copy of the secret. If the seals match and the message is less than 5 minutes old, it's genuine.
3. Without the check, a stranger could pretend to be us and send a fake "Pat downloaded everything, release the payout."

**Why it matters:** webhooks can move money (pilot payouts), so SkyyTask must be able to trust them.

**How you'd explain it to Geno:** "Every message we send you is sealed with a secret only we both know. Your developer adds a ten-line check to make sure it's really from us."

---

## 9. Outbox, cron and retries

**What they are:**
- The **outbox** is a to-do list of webhooks waiting to be sent.
- The **cron** is a timer that works through that list every minute.
- **Retries** are how we keep trying when SkyyTask's server doesn't answer.

**Think of it like…** a mail room:
- Letters go into the outbox tray the moment they're written.
- A clerk empties the tray every minute.
- If a recipient's mailbox is closed, the clerk tries again later, and waits a bit longer each time.

**How ShootPortal uses it:**
1. When Sam submits, we write a `delivery.submitted` note to the outbox *as part of the same step*, so it can never be forgotten.
2. Within a minute, the timer sends it.
3. If SkyyTask's server is down, we retry at 1 minute, 5 minutes, 30 minutes, 2 hours, 6 hours, then every 12 hours, for **3 days**.
4. After that, the address is paused and both you and SkyyTask get an email.
5. Every attempt is logged in `/platform`, with a **Resend** button.

**Why it matters:**
- We never make an API request wait on SkyyTask's server, so a slow partner can't slow ShootPortal down.
- Messages are never lost: they wait in the outbox until delivered.

**How you'd explain it to Geno:** "If your server is down, we don't lose anything. We keep retrying for three days and tell you if it's still failing."

---

## 10. Upload sessions

**What it is:** an **upload session** is a one-job, short-lived upload link for one pilot.

**Think of it like…** a valet ticket. It lets you hand over one specific car, at one specific place, today only. It isn't a key to the garage.

**How ShootPortal uses it:**
1. When Sam taps **Transfer deliverables**, SkyyTask's *server* asks us for an upload session for JOB-10482 and Sam.
2. We return a link that lasts up to 24 hours, and the app opens it.
3. Sam has **no ShootPortal account and no password**. The link itself is his permission, and it only allows uploading to this one project.
4. When he submits, the link is used up, and the in-app browser returns him to the SkyyTask app.

**Why it matters:** the secret API key never goes on a phone. If Sam's phone were stolen, the worst anyone could do is upload to one project for a few hours.

**How you'd explain it to Geno:** "Your server asks us for a one-time upload link and your app opens it. Pilots never need a ShootPortal login."

---

## 11. Resumable uploads (TUS) and signed upload tokens

**What they are:**
- A **resumable upload** sends a big file in small pieces, so a dropped connection picks up where it left off instead of starting over. **TUS** is the name of the standard way of doing this.
- A **signed upload token** is our server's written permission to upload one particular file to one particular place.

**Think of it like…**
- **Resumable upload:** moving house with a numbered stack of boxes instead of one giant crate. If the truck breaks down after box 40, you continue from box 41.
- **Signed upload token:** a parking permit valid for one exact space.

**How ShootPortal uses it:**
1. Sam picks a 4 GB video. The upload screen asks our server for permission for that one file. Our server checks the file type and size and returns a signed upload token.
2. The phone then sends the video **straight to our file storage** in 6 MB pieces. It never passes through our website servers, which is what makes huge files work.
3. We keep track of which pieces arrived. If Sam loses signal, or closes and reopens the screen, it asks "what's done already?" and continues.
4. When the last piece lands, our server double-checks that the file really exists before counting it.

**Why uploads pause when the phone is locked:**
- Phones freeze web pages that aren't on screen, to save battery. A web page simply isn't allowed to keep uploading in the background.
- So if Sam locks his phone or switches apps, the upload **pauses**. It **never loses progress** and resumes when he comes back.
- That's why the screen stays awake and says *"Keep this screen open while uploading."*
- True background uploading would need code built into SkyyTask's own app. That's possible later, but it isn't part of v1.

**Why it matters:** pilots upload huge files from the field on bad connections. Without resumable uploads, a 4 GB upload that fails at 95% would start over from zero.

**How you'd explain it to Geno:** "Big files upload in small pieces directly to storage. If the signal drops, it picks up where it left off. Pilots just need to keep the screen open."

---

## 12. Signed expiring links (access links)

**What it is:** an **access link** is a private web address that lets one recipient view one delivery, without a login, until a set date.

**Think of it like…** a hotel key card coded for one room, for the length of your stay. When checkout comes, it stops working.

**How ShootPortal uses it:**
- When the delivery is published, Pat gets an access link. Either ShootPortal emails it to her with SkyyTask's branding, or SkyyTask's system asks for the link and sends it in its own chat.
- The link opens Pat's gallery for JOB-10482 only.
- It lasts up to **90 days**, and never longer than the files themselves are stored. SkyyTask can renew it.
- The link only lets Pat **view and download**. It never logs her into an account.
- Each link is tracked, so we know when Pat first viewed and first downloaded. That's what produces the "viewed" and "downloaded" webhooks.

**Why it matters:** it replaces the old OTP-code-plus-Google-Drive step with a single tap. No codes, no accounts, no leaving the brand.

**How you'd explain it to Geno:** "Your client gets one private link, in our branded email or in your chat. No codes, no passwords. It's good for 90 days and you can renew it."

---

## 13. Deliveries, delivery-only mode, pricing, and launch credit

**What they are:**
- A **delivery** is the set of files a pilot submits for a job, priced as one unit.
- **Delivery-only mode** is a project with all money features hidden: no estimates, invoices or payments.

**Think of it like…** a shipping company:
- You pay per package, by size. Small box, medium box, large box.
- The rate printed on your receipt is the rate you paid, even if prices change next month.

**How ShootPortal uses it:**

1. **Measuring:** when Sam submits, we add up the size of every file he uploaded. Say it's 3.4 GB. Links to 360 tours or 3D models count as zero.
2. **Tiers:** we look up the price list:
   - **Standard:** up to 5 GB.
   - **Large:** up to 25 GB.
   - **XL:** up to 100 GB.
   - **Over 100 GB:** XL plus a per-GB charge.

   3.4 GB is Standard.
3. **Pricing snapshot:** we save a copy of the exact price list used, right on the delivery. If you change prices later in `/platform`, Sam's delivery keeps its original price.
4. **Late additions:** files added within 7 days join the same delivery. Its tier may go up, but it's never charged twice.
5. **Launch credit:** during the launch period, deliveries are free up to **50 GB** in total, or until an end date you set. The price is still shown, as "covered by launch credit", so SkyyTask sees the value. Both the 50 GB and the date are editable.
6. **Monthly minimum:** at month end, if a partner's deliveries add up to less than the minimum, they pay the minimum. Above it, they pay just the total. The minimum is waived during the launch period.
7. **Delivery-only mode:** API accounts use it by default. Pat never sees anything about money, and her downloads unlock the moment the delivery is published, with no payment step.

**Why it matters:**
- SkyyTask can predict every job's cost in advance. There's even a "quote" endpoint that prices a job before it happens.
- You're protected from the cost of huge or unexpected volume.
- Changing prices later never rewrites history.

**How you'd explain it to Geno:** "You pay a flat price per job, based on its size, and you see the price the instant the pilot submits. There are no surprise storage bills."

---

## 14. Request IDs and logs

**What it is:** every API answer comes with a **request ID**, a tracking number like `req_9a…`. We keep a log of every API call for 30 days.

**Think of it like…** a package tracking number. When something goes wrong, you don't describe the package. You read out the number.

**How ShootPortal uses it:**
1. SkyyTask's developer says "creating JOB-10777 failed."
2. You ask for the request ID, paste it into `/platform` → API → Logs, and see exactly what happened. For example: "email was missing."
3. If it was our fault, the same ID leads to the detailed error in our hosting logs.

To protect privacy, we only keep the details of failed calls, trimmed and with personal information masked.

**Why it matters:** it turns "it's broken" into a two-minute fix, and it lets one person (you) support partners without guesswork.

**How you'd explain it to Geno:** "Every response has a tracking number. If anything ever fails, send me that number and I can see exactly what happened."

---

## 15. Rate limits

**What it is:** a **rate limit** is a cap on how many requests one key can make per minute.

**Think of it like…** a "limit 10 per customer" sign. It's there to keep the shelves stocked for everyone, not to annoy anyone.

**How ShootPortal uses it:**
- v1 has a soft limit of **100 requests per minute** per key, which is far more than SkyyTask should need.
- If a bug in someone's code starts firing thousands of requests, they get a polite "slow down" answer instead of overwhelming ShootPortal for every other customer.

**Why it matters:** one runaway program shouldn't be able to slow down the whole platform.

**How you'd explain it to Geno:** "There's a generous per-minute limit, just to protect everyone from runaway bugs. Normal use won't come close."

---

## 16. external_id (your number, not ours)

**What it is:** **external_id** is SkyyTask's own ID for something, stored alongside ours. Examples: its job number, pilot ID or client ID.

**Think of it like…** writing your own order number on a dry-cleaning ticket. You can ask for your clothes by your number. You never need to memorize the shop's.

**How ShootPortal uses it:**
- The project is stored with `external_id = JOB-10482`, Sam with `P-4410` and Pat with `C-889`.
- SkyyTask can look up "the project for JOB-10482" at any time, and every webhook includes these numbers.
- SkyyTask never has to store ShootPortal's own IDs if it doesn't want to.

**Why it matters:** it makes the integration simpler and harder to break. Both systems talk in SkyyTask's own job numbers.

**How you'd explain it to Geno:** "Use your own job numbers. Everything we send back is labeled with them."

---

## 17. Feature flags and the kill switch

**What it is:** a **feature flag** is an on/off switch for a feature. A **kill switch** is a master switch that turns something off everywhere, instantly.

**Think of it like…** the circuit breakers in a house. You can switch off one room, or flip the main breaker.

**How ShootPortal uses it:**
- Each API account has an **API on/off** switch in `/platform` → API.
- There's also one master switch for the whole Platform API.
- Everything new is built behind these switches. Your current customers see **no change** until you decide to turn something on.
- There's also a **"Pause all emails"** switch per account, in case something looks wrong.

**Why it matters:**
- You can build and test in production safely.
- If a problem ever appears, you can stop it in seconds without a code change.

**How you'd explain it to Geno:** "Everything ships behind switches, so we can turn your account on when you're ready, and pause it instantly if anything looks off."

---

## 18. OpenAPI and Postman

**What they are:**
- **OpenAPI** is a single file that describes every endpoint precisely: what you send, and what you get back.
- **Postman** is a free app where you can click through API requests without writing code.

**Think of it like…**
- **OpenAPI:** the official, detailed menu, with every ingredient listed.
- **Postman:** a tasting session where you can try each dish.

**How ShootPortal uses it:**
- You'll get an `openapi.yaml` file and a Postman collection.
- You can import the collection, paste a sandbox key, and click through creating JOB-10482, adding Pat and Sam, and getting an upload link. That's the whole flow, with no programming.
- SkyyTask's developer gets the same files, so both sides are always reading the same menu.

**Why it matters:**
- It helps you understand and demo the API yourself.
- It helps SkyyTask's developers start fast without waiting on you.

**How you'd explain it to Geno:** "Your developer gets an exact spec and a click-through test kit on day one."

---

## A–Z mini glossary

| Term | In one line |
|---|---|
| **Access link** | A private, expiring link that lets one recipient view one delivery without logging in. |
| **API** | A set of doors that lets one company's software ask another's to do things. |
| **API account** | A partner using our API: a live business, a sandbox business, and their settings. |
| **API key** | A long secret password for a partner's servers (`sp_test_…` or `sp_live_…`). |
| **Contributor** | The pilot uploading files. No ShootPortal account needed. |
| **Cron** | A timer that runs a task on a schedule, ours every minute. |
| **Delivery** | The files a pilot submits for one job, priced as one unit. |
| **Delivery-only mode** | A project with no estimates, invoices or payments. |
| **Endpoint** | One specific door in the API, such as "create a project". |
| **external_id** | The partner's own ID for something, such as its job number. |
| **Feature flag** | An on/off switch for a feature. |
| **Hash** | A one-way fingerprint. We store the key's fingerprint, never the key. |
| **HMAC signature** | A tamper-proof seal proving a webhook came from us. |
| **Idempotency key** | A label that makes sure a retried request is only done once. |
| **JSON** | The standard way of writing data as labels and values. |
| **Kill switch** | A master switch that turns something off everywhere, instantly. |
| **Launch credit** | Free deliveries up to a set amount (50 GB) during the launch period. |
| **Live** | The real account, with real clients and real billing. |
| **Monthly minimum** | The lowest monthly bill. It disappears once usage passes it. |
| **OpenAPI** | A file that describes every endpoint exactly. |
| **Outbox** | A to-do list of webhooks waiting to be sent. |
| **Postman** | An app for clicking through API requests without writing code. |
| **Pricing snapshot** | A saved copy of the prices used for a delivery, so later changes don't alter it. |
| **Rate limit** | A cap on requests per minute, to protect the platform. |
| **Recipient** | The end client (e.g. the realtor) who views and downloads the delivery. |
| **Request / response** | What a partner asks for, and what we answer. |
| **Request ID** | A tracking number on every API answer, used for support. |
| **Retry** | Trying to deliver a webhook again after a failure. |
| **RLS (row-level security)** | Database rules deciding which rows each user may see or change. |
| **Rotation** | Swapping an old key for a new one without downtime. |
| **Sandbox** | The practice copy of an API account. Nothing is billed and emails are held. |
| **Service role** | Our server's master key to the database. It never leaves the server. |
| **Signed upload token** | Our server's permission slip to upload one file to one place. |
| **Tenant / business** | One customer's walled-off space inside ShootPortal. |
| **Tier** | The size bracket that sets a delivery's price (Standard, Large, XL). |
| **TUS / resumable upload** | Uploading in small pieces so a dropped connection resumes instead of restarting. |
| **Upload session** | A one-job, short-lived upload link for a pilot. |
| **Webhook** | ShootPortal calling the partner's system when something happens. |
