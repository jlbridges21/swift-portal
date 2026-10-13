-- Drop zip_codes.city and zip_codes.state.
--
-- v100 added both as NOT NULL DEFAULT ''. The Census gazetteer has no city
-- or state, and the seed wrote an empty string on all 33,791 rows. A query
-- for city returns blanks with no sign that the column was never real data.
--
-- Do not edit v100. It may already have been applied.
--
-- Travel fees: v100 creates the table and does not load it. After v100, run
--   npm run db:seed-zips
-- once. The script is idempotent. If it never runs, every ZIP lookup fails
-- open: estimates are still created, no travel fee is added, and nothing
-- alerts. Seed again after this migration; the script no longer writes city
-- or state.

ALTER TABLE public.zip_codes DROP COLUMN IF EXISTS city;
ALTER TABLE public.zip_codes DROP COLUMN IF EXISTS state;
