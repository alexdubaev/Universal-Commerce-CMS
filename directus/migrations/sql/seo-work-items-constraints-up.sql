-- Up: seo_work_items control-plane constraints (R10A, Task 14).
--
-- Apply after schema:apply creates seo_work_items. A fresh instance has no
-- legacy work items to reconcile.
--
-- UNIQUE dedupe_key: the W1 worker derives it deterministically from
-- entity_type + entity_key + type + subtype + patch (seo-worker
-- computeDedupeKey), so the constraint PHYSICALLY forbids storing the same
-- recommendation twice — the same approach as product_codes and
-- products_analogs.
--
-- The status lifecycle stays DIRECTUS CHOICES (draft | ready | review |
-- applied | rolled_back | rejected) — intentionally NOT a SQL enum or CHECK,
-- so the choice list can evolve without a database migration.
--
-- Idempotent (constraint existence check through pg_constraint — Postgres has
-- no ADD CONSTRAINT IF NOT EXISTS) and safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'seo_work_items_dedupe_key_unique'
  ) THEN
    ALTER TABLE seo_work_items
      ADD CONSTRAINT seo_work_items_dedupe_key_unique
      UNIQUE (dedupe_key);
  END IF;
END
$$;
