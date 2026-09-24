-- Staff Phase 1 — RLS / SQL role audit
--
-- is_admin() remains `profiles.role = 'admin'` only (schema.sql / v31b).
-- is_staff() is additive and is NOT OR'd into existing admin policies.
-- Default deny: every policy that used is_admin() still excludes staff.

| # | Location | What it guards | staff allowed | reasoning |
|---|---|---|---|---|
| 1 | `is_admin()` (schema + effective) | All `is_admin() AND business_id = current_business_id()` policies | **no** | Function predicate is role=admin only; intentionally unchanged |
| 2 | `is_super_admin()` | Platform bypass | **no** | role=super_admin only |
| 3 | migration-v32 (all rewritten admin policies) | Tenant-scoped admin CRUD | **no** | Uses is_admin(); staff not included |
| 4 | migration-v32 reorder_photos auth | RPC admin gate | **no** | is_admin() branch |
| 5 | migration-v33 business_settings | Settings RLS | **no** | is_admin() |
| 6 | migration-v36 storage policies | Storage upload/read admin paths | **no** | is_admin() OR is_super_admin() |
| 7 | migration-v37 stripe connect | Connect account rows | **no** | is_admin() |
| 8 | migration-v38 branding storage | Brand asset storage | **no** | is_admin() |
| 9 | migration-v40 business_services | Services catalog | **no** | is_admin() |
| 10 | migration-v81 project_shares admin policy | Share management | **no** | is_admin() |
| 11 | migration-v89 project_3d_models | 3D model CRUD | **no** | is_admin() |
| 12 | Legacy v10/v14/v15/v16/v17/v25/v26/v27 policies | Pre-v32 is_admin()-only (superseded or scoped later) | **no** | Still admin-only if present |
| 13 | `handle_new_user()` (v90b) | Profile role on signup/invite | staff **only if** metadata role=staff **and** valid business_id | Forged staff without business_id → client |
| 14 | v90b `project_staff` admin policy | Assignment management | **no** (writes) | is_admin() for ALL; staff SELECT own rows only |
| 15 | v90b `is_staff()` | Staff helper | n/a | Not wired into admin policies |

**Unclassified SQL:** none — all admin RLS paths default deny for staff.
