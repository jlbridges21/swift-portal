# Staff Phase 3 — enforcement audit

Maps the Phase 1 **172** admin-check inventory to the permission key (or **admin only**) enforced in Phase 3.

Source: `docs/STAFF-PHASE1-ADMIN-CHECK-AUDIT.md` + current `staffCan` / `requireAdminApi` / `requireAdminPage` / `adminOnly` gates.

| # | file:line | permission key / gate | notes |
|---|---|---|---|
| 1 | `src/app/admin/calendar/page.tsx:9` | **area.calendar** | const { tenant } = await requireAdminPage({ area: 'calendar' }); |
| 2 | `src/app/admin/clients/[id]/page.tsx:15` | **area.clients** | const { profile, tenant } = await requireAdminPage({ area: "clients" }); |
| 3 | `src/app/admin/clients/page.tsx:14` | **area.clients** | const { tenant } = await requireAdminPage({ area: 'clients' }); |
| 4 | `src/app/admin/layout.tsx:24` | **anyArea** (shell) | const { profile, tenant } = await requireAdminPage(); |
| 5 | `src/app/admin/leads/page.tsx:13` | **admin only** | const { tenant } = await requireAdminPage({ adminOnly: true }); |
| 6 | `src/app/admin/media/page.tsx:11` | **area.media** | const { tenant } = await requireAdminPage({ area: 'media' }); |
| 7 | `src/app/admin/messages/page.tsx:7` | **area.messages** | await requireAdminPage({ area: 'messages' }); |
| 8 | `src/app/admin/page.tsx:19` | **anyArea** (shell) | const { profile, tenant } = await requireAdminPage(); |
| 9 | `src/app/admin/projects/[id]/page.tsx:17` | **area.projects** | const { profile, tenant } = await requireAdminPage({ area: "projects" }); |
| 10 | `src/app/admin/projects/[id]/reviews/[reviewId]/page.tsx:14` | **area.projects** | const { tenant, profile } = await requireAdminPage({ area: 'projects' }); |
| 11 | `src/app/admin/projects/[id]/reviews/asset/[assetId]/page.tsx:15` | **area.projects** | const { tenant, profile } = await requireAdminPage({ area: 'projects' }); |
| 12 | `src/app/admin/projects/page.tsx:27` | **area.projects** | const { profile, tenant } = await requireAdminPage({ area: "projects" }); |
| 13 | `src/app/admin/settings/page.tsx:22` | **admin only** | const { tenant } = await requireAdminPage({ adminOnly: true }); |
| 14 | `src/app/api/admin/custom-domain/route.ts:19` | **admin only** | if (!profile \ |
| 15 | `src/app/api/admin/custom-domain/route.ts:38` | **admin only** | if (!profile \ |
| 16 | `src/app/api/admin/email/domain/route.ts:22` | **admin only** | if (!profile \ |
| 17 | `src/app/api/admin/email/domain/verify/route.ts:10` | **admin only** | if (!profile \ |
| 18 | `src/app/api/admin/email/route.ts:9` | **admin only** | if (!profile \ |
| 19 | `src/app/api/admin/email/route.ts:119` | **admin only** | if (!profile \ |
| 20 | `src/app/api/admin/media/repair-orphans/route.ts:18` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 21 | `src/app/api/admin/media/repair-orphans/route.ts:29` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 22 | `src/app/api/admin/push/route.ts:9` | **admin only** | if (!profile \ |
| 23 | `src/app/api/admin/push/route.ts:33` | **admin only** | if (!profile \ |
| 24 | `src/app/api/admin/search/route.ts:18` | **admin only** | const profile = await requireAdmin({ anyArea: true }); |
| 25 | `src/app/api/admin/services/[id]/route.ts:17` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 26 | `src/app/api/admin/services/[id]/route.ts:80` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 27 | `src/app/api/admin/services/reorder/route.ts:9` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 28 | `src/app/api/admin/services/route.ts:30` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 29 | `src/app/api/admin/services/route.ts:40` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 30 | `src/app/api/admin/settings/logo/route.ts:96` | **admin only** | if (!profile \ |
| 31 | `src/app/api/admin/settings/route.ts:17` | **admin only** | if (!profile \ |
| 32 | `src/app/api/admin/settings/route.ts:33` | **admin only** | if (!profile \ |
| 33 | `src/app/api/asset-reviews/route.ts:168` | **projects.edit** | if (!profile \|\| !(isOwnerAdmin(profile) \|\| staffCan(profile, "projects.edit"))) { |
| 34 | `src/app/api/billing/checkout/route.ts:28` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 35 | `src/app/api/billing/portal/route.ts:14` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 36 | `src/app/api/billing/promo-preview/route.ts:21` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 37 | `src/app/api/clients/[id]/notes/route.ts:11` | **clients.edit** | const profile = await requireAdmin({ permission: 'clients.edit' }); |
| 38 | `src/app/api/clients/[id]/notes/route.ts:39` | **clients.edit** | const profile = await requireAdmin({ permission: 'clients.edit' }); |
| 39 | `src/app/api/clients/[id]/notes/route.ts:73` | **clients.edit** | const profile = await requireAdmin({ permission: 'clients.edit' }); |
| 40 | `src/app/api/clients/[id]/notes/route.ts:105` | **clients.edit** | const profile = await requireAdmin({ permission: 'clients.edit' }); |
| 41 | `src/app/api/clients/[id]/portal/route.ts:15` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 42 | `src/app/api/clients/[id]/portal/route.ts:38` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 43 | `src/app/api/clients/[id]/portal-recovery/route.ts:14` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 44 | `src/app/api/clients/[id]/portal-recovery/route.ts:30` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 45 | `src/app/api/clients/[id]/projects/route.ts:12` | **area.clients** | const profile = await requireAdmin({ area: 'clients' }); |
| 46 | `src/app/api/clients/[id]/route.ts:12` | **clients.edit** | const profile = await requireAdmin({ permission: 'clients.edit' }); |
| 47 | `src/app/api/clients/[id]/route.ts:36` | **clients.edit** | const profile = await requireAdmin({ permission: 'clients.edit' }); |
| 48 | `src/app/api/clients/route.ts:8` | **area.clients** | const profile = await requireAdmin({ area: 'clients' }); |
| 49 | `src/app/api/clients/route.ts:57` | **clients.create** | const profile = await requireAdmin({ permission: 'clients.create' }); |
| 50 | `src/app/api/clients/route.ts:129` | **clients.edit** | const profile = await requireAdmin({ permission: 'clients.edit' }); |
| 51 | `src/app/api/leads/[id]/route.ts:11` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 52 | `src/app/api/leads/[id]/route.ts:30` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 53 | `src/app/api/media/[id]/property-line/route.ts:34` | **area.media** | const auth = await requireAdminApi({ area: 'media' }); |
| 54 | `src/app/api/media/[id]/property-line/route.ts:106` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 55 | `src/app/api/media/[id]/route.ts:31` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 56 | `src/app/api/media/[id]/route.ts:136` | **media.delete** | const auth = await requireAdminApi({ permission: 'media.delete' }); |
| 57 | `src/app/api/media/bulk/route.ts:10` | **area.media** | const profile = await requireAdmin({ permission: ['media.delete', 'media.organize'] }); |
| 58 | `src/app/api/media/download/[id]/route.ts:60` | **area.media** | const isAdmin = isOwnerAdmin(profile) \|\| staffCan(profile, "area.media"); |
| 59 | `src/app/api/media/library/[id]/route.ts:17` | **area.media** | const profile = await requireAdmin({ area: 'media' }); |
| 60 | `src/app/api/media/library/route.ts:8` | **area.media** | const profile = await requireAdmin({ area: 'media' }); |
| 61 | `src/app/api/media/move-to-folder/route.ts:11` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 62 | `src/app/api/media/reorder/route.ts:13` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 63 | `src/app/api/media/thumbnails/route.ts:40` | **area.media** | const isAdmin = isOwnerAdmin(profile) \|\| staffCan(profile, "area.media"); |
| 64 | `src/app/api/media/upload/complete/route.ts:14` | **media.upload** | const auth = await requireAdminApi({ permission: 'media.upload' }); |
| 65 | `src/app/api/media/upload/route.ts:12` | **media.upload** | const auth = await requireAdminApi({ permission: 'media.upload' }); |
| 66 | `src/app/api/media/upload/sign/route.ts:12` | **media.upload** | const auth = await requireAdminApi({ permission: 'media.upload' }); |
| 67 | `src/app/api/media/youtube/route.ts:9` | **media.upload** | const auth = await requireAdminApi({ permission: 'media.upload' }); |
| 68 | `src/app/api/media-folders/route.ts:68` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 69 | `src/app/api/media-folders/route.ts:118` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 70 | `src/app/api/media-folders/route.ts:174` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 71 | `src/app/api/messages/route.ts:33` | **area.messages** | if (isOwnerAdmin(profile) \|\| staffCan(profile, "area.messages")) { |
| 72 | `src/app/api/messages/route.ts:87` | **messages.send** | const isAdmin = isOwnerAdmin(profile) \|\| staffCan(profile, "messages.send"); |
| 73 | `src/app/api/messages/route.ts:222` | **area.messages** | const auth = await requireAdminApi({ area: 'messages' }); |
| 74 | `src/app/api/onboarding/route.ts:21` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 75 | `src/app/api/onboarding/route.ts:83` | **admin only** | const auth = await requireAdminApi({ adminOnly: true }); |
| 76 | `src/app/api/payments/[id]/route.ts:13` | **money.mark_paid** | const profile = await requireAdmin({ permission: 'money.mark_paid' }); |
| 77 | `src/app/api/payments/[id]/route.ts:71` | **money.send_payment_links** | const profile = await requireAdmin({ permission: 'money.send_payment_links' }); |
| 78 | `src/app/api/payments/route.ts:15` | **money.send_payment_links** | const profile = await requireAdmin({ permission: 'money.send_payment_links' }); |
| 79 | `src/app/api/project-3d-models/route.ts:11` | **media.upload** | const auth = await requireAdminApi({ permission: 'media.upload' }); |
| 80 | `src/app/api/project-3d-models/route.ts:77` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 81 | `src/app/api/project-3d-models/route.ts:132` | **media.delete** | const auth = await requireAdminApi({ permission: 'media.delete' }); |
| 82 | `src/app/api/project-clients/route.ts:9` | **area.clients** | const auth = await requireAdminApi({ area: 'clients' }); |
| 83 | `src/app/api/project-clients/route.ts:39` | **clients.add_to_projects** | const auth = await requireAdminApi({ permission: 'clients.add_to_projects' }); |
| 84 | `src/app/api/project-clients/route.ts:130` | **clients.add_to_projects** | const auth = await requireAdminApi({ permission: 'clients.add_to_projects' }); |
| 85 | `src/app/api/projects/[id]/email-events/route.ts:13` | **area.projects** | const profile = await requireAdmin({ area: 'projects' }); |
| 86 | `src/app/api/projects/[id]/messages/route.ts:36` | **area.messages** | const hasAccess = await canAccessProject(profile, projectId); |
| 87 | `src/app/api/projects/[id]/messages/route.ts:80` | **messages.send** | const isAdmin = isOwnerAdmin(profile) \|\| staffCan(profile, "messages.send"); |
| 88 | `src/app/api/projects/[id]/messages/route.ts:198` | **area.messages** | if (isOwnerAdmin(profile) \|\| staffCan(profile, "area.messages")) { |
| 89 | `src/app/api/projects/[id]/route.ts:12` | **projects.delete** | const profile = await requireAdmin({ permission: 'projects.delete' }); |
| 90 | `src/app/api/projects/[id]/route.ts:36` | **projects.edit** | const profile = await requireAdmin({ permission: 'projects.edit' }); |
| 91 | `src/app/api/projects/route.ts:41` | **projects.create** | const profile = await requireAdmin({ permission: 'projects.create' }); |
| 92 | `src/app/api/projects/route.ts:148` | **area.projects** | Calls requireAdmin* — admin API/page gate |
| 93 | `src/app/api/quotes/route.ts:53` | **money.create_send_estimates** | if (!profile \|\| !(isOwnerAdmin(profile) \|\| staffCan(profile, "money.create_send_estimates"))) { |
| 94 | `src/app/api/quotes/route.ts:152` | **money.view** | const cookie = (isOwnerAdmin(profile) \|\| staffCan(profile, "money.view") \|\| staffCan(profile, "money.creat |
| 95 | `src/app/api/quotes/route.ts:162` | **money.create_send_estimates** | if (action === "send" && (isOwnerAdmin(profile) \|\| staffCan(profile, "money.create_send_estimates"))) { |
| 96 | `src/app/api/quotes/route.ts:231` | **money.create_send_estimates** | if (action === "convert_to_official" && (isOwnerAdmin(profile) \|\| staffCan(profile, "money.create_send_estim |
| 97 | `src/app/api/quotes/route.ts:407` | **money.create_send_estimates** | if (action === "update" && (isOwnerAdmin(profile) \|\| staffCan(profile, "money.create_send_estimates"))) { |
| 98 | `src/app/api/quotes/route.ts:444` | **money.create_send_estimates** | if (action === "duplicate" && (isOwnerAdmin(profile) \|\| staffCan(profile, "money.create_send_estimates"))) { |
| 99 | `src/app/api/revisions/route.ts:121` | **projects.edit** | if (!profile \|\| !(isOwnerAdmin(profile) \|\| staffCan(profile, "projects.edit"))) { |
| 100 | `src/app/api/shoot-proposals/route.ts:68` | **scheduling.propose** | const isAdmin = isOwnerAdmin(profile) \|\| staffCan(profile, "scheduling.propose"); |
| 101 | `src/app/api/shoot-proposals/route.ts:213` | **scheduling.propose** | staffCan(profile, "scheduling.propose") \|\| |
| 102 | `src/app/api/stripe/connect/callback/route.ts:35` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 103 | `src/app/api/stripe/connect/callback/route.ts:41` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 104 | `src/app/api/stripe/connect/refresh/route.ts:30` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 105 | `src/app/api/stripe/connect/refresh/route.ts:36` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 106 | `src/app/api/stripe/connect/route.ts:18` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 107 | `src/app/api/stripe/connect/route.ts:31` | **admin only** | const profile = await requireAdmin({ adminOnly: true }); |
| 108 | `src/app/api/tours/route.ts:24` | **media.upload** | const auth = await requireAdminApi({ permission: 'media.upload' }); |
| 109 | `src/app/api/tours/route.ts:83` | **media.organize** | const auth = await requireAdminApi({ permission: 'media.organize' }); |
| 110 | `src/app/api/tours/route.ts:107` | **media.delete** | const auth = await requireAdminApi({ permission: 'media.delete' }); |
| 111 | `src/app/api/video-reviews/[id]/versions/route.ts:13` | **video_review.upload_versions** | if (!profile \|\| !(isOwnerAdmin(profile) \|\| staffCan(profile, "video_review.upload_versions"))) { |
| 112 | `src/app/auth/confirm/verify/route.ts:111` | **admin only** | } else if (profile?.role === "admin") { |
| 113 | `src/app/billing/page.tsx:43` | **admin only** | const { tenant } = await requireAdminPage({ adminOnly: true }); |
| 114 | `src/app/dashboard/messages/page.tsx:9` | **area.messages** | if (profile.role === "admin") redirect("/admin/messages"); |
| 115 | `src/app/dashboard/page.tsx:34` | **admin only** | if (profile.role === "admin") redirect("/admin"); |
| 116 | `src/app/dashboard/projects/[id]/page.tsx:51` | **area.projects** | if (profile.role === "admin" && !preview) { |
| 117 | `src/app/dashboard/projects/[id]/page.tsx:161` | **area.projects** | const isAdminViewer = profile.role === "admin"; |
| 118 | `src/app/dashboard/projects/[id]/page.tsx:214` | **area.projects** | isPreview={preview && profile.role === "admin"} |
| 119 | `src/app/dashboard/projects/[id]/page.tsx:215` | **area.projects** | isAdmin={profile.role === "admin"} |
| 120 | `src/app/dashboard/projects/[id]/reviews/[reviewId]/page.tsx:43` | **area.projects** | <Header variant="dashboard" userRole={profile.role === "admin" ? "admin" : "client"} /> |
| 121 | `src/app/dashboard/projects/[id]/reviews/asset/[assetId]/page.tsx:77` | **area.projects** | <Header variant="dashboard" userRole={profile.role === "admin" ? "admin" : "client"} /> |
| 122 | `src/app/dashboard/settings/page.tsx:10` | **admin only** | if (profile.role === "admin") redirect("/admin"); |
| 123 | `src/app/onboarding/page.tsx:24` | **admin only** | const { profile, tenant } = await requireAdminPage({ adminOnly: true }); |
| 124 | `src/components/admin/push-notifications-card.tsx:87` | **admin only** | if (profile?.role !== "admin" && profile?.role !== "super_admin") { |
| 125 | `src/components/auth/safe-home-link.tsx:45` | **admin only** | } else if (profile.role === "admin") { |
| 126 | `src/components/partner/partner-dashboard-shell.tsx:37` | **admin only** | const hasBusiness = caps.business.active && caps.business.role === "admin"; |
| 127 | `src/lib/admin-access.ts:14` | **(path / helper)** | redirect(profile.role === "admin" ? "/admin" : "/dashboard"); |
| 128 | `src/lib/admin-access.ts:26` | **(path / helper)** | Central admin gate definition |
| 129 | `src/lib/admin-access.ts:38` | **(path / helper)** | if (profile.role !== "admin") { |
| 130 | `src/lib/api-auth.ts:10` | **admin only** | Central admin gate definition |
| 131 | `src/lib/api-auth.ts:62` | **admin only** | if (profile.role !== "admin" && profile.role !== "super_admin") { |
| 132 | `src/lib/api-auth.ts:73` | **admin only** | Calls requireAdmin* — admin API/page gate |
| 133 | `src/lib/auth-login-resolve.ts:99` | **admin only** | .update({ business_id: client.business_id, role: profile.role === "admin" ? "admin" : "client" }) |
| 134 | `src/lib/auth-login-resolve.ts:124` | **admin only** | role: profile.role === "admin" ? "admin" : "client", |
| 135 | `src/lib/auth-login-resolve.ts:153` | **admin only** | role: profile.role === "admin" ? "admin" : "client", |
| 136 | `src/lib/auth-login-resolve.ts:220` | **admin only** | profile.role === "admin" ? (needsWizard ? "/onboarding" : "/admin") : "/dashboard"; |
| 137 | `src/lib/auth-resend-link.ts:53` | **admin only** | if (profile.business_id !== options.businessId \ |
| 138 | `src/lib/auth-resend-link.ts:84` | **admin only** | if (profile.role !== "admin" && profile.role !== "super_admin") { |
| 139 | `src/lib/auth-resend-link.ts:120` | **admin only** | if (!user.email_confirmed_at && profile.role === "admin") { |
| 140 | `src/lib/auth.ts:127` | **admin only** | Central admin gate definition |
| 141 | `src/lib/auth.ts:129` | **admin only** | if (profile.role !== "admin" && profile.role !== "super_admin") { |
| 142 | `src/lib/capabilities.ts:81` | **admin only** | if (profile.business_id && (profile.role === "admin" \ |
| 143 | `src/lib/capabilities.ts:87` | **admin only** | role: profile.role === "admin" ? "admin" : "client", |
| 144 | `src/lib/capabilities.ts:156` | **admin only** | const isBusinessAdmin = caps.business.active && caps.business.role === "admin"; |
| 145 | `src/lib/client-portal-link.ts:17` | **admin only** | if (profile.role === "admin") return profile.business_id === businessId; |
| 146 | `src/lib/client-portal-link.ts:64` | **admin only** | if (profile.role !== "admin" && profile.client_id !== client.id) { |
| 147 | `src/lib/client-portal-link.ts:66` | **admin only** | } else if (profile.role === "admin" && profile.client_id !== client.id) { |
| 148 | `src/lib/client-portal-link.ts:109` | **admin only** | if (profileByEmail.role !== "admin") { |
| 149 | `src/lib/client-portal-link.ts:176` | **admin only** | if (existingProfile.role !== "admin") { |
| 150 | `src/lib/media-asset-access.ts:15` | **area.media** | return isOwnerAdmin(profile) \|\| staffCan(profile, "area.media"); |
| 151 | `src/lib/media-asset-access.ts:16` | **area.media** | return isOwnerAdmin(profile) \|\| staffCan(profile, "area.media"); |
| 152 | `src/lib/notifications.ts:327` | **(path / helper)** | allowInApp && (user.role === "admin" \ |
| 153 | `src/lib/notifications.ts:355` | **(path / helper)** | if (user.role === "admin") { |
| 154 | `src/lib/onboarding.ts:155` | **admin only** | if (input.role !== "admin") return false; |
| 155 | `src/lib/onboarding.ts:183` | **admin only** | if (input.role !== "admin") return false; |
| 156 | `src/lib/platform-admin-recovery.ts:20` | **admin only** | if (!profile \ |
| 157 | `src/lib/project-access.ts:20` | **admin only** | (profile.role === "admin" \ |
| 158 | `src/lib/project-shares.ts:475` | **area.projects** | if (profile.business_id \ |
| 159 | `src/lib/project-zip-download.ts:633` | **area.media** | const isAdmin = isOwnerAdmin(profile) \|\| staffCan(profile, "area.media") \|\| staffCan(profile, "media.downl |
| 160 | `src/lib/supabase/middleware.ts:401` | **(path / helper)** | profile?.role === "admin" && |
| 161 | `src/lib/supabase/middleware.ts:405` | **(path / helper)** | profile?.role === "admin" && |
| 162 | `src/lib/supabase/middleware.ts:416` | **(path / helper)** | : profile?.role === "admin" |
| 163 | `src/lib/supabase/middleware.ts:500` | **(path / helper)** | if (profile?.role !== "admin" && profile?.role !== "super_admin") { |
| 164 | `src/lib/supabase/middleware.ts:517` | **(path / helper)** | if (!isApi && profile?.role === "admin" && ownBusiness) { |
| 165 | `src/lib/supabase/middleware.ts:548` | **(path / helper)** | staffMayAccessAdminPath(staffProfile, path); |
| 166 | `src/lib/supabase/middleware.ts:568` | **(path / helper)** | if (profile?.role !== "admin" && profile?.role !== "super_admin") { |
| 167 | `src/lib/supabase/middleware.ts:592` | **(path / helper)** | if (profile.role === "admin") { |
| 168 | `src/lib/supabase/middleware.ts:637` | **(path / helper)** | profile?.role === "admin" |
| 169 | `src/lib/tenant.ts:224` | **admin only** | if (tenant.role !== "admin" && tenant.role !== "super_admin") { |
| 170 | `src/lib/video-review-access.ts:15` | **area.projects** | return isOwnerAdmin(profile) \|\| staffCan(profile, "area.projects"); |
| 171 | `src/lib/video-review-access.ts:16` | **area.projects** | return isOwnerAdmin(profile) \|\| staffCan(profile, "area.projects"); |
| 172 | `src/lib/video-review-notifications.ts:59` | **area.projects** | role === "admin" |

**Total enumerated checks: 172**

## Additional Phase 3 gates (beyond original 172)

- `src/app/admin/clients/[id]/page.tsx:16` → **area.clients** — `const { profile, tenant } = await requireAdminPage({ area: "clients" });`
- `src/app/admin/clients/[id]/page.tsx:23` → **money.view** — `const canViewMoney = staffCan(profile, "money.view");`
- `src/app/admin/layout.tsx:25` → **admin only** — `const { profile, tenant } = await requireAdminPage();`
- `src/app/admin/projects/[id]/page.tsx:18` → **area.projects** — `const { profile, tenant } = await requireAdminPage({ area: "projects" });`
- `src/app/admin/projects/[id]/page.tsx:24` → **area.projects** — `const allowed = await canAccessProject(tenant.businessId, profile, id);`
- `src/app/admin/projects/[id]/page.tsx:123` → **money.view** — `const canViewMoney = staffCan(profile, "money.view");`
- `src/app/admin/projects/page.tsx:29` → **area.projects** — `const { profile, tenant } = await requireAdminPage({ area: "projects" });`
- `src/app/admin/projects/page.tsx:58` → **projects.create** — `const canCreate = !isStaff || staffCan(profile, "projects.create");`
- `src/app/admin/settings/page.tsx:23` → **admin only** — `const { tenant } = await requireAdminPage({ adminOnly: true });`
- `src/app/api/admin/staff/route.ts:23` → **admin only** — `const auth = await requireAdminApi({ adminOnly: true });`
- `src/app/api/admin/staff/route.ts:40` → **admin only** — `const auth = await requireAdminApi({ adminOnly: true });`
- `src/app/api/admin/staff/route.ts:94` → **admin only** — `const auth = await requireAdminApi({ adminOnly: true });`
- `src/app/api/admin/staff/route.ts:134` → **admin only** — `const auth = await requireAdminApi({ adminOnly: true });`
- `src/app/api/asset-reviews/route.ts:76` → **area.projects** — `const hasAccess = await canAccessProject(profile, project_id);`
- `src/app/api/asset-reviews/route.ts:169` → **projects.edit** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "projects.edit"))) {`
- `src/app/api/media/bulk/route.ts:11` → **area.media** — `const profile = await requireAdmin({ permission: ['media.delete', 'media.organize'] });`
- `src/app/api/media/bulk/route.ts:32` → **media.delete** — `if (!staffCan(profile, "media.delete")) {`
- `src/app/api/media/bulk/route.ts:36` → **media.download_originals** — `if (!staffCan(profile, "media.download_originals") && profile.role === "staff") {`
- `src/app/api/media/bulk/route.ts:39` → **media.organize** — `} else if (profile.role === "staff" && !staffCan(profile, "media.organize")) {`
- `src/app/api/media/download/[id]/route.ts:61` → **area.media** — `const isAdmin = isOwnerAdmin(profile) || staffCan(profile, "area.media");`
- `src/app/api/media/download/[id]/route.ts:62` → **media.download_originals** — `const canDownloadOriginals = isOwnerAdmin(profile) || staffCan(profile, "media.download_originals");`
- `src/app/api/media/thumbnails/route.ts:41` → **area.media** — `const isAdmin = isOwnerAdmin(profile) || staffCan(profile, "area.media");`
- `src/app/api/media-folders/route.ts:23` → **area.media** — `const hasAccess = await canAccessProject(profile, projectId);`
- `src/app/api/messages/route.ts:34` → **area.messages** — `if (isOwnerAdmin(profile) || staffCan(profile, "area.messages")) {`
- `src/app/api/messages/route.ts:88` → **messages.send** — `const isAdmin = isOwnerAdmin(profile) || staffCan(profile, "messages.send");`
- `src/app/api/messages/route.ts:225` → **area.messages** — `const auth = await requireAdminApi({ area: 'messages' });`
- `src/app/api/project-staff/route.ts:14` → **projects.manage_staff** — `const auth = await requireAdminApi({ permission: "projects.manage_staff" });`
- `src/app/api/project-staff/route.ts:35` → **projects.manage_staff** — `const auth = await requireAdminApi({ permission: "projects.manage_staff" });`
- `src/app/api/project-staff/route.ts:65` → **projects.manage_staff** — `const auth = await requireAdminApi({ permission: "projects.manage_staff" });`
- `src/app/api/projects/[id]/link-access/rotate/route.ts:13` → **sharing.anyone_with_link** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.anyone_with_link"))) {`
- `src/app/api/projects/[id]/link-access/route.ts:13` → **sharing.anyone_with_link** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.anyone_with_link"))) {`
- `src/app/api/projects/[id]/link-access/route.ts:34` → **sharing.anyone_with_link** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.anyone_with_link"))) {`
- `src/app/api/projects/[id]/messages/route.ts:32` → **area.messages** — `const hasAccess = await canAccessProject(profile, projectId);`
- `src/app/api/projects/[id]/messages/route.ts:37` → **area.messages** — `if (isOwnerAdmin(profile) || staffCan(profile, "area.messages")) {`
- `src/app/api/projects/[id]/messages/route.ts:67` → **area.messages** — `const hasAccess = await canAccessProject(profile, projectId);`
- `src/app/api/projects/[id]/messages/route.ts:81` → **messages.send** — `const isAdmin = isOwnerAdmin(profile) || staffCan(profile, "messages.send");`
- `src/app/api/projects/[id]/messages/route.ts:192` → **area.messages** — `const hasAccess = await canAccessProject(profile, projectId);`
- `src/app/api/projects/[id]/messages/route.ts:201` → **area.messages** — `if (isOwnerAdmin(profile) || staffCan(profile, "area.messages")) {`
- `src/app/api/projects/[id]/payments/reconcile/route.ts:24` → **money.view** — `if (!staffCan(profile, "money.view")) {`
- `src/app/api/projects/[id]/shares/[shareId]/route.ts:18` → **sharing.email** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.email"))) {`
- `src/app/api/projects/[id]/shares/[shareId]/route.ts:38` → **sharing.email** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.email"))) {`
- `src/app/api/projects/[id]/shares/route.ts:14` → **sharing.email** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.email"))) {`
- `src/app/api/projects/[id]/shares/route.ts:35` → **sharing.email** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "sharing.email"))) {`
- `src/app/api/projects/route.ts:157` → **projects.edit** — `const profile = await requireAdmin({ permission: 'projects.edit' });`
- `src/app/api/quotes/route.ts:38` → **money.view** — `if (profile.role === "staff" && !staffCan(profile, "money.view")) {`
- `src/app/api/quotes/route.ts:57` → **money.create_send_estimates** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))) {`
- `src/app/api/quotes/route.ts:156` → **money.view** — `const cookie = (isOwnerAdmin(profile) || staffCan(profile, "money.view") || staffCan(profile, "money`
- `src/app/api/quotes/route.ts:166` → **money.create_send_estimates** — `if (action === "send" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"))`
- `src/app/api/quotes/route.ts:235` → **money.create_send_estimates** — `if (action === "convert_to_official" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_se`
- `src/app/api/quotes/route.ts:411` → **money.create_send_estimates** — `if (action === "update" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimates"`
- `src/app/api/quotes/route.ts:448` → **money.create_send_estimates** — `if (action === "duplicate" && (isOwnerAdmin(profile) || staffCan(profile, "money.create_send_estimat`
- `src/app/api/revisions/route.ts:73` → **area.projects** — `const hasAccess = await canAccessProject(profile, body.project_id);`
- `src/app/api/revisions/route.ts:122` → **projects.edit** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "projects.edit"))) {`
- `src/app/api/shoot-proposals/route.ts:69` → **scheduling.propose** — `const isAdmin = isOwnerAdmin(profile) || staffCan(profile, "scheduling.propose");`
- `src/app/api/shoot-proposals/route.ts:80` → **area.projects** — `if (!isAdmin && !(await canAccessProject(profile, body.project_id))) {`
- `src/app/api/shoot-proposals/route.ts:216` → **scheduling.propose** — `staffCan(profile, "scheduling.propose") ||`
- `src/app/api/shoot-proposals/route.ts:217` → **scheduling.confirm** — `staffCan(profile, "scheduling.confirm");`
- `src/app/api/shoot-proposals/route.ts:218` → **scheduling.confirm** — `const canConfirm = isOwnerAdmin(profile) || staffCan(profile, "scheduling.confirm");`
- `src/app/api/shoot-proposals/route.ts:229` → **area.projects** — `if (!isAdmin && proposal && !(await canAccessProject(profile, proposal.project_id))) {`
- `src/app/api/stripe/connect/callback/route.ts:36` → **admin only** — `const profile = await requireAdmin({ adminOnly: true });`
- `src/app/api/stripe/connect/refresh/route.ts:31` → **admin only** — `const profile = await requireAdmin({ adminOnly: true });`
- `src/app/api/video-reviews/[id]/comments/route.ts:28` → **video_review.comment** — `return isOwnerAdmin(profile) || staffCan(profile, "video_review.comment");`
- `src/app/api/video-reviews/[id]/versions/[versionId]/route.ts:19` → **video_review.upload_versions** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "video_review.upload_versions"))) {`
- `src/app/api/video-reviews/[id]/versions/route.ts:14` → **video_review.upload_versions** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "video_review.upload_versions"))) {`
- `src/app/api/video-reviews/lazy-comment/route.ts:39` → **area.projects** — `const hasAccess = await canAccessProject(profile, projectId);`
- `src/app/api/video-reviews/lazy-comment/route.ts:44` → **video_review.comment** — `const isTeam = isOwnerAdmin(profile) || staffCan(profile, "video_review.comment");`
- `src/app/api/video-reviews/route.ts:27` → **area.projects** — `const ok = await canAccessProject(profile, projectId);`
- `src/app/api/video-reviews/route.ts:39` → **video_review.upload_versions** — `if (!profile || !(isOwnerAdmin(profile) || staffCan(profile, "video_review.upload_versions"))) {`
- `src/app/api/video-reviews/route.ts:58` → **area.projects** — `const hasAccess = await canAccessProject(profile, projectId);`
- `src/lib/admin-access.ts:49` → **(path / helper)** — `export async function requireAdminPage(`
- `src/lib/admin-access.ts:82` → **(path / helper)** — `if (!passesAccessGate(profile, gate)) {`
- `src/lib/admin-project-pipeline.ts:318` → **admin only** — `const visible = await visibleProjectIdsFor(bid, profile);`
- `src/lib/admin-project-pipeline.ts:404` → **admin only** — `const visible = await visibleProjectIdsFor(bid, profile);`
- `src/lib/api-auth.ts:23` → **admin only** — `* - Use '{ adminOnly: true }' for never-delegable / owner-only routes.`
- `src/lib/api-auth.ts:25` → **admin only** — `export async function requireAdminApi(opts?: RequireAdminApiOpts): Promise<AdminResult> {`
- `src/lib/api-auth.ts:83` → **admin only** — `if (isActiveStaff(p) && opts && passesAccessGate(p, opts)) {`
- `src/lib/api-auth.ts:94` → **admin only** — `const result = await requireAdminApi({ adminOnly: true });`
- `src/lib/auth.ts:163` → **admin only** — `export async function requireAdmin(gate?: AccessGate): Promise<Profile> {`
- `src/lib/auth.ts:166` → **admin only** — `if (isActiveStaff(profile) && gate && passesAccessGate(profile, gate)) {`
- `src/lib/media-asset-access.ts:17` → **area.media** — `return isOwnerAdmin(profile) || staffCan(profile, "area.media");`
- `src/lib/notifications.ts:154` → **(path / helper)** — `!staffShouldReceiveNotification(`
- `src/lib/project-access.ts:124` → **admin only** — `export async function canAccessProject(profile: Profile, projectId: string): Promise<boolean> {`
- `src/lib/project-zip-download.ts:634` → **area.media** — `const isAdmin = isOwnerAdmin(profile) || staffCan(profile, "area.media") || staffCan(profile, "media`
- `src/lib/staff-access.ts:4` → **(path / helper)** — `* ONE permission checker: staffCan(). Route every check through it.`
- `src/lib/staff-access.ts:62` → **(path / helper)** — `export function staffCan(`
- `src/lib/staff-access.ts:77` → **(path / helper)** — `return AREA_ORDER.some((area) => staffCan(profile, STAFF_AREA_PERMISSION[area]));`
- `src/lib/staff-access.ts:84` → **(path / helper)** — `return staffCan(profile, STAFF_AREA_PERMISSION[area]);`
- `src/lib/staff-access.ts:91` → **(path / helper)** — `if (staffCan(profile, STAFF_AREA_PERMISSION[area])) {`
- `src/lib/staff-access.ts:102` → **(path / helper)** — `return AREA_ORDER.filter((a) => staffCan(profile, STAFF_AREA_PERMISSION[a]));`
- `src/lib/staff-access.ts:128` → **(path / helper)** — `export function staffMayAccessAdminPath(`
- `src/lib/staff-access.ts:137` → **(path / helper)** — `return passesAccessGate(profile, { area });`
- `src/lib/staff-access.ts:141` → **admin only** — `| { adminOnly: true }`
- `src/lib/staff-access.ts:146` → **(path / helper)** — `export function passesAccessGate(`
- `src/lib/staff-access.ts:164` → **(path / helper)** — `? keys.every((k) => staffCan(profile, k))`
- `src/lib/staff-access.ts:165` → **(path / helper)** — `: keys.some((k) => staffCan(profile, k));`
- `src/lib/staff-access.ts:191` → **projects.view_all** — `if (staffCan(profile, "projects.view_all")) return "all";`
- `src/lib/staff-access.ts:219` → **(path / helper)** — `export async function visibleProjectIdsFor(`
- `src/lib/staff-access.ts:235` → **(path / helper)** — `export async function canAccessProject(`
- `src/lib/staff-access.ts:242` → **area.projects** — `if (!staffCan(profile, "area.projects") && !staffCan(profile, "projects.view_all")) {`
- `src/lib/staff-access.ts:246` → **area.projects** — `if (!staffCan(profile, "area.projects")) return false;`
- `src/lib/staff-access.ts:248` → **(path / helper)** — `const visible = await visibleProjectIdsFor(businessId, profile);`
- `src/lib/staff-access.ts:269` → **(path / helper)** — `export function assertNeverDelegableBlocked(`
- `src/lib/staff-access.ts:300` → **(path / helper)** — `export function staffShouldReceiveNotification(`
- `src/lib/supabase/middleware.ts:544` → **(path / helper)** — `staffMayAccessAdminPath(staffProfile, path);`
- `src/lib/supabase/middleware.ts:657` → **(path / helper)** — `// Staff hitting /admin/settings is covered by staffMayAccessAdminPath (adminOnly).`
- `src/lib/video-review-access.ts:18` → **area.projects** — `return isOwnerAdmin(profile) || staffCan(profile, "area.projects");`
- `src/lib/video-review-access.ts:22` → **video_review.resolve** — `if (isOwnerAdmin(profile) || staffCan(profile, "video_review.resolve")) {`
- `src/lib/video-review-access.ts:36` → **area.projects** — `const ok = await canAccessProject(profile, projectId);`

## Enforcement summary

| Surface | Gate |
|---|---|
| Middleware `/admin` paths | `staffMayAccessAdminPath` + `area.*` |
| `/billing`, `/onboarding`, `/admin/settings` | **admin only** → `staffHomePath` |
| `/staff` | auth required; redirect if any area |
| Project list | `visibleProjectIdsFor` |
| Project detail | `canAccessProject` → **404** |
| Money UI (QuoteSection / AdminPaymentActions) | `money.view` via `canViewMoney` |
| Notifications | `staffShouldReceiveNotification` + assignment / `projects.view_all` |
| Never-delegable | billing, subscription, staff_management, partner_program, custom_domain, stripe_connect, delete_business |
