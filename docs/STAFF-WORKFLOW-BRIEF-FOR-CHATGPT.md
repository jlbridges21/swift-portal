# ShootPortal Staff Functionality: Current State, HD Photo Hub Comparison, and Gaps

*Prepared November 12, 2026, from a full review of the ShootPortal codebase and HD Photo Hub's public help center (195 articles), marketing pages, changelog and pricing page.*

## How to use this document

You are helping me (the founder of ShootPortal) brainstorm how to make ShootPortal's staff and team features as capable as HD Photo Hub's, and ideally simpler and more intuitive. This document is the factual baseline. Please read it fully before suggesting anything:

- **Part 1** explains what ShootPortal is.
- **Part 2** is an exact inventory of today's staff functionality. Treat it as ground truth. If something isn't listed, assume it doesn't exist.
- **Part 3** describes how HD Photo Hub handles staff, scheduling, dispatch, pay and mileage.
- **Part 4** compares the two side by side.
- **Part 5** summarizes what ShootPortal is missing.
- **Part 6** lists constraints and the questions I want to brainstorm.

---

## Part 1: What ShootPortal is

ShootPortal is a multi-tenant SaaS for real estate media businesses (photographers, videographers, drone operators, 3D tour providers). Each **business** gets:

- **An admin portal** for the owner and team. It has a Projects pipeline, Clients CRM, Media library, Shoot Calendar, Messages, Leads, Settings and Billing. There are two interfaces: a redesigned **"New interface"** and a **"Classic"** one. Each user picks one, and both enforce the same permissions.
- **A client portal**, branded with the business's colors and domain. Clients request shoots, approve proposals, pick shoot times, pay invoices, view and download media, give video feedback, and message the business.
- **A project workflow** with eight stages: New Request → Quote Sent → Proposal Approved (Awaiting Schedule) → Scheduled → Shoot Complete (Editing) → Review → Approved (Awaiting Payment) → Delivered. Stage changes can notify clients and run automations.
- **Scheduling.** The business and the client trade proposed shoot times ("shoot proposals"). A confirmed proposal is the project's scheduled shoot. The business has one time zone setting, and shoots are 60-minute blocks; there is no per-shoot duration.
- **Money.** Estimates and proposals (multiple services per project), Stripe invoices and payment links, and travel fees charged to clients using mileage bands.
- **Google Calendar integration.** One connection per business, owned by the business owner. Confirmed shoots are pushed one way to the owner's Google Calendar, and the owner can see their Google events overlaid on the Shoot Calendar.
- **An installable app (PWA)** for the admin portal with a mobile bottom navigation bar, plus push notifications through OneSignal.
- **Pricing.** Subscription plans. **Staff seats are unlimited and free.** Only admin co-owner seats are limited (for example, 3 on the Studio plan).

---

## Part 2: ShootPortal's current staff functionality (exact inventory)

### 2.1 Roles

| Role | Who | Notes |
|---|---|---|
| Owner | The business's first admin | Can't be demoted or removed by co-admins. |
| Admin | Co-owner / manager | Full access to everything, including billing, settings and staff management. Uses a paid admin seat. |
| Staff | Team member (photographer, editor, coordinator and so on) | Access is controlled entirely by individual permission toggles. Unlimited and free. |
| Client | The business's customers | Use the client portal only. |
| Super admin | ShootPortal platform operator | Not part of the business. |

- There are **no named staff roles** such as "Photographer" or "Editor". Every staff member is the same account type with a different set of toggles.
- One login belongs to **exactly one business**. A person can't be staff at two businesses with the same email.

### 2.2 Staff account lifecycle

- **Invite:**
  - The owner or an admin goes to Settings → "Staff & Permissions" and enters an email and an optional name.
  - The person gets a branded email ("You're invited to join the team" with a "Set up your staff account" button). They set a password and land in their staff area.
  - If the email already has an account (for example a former client), it's converted to staff and keeps its password.
- **New staff start with every permission off.** The owner then turns permissions on.
- **Edit:** name, email (also changes their login), permissions, and "Send password reset email".
- **Promote / demote:**
  - Staff can be promoted to Admin, which uses an admin seat. If no seat is free, the promotion is refused.
  - Admins can be demoted to Staff. Their permissions are cleared and the seat is freed.
- **Remove:**
  - This is a soft delete. The person is disabled and immediately loses access.
  - All of their project assignments are deleted.
  - They're listed under "Show removed team members". Re-inviting the same email reactivates them with all permissions off.
- **Who can manage staff:** only the owner and admins. Staff can never manage staff, even with every permission on.
- **Staff's own settings:** a "Preferences" page with only email and in-app notification on/off switches.

### 2.3 Permissions (complete list: 30 toggles in 9 groups)

All toggles default to off. Anything not explicitly on is denied.

**Area access** (whether the area shows in their navigation at all)
- `area.projects`: Projects
- `area.clients`: Clients
- `area.media`: Media library
- `area.calendar`: Calendar
- `area.messages`: Messages

**Projects**
- `projects.view_all`: View all projects. Without this, staff see **only projects they're assigned to**.
- `projects.create`: Create projects. A staff member who creates a project is automatically assigned to it.
- `projects.edit`: Edit project details, including name, status/stage, address and notes. This is also what lets them move a project to "Delivered".
- `projects.delete`: Delete or archive projects. Hide, or permanently remove; deleting the media too also needs Delete media.
- `projects.manage_staff`: Manage project staff. Assign or remove staff on projects they can access.

**Clients**
- `clients.create`: Create clients
- `clients.edit`: Edit clients' contact details and notes
- `clients.add_to_projects`: Add clients to projects
- `clients.delete`: Delete clients (their projects and media are kept)

**Media**
- `media.upload`: Upload media (photos, video, files, YouTube links, 360° tours, 3D models)
- `media.delete`: Delete media
- `media.organize`: Organize media (reorder, folders, cover image, hide/show; also needed to save in the photo editor)
- `media.download_originals`: Download original-quality files

**Video review**
- `video_review.comment`: Comment on reviews
- `video_review.resolve`: Resolve and reopen feedback
- `video_review.upload_versions`: Upload new video versions

**Scheduling**
- `scheduling.propose`: Propose shoot times to clients
- `scheduling.confirm`: Confirm and reschedule shoots (also needed to drag shoots on the calendar)

**Money**
- `money.view`: View estimates and payments. Without this, all prices, estimates, invoices and payment status are hidden everywhere: project pages, client profiles, search, PDFs and notifications.
- `money.create_send_estimates`: Create and send estimates and proposals
- `money.send_payment_links`: Send Stripe payment links
- `money.mark_paid`: Mark payments paid manually

**Messages**
- `messages.send`: Send portal messages to clients

**Sharing**
- `sharing.email`: Share projects by email to a named person
- `sharing.anyone_with_link`: Set a project to "Anyone with link"

**Never delegable to staff (owner and admins only):** billing, subscription, staff management, partner program, custom domain, Stripe Connect, deleting the business, Settings, Leads, the main Dashboard/Command Center, and the Photo Editor page. For the Photo Editor, the editor's own permission check would allow staff with Media access, but the portal's default-deny rule for unknown admin pages blocks staff from opening it. That's a known inconsistency.

**Presets** (quick-fill buttons in the permission editor; nothing records which one was used, and custom templates can't be saved):

| Preset | What it turns on |
|---|---|
| Blank | Nothing |
| Editor | Projects and Media areas; edit projects; upload, organize and download media; all video review permissions |
| Coordinator | All five areas; create/edit projects; manage project staff; create/edit clients and add them to projects; upload/organize media; propose and confirm shoots; message clients; share by email; comment on video reviews. **No money.** |
| Full access except money | Everything except the four money permissions |

The editor also has a permission search box, toggles grouped by section, and an "Admin" button that promotes the person to admin.

### 2.4 The staff portal

Staff don't get a separate app. They log into the **same admin portal** as the owner, cut down to their permissions:

- The navigation (desktop sidebar, Classic header and mobile bottom nav) shows **only the areas they have** (Projects, Clients, Media, Calendar, Messages).
- **No** Dashboard/Command Center, Leads, Settings, Billing, Partner program, Sites/website builder, launch checklist, subscription banners or tax/W-9 panel.
- "Settings" becomes "Preferences" (notification toggles only).
- Logging in sends them to their first permitted area, in the order Projects → Clients → Media → Calendar → Messages.
- A staff member with no areas sees: "An admin hasn't assigned project access or permissions yet."
- **Projects page:**
  - Shows only assigned projects, unless they have View all.
  - The Staff filter defaults to "assigned to me".
  - No Hidden Projects view, and no permanent delete or restore.
  - The staff dropdown only lists teammates on projects they can see.
- **Clients:** only clients connected to projects they can see. Contact details (phone and email) are **not** masked.
- **Money:** fully hidden without `money.view`.
- **Shoot Calendar:** only shoots for projects they can see. Staff never see Google Calendar events or connection settings.
- **Search:** results are scoped the same way. Staff can't search for other staff.
- **Mobile:** the same installable app as admins, with navigation filtered to their areas and a Create menu that shows only what they can create.
- **Security:** project access is enforced on the server (pages, APIs, and database row-level security). If staff open a link to a project they can't see, they get "not found".

### 2.5 Assigning staff to projects (jobs)

- **Data model:** a project can have **any number of assigned staff**. Each assignment is a plain link between a project and a user, with no role, no "lead" flag and no per-assignment details (time, pay, notes).
- **Where you can assign:**
  1. **Project detail page:** a "Staff" card with a dropdown, an Add button and an X to remove someone. Staff without Manage project staff can't load the assignment list. The card shows an access error instead of a read-only list of who is assigned.
  2. **Projects page, List view (New interface):** select several projects, then **Assign Staff** in the bulk toolbar. This only adds people and never removes existing assignments.
  3. **Projects page, Calendar view (New interface):** click a shoot, and the popover has a multi-select staff picker that saves automatically when closed.
  4. **Automatically:** a staff member who creates a project is assigned to it.
- **Not possible:**
  - Assigning staff in the New Project form.
  - Seeing or assigning staff on the dedicated **Shoot Calendar** page.
  - Assigning by role (for example "photographer: Sam, editor: Alex").
- **Filtering:** the Projects page has a Staff filter (multi-select, including "Unassigned"). It's remembered for the browser session.
- **Assignment notifications: none.** Being assigned to a job doesn't email, notify or push the staff member. The action is only written to an internal audit log.
- **Who can assign:** owner, admins, and staff with Manage project staff (only on projects they can access).

### 2.6 Scheduling and calendar from a staff perspective

- **Shoot Calendar page:**
  - Month, Week, Day and Agenda views of pending and confirmed shoots, with drag-to-reschedule.
  - It's **not** staff-aware: no per-staff columns, colors or filter, and no staff names on events.
- **Projects page Calendar view (New interface):**
  - Month, Week and List views of scheduled shoots, honoring the Projects page's Staff filter.
  - Drag to reschedule (Week snaps to 15 minutes, Month keeps the time), with a confirmation step.
  - Click a shoot to assign staff.
  - This is the only place where staff and schedule meet visually.
- **Scheduling permissions:**
  - Propose lets staff send shoot times to clients.
  - Confirm lets them confirm or reschedule.
  - Rescheduling updates the owner's Google Calendar and, per business settings, notifies the client.
- **Google Calendar:** one connection per business (the owner's).
  - Staff can't connect their own calendars.
  - Staff aren't added as attendees on Google events.
  - Staff's personal busy times are never considered.
- **Does not exist:**
  - Staff availability or working hours
  - Time off / blackout dates
  - Service areas or territories per staff member
  - Skills (which services a person can shoot)
  - Drive-time or travel-time calculation
  - Routing or a "my day" route
  - Double-booking or conflict detection
  - Capacity limits (maximum shoots per day)
  - Auto-assign or dispatch, including "first available" or "closest photographer"
  - Client booking against staff availability. Clients pick times through the proposal flow, not from real staff calendars.

### 2.7 Notifications to staff

- Staff receive **the same business notifications as admins**, filtered:
  - Project events reach only staff assigned to that project (or with View all).
  - Money events (payment received/failed, invoice available, estimates sent and so on) reach only staff with View money.
  - Billing and subscription events never reach staff.
  - Staff with no areas get nothing.
- **Channels:** in-app notifications and branded email. Each staff member can switch email and in-app on or off.
- **Push notifications go to owners and admins only.** Staff never get push.
- **Events that reach the team:**
  - New requests
  - Proposals approved or changes requested
  - Shoot proposed, confirmed, declined, or reschedule requested
  - Revision requested
  - Project messages
  - Status changes
  - Client video feedback
  - Payments, for money-permitted staff
- **Missing:**
  - Notification when a staff member is assigned or unassigned
  - Daily schedule digest ("your shoots tomorrow")
  - Shoot reminders
  - SMS to staff
- New public requests arrive with no one assigned, so in practice only View-all staff hear about them.

### 2.8 Media, editing and delivery

- Staff with media permissions can upload (photos, video, files, 360° tours, 3D models, YouTube), organize, delete and download originals on projects they can access.
- Video review: staff can upload new versions, comment, and resolve or reopen client feedback.
- "Delivering" is just changing the project stage, which needs Edit project details.
- **Missing:**
  - Editor task queues
  - Per-task assignment (shooter versus editor)
  - Raw-to-edited handoff
  - Due dates for edits
  - Outsourced editing integrations
  - Upload folders for the field (for example Dropbox)

### 2.9 Staff pay, mileage and finance

- **Nothing exists for paying staff:**
  - No pay rates (per service, per job or hourly)
  - No payouts, payroll or payout reports
  - No commissions or tips
  - No timesheets
  - No contractor or 1099 information
  - No mileage tracking for staff
- Two existing features look related but aren't:
  - **Travel fees** are charged *to clients* using mileage bands.
  - **W-9 generator**: the *business's own* W-9, sent to clients. It isn't for staff and is hidden from them.
- Payout and commission code exists only for ShootPortal's affiliate Partner program, which is unrelated to staff.

### 2.10 Oversight and reporting

- Staff management actions (invited, removed, promoted, assigned, unassigned) are written to an audit log that **only the ShootPortal platform operator can see**. Business owners have no staff activity view.
- The business activity feed records who did each action but **doesn't show it** in the UI.
- **No staff analytics:** no jobs per staff member, revenue per staff member, workload or utilization.

---

## Part 3: How HD Photo Hub handles staff

*Source: HD Photo Hub's own help center, product pages, changelog and pricing. I found no independent reviews of HD Photo Hub's team features. HD Photo Hub also runs a Classic and a New interface, plus an AI assistant called "Hubby".*

### 3.1 Accounts, roles and permissions

- **Account types:**
  - Business Owner (there can be several)
  - Team Member (one type for photographers, videographers, editors, admin assistants and schedulers)
  - Client
  - Group Admin (a brokerage manager who orders for every client in the group)
  - Assistant (supports a client and can't order)
- **Team member permissions:**
  - Checkboxes per person, for example "Modify/Cancel Orders".
  - Business-wide defaults, such as letting team members edit their own service areas and travel fees.
  - "Hide pricing from team members", which can be turned back on per person.
- **Copy a team member:** clones their products, pay rates, service areas, travel fees, permissions and market area, so onboarding a new photographer is quick.
- **Team Member Agreements:** NDAs, PTO policies and similar that staff must accept at login (again if the text changes), with an acceptance report.
- **Each team member chooses a calendar color.**
- **Unlimited team members** at no extra cost. Pricing is per delivery ($5 basic / $10 full), not per seat.

### 3.2 Scheduling and dispatch (their core strength)

- **Team Schedule:**
  - Day, Week and Month views, with **one column per team member**.
  - Drag and drop to reschedule or reassign. Dropping on another person's column opens a confirmation with an "Assign To" dropdown, and the drop respects real-time availability.
  - An "Unscheduled" bar to drag orders out of.
  - Travel bars between shoots showing drive time and "time to spare".
  - A per-person Google Maps route button.
  - A team display drawer to reorder or hide members.
- **Per-staff availability** (through each staff member's own two-way Google Calendar):
  - Weekly working hours with split shifts and breaks
  - Maximum appointments per day and maximum work hours per day
  - Earliest bookable day
  - Start-time interval
  - Extra drive-time buffer and maximum drive time between shoots
  - Avoid tolls and ferries
  - Personal Google events block availability.
- **Time off:** full day, partial day or twilight-only, entered for several people at once.
- **Service areas per staff member:**
  - Drive-distance or radius from the staff member's home, with priorities and bookable weekdays.
  - Map editing, with an overlay of other members' areas to check coverage.
  - Group-level overrides for brokerages and a fallback team member for uncovered areas.
- **Skills:** each staff member is enabled for specific products/services, and is only bookable for those.
- **Client self-booking:**
  - The online order cart shows real availability.
  - The business chooses one of three modes: the client picks a photographer, "First Available or pick one", or fully auto-assigned.
- **Auto-assign rules:**
  - The client's preferred photographer first.
  - Then service-area priority, then distance to the property.
  - Then a per-person "Scheduling Bias" number to favor senior shooters or hold back trainees.
  - Booking uses **calculated real drive time** (traffic-aware) between shoots.
- **Rescheduling:**
  - Uses real-time availability.
  - Clients can "Check More Photographers", which reassigns the shoot when they pick someone else.

### 3.3 Staff pay, mileage and tips

- **Per-product pay:** each team member has a pay amount for every service they offer, set individually or in bulk.
- **Per-task pay:** workflow tasks (for example an edit) can carry their own payout and assignee.
- **Travel pay:** team members get 90% of the client's travel fee by default, or a fixed per-area override.
- **Pay formulas ("Business Product Fees"):**
  - A formula engine for commissions, editor pay and expense deductions.
  - Conditions can use client, staff and product tags, client price, square footage and quantity.
- **Pay Team screen:**
  - Each member's completed tasks and earnings, manual bonuses or reimbursements, and grouped payouts.
  - A Payout Report with export.
  - No direct deposit, payroll integration or 1099 handling found.
- **Tips:**
  - Clients can tip at payment.
  - Tips are split among the staff on the job or kept by the business, with an optional business share.
  - Staff are emailed when they receive a tip.
- **Mileage Report per staff member:**
  - Home → first shoot, between shoots, last shoot → home.
  - Monthly, daily or detailed route views, with CSV download.
  - Calculated from addresses and routes, not GPS.
  - Marketed for tax records or extra pay; it isn't paid out automatically.

### 3.4 Field and workflow tools for staff

- **Mobile "Daily Schedule"** (mobile web):
  - The day's shoots in order, with drive times and "View in Maps".
  - Agent contact details and order notes (staff can add notes).
  - One-tap "Text: Arrived" / "Text: Leaving" SMS to the client.
  - Swipe to mark a service Done.
  - A mobile team schedule with day and week views.
- **Morning text message** to each staff member: the number of shoots today, the first start time, and a link to the day's schedule.
- **Workflow Tasks:**
  - Per-product or per-order tasks, each with an assignee, a payout and a due date.
  - Staff are emailed when a task is assigned, when it becomes ready (the step before it is done), and when it's due.
- **Editor handoff:**
  - Dropbox "Media Upload Folder" links so shooters upload raws without a Dropbox login.
  - Watched folders automatically import edited media back.
  - Integrations with Google Drive and outsourced editors (eSoft, AutoHDR).
- **Order management:** saved views filtered by assigned staff member, appointment date, status, media status, products, tasks and tags. There's also a dashboard order map; staff only see their own appointments on it, without pricing.
- **Hubby AI:**
  - Plain-language questions ("how many shoots did each team member complete last month?").
  - Automations, for example emailing the team tomorrow's appointments.
  - Respects each person's permissions and logs its actions.
- **Gaps on HD Photo Hub's side:**
  - The native mobile app is mainly for clients, and staff features there are "limited".
  - Calendar sync is Google only (no Outlook).
  - No 1099 or payroll integration.
  - No GPS mileage.
  - No push notifications for staff found.
  - No named role templates.

---

## Part 4: Side-by-side comparison

| Capability | ShootPortal today | HD Photo Hub |
|---|---|---|
| Staff seats | Unlimited, free | Unlimited, free |
| Permission detail | **30 detailed toggles plus 4 presets; strong money hiding** | Fewer, coarser checkboxes plus "hide pricing" |
| Staff only see their own jobs | Yes (unless View all) | Yes (their own appointments) |
| Named roles or role templates | No (presets only, no saved templates) | No (Team Member type only) |
| Copy a staff member's setup | No | Yes |
| Staff agreements (NDA, policies) | No | Yes |
| Multiple staff per job | Yes, no role per assignment | Yes, through product and task assignment |
| Assignment notification to staff | **No** | Yes (task emails, morning text) |
| Team schedule with a column per staff member | **No** | Yes (day, week, month) |
| Staff colors on the calendar | No | Yes |
| Drag to reassign between staff | No (drag only reschedules) | Yes |
| Per-staff availability / working hours | **No** | Yes |
| Time off / blackout dates | **No** | Yes |
| Per-staff Google Calendar sync | **No** (owner's calendar only) | Yes, two-way |
| Service areas / territories | **No** | Yes |
| Skills (who can shoot what) | **No** | Yes (products per member) |
| Auto-assign / first available | **No** | Yes, with priority, distance and bias rules |
| Client self-booking against staff availability | **No** (proposal back-and-forth) | Yes |
| Drive time between shoots | **No** | Yes (traffic-aware) |
| Conflict / double-booking checks | **No** | Yes (availability-based) |
| Staff pay rates | **No** | Per product, per task, travel share |
| Pay formulas / commissions | **No** | Yes |
| Payout tracking / reports | **No** | Pay Team plus Payout Report |
| Tips to staff | **No** | Yes |
| Mileage tracking | **No** | Per-staff Mileage Report (CSV) |
| 1099 / payroll integration | No | No |
| Mobile daily schedule for staff | **No** (just the filtered admin app) | Yes (route, maps, arrive/leave texts, mark done) |
| Morning schedule text or digest | **No** | Yes |
| Editor tasks and handoff | **No** | Workflow tasks, Dropbox folders, editor integrations |
| Staff push notifications | **No** (admins only) | Not found |
| Staff performance / analytics | **No** | Payout and task counts; AI questions |
| Owner-visible staff activity log | **No** | AI change audit log |
| Media delivery and client portal | **Strong**: branded portal, video review, marketing kit, media library, photo editor | Strong: delivery sites, marketing kit |
| Modern UI and permission safety | **Strong**: server-enforced row-level scoping and modern UI | Older UI being modernized |

---

## Part 5: What ShootPortal is missing (summary)

ShootPortal has a **solid, secure foundation**: real staff accounts, detailed permissions, assigned-only visibility, money hiding, multi-staff assignment, a filtered portal and app, and drag-to-reschedule. It's missing the layer that lets a multi-photographer business **run its operations**:

1. **Dispatch and scheduling intelligence:**
   - Staff availability and working hours
   - Time off
   - Per-staff calendar sync
   - Skills and service areas
   - Drive time and conflict checks
   - Auto-assign / first available
   - Client self-booking against real availability
2. **A team schedule view:** a calendar with a column (or color) per staff member, where you drag to reassign, plus an unassigned queue.
3. **Staff communication:**
   - Assignment and unassignment notifications
   - Daily or next-day schedule digests
   - Shoot reminders
   - Push or SMS for staff
4. **A field experience for staff:** a mobile "my day" view with ordered shoots, directions, client/agent contact, arrived/leaving texts, notes and mark-done.
5. **Staff compensation:**
   - Pay rates per service, job or task
   - Travel pay
   - Bonuses and reimbursements
   - Payout tracking and export
   - Tips
   - Mileage logs
   - Contractor info and 1099 readiness
6. **Production workflow:**
   - Role-based assignments (shooter, editor)
   - Editing tasks with due dates and handoff
   - Raw upload paths
   - Outsourced editor integrations
7. **Oversight:**
   - Owner-visible staff activity
   - "Who did what" on the activity feed
   - Workload, utilization and per-staff revenue reports
8. **Team admin conveniences:**
   - Saved permission templates and named roles
   - Copy a staff member
   - Staff agreements
   - Staff on the New Project form and Shoot Calendar
   - A read-only staff list on projects for people who can't manage staff

---

## Part 6: Constraints and what I want from you

**Constraints and principles**
- ShootPortal's selling points are a **modern, clean, intuitive UI**, a strongly **branded client experience**, and **safety**: server-enforced permissions with every business fully isolated from the others. New features should keep these.
- Keep staff **unlimited and free**, which matches HD Photo Hub.
- Changes must stay backward-compatible with existing businesses. Database changes must be additive (businesses that don't adopt a feature shouldn't notice it).
- Both the New and Classic interfaces exist. New features can target the New interface first.
- Google Calendar is currently one connection per business owned by the owner. Per-staff calendars would be a new integration layer.
- Shoots currently have **no duration field** (60-minute blocks) and there's **no service-level duration**. Drive-time and availability features would need durations.
- Simplicity matters. Small solo businesses (one owner, no staff) must not be burdened by team features.

**Questions to brainstorm**
1. What's the smallest, highest-impact set of staff features to build first so a 3–10 person team can run its day in ShootPortal?
2. How should a **Team Schedule** look and behave to be easier than HD Photo Hub's (per-staff columns, unassigned queue, drag to reassign, conflicts)?
3. How should **availability, time off, skills and service areas** be modeled and set up so setup is fast and not overwhelming?
4. How should **dispatch / auto-assign** work, and how should client self-booking interact with it?
5. How should **staff pay** work (per-service rates, travel share, bonuses, payout reports, tips, mileage), and how far should ShootPortal go toward payroll or 1099s?
6. What should the **staff mobile "my day" experience** include, and how should notifications work (assignment, morning digest, reminders, push/SMS)?
7. How should **editor workflows** (tasks, handoff, due dates) fit into the existing 8-stage project pipeline?
8. Where can ShootPortal go **beyond** HD Photo Hub, for example smarter suggestions, better mobile UX, clearer permissions, AI assistance, or client-facing photographer profiles?
9. What are the right **roles and templates** (Photographer, Editor, Coordinator, Manager) on top of the existing 30 permissions?
