# Staff Phase 1 — admin-check audit

DEFAULT DENY for `staff`. Central helpers (`requireAdmin`, `requireAdminApi`, `requireAdminPage`) remain **admin | super_admin only**.

Scope: every `profile`/`user`/`tenant`/`input` role comparison to `admin`, plus each `requireAdmin*` call site (inherits deny).

Excluded as non-access-control: `sender_role`, message UI labels, `audience === "admin"`, `visibility === "admin"`, partner landing `mode === "admin"`, product-demo fixtures, `proposed_by` string literals without a profile.role check.

| # | file:line | what it guards | staff allowed | reasoning |
|---|---|---|---|---|
| 1 | `src/app/admin/calendar/page.tsx:9` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 2 | `src/app/admin/clients/[id]/page.tsx:15` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 3 | `src/app/admin/clients/page.tsx:14` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 4 | `src/app/admin/layout.tsx:24` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 5 | `src/app/admin/leads/page.tsx:13` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 6 | `src/app/admin/media/page.tsx:11` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 7 | `src/app/admin/messages/page.tsx:7` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 8 | `src/app/admin/page.tsx:19` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 9 | `src/app/admin/projects/[id]/page.tsx:17` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 10 | `src/app/admin/projects/[id]/reviews/[reviewId]/page.tsx:14` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 11 | `src/app/admin/projects/[id]/reviews/asset/[assetId]/page.tsx:15` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 12 | `src/app/admin/projects/page.tsx:27` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 13 | `src/app/admin/settings/page.tsx:22` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 14 | `src/app/api/admin/custom-domain/route.ts:19` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 15 | `src/app/api/admin/custom-domain/route.ts:38` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 16 | `src/app/api/admin/email/domain/route.ts:22` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 17 | `src/app/api/admin/email/domain/verify/route.ts:10` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 18 | `src/app/api/admin/email/route.ts:9` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 19 | `src/app/api/admin/email/route.ts:119` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 20 | `src/app/api/admin/media/repair-orphans/route.ts:18` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 21 | `src/app/api/admin/media/repair-orphans/route.ts:29` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 22 | `src/app/api/admin/push/route.ts:9` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 23 | `src/app/api/admin/push/route.ts:33` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 24 | `src/app/api/admin/search/route.ts:18` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 25 | `src/app/api/admin/services/[id]/route.ts:17` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 26 | `src/app/api/admin/services/[id]/route.ts:80` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 27 | `src/app/api/admin/services/reorder/route.ts:9` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 28 | `src/app/api/admin/services/route.ts:30` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 29 | `src/app/api/admin/services/route.ts:40` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 30 | `src/app/api/admin/settings/logo/route.ts:96` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 31 | `src/app/api/admin/settings/route.ts:17` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 32 | `src/app/api/admin/settings/route.ts:33` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 33 | `src/app/api/asset-reviews/route.ts:168` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 34 | `src/app/api/billing/checkout/route.ts:28` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 35 | `src/app/api/billing/portal/route.ts:14` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 36 | `src/app/api/billing/promo-preview/route.ts:21` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 37 | `src/app/api/clients/[id]/notes/route.ts:11` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 38 | `src/app/api/clients/[id]/notes/route.ts:39` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 39 | `src/app/api/clients/[id]/notes/route.ts:73` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 40 | `src/app/api/clients/[id]/notes/route.ts:105` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 41 | `src/app/api/clients/[id]/portal/route.ts:15` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 42 | `src/app/api/clients/[id]/portal/route.ts:38` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 43 | `src/app/api/clients/[id]/portal-recovery/route.ts:14` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 44 | `src/app/api/clients/[id]/portal-recovery/route.ts:30` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 45 | `src/app/api/clients/[id]/projects/route.ts:12` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 46 | `src/app/api/clients/[id]/route.ts:12` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 47 | `src/app/api/clients/[id]/route.ts:36` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 48 | `src/app/api/clients/route.ts:8` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 49 | `src/app/api/clients/route.ts:57` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 50 | `src/app/api/clients/route.ts:129` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 51 | `src/app/api/leads/[id]/route.ts:11` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 52 | `src/app/api/leads/[id]/route.ts:30` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 53 | `src/app/api/media/[id]/property-line/route.ts:34` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 54 | `src/app/api/media/[id]/property-line/route.ts:106` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 55 | `src/app/api/media/[id]/route.ts:31` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 56 | `src/app/api/media/[id]/route.ts:136` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 57 | `src/app/api/media/bulk/route.ts:10` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 58 | `src/app/api/media/download/[id]/route.ts:60` | const isAdmin = profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | API mutation/read admin privilege — staff denied until permissions |
| 59 | `src/app/api/media/library/[id]/route.ts:17` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 60 | `src/app/api/media/library/route.ts:8` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 61 | `src/app/api/media/move-to-folder/route.ts:11` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 62 | `src/app/api/media/reorder/route.ts:13` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 63 | `src/app/api/media/thumbnails/route.ts:40` | const isAdmin = profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | API mutation/read admin privilege — staff denied until permissions |
| 64 | `src/app/api/media/upload/complete/route.ts:14` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 65 | `src/app/api/media/upload/route.ts:12` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 66 | `src/app/api/media/upload/sign/route.ts:12` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 67 | `src/app/api/media/youtube/route.ts:9` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 68 | `src/app/api/media-folders/route.ts:68` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 69 | `src/app/api/media-folders/route.ts:118` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 70 | `src/app/api/media-folders/route.ts:174` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 71 | `src/app/api/messages/route.ts:33` | if (profile.role === "admin" \|\| profile.role === "super_admin") { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 72 | `src/app/api/messages/route.ts:87` | const isAdmin = profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | API mutation/read admin privilege — staff denied until permissions |
| 73 | `src/app/api/messages/route.ts:222` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 74 | `src/app/api/onboarding/route.ts:21` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 75 | `src/app/api/onboarding/route.ts:83` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 76 | `src/app/api/payments/[id]/route.ts:13` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 77 | `src/app/api/payments/[id]/route.ts:71` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 78 | `src/app/api/payments/route.ts:15` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 79 | `src/app/api/project-3d-models/route.ts:11` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 80 | `src/app/api/project-3d-models/route.ts:77` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 81 | `src/app/api/project-3d-models/route.ts:132` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 82 | `src/app/api/project-clients/route.ts:9` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 83 | `src/app/api/project-clients/route.ts:39` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 84 | `src/app/api/project-clients/route.ts:130` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 85 | `src/app/api/projects/[id]/email-events/route.ts:13` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 86 | `src/app/api/projects/[id]/messages/route.ts:36` | if (profile.role === "admin" \|\| profile.role === "super_admin") { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 87 | `src/app/api/projects/[id]/messages/route.ts:80` | const isAdmin = profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | API mutation/read admin privilege — staff denied until permissions |
| 88 | `src/app/api/projects/[id]/messages/route.ts:198` | if (profile.role === "admin" \|\| profile.role === "super_admin") { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 89 | `src/app/api/projects/[id]/route.ts:12` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 90 | `src/app/api/projects/[id]/route.ts:36` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 91 | `src/app/api/projects/route.ts:41` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 92 | `src/app/api/projects/route.ts:148` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 93 | `src/app/api/quotes/route.ts:53` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 94 | `src/app/api/quotes/route.ts:152` | const cookie = (profile.role === "admin" \|\| profile.role === "super_admin") ? null : await createCli | **no** | API mutation/read admin privilege — staff denied until permissions |
| 95 | `src/app/api/quotes/route.ts:162` | if (action === "send" && (profile.role === "admin" \|\| profile.role === "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 96 | `src/app/api/quotes/route.ts:231` | if (action === "convert_to_official" && (profile.role === "admin" \|\| profile.role === "super_admin") | **no** | API mutation/read admin privilege — staff denied until permissions |
| 97 | `src/app/api/quotes/route.ts:407` | if (action === "update" && (profile.role === "admin" \|\| profile.role === "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 98 | `src/app/api/quotes/route.ts:444` | if (action === "duplicate" && (profile.role === "admin" \|\| profile.role === "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 99 | `src/app/api/revisions/route.ts:121` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 100 | `src/app/api/shoot-proposals/route.ts:68` | const isAdmin = profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | API mutation/read admin privilege — staff denied until permissions |
| 101 | `src/app/api/shoot-proposals/route.ts:213` | const isAdmin = profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | API mutation/read admin privilege — staff denied until permissions |
| 102 | `src/app/api/stripe/connect/callback/route.ts:35` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 103 | `src/app/api/stripe/connect/callback/route.ts:41` | profile.role === "admin" && | **no** | Stripe Connect is business-owner admin only |
| 104 | `src/app/api/stripe/connect/refresh/route.ts:30` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 105 | `src/app/api/stripe/connect/refresh/route.ts:36` | profile.role === "admin" && | **no** | Stripe Connect is business-owner admin only |
| 106 | `src/app/api/stripe/connect/route.ts:18` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 107 | `src/app/api/stripe/connect/route.ts:31` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 108 | `src/app/api/tours/route.ts:24` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 109 | `src/app/api/tours/route.ts:83` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 110 | `src/app/api/tours/route.ts:107` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 111 | `src/app/api/video-reviews/[id]/versions/route.ts:13` | if (!profile \|\| (profile.role !== "admin" && profile.role !== "super_admin")) { | **no** | API mutation/read admin privilege — staff denied until permissions |
| 112 | `src/app/auth/confirm/verify/route.ts:111` | } else if (profile?.role === "admin") { | **no** | Post-confirm dest for admins — staff → /staff |
| 113 | `src/app/billing/page.tsx:43` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 114 | `src/app/dashboard/messages/page.tsx:9` | if (profile.role === "admin") redirect("/admin/messages"); | **no** | UI routing treating admin specially — staff has /staff home |
| 115 | `src/app/dashboard/page.tsx:34` | if (profile.role === "admin") redirect("/admin"); | **no** | UI routing treating admin specially — staff has /staff home |
| 116 | `src/app/dashboard/projects/[id]/page.tsx:51` | if (profile.role === "admin" && !preview) { | **no** | UI routing treating admin specially — staff has /staff home |
| 117 | `src/app/dashboard/projects/[id]/page.tsx:161` | const isAdminViewer = profile.role === "admin"; | **no** | UI routing treating admin specially — staff has /staff home |
| 118 | `src/app/dashboard/projects/[id]/page.tsx:214` | isPreview={preview && profile.role === "admin"} | **no** | UI routing treating admin specially — staff has /staff home |
| 119 | `src/app/dashboard/projects/[id]/page.tsx:215` | isAdmin={profile.role === "admin"} | **no** | UI routing treating admin specially — staff has /staff home |
| 120 | `src/app/dashboard/projects/[id]/reviews/[reviewId]/page.tsx:43` | <Header variant="dashboard" userRole={profile.role === "admin" ? "admin" : "client"} /> | **no** | UI routing treating admin specially — staff has /staff home |
| 121 | `src/app/dashboard/projects/[id]/reviews/asset/[assetId]/page.tsx:77` | <Header variant="dashboard" userRole={profile.role === "admin" ? "admin" : "client"} /> | **no** | UI routing treating admin specially — staff has /staff home |
| 122 | `src/app/dashboard/settings/page.tsx:10` | if (profile.role === "admin") redirect("/admin"); | **no** | UI routing treating admin specially — staff has /staff home |
| 123 | `src/app/onboarding/page.tsx:24` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 124 | `src/components/admin/push-notifications-card.tsx:87` | if (profile?.role !== "admin" && profile?.role !== "super_admin") { | **no** | Admin-only settings card |
| 125 | `src/components/auth/safe-home-link.tsx:45` | } else if (profile.role === "admin") { | **no** | UI routing treating admin specially — staff has /staff home |
| 126 | `src/components/partner/partner-dashboard-shell.tsx:37` | const hasBusiness = caps.business.active && caps.business.role === "admin"; | **no** | Detects business-admin capability for nav — staff is not business admin |
| 127 | `src/lib/admin-access.ts:14` | redirect(profile.role === "admin" ? "/admin" : "/dashboard"); | **no** | Page gate / redirect — staff → /staff, never /admin |
| 128 | `src/lib/admin-access.ts:26` | Central admin gate definition | **no** | Staff must not pass; keep admin\|super_admin only |
| 129 | `src/lib/admin-access.ts:38` | if (profile.role !== "admin") { | **no** | Page gate / redirect — staff → /staff, never /admin |
| 130 | `src/lib/api-auth.ts:10` | Central admin gate definition | **no** | Staff must not pass; keep admin\|super_admin only |
| 131 | `src/lib/api-auth.ts:62` | if (profile.role !== "admin" && profile.role !== "super_admin") { | **no** | Default deny — admin-only capability |
| 132 | `src/lib/api-auth.ts:73` | Calls requireAdmin* — admin API/page gate | **no** | Inherits requireAdmin deny for staff |
| 133 | `src/lib/auth-login-resolve.ts:99` | .update({ business_id: client.business_id, role: profile.role === "admin" ? "admin" : "client" }) | **no** | Must not demote/promote staff when linking clients — preserve staff role (separate fix); comparison itself must not grant admin |
| 134 | `src/lib/auth-login-resolve.ts:124` | role: profile.role === "admin" ? "admin" : "client", | **no** | Must not demote/promote staff when linking clients — preserve staff role (separate fix); comparison itself must not grant admin |
| 135 | `src/lib/auth-login-resolve.ts:153` | role: profile.role === "admin" ? "admin" : "client", | **no** | Must not demote/promote staff when linking clients — preserve staff role (separate fix); comparison itself must not grant admin |
| 136 | `src/lib/auth-login-resolve.ts:220` | profile.role === "admin" ? (needsWizard ? "/onboarding" : "/admin") : "/dashboard"; | **no** | Login dest: admin→/admin; staff must go to /staff (not /dashboard client shell as full access) |
| 137 | `src/lib/auth-resend-link.ts:53` | if (profile.business_id !== options.businessId \|\| profile.role !== "admin") { | **no** | Admin invite/recovery identity — staff is not a business admin |
| 138 | `src/lib/auth-resend-link.ts:84` | if (profile.role !== "admin" && profile.role !== "super_admin") { | **no** | Admin invite/recovery identity — staff is not a business admin |
| 139 | `src/lib/auth-resend-link.ts:120` | if (!user.email_confirmed_at && profile.role === "admin") { | **no** | Admin invite/recovery identity — staff is not a business admin |
| 140 | `src/lib/auth.ts:127` | Central admin gate definition | **no** | Staff must not pass; keep admin\|super_admin only |
| 141 | `src/lib/auth.ts:129` | if (profile.role !== "admin" && profile.role !== "super_admin") { | **no** | Default deny — admin-only capability |
| 142 | `src/lib/capabilities.ts:81` | if (profile.business_id && (profile.role === "admin" \|\| profile.role === "client")) { | **no** | Business capability membership — staff need a non-admin membership branch (handled separately); this comparison must NOT treat staff as admin |
| 143 | `src/lib/capabilities.ts:87` | role: profile.role === "admin" ? "admin" : "client", | **no** | Default deny — admin-only capability |
| 144 | `src/lib/capabilities.ts:156` | const isBusinessAdmin = caps.business.active && caps.business.role === "admin"; | **no** | Default deny — admin-only capability |
| 145 | `src/lib/client-portal-link.ts:17` | if (profile.role === "admin") return profile.business_id === businessId; | **no** | Admin may manage portal links for others; staff must not |
| 146 | `src/lib/client-portal-link.ts:64` | if (profile.role !== "admin" && profile.client_id !== client.id) { | **no** | Admin may manage portal links for others; staff must not |
| 147 | `src/lib/client-portal-link.ts:66` | } else if (profile.role === "admin" && profile.client_id !== client.id) { | **no** | Admin may manage portal links for others; staff must not |
| 148 | `src/lib/client-portal-link.ts:109` | if (profileByEmail.role !== "admin") { | **no** | Admin may manage portal links for others; staff must not |
| 149 | `src/lib/client-portal-link.ts:176` | if (existingProfile.role !== "admin") { | **no** | Admin may manage portal links for others; staff must not |
| 150 | `src/lib/media-asset-access.ts:15` | Defines admin helper (admin\|super_admin) | **no** | Default deny — staff must not inherit via this helper until permissions UI |
| 151 | `src/lib/media-asset-access.ts:16` | return profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | Full project/media/review admin powers — phase 1 staff has none |
| 152 | `src/lib/notifications.ts:327` | allowInApp && (user.role === "admin" \|\| user.in_app_notifications_enabled !== false); | **no** | Admin notification defaults — staff prefs TBD; do not auto-enable admin channels |
| 153 | `src/lib/notifications.ts:355` | if (user.role === "admin") { | **no** | Admin notification defaults — staff prefs TBD; do not auto-enable admin channels |
| 154 | `src/lib/onboarding.ts:155` | if (input.role !== "admin") return false; | **no** | Onboarding wizard is owner/admin only |
| 155 | `src/lib/onboarding.ts:183` | if (input.role !== "admin") return false; | **no** | Onboarding wizard is owner/admin only |
| 156 | `src/lib/platform-admin-recovery.ts:20` | if (!profile \|\| profile.role !== "admin" \|\| profile.business_id !== businessId) { | **no** | Admin invite/recovery identity — staff is not a business admin |
| 157 | `src/lib/project-access.ts:20` | (profile.role === "admin" \|\| profile.role === "super_admin") && | **no** | Full project/media/review admin powers — phase 1 staff has none |
| 158 | `src/lib/project-shares.ts:475` | if (profile.business_id \|\| profile.role === "admin" \|\| profile.role === "super_admin") { | **no** | Blocks share-viewer bootstrap for admins — staff with business_id already scoped; do not treat as share viewer, but also not admin |
| 159 | `src/lib/project-zip-download.ts:633` | const isAdmin = profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | Full project/media/review admin powers — phase 1 staff has none |
| 160 | `src/lib/supabase/middleware.ts:401` | profile?.role === "admin" && | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 161 | `src/lib/supabase/middleware.ts:405` | profile?.role === "admin" && | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 162 | `src/lib/supabase/middleware.ts:416` | : profile?.role === "admin" | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 163 | `src/lib/supabase/middleware.ts:500` | if (profile?.role !== "admin" && profile?.role !== "super_admin") { | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 164 | `src/lib/supabase/middleware.ts:517` | if (!isApi && profile?.role === "admin" && ownBusiness) { | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 165 | `src/lib/supabase/middleware.ts:548` | if (profile?.role !== "admin" && profile?.role !== "super_admin") { | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 166 | `src/lib/supabase/middleware.ts:568` | if (profile?.role !== "admin" && profile?.role !== "super_admin") { | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 167 | `src/lib/supabase/middleware.ts:592` | if (profile.role === "admin") { | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 168 | `src/lib/supabase/middleware.ts:637` | profile?.role === "admin" | **no** | Route protection for /admin,/billing,/onboarding — staff denied |
| 169 | `src/lib/tenant.ts:224` | if (tenant.role !== "admin" && tenant.role !== "super_admin") { | **no** | Tenant admin assertion |
| 170 | `src/lib/video-review-access.ts:15` | Defines admin helper (admin\|super_admin) | **no** | Default deny — staff must not inherit via this helper until permissions UI |
| 171 | `src/lib/video-review-access.ts:16` | return profile.role === "admin" \|\| profile.role === "super_admin"; | **no** | Full project/media/review admin powers — phase 1 staff has none |
| 172 | `src/lib/video-review-notifications.ts:59` | role === "admin" | **no** | Admin notification defaults — staff prefs TBD; do not auto-enable admin channels |

**Total enumerated checks: 172**

## Unclassified / needs care

None left unclassified — all default to **no**. Items that need a *non-admin* staff-aware branch (still not granting admin) are called out in reasoning: `capabilities.ts` membership, `auth-login-resolve.ts` destination + role preserve, middleware `/staff` allowlist, confirm/verify dest.

## requireAdmin call-site note

Every `requireAdmin()` / `requireAdminApi()` / `requireAdminPage()` call inherits **staff allowed: no** via the central helpers. Those call sites are listed above when the call appears on its own line.

