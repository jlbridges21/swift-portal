# Swift Portal — Multi-Tenant Tenant Audit

Investigation only. Effective schema is `supabase/schema.sql` plus `migration-v2.sql` … `migration-v28-project-wide-photo-order.sql` and `fix-auth-trigger.sql`, applied in numeric order (v5 before v5b, v7 before v7b). There is **no `business_id` / tenant column anywhere**. `is_admin()` is global: any `profiles.role = 'admin'` row can read/write every business-owned table through RLS and through the service role.

Auth path: `src/proxy.ts` → `updateSession` in `src/lib/supabase/middleware.ts` (anon-key session refresh, `/dashboard`+`/admin` login gate, `/admin` role check). `src/lib/api-auth.ts` `requireAdminApi()` uses the anon client + `profiles.role === "admin"`. `src/lib/project-access.ts` `canAccessProject()` returns **true for every admin**; clients are checked via RLS `select` on `projects`. `src/lib/supabase/server.ts` `createServiceClient()` uses `SUPABASE_SERVICE_ROLE_KEY` and **bypasses RLS**.

---

## A. TABLE INVENTORY

Ownership path today means “how this row attaches to Swift’s single-tenant graph.” After multi-tenancy, every business-owned table needs an explicit `business_id` (or a FK that eventually reaches one).

### Effective enums

| Type | Values (final) |
|---|---|
| `user_role` | `admin`, `client` |
| `project_status` | Original: `lead_received`, `scheduled`, `shot_complete`, `editing`, `ready_for_review`, `awaiting_payment`, `delivered`. Added: `shoot_confirmed` (v3), `shoot_rescheduled` (v4), `new_request`, `quote_sent`, `proposal_approved`, `shoot_complete_editing`, `approved` (v5). Live app uses the v5 workflow; leftovers remain in the enum. |
| `payment_status` | `pending`, `paid`, `cancelled` + `draft`, `sent`, `failed`, `expired` (v14) |
| `media_type` | `photo`, `video`, `document` |
| `activity_type` | schema originals + v4/v5/v10/v11 additions (`proposal_submitted`, `shoot_*`, upload types, `quote_*`, `email_*`, `preliminary_estimate_created`, `official_proposal_sent`, …) |
| `revision_status` | `pending`, `in_progress`, `completed` |
| `shoot_proposal_status` | `pending`, `accepted`, `countered`, `confirmed`, `declined`, `superseded` |
| `quote_status` | `draft`, `sent`, `approved`, `changes_requested` |
| `quote_kind` | `preliminary`, `official` |
| `asset_review_status` | `pending`, `approved`, `rejected` |

### Tables

**`profiles`** — mixed. Identity (`id` → `auth.users`). `role`, prefs, `onesignal_subscription_id`. `client_id` → `clients` (nullable). Path: **none for admins**; **via client** for clients. Business-owned in the SaaS sense (membership). Columns (effective): `id`, `email`, `full_name`, `role`, `client_id`, `created_at`, `updated_at`, `avatar_url` (v6), `push_notifications_enabled`, `onesignal_subscription_id` (v8), `email_notifications_enabled`, `in_app_notifications_enabled` (v9). Indexes: `idx_profiles_role`, `idx_profiles_client_id`. FK: `id` → `auth.users` ON DELETE CASCADE; `client_id` → `clients` ON DELETE SET NULL. Trigger: `profiles_updated_at`. RLS ON.

```
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT USING (auth.uid() = id OR is_admin());
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id OR is_admin());
CREATE POLICY "Admins can insert profiles" ON profiles
  FOR INSERT WITH CHECK (is_admin() OR auth.uid() = id);
CREATE POLICY "Auth service can insert profiles" ON profiles
  FOR INSERT TO supabase_auth_admin
  WITH CHECK (true);
```

**`clients`** — **yes, business-owned**. Path: **none** (top of CRM graph). Columns: schema `id, name, email, phone, company, notes, user_id, created_at, updated_at` + `full_name, referral_source, last_login_at, last_activity_at` (v14) + `first_name, last_name` (v22) + `deleted_at, deleted_by` (v24). Indexes: email, user_id, last_activity, deleted_at. Trigger: `clients_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access clients" ON clients
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own record" ON clients
  FOR SELECT USING (id = get_user_client_id());
```

**`leads`** — **yes, business-owned**. Path: **none** (inbound intake); optional `project_id` (v2). Columns: schema + `project_id` + `first_name, last_name` (v22) + `deleted_at, deleted_by` (v24). RLS ON. **Public INSERT.**

```
CREATE POLICY "Anyone can create leads" ON leads
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can view leads" ON leads
  FOR SELECT USING (is_admin());
CREATE POLICY "Admins can update leads" ON leads
  FOR UPDATE USING (is_admin());
CREATE POLICY "Admins can delete leads" ON leads
  FOR DELETE USING (is_admin());
```

**`projects`** — **yes, business-owned**. Path: **via client** (`client_id`) + property (`property_id` v14). Columns: schema + `cover_image_id` (v2) + `deliverables_approved_at/by` (v3) + `property_id` (v14) + `ghl_sync_status, ghl_last_sync_attempt_at, ghl_webhook_status_code, ghl_webhook_response_body` (v22) + `deleted_at, deleted_by` (v24). Indexes: client_id, status, created_at, property_id, ghl_sync_status, deleted_at. Trigger: `projects_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access projects" ON projects
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own projects" ON projects
  FOR SELECT USING (
    deleted_at IS NULL
    AND (
      client_id = get_user_client_id()
      OR client_has_project_access(id)
    )
  );
```

**`project_clients`** — **yes**. Path: **via project + client**. Columns: `id, project_id, client_id, is_primary, created_at`. UNIQUE `(project_id, client_id)`. RLS ON.

```
CREATE POLICY "Admins full access project_clients" ON project_clients FOR ALL USING (is_admin());
CREATE POLICY "Clients view own project_clients" ON project_clients
  FOR SELECT USING (client_id = get_user_client_id());
```

**`properties`** — **yes**. Path: **via client** (`client_id` nullable). Address/type/geo. Soft-delete v24. Unique `(client_id, normalized_address)` where client_id and address set. Trigger: `properties_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access properties" ON properties
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own properties" ON properties
  FOR SELECT USING (
    client_id = get_user_client_id()
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.property_id = properties.id AND client_has_project_access(p.id)
    )
  );
```

**`media_assets`** — **yes**. Path: **via project** (`project_id` nullable since v19 — unassigned library has **no** owner path), plus denormalized `client_id` / `property_id` / `folder_id`. Large DAM + property-line columns (v2, v14, v16, v19, v21, v27). UNIQUE index `idx_media_assets_file_path_unique` on `file_path`. Trigger: `media_assets_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access media" ON media_assets
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own media" ON media_assets
  FOR SELECT USING (client_has_project_access(project_id));
```

**`media_folders`** — **yes**. Path: **via project**. `id, project_id, name, display_order, created_at`. RLS ON.

```
CREATE POLICY "Admins full access media_folders" ON media_folders
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own media_folders" ON media_folders
  FOR SELECT USING (client_has_project_access(project_id));
```

**`media_asset_tags`** — **yes**. Path: **via media → project**. RLS ON.

```
CREATE POLICY "Admins full access media_asset_tags" ON media_asset_tags
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view tags on accessible media" ON media_asset_tags
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM media_assets m
      WHERE m.id = media_asset_tags.media_asset_id
        AND client_has_project_access(m.project_id)
    )
  );
```

**`media_downloads`** — **yes**. Path: **via media → project**. Admin-only RLS.

```
CREATE POLICY "Admins full access media_downloads" ON media_downloads
  FOR ALL USING (is_admin());
```

**`media_asset_events`** — **yes**. Path: **via media** (`project_id` nullable). Admin-only RLS.

```
CREATE POLICY "Admins full access media_asset_events" ON media_asset_events
  FOR ALL USING (is_admin());
```

**`tours`** — **yes**. Path: **via project**. Extra: display_order/notes (v2), DAM fields + `client_visible` (v16, v18). Trigger: `tours_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access tours" ON tours
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own tours" ON tours
  FOR SELECT USING (client_has_project_access(project_id));
```

**`payments`** — **yes**. Path: **via project and client**. Stripe ids + `quote_id` (v14) + `stripe_receipt_url` (v4). RLS ON.

```
CREATE POLICY "Admins full access payments" ON payments
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own payments" ON payments
  FOR SELECT USING (
    client_id = get_user_client_id()
    OR (project_id IS NOT NULL AND client_has_project_access(project_id))
  );
```

**`revisions`** — **yes**. Path: **via project and client**. RLS ON.

```
CREATE POLICY "Admins full access revisions" ON revisions
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own revisions" ON revisions
  FOR SELECT USING (
    client_id = get_user_client_id()
    OR (project_id IS NOT NULL AND client_has_project_access(project_id))
  );
CREATE POLICY "Clients create revisions" ON revisions
  FOR INSERT WITH CHECK (
    client_id = get_user_client_id()
    AND (
      project_id IS NULL
      OR client_has_project_access(project_id)
    )
  );
```

**`activity_logs`** — **yes**. Path: **via project** and/or **via client** / property (v14). Idempotency keys v15. RLS: no UPDATE/DELETE policies (insert for any authenticated user).

```
CREATE POLICY "Admins view all activity" ON activity_logs
  FOR SELECT USING (is_admin());
CREATE POLICY "Clients view own activity" ON activity_logs
  FOR SELECT USING (
    project_id IS NOT NULL AND client_has_project_access(project_id)
  );
CREATE POLICY "Authenticated users can log activity" ON activity_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
```

**`notifications`** — **yes**. Path: **via user** (`user_id`) + optional `project_id` / `payment_id`. RLS ON.

```
CREATE POLICY "Users view own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service can insert notifications" ON notifications
  FOR INSERT WITH CHECK (true);
```

**`shoot_proposals`** — **yes**. Path: **via project**. `google_calendar_event_id` (v17). Trigger: `shoot_proposals_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access shoot_proposals" ON shoot_proposals FOR ALL USING (is_admin());
CREATE POLICY "Clients view own shoot_proposals" ON shoot_proposals
  FOR SELECT USING (client_has_project_access(project_id));
CREATE POLICY "Clients create shoot_proposals" ON shoot_proposals
  FOR INSERT WITH CHECK (client_has_project_access(project_id) AND proposed_by = 'client');
CREATE POLICY "Clients update own counter proposals" ON shoot_proposals
  FOR UPDATE USING (client_has_project_access(project_id));
```

**`project_quotes`** — **yes**. Path: **via project**. `quote_kind` (v11). Trigger: `project_quotes_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access project_quotes" ON project_quotes FOR ALL USING (is_admin());
CREATE POLICY "Clients view own project_quotes" ON project_quotes
  FOR SELECT USING (client_has_project_access(project_id));
CREATE POLICY "Clients update own project_quotes" ON project_quotes
  FOR UPDATE USING (client_has_project_access(project_id));
```

**`asset_reviews`** — **yes**. Path: **via project**. UNIQUE `(project_id, asset_type, asset_id)`. Trigger: `asset_reviews_updated_at`. RLS ON.

```
CREATE POLICY "Admins full access asset_reviews" ON asset_reviews FOR ALL USING (is_admin());
CREATE POLICY "Clients view own asset_reviews" ON asset_reviews
  FOR SELECT USING (client_has_project_access(project_id));
CREATE POLICY "Clients manage own asset_reviews" ON asset_reviews
  FOR ALL USING (client_has_project_access(project_id));
```

**`email_events`** — **yes**. Path: **via project** (nullable) + Resend id. Admin SELECT only; no INSERT policy (service role writes). RLS ON.

```
CREATE POLICY "Admins view email events" ON email_events
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
  );
```

**`communications`** — **yes**. Path: **via project and/or client**. Admin-only RLS (no client policy).

```
CREATE POLICY "Admins full access communications" ON communications
  FOR ALL USING (is_admin());
```

**`client_notes`** — **yes**. Path: **via client**. Soft-delete v24. Admin-only RLS.

```
CREATE POLICY "Admins full access client_notes" ON client_notes
  FOR ALL USING (is_admin());
```

**`app_settings`** — **yes, singleton platform/business config**. Path: **none** (`id = 1` CHECK). RLS enabled, **zero policies** — only service role (and table owner) can access.

**`google_calendar_connections`** — **yes, singleton OAuth**. Path: **none** (`id = 1` CHECK). Tokens in plaintext. RLS ON.

```
CREATE POLICY "Admins full access google_calendar" ON google_calendar_connections
  FOR ALL USING (is_admin());
```

**`processed_stripe_events`** — platform webhook idempotency (`event_id` PK). Path: **none**. RLS enabled, **zero policies** — service role only.

**`project_messages` / `project_message_reads`** — **yes**. Path: **via project**. Still present after v26 (data migrated to `client_messages`; table not dropped). RLS ON.

```
CREATE POLICY "Admins full access project_messages" ON project_messages
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view project messages" ON project_messages
  FOR SELECT USING (client_has_project_access(project_id));
CREATE POLICY "Clients insert project messages" ON project_messages
  FOR INSERT WITH CHECK (
    client_has_project_access(project_id)
    AND sender_user_id = auth.uid()
    AND sender_role = 'client'
  );
CREATE POLICY "Admins full access project_message_reads" ON project_message_reads
  FOR ALL USING (is_admin());
CREATE POLICY "Users manage own message reads" ON project_message_reads
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**`client_messages` / `client_message_reads`** — **yes**. Path: **via client** (optional `project_id`). RLS ON.

```
CREATE POLICY "Admins full access client_messages" ON client_messages
  FOR ALL USING (is_admin());
CREATE POLICY "Clients view own client_messages" ON client_messages
  FOR SELECT USING (client_id = get_user_client_id());
CREATE POLICY "Clients insert own client_messages" ON client_messages
  FOR INSERT WITH CHECK (
    client_id = get_user_client_id()
    AND sender_user_id = auth.uid()
    AND sender_role = 'client'
  );
CREATE POLICY "Admins full access client_message_reads" ON client_message_reads
  FOR ALL USING (is_admin());
CREATE POLICY "Users manage own client_message_reads" ON client_message_reads
  FOR ALL USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

### View

**`client_stats`** (replaced v14 → v15 → v24) — computed metrics per client. `GRANT SELECT ON client_stats TO authenticated`. **Not `security_invoker`.** Path: aggregates `clients`, `projects`, `project_clients`, `payments`. See §I.

### Storage buckets (effective)

| Bucket | Public | Size cap (effective) | MIME |
|---|---|---|---|
| `project-media` | false | 2 GiB (v2), kept by v20 `GREATEST` | jpeg/png/webp + mp4/quicktime + x-m4v/m4v + octet-stream (v20) |
| `project-documents` | false | 500 MiB (v2) | pdf/zip |
| `avatars` | true | 5 MiB | jpeg/png/webp |

Storage RLS (current):

```
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'avatars');

CREATE POLICY "Admins can upload media" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id IN ('project-media', 'project-documents') AND is_admin());
CREATE POLICY "Admins can update media" ON storage.objects
  FOR UPDATE USING (bucket_id IN ('project-media', 'project-documents') AND is_admin());
CREATE POLICY "Admins can delete media" ON storage.objects
  FOR DELETE USING (bucket_id IN ('project-media', 'project-documents') AND is_admin());
CREATE POLICY "Admins can view all media" ON storage.objects
  FOR SELECT USING (bucket_id IN ('project-media', 'project-documents') AND is_admin());
CREATE POLICY "Clients can view own media files" ON storage.objects
  FOR SELECT USING (
    bucket_id IN ('project-media', 'project-documents') AND
    (storage.foldername(name))[1] IN (
      SELECT id::text FROM projects p
      WHERE p.client_id = get_user_client_id()
         OR EXISTS (
           SELECT 1 FROM project_clients pc
           WHERE pc.project_id = p.id AND pc.client_id = get_user_client_id()
         )
    )
  );
```

---

## B. SERVICE-ROLE INVENTORY

`createServiceClient()` is defined in `src/lib/supabase/server.ts`. **55 `src/` files** mention it (182 hits including the definition, imports, and calls). Docs add 7 more hits in `docs/SAAS-MIGRATION-PLAN.md` → **56 files / 189 hits repo-wide**.

**Scoping rule used below:** today every admin is authorized for every row. **SCOPED** = the query predicates on `project_id`, `client_id`, or the caller’s `user_id` / a resource id already bound to one of those. **UNSCOPED** = no such ownership predicate (full-table, `role = 'admin'`, email/path lookup, singleton, PK-only with no prior owner bind). PK lookups of child rows (`eq("id")` on media/payments) are **UNSCOPED** unless a project/client filter is on the same query.

Also listed: `storage.from(...)` and `rpc(...)` on service clients, plus `auth.admin.*` (not `.from`, but service-role Auth).

### `src/lib/supabase/server.ts`

Definition only. No table queries.

### `src/lib/auth.ts`

Service client only when a client profile has no `client_id`.

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `clients` | `user_id` = caller | SCOPED |
| select | `clients` | `ilike email` (any matching CRM row) | **UNSCOPED** (global email attach) |
| update | `clients` | `id` | SCOPED after lookup |
| update | `profiles` | `id` = caller | SCOPED |

### `src/lib/app-settings.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `app_settings` | `id = 1` | **UNSCOPED** singleton |
| upsert | `app_settings` | `id = 1` | **UNSCOPED** singleton |

Module cache of this row is a cross-request leak (see §F).

### `src/lib/notifications.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `profiles` | `in id` (recipient ids) | SCOPED (id list) |
| select | `profiles` | `role = admin` | **UNSCOPED** (all admins) |
| select | `clients` | `id` | SCOPED |
| select | `projects` | `id` | SCOPED |
| select | `project_clients` | `project_id` | SCOPED |
| select | `clients` | `in id` (junction clients) | SCOPED |
| select | `notifications` | `user_id, type, payment_id` | SCOPED |
| insert | `notifications` | — | SCOPED by payload `user_id` |

### `src/lib/onesignal-push.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `profiles` | `role=admin` AND push enabled | **UNSCOPED** |
| select | `profiles` | `id` = caller | SCOPED |
| update | `profiles` | `id` = caller | SCOPED |

### `src/lib/activity.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `projects` | `id` | SCOPED |
| select | `activity_logs` | idempotency_key + project/client | SCOPED |
| insert | `activity_logs` | — | SCOPED by payload |
| update | `clients` | `id` | SCOPED |

### `src/lib/status-automation.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `projects` | `id` | SCOPED |
| update | `projects` | `id` | SCOPED |

### `src/lib/stripe-payments.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| update | `payments` | `id` | SCOPED-by-id |
| select | `projects` | `id` | SCOPED |
| select | `payments` | `id` / `stripe_payment_intent_id` / `stripe_checkout_session_id` / `stripe_payment_link_id` | **UNSCOPED** (global Stripe-id lookup) |

### `src/lib/stripe-webhook-events.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `processed_stripe_events` | `event_id` | **UNSCOPED** platform |
| upsert | `processed_stripe_events` | — | **UNSCOPED** platform |

### `src/lib/google-calendar.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/upsert/update/delete | `google_calendar_connections` | `id = 1` | **UNSCOPED** singleton |
| update/select | `shoot_proposals` | `id` | SCOPED-by-id |

### `src/lib/ghl/sync-portal-lead.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| update | `projects` | `id` | SCOPED |

### `src/lib/preliminary-estimates.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/update/insert | `project_quotes` | `project_id` + `quote_kind` or insert payload | SCOPED |

### `src/lib/properties.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/insert | `properties` | `client_id` + normalized_address | SCOPED |
| update | `projects` | `id` | SCOPED |

### `src/lib/soft-delete.ts`

All mutations filter `client_id` / `project_id` / junction ids. **SCOPED.** Tables: `project_clients` (select/delete/update), `projects` (select/update), `clients` (update), `properties` (update), `leads` (update).

### `src/lib/communication-records.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| insert | `communications` | payload | SCOPED by payload ids |

### `src/lib/email-analytics.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| insert | `email_events` | — | **UNSCOPED** write (project_id may be null) |
| select | `email_events` | `project_id` | SCOPED |

### `src/lib/message-templates.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `projects` | `id` | SCOPED |
| select | `clients` | `id` | SCOPED |

### `src/lib/client-email-notifications.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `profiles` | `id` | SCOPED |

### `src/lib/client-messaging.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `client_messages` | (inbox; filtered in code after load) | treat **UNSCOPED** if no eq on query; threads also `eq client_id` — **SCOPED** |
| select | `clients` | `id` / list | mixed: by id SCOPED; list **UNSCOPED** if unfiltered |
| select | `client_message_reads` | `user_id` | SCOPED |
| select | `profiles` | `user_id` in | SCOPED |
| upsert | `client_message_reads` | caller user | SCOPED |
| select | `project_clients` | `client_id` | SCOPED |
| select | `projects` | `client_id` | SCOPED |
| select | `activity_logs` | `client_id` | SCOPED |
| select | `projects` | (related-projects helper) | inspect: project access list — SCOPED when `client_id` |

L52/L61 inbox select loads messages then filters — if the initial `.from("client_messages").select` has no `client_id`, that call is **UNSCOPED**.

### `src/lib/client-portal-link.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `clients` | `id` | SCOPED |
| select | `profiles` | `id` / `ilike email` | email match **UNSCOPED** |
| update | `profiles` / `clients` | `id` | SCOPED after lookup |
| Auth | `auth.admin.updateUserById` / `createUser` | — | **UNSCOPED** Auth API (by user id/email) |

### `src/lib/clients-crm.ts`

Service client is **not** used for the CRM `.from` list/detail queries (those use `createClient()` + admin RLS). Service uses:

| Op | Table/API | Filter | Flag |
|---|---|---|---|
| update | `clients` | `id` (`touchClientLogin`, `touchClientActivity`) | SCOPED |
| Auth | `auth.admin.listUsers({ perPage: 1000 })` | none | **UNSCOPED — entire Auth user directory** |
| Auth | `auth.admin.getUserById` | user id | SCOPED |

### `src/lib/media-library.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| insert | `media_asset_events` | — | SCOPED by payload |
| insert/select | `media_downloads` | — | SCOPED by asset |
| update | `media_assets` | `id` | **UNSCOPED** PK |
| select | `projects` | `in id` batch | SCOPED |
| select | `media_assets` | optional type/source/client; default **all rows** `.limit(2000)` | **UNSCOPED** (DAM) |
| select | `tours` | date only, `.limit(500)` | **UNSCOPED** |
| select | `media_asset_tags` | by asset / global tag index | mixed |
| select | `tours` / `media_assets` | `id` | **UNSCOPED** PK |
| select | `media_asset_events` / `media_downloads` / `media_asset_tags` | asset id | SCOPED-by-asset |
| delete/insert | `media_asset_tags` | `media_asset_id` | SCOPED-by-asset |
| select | `clients` | **all**, order name | **UNSCOPED** |
| select | `properties` | **all**, `.limit(200)` | **UNSCOPED** |
| select | `projects` | filter helper | **UNSCOPED** unless ids passed |

### `src/app/admin/calendar/page.tsx`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `shoot_proposals` | `status = confirmed` (all projects) | **UNSCOPED** |

### `src/app/api/admin/email/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `profiles` | `id` | SCOPED |
| select | `clients` | `email` | **UNSCOPED** email lookup |
| select | `profiles` | `id` | SCOPED |

### `src/app/api/admin/push/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `profiles` | `id` | SCOPED |

### `src/app/api/asset-reviews/route.ts`

Service client for GET seeds / POST/PATCH writes (user client also used for some client GETs). Service:

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `media_assets`, `tours`, `asset_reviews` | `project_id` | SCOPED |
| select | `asset_reviews` | `project_id` | SCOPED |
| upsert | `asset_reviews` | — | SCOPED by payload project |
| select/update | `projects` | `id` | SCOPED |

### `src/app/api/clients/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `clients` | (list) | **UNSCOPED** |
| insert | `clients` | — | insert |
| Auth | `auth.admin.createUser` | — | **UNSCOPED** Auth |
| update | `clients` | `id` | SCOPED |
| update | `profiles` | `id` | SCOPED |
| update | `clients` | `id` (delete/soft) | SCOPED |

### `src/app/api/clients/[id]/notes/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/insert/update/delete | `client_notes` | `client_id` / `id+client_id` | SCOPED |

### `src/app/api/cron/workflow-reminders/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `activity_logs` | project + idempotency_key | SCOPED |
| select | `projects` | `status` in (four reminder buckets) — **all matching projects** | **UNSCOPED** |

### `src/app/api/leads/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| insert | `leads` | — | insert (no owner) **UNSCOPED** |
| insert | `activity_logs` | — | **UNSCOPED** / payload |

### `src/app/api/leads/[id]/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/update | `leads` | `id` | **UNSCOPED** PK |

### `src/app/api/media/[id]/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `projects` | `id` | SCOPED |
| select/update/delete | `media_assets` | `id` | **UNSCOPED** PK |
| select | `media_folders` | `id` | **UNSCOPED** PK |
| storage | bucket remove | path from row | follows PK load |

### `src/app/api/media/[id]/property-line/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `projects` | `id` | SCOPED |
| select/update/insert | `media_assets` | `id` / `property_line_base_media_id` | SCOPED-by-asset |
| update | `projects` | `id` (cover) | SCOPED |
| storage | `upload` | built path | SCOPED path |

### `src/app/api/media/bulk/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/delete/update | `media_assets` | `id` | **UNSCOPED** PK |
| update | `projects` | `id` | SCOPED |
| storage | remove / signed URL | — | follows PK |

### `src/app/api/media/download/[id]/route.ts`

Anon client loads the asset (RLS). Service used **only for admin storage**: `storage.from(bucket).download` / signed URLs. Storage **UNSCOPED** relative to RLS (admin bypass).

### `src/app/api/media/move-to-folder/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `media_folders` | `id` | + project check |
| select | `media_assets` | `in ids` (then verifies `project_id`) | SCOPED after check |
| update | `media_assets` | `project_id` + `media_type` | SCOPED |

### `src/app/api/media/reorder/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `media_assets` | `in ids` + project | SCOPED |
| rpc | `reorder_media_assets` | `p_project_id`, ids | SCOPED |

### `src/app/api/media/upload/complete/route.ts` / `upload/route.ts` / `upload/sign/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `media_assets` | `file_path` unique / `project_id+media_type` / ids | `file_path` **UNSCOPED** unique; project filter SCOPED |
| insert | `media_assets` | — | SCOPED by payload `project_id` |
| update | `projects` | `id` cover | SCOPED |
| storage | `createSignedUploadUrl` | constructed path | SCOPED path if project-prefixed |

### `src/app/api/media/youtube/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `media_assets` | `project_id, media_type` (max order) | SCOPED |
| insert | `media_assets` | payload | SCOPED |

### `src/app/api/media-folders/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/insert/update/delete | `media_folders` | `project_id` / `id` | SCOPED when project_id present |
| select | `media_assets` | `project_id, media_type` | SCOPED |
| select | `projects` | `id` | SCOPED |

### `src/app/api/messages/route.ts` / `projects/[id]/messages/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `clients` | `id` | SCOPED |
| select | `project_clients` | `project_id, client_id` | SCOPED |
| select | `projects` | `id` | SCOPED |
| insert | `client_messages` | — | SCOPED by payload |
| upsert | `client_message_reads` | caller | SCOPED |

### `src/app/api/payments/[id]/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/delete | `payments` | `id` | **UNSCOPED** PK (admin-gated) |

### `src/app/api/profile/route.ts` (PATCH only)

| Op | Table | Filter | Flag |
|---|---|---|---|
| update | `profiles` | `id` = caller | SCOPED |
| update | `clients` | `id` = caller’s client | SCOPED |

GET uses `createClient()`, not service.

### `src/app/api/profile/avatar/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| update | `profiles` | `id` | SCOPED |
| storage | `avatars` upload | uid folder | SCOPED |

### `src/app/api/project-clients/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/update/upsert/delete | `project_clients` | `project_id` / `id` | SCOPED |
| update | `projects` | `id` (primary client) | SCOPED |

### `src/app/api/projects/route.ts`

User client for most PATCH. Service:

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `clients` | `id` (POST) | SCOPED |
| insert | `projects` | — | insert |
| upsert | `project_clients` | — | SCOPED |
| insert | `shoot_proposals` | — | SCOPED |
| select/update | `projects` | `id` | SCOPED |
| select/update | `shoot_proposals` | `project_id` / `id` | SCOPED |

### `src/app/api/projects/[id]/download-zip/route.ts`

Entire ZIP path uses service client after `authorizeProjectZipDownload`. Subsequent `.from` / `storage.from` live in `src/lib/project-zip-download.ts` on that client (project-scoped after auth). **SCOPED** by `projectId` once authorized; **admin authorization is global.**

### `src/app/api/quotes/route.ts`

POST uses service for insert. PATCH/admin convert/archive: extra `service` client.

| Op | Table | Filter | Flag |
|---|---|---|---|
| insert/update/select | `project_quotes` | `project_id` / `id` | SCOPED (id PK on quote then uses `quote.project_id`) |

Admin branch may use service for `eq("id")` quote load: **UNSCOPED** PK then project from row.

### `src/app/api/request/route.ts`

Public project creation. Service:

| Op | Table | Filter | Flag |
|---|---|---|---|
| Auth | `auth.admin.createUser` / `deleteUser` | — | **UNSCOPED** Auth |
| insert | `clients`, `projects`, `leads`, `activity_logs` | — | inserts **UNSCOPED** (no tenant) |
| update | `profiles` | `id` | SCOPED |

### `src/app/api/request/logged-in/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select | `clients` | `id` | SCOPED |
| insert | `projects`, `leads` | — | SCOPED by caller client |
| upsert | `project_clients` | — | SCOPED |

### `src/app/api/shoot-proposals/route.ts`

`supabase` is service for admins, RLS client for clients. **Always** `serviceClient = createServiceClient()` for side effects.

Service-only `serviceClient` + admin `supabase`: insert/update `shoot_proposals`, update `projects` by `id`. Client-path still uses `serviceClient` for some writes — **bypass of client RLS**. Filters by `project_id` / `id`: **SCOPED** to that project.

### `src/app/api/tours/route.ts`

| Op | Table | Filter | Flag |
|---|---|---|---|
| select/insert/update/delete | `tours` | `project_id` / `id` | SCOPED when project_id; delete `id+project_id` SCOPED |
| storage | remove thumbnail | — | follows row |

### Highest-risk UNSCOPED list (must tenant-scope)

1. `media-library.ts` — `media_assets` / `tours` / `clients` / `properties` full DAM catalogs  
2. `clients/route.ts` GET — all `clients`  
3. `notifications.ts` / `onesignal-push.ts` — all `role=admin` profiles  
4. `calendar/page.tsx` — all confirmed `shoot_proposals`  
5. `cron/workflow-reminders` — all `projects` by status  
6. `app_settings` + `google_calendar_connections` singletons  
7. `auth.admin.listUsers` in `clients-crm.ts` (up to 1000 users)  
8. `auth.ts` / `client-portal-link.ts` / `admin/email` **global email** lookups  
9. Stripe id lookups in `stripe-payments.ts` (fine for webhooks; must add `business_id` later)  
10. Public `request/route.ts` inserts + `auth.admin.createUser`  
11. DAM `file_path` unique lookup (`upload/complete`) — global uniqueness becomes a cross-tenant collision surface  

API routes that **do not** call `createServiceClient` themselves (they use anon RLS or only Stripe/Resend): `approvals`, `auth/signout`, `admin/settings`, `clients/[id]`, `clients/[id]/portal`, `google-calendar/*`, `media/library`, `media/library/[id]`, `notifications`, `payments` (list/create), `payments/[id]/checkout`, `payments/[id]/receipt`, `projects/[id]`, `projects/[id]/email-events`, `revisions`, `resend/webhook`, `stripe/webhook`. Webhooks still reach service-role **via** `stripe-payments` / `email-analytics`.

---

## C. HARDCODED BRAND INVENTORY

Verification greps (full repo, occurrence counts): **`Swift Aerial` = 73** across 30 files; **`Swift Portal` = 96** across 44 files. `src/` only: **55 / 28 files** and **41 / 18 files**. Extra hits live in `README.md`, `docs/SAAS-MIGRATION-PLAN.md`, and `supabase/migration-v*.sql` header comments (`-- Swift Portal Vn`).

### (1) Brand config constants

| File:line | Literal |
|---|---|
| `src/lib/brand.ts:2` | filesafe.space logo URL (`LOGO_URL`) |
| `src/lib/brand.ts:5` | `name: "Swift Aerial Media"` |
| `src/lib/brand.ts:6` | `portalName: "Swift Portal"` |
| `src/lib/portal-brand.ts:17` | `businessName: "Swift Aerial Media"` |
| `src/lib/portal-brand.ts:18` | `portalName: "Swift Portal"` |
| `src/lib/portal-brand.ts:19` | `adminDisplayName: "Jackson Bridges"` |
| `src/lib/portal-brand.ts:20` | `primaryContactEmail: "jackson@swiftaerialmedia.com"` |
| `src/lib/portal-brand.ts:21` | `phoneNumber: "6626871259"` |
| `src/lib/portal-brand.ts:22` | `websiteUrl: "https://swiftaerialmedia.com"` |
| `src/lib/portal-brand.ts:38` | fallback `"Swift Aerial Media"` for admin display name |
| `src/lib/app-settings.ts:119-122` | `fromName: "Swift Portal"`, `senderEmail: "notification@swiftaerialmedia.com"`, `replyTo: "jackson@swiftaerialmedia.com"`, footer mentions Swift Aerial Media |
| `src/lib/app-settings.ts:124-133` | copies `SWIFT_BUSINESS_DEFAULTS` + `LOGO_URL` |
| `src/lib/site-metadata.ts:16` | fallback `"https://portal.swiftaerialmedia.com"` |
| `src/lib/site-metadata.ts:21-25` | SITE.name/company/title/description |
| `src/lib/landing-assets.ts:4-28` | 12 filesafe.space marketing asset URLs |
| `src/lib/ghl/types.ts:18` | `source: "Swift Portal"` |
| `next.config.js:6` | `assets.cdn.filesafe.space` remote pattern |
| `src/components/ui/remote-image.tsx:12` | hostname allowlist `assets.cdn.filesafe.space` |

### (2) User-facing UI copy

| File:line | Note |
|---|---|
| `src/app/not-found.tsx:13` | “Swift Aerial Media” |
| `src/components/layout/footer.tsx:11` | copyright |
| `src/components/landing/landing-page.tsx:20,30,113-119,138,163,173,331,367,377,380,412,435-441,450,453` | landing brand, swiftaerialmedia.com links, filesafe images, “Swift Portal” product copy |
| `src/components/projects/proposal-card.tsx:49` | final pricing after Swift Aerial Media |
| `src/components/projects/quote-section.tsx:488` | change request copy |
| `src/components/projects/shoot-scheduling.tsx:331,357` | awaiting review / “Proposed by Swift Aerial Media” |
| `src/components/projects/payments-section.tsx:40` | will send payment link |
| `src/components/projects/project-messages.tsx:116,153` | “Message Swift Aerial Media” / sender label |
| `src/components/projects/client-messages-chat.tsx:94` | “Chat with Swift Aerial Media” |
| `src/components/projects/project-hero.tsx:91` | overlay name |
| `src/lib/journey.ts:34,51,60,107` | client journey strings |
| `src/components/admin/admin-settings-client.tsx:480` | reset-to-Swift copy |
| `src/components/admin/google-calendar-card.tsx:78` | “Swift Portal remains the source of truth” |
| `src/components/admin/push-notifications-card.tsx:150,197` | Swift Portal PWA copy |
| `src/app/admin/settings/page.tsx:23` | settings description |
| `src/app/dashboard/settings/settings-client.tsx:223` | notification bell |
| `src/components/ui/url-toast-handler.tsx:17` | “Welcome to Swift Portal!” |

### (3) Email / notification body text

| File:line | Note |
|---|---|
| `src/lib/email.ts:36` | `"Swift Portal <portal@swiftaerialmedia.com>"` |
| `src/lib/email.ts:182,185-189` | portal URL fallback + test email copy |
| `src/lib/email-templates.ts:79,88` | portal URL fallback + default footer |
| `src/lib/workflow-settings.ts:228,253` | default proposal subject / completion body |
| `src/lib/client-email-notifications.ts:65,105-106,148,158,167,175-176,185` | URL fallback, name fallbacks, Swift Portal CTA copy |
| `src/lib/client-messages.ts:11,39` | in-app automated messages |
| `src/lib/stripe-payments.ts:120` | payment-confirmed body |
| `src/lib/preliminary-estimates.ts:126` | estimate-ready body |
| `src/lib/onesignal-push.ts:37,120,162,176` | URL fallback; comment; test heading “Swift Portal Test” |
| `src/app/api/messages/route.ts:145,168,170` | URL fallback + “message from Swift Aerial Media” |
| `src/app/api/projects/[id]/messages/route.ts:124,145,147` | same |
| `src/app/api/shoot-proposals/route.ts:96,394,428` | proposed/declined bodies |
| `src/app/api/quotes/route.ts:100,276` | official proposal bodies |
| `src/app/api/revisions/route.ts:133` | revision in-progress body |
| `src/app/api/payments/[id]/receipt/route.ts:50,56` | HTML receipt title + h1 |
| `src/lib/ghl/sync-portal-lead.ts:13` | portal URL fallback |
| `src/lib/ghl/build-portal-lead-payload.ts:59-60` | `source: "Swift Portal"`, tags `Swift Portal Lead` |

### (4) Metadata / SEO

| File:line | Note |
|---|---|
| `src/lib/site-metadata.ts:16,21-25` | canonical URL, title, description |
| `src/app/not-found.tsx:13` | visible brand (also UI) |
| landing `alt` / `title` / `aria-label` on `landing-page.tsx` (listed in §2) | SEO-ish |

### (5) Service catalog copy

| File:line | Note |
|---|---|
| `src/lib/service-templates.ts:19` | `PRELIMINARY_ESTIMATE_DISCLAIMER` names Swift Aerial Media |
| `src/lib/service-templates.ts:36,56,72,108,140,156,220` | “Swift Portal delivery” include lines |
| `src/lib/service-templates.ts:223,268` | inspection disclaimer / custom proposal copy |

### `swiftaerialmedia.com` / phone / Jackson / filesafe (complete `src/` + config)

- **Jackson Bridges:** `src/lib/portal-brand.ts:19` only in `src/` (also `docs/SAAS-MIGRATION-PLAN.md`).  
- **6626871259:** `src/lib/portal-brand.ts:21` only in `src/`.  
- **swiftaerialmedia.com:** `site-metadata.ts:16`; `landing-page.tsx:113,138,435,453`; `onesignal-push.ts:37,162`; `client-email-notifications.ts:65`; `email.ts:36,182`; `portal-brand.ts:20,22`; `app-settings.ts:120,121`; `messages/route.ts:145`; `ghl/sync-portal-lead.ts:13`; `projects/[id]/messages/route.ts:124`; `email-templates.ts:79`.  
- **filesafe.space:** `brand.ts:2`; `landing-assets.ts` 12 URLs; `landing-page.tsx:20,440`; `remote-image.tsx:12`; `next.config.js:6`.

---

## D. HARDCODED LIFECYCLE INVENTORY

**`PROJECT_STATUSES` — 29 hits / 8 files repo; 22 hits / 7 files in `src/`:**

| File | Role |
|---|---|
| `src/lib/constants.ts` | definition + `ProjectStatus` type + `normalizeStatus` / labels / order |
| `src/lib/journey.ts` | current-step title via `PROJECT_STATUSES.find` |
| `src/lib/email-templates.ts` | progress stepper (`clientLabel` list, clamp to length) |
| `src/components/projects/status-timeline.tsx` | client/admin timeline |
| `src/components/admin/project-pipeline.tsx` | kanban columns |
| `src/components/admin/project-detail.tsx` | status `<Select>` options |
| `src/app/admin/projects/new/page.tsx` | create-project status options |
| `docs/SAAS-MIGRATION-PLAN.md` | docs only |

**`LEGACY_STATUS_MAP`:** defined and consumed only in `src/lib/constants.ts` (`normalizeStatus`). Every `normalizeStatus(...)` call is an indirect consumer.

**`project_status` enum (SQL):** `schema.sql:9-17`; `migration-v3.sql` `shoot_confirmed`; `v4` `shoot_rescheduled`; `v5` `new_request`, `quote_sent`, `proposal_approved`, `shoot_complete_editing`, `approved`; data remaps in `v5b` and `v7b` (`approved` → `awaiting_payment`).

**`WORKFLOW_STAGE_DEFINITIONS`:** `src/lib/workflow-settings.ts` (definition + default merge + validation loop); `src/components/admin/workflow-settings-card.tsx` (admin UI).

**`normalizeStatus` / `getStatusLabel` / `getClientStatusLabel` / `getStatusOrder` / `getStatusColor` consumers:** `client-messages.ts`, `workflow-settings.ts`, `dashboard/page.tsx`, `status-timeline.tsx`, `journey.ts`, `clients-crm.ts`, `project-pipeline.tsx`, `shoot-calendar.tsx`, `project-quick-actions.tsx`, `status-automation.ts`, `clients-table.tsx`, `api/projects/route.ts`, `admin-project-status.ts`, `badge.tsx`, `client-email-notifications.ts`, `notifications.ts`, `project-page-client.tsx`, `project-detail.tsx`, `admin-project-pipeline.ts`, `deliverables.ts`, `api/media/download/[id]/route.ts`.

**Switches / equality on project status strings:**

| File | What |
|---|---|
| `src/lib/journey.ts` | `switch` on normalized status (two functions) — `new_request` … `delivered` |
| `src/app/api/projects/route.ts` | `switch (normalizeStatus(status))` for activity copy; extra `=== "shoot_complete_editing" \| "ready_for_review" \| "awaiting_payment"` |
| `src/lib/admin-project-pipeline.ts` | counts + `switch` cases `new_request`, `awaiting_payment`; filters `shoot_complete_editing`, `ready_for_review` |
| `src/lib/admin-project-status.ts` | `=== "delivered"`, `!== "quote_sent"`, `=== "awaiting_payment"` |
| `src/lib/notification-settings.ts` | `case "proposal_approved"`, `case "quote_sent"` (event mapping) |
| `src/lib/status-automation.ts` | `status === "awaiting_payment"` for notify type |
| `src/lib/media-library.ts` | `matchesProjectStatus` vs `delivered` / `awaiting_payment` |
| `src/lib/deliverables.ts` | downloads allowed iff `delivered` |
| `src/components/projects/project-page-client.tsx` | UI gates on `ready_for_review` / `awaiting_payment` |
| `src/components/admin/project-detail.tsx` | `=== "shoot_complete_editing"` (upload hint) |
| `src/app/dashboard/page.tsx` | `!== "delivered"`, `=== "scheduled"` |
| `src/components/admin/clients-table.tsx` | delivered / awaiting_payment filters |
| `src/app/api/asset-reviews/route.ts` | `project?.status === "ready_for_review"` |
| `src/lib/clients-crm.ts` | delivered vs active counts |
| `src/components/admin/project-pipeline.tsx` | `p.status === status` column membership |

Default template keys in `workflow-settings.ts` (`new_request_confirmation`, `proposal_ready`, …) are stage-aligned strings, not the enum, but they are a frozen lifecycle catalog.

---

## E. HARDCODED SERVICE / PRICING INVENTORY

**`SERVICE_TYPES`** (`src/lib/constants.ts:81-97`, 15 strings):

- `src/app/request/page.tsx` — public request form  
- `src/app/dashboard/request/page.tsx` — logged-in request form  
- `src/app/admin/projects/new/page.tsx` — admin create project  

**`DAM_SERVICE_FILTERS`** (`src/lib/constants.ts:48-63`):

- `src/components/admin/media-library-client.tsx` — DAM service dropdown  

**`SERVICE_TEMPLATES` — 22 hits / 2 files repo; 17 hits / 1 file in `src/`:** only `src/lib/service-templates.ts` (array + `getServiceTemplate` fuzzy match). Docs mentions in `SAAS-MIGRATION-PLAN.md`.

**`getServiceTemplate`:**

- `src/lib/service-templates.ts` (definition + internal)  
- `src/lib/ghl/build-portal-lead-payload.ts` — GHL payload pricing fields  
- (transitively) `buildPreliminaryEstimatePayload`  

**`buildPreliminaryEstimatePayload`:**

- defined `src/lib/service-templates.ts:319`  
- `src/lib/preliminary-estimates.ts` (create + refresh paths)  

`PROPERTY_TYPES` / `DAM_SUGGESTED_TAGS` in `constants.ts` are the same frozen Swift catalog (property CHECK constraint in `properties` mirrors `PROPERTY_TYPES`).

---

## F. SHARED-STATE INVENTORY

Module-level `let` / `var` in `src/lib/` (warm-server cross-request state):

| File | Variable | Caches |
|---|---|---|
| `src/lib/app-settings.ts` | `cachedSettings` | merged `AppSettings` (brand, email, workflow, notifications) for **all requests**, TTL 30s |
| `src/lib/app-settings.ts` | `cacheExpiresAt` | expiry timestamp for that cache |
| `src/lib/email.ts` | `resend` | process-wide `Resend` SDK (API key) |
| `src/lib/email.ts` | `lastEmailSendResult` | last send metadata (observable via `getLastEmailSendResult()`) |
| `src/lib/stripe.ts` | `stripeInstance` | process-wide Stripe SDK (`STRIPE_SECRET_KEY`) |
| `src/lib/onesignal-client.ts` | `scriptPromise` | browser SDK script load (client component; still module-scope) |
| `src/lib/onesignal-client.ts` | `initPromise` | OneSignal init |
| `src/lib/onesignal-client.ts` | `sdkInstance` | OneSignal namespace |

`onesignal-client.ts` is `"use client"` — leak is per-browser tab, not serverless tenant. The three **server** leaks are `app-settings` cache (will return Business A settings to Business B on a warm isolate), plus singleton Stripe/Resend clients (OK only if keys stay platform-level).

No other `^let`/`^var` at module scope under `src/lib/`. `const` Maps/Sets (`CRITICAL_CLIENT_EMAIL_TYPES`, `RESEND_EVENT_MAP`, etc.) are immutable catalogs, not request caches.

---

## G. EXTERNAL INTEGRATION INVENTORY

### Stripe

- **Env:** `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_APP_URL` (redirects). No `NEXT_PUBLIC_STRIPE_*` in src.  
- **Module client:** `src/lib/stripe.ts` `let stripeInstance` via `getStripe()`.  
- **Webhook:** `POST /api/stripe/webhook` (excluded from `proxy.ts` matcher). Idempotency table `processed_stripe_events`.  
- **Other endpoints:** `POST /api/payments` (Payment Links), `POST /api/payments/[id]/checkout` (Checkout Session), receipt retrieve in `/api/payments/[id]/receipt`.  
- **Per-business id today:** **none**. One platform Stripe account. Metadata carries `payment_id` (`src/lib/stripe-metadata.ts`), not a tenant id.

### Resend

- **Env:** `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`.  
- **Module client:** `src/lib/email.ts` `let resend`. Webhook constructs `new Resend(...)` locally in `src/app/api/resend/webhook/route.ts`.  
- **Webhook:** `POST /api/resend/webhook` (excluded from proxy matcher) → `email_events` / `communications`.  
- **From-address:** settings row with defaults `notification@swiftaerialmedia.com` / `Swift Portal <portal@swiftaerialmedia.com>` fallback.  
- **Per-business id today:** **none** (one API key, one default domain).

### OneSignal

- **Env:** `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`.  
- **Clients:** REST in `onesignal-push.ts` (no module-level SDK); browser SDK in `onesignal-client.ts`.  
- **Webhook:** none. Push via REST `https://api.onesignal.com/notifications`.  
- **Per-business id today:** **none**. One app id. Targeting is `profiles.onesignal_subscription_id` / external user id = profile UUID. All admins with push enabled receive admin events.

### Google Calendar

- **Env:** `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI` (optional), `NEXT_PUBLIC_APP_URL`.  
- **Module client:** none cached; `googleapis` constructed per call in `src/lib/google-calendar.ts`.  
- **OAuth:** `GET /api/google-calendar/connect`, `GET /api/google-calendar/callback`; admin card/API ` /api/google-calendar`.  
- **Store:** singleton `google_calendar_connections` (`id = 1`) with access/refresh tokens.  
- **Per-business id today:** **none** — one connected Google account for the whole app.

### GoHighLevel

- **Env:** `GHL_PORTAL_LEAD_WEBHOOK_URL`.  
- **Module client:** none (plain `fetch` POST).  
- **Webhook (outbound):** `src/lib/ghl/sync-portal-lead.ts` from request/project creation. Status columns on `projects` (`ghl_sync_status`, …).  
- **Inbound webhook:** none in this repo.  
- **Per-business id today:** **none**. Payload `source: "Swift Portal"` and tags are hardcoded.

---

## H. SINGLETON TABLES

| Table | Constraint | Purpose |
|---|---|---|
| `app_settings` | `id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1)` | Global JSON settings |
| `google_calendar_connections` | `id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1)` | One OAuth token row |

No other `CHECK (id = 1)` in `supabase/`.

---

## I. VIEWS AND SECURITY-DEFINER FUNCTIONS

### View `client_stats`

Created v14, replaced v15 (more columns), replaced v24 (exclude `deleted_at`).  
Columns: `client_id`, `lifetime_revenue`, `outstanding_balance`, `active_project_count`, `delivered_project_count`, `total_project_count`, `average_project_value`, `last_payment_at`.  
**GRANT:** `GRANT SELECT ON client_stats TO authenticated` (v15, v24).  
**Invoker:** no `security_invoker = true` — PostgreSQL default is security definer (owner). **Leak:** any authenticated user (including a client) who can `select * from client_stats` bypasses RLS on `clients`/`payments`/`projects` and sees **every client’s revenue**. Admin UI currently reads it through the anon client (`clients-crm.ts` uses `createClient()`), so this is live if PostgREST exposes the view.

### SECURITY DEFINER functions

**`public.handle_new_user()`**  
`SECURITY DEFINER SET search_path = public`. Inserts `profiles` on `auth.users` insert.  
**GRANT:** `GRANT EXECUTE … TO supabase_auth_admin`; `GRANT ALL ON profiles TO supabase_auth_admin`.  
Trigger `on_auth_user_created` AFTER INSERT ON `auth.users`.  
**Leak:** cannot read other tenants’ data; **will insert every signup into the single global `profiles` table** (no `business_id`). Role taken from `raw_user_meta_data->>'role'` — a client could request `admin` if signup payload is trusted (meta is usually server-set).

**`is_admin()`**  
`SECURITY DEFINER`. `EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')`.  
No explicit GRANT in repo → default **PUBLIC EXECUTE**.  
**Leak:** definition is correct for a single tenant. Multi-tenant: **any** admin of any business is admin of **all** RLS policies.

**`get_user_client_id()`**  
`SECURITY DEFINER STABLE` (v26). Reads `profiles.client_id`, else `clients.user_id`.  
Default PUBLIC EXECUTE.  
**Leak:** returns one client globally; email/user uniqueness is assumed worldwide.

**`client_has_project_access(p_project_id UUID)`**  
`SECURITY DEFINER` (v3). Junction **or** `projects.client_id`.  
Default PUBLIC EXECUTE.  
**Leak:** same global client graph. Used by almost every client SELECT policy.

**`reorder_media_assets(p_project_id UUID, p_ordered_ids UUID[])`**  
`SECURITY DEFINER SET search_path = public` (v28; v27 3-arg version dropped). Updates `display_order` if ids belong to that project as photos. **Does not call `is_admin()` or `client_has_project_access`.**  
**GRANT:** `REVOKE ALL … FROM PUBLIC`; `GRANT EXECUTE … TO service_role, authenticated`.  
**Leak:** **any authenticated user who can execute RPC and guess a `project_id` can reorder that project’s photos**, including another tenant after multi-tenant data exists.

Non-definer helpers (for completeness): `update_updated_at()` trigger fn; `normalize_address(addr)` `LANGUAGE sql IMMUTABLE`.

---

## VERIFICATION (re-run after writing)

Tool: `rg --count-matches` (occurrence count, not matching-lines). Re-run from repo root after this file was written.

**A. Entire repo including this report**

| Pattern | Files | Occurrences |
|---|---|---|
| `Swift Aerial` | 31 | **88** |
| `Swift Portal` | 45 | **118** |
| `createServiceClient` | 57 | **196** |
| `PROJECT_STATUSES` | 9 | **33** |
| `SERVICE_TEMPLATES` | 3 | **25** |

**B. Repo excluding `docs/TENANT-AUDIT.md` (the inventory itself)**

| Pattern | Files | Occurrences | Notes |
|---|---|---|---|
| `Swift Aerial` | 30 | **74** | 28 files / 55 in `src/`; rest `README.md` + `docs/SAAS-MIGRATION-PLAN.md`. §C lists every `src/` hit. |
| `Swift Portal` | 44 | **96** | 18 files / 41 in `src/`; rest SQL `-- Swift Portal` migration headers, README, `docs/SAAS-MIGRATION-PLAN.md`. |
| `createServiceClient` | 56 | **189** | 55 files / **182** in `src/` (definition + 54 callers); 7 in `docs/SAAS-MIGRATION-PLAN.md`. |
| `PROJECT_STATUSES` | 8 | **29** | 7 files / **22** in `src/` (§D); 7 in `docs/SAAS-MIGRATION-PLAN.md`. |
| `SERVICE_TEMPLATES` | 2 | **22** | **17** in `src/lib/service-templates.ts`; 5 in `docs/SAAS-MIGRATION-PLAN.md`. |

This report accounts for every **B** hit: application inventory is complete; the **A** extras are strings inside this document (14 / 22 / 7 / 4 / 3 respectively: 74+14=88, 96+22=118, 189+7=196, 29+4=33, 22+3=25).

`createServiceClient` callers (54) + `src/lib/supabase/server.ts` (1) = 55 `src/` files.

No code or schema was changed in this investigation.
