-- V123 — Per-project client visibility for the Marketing Kit
-- Same idea as V88/V113 (client_section_photos, client_section_estimates, ...), but nullable:
--   NULL  = automatic (today's behavior: visible when an add-on is offered and the business
--           shows the Marketing Kit to clients, or the project has an offer, purchase or
--           published website)
--   true  = visible to the client whenever at least one add-on is offered
--   false = hidden from the client (portal tab, marketing pages and client API)
-- Visibility only: offers, prices, purchases and published websites are unchanged.
-- Existing rows stay NULL, so nothing changes until a business flips the toggle.

ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS client_section_marketing BOOLEAN;

COMMENT ON COLUMN projects.client_section_marketing IS
  'Marketing Kit client visibility: NULL = automatic, true = shown (when an add-on is offered), false = hidden.';
