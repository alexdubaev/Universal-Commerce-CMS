-- Fresh-instance page_sections owner-XOR constraint.
--
-- Apply after schema:apply creates page_sections and its nullable owner fields.
--
-- A fresh instance has no legacy rows to reconcile. This checks the
-- single-owner invariant for new records; no content migration is included.

ALTER TABLE page_sections
  DROP CONSTRAINT IF EXISTS page_sections_exactly_one_owner_check;

ALTER TABLE page_sections
  ADD CONSTRAINT page_sections_exactly_one_owner_check
  CHECK (num_nonnulls(page, home_page) = 1);
