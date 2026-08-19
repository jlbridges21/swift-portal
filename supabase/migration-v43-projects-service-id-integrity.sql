-- Swift Portal V43: same-business trigger for projects.service_id
--
-- v40 added projects.service_id → business_services.id. v30 covered
-- client_id and property_id on projects but not the catalog FK, so a
-- service-role write could attach another tenant's service to a project.
-- NULL service_id remains allowed (enforce_same_business early-returns).
--
-- Do NOT drop app_settings / google_calendar_connections here. Those
-- singleton successors (business_settings, google_calendar_connections_v2)
-- have only been live since 2026-08-18; that is not a meaningful production
-- period. Leave the unused tables in place.

DROP TRIGGER IF EXISTS trg_projects_service_id_same_business ON projects;
CREATE TRIGGER trg_projects_service_id_same_business
  BEFORE INSERT OR UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION enforce_same_business('business_services', 'service_id');
