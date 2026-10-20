# A0-UX implementation evidence

## Behavior-first checks

- Initial RED: `node --test directus/extensions/deere-shop-product-editor/test/admin-ux.test.mjs` failed three behavior checks: untouched editor was announced as saved, conflict lacked an explicit compare action, and an uncertain write exposed technical error details.
- GREEN after shared shell changes: the same focused suite passes 4/4, including native Directus route confirmation (single persistent dialog, focused Stay action, Escape cancels navigation).
- Category discard behavior: `node --test --test-name-pattern="discarding category edits" directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs` verifies reload of saved values with no write.
- Focused integration command: `node --test directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs directus/extensions/deere-shop-product-editor/test/page-sections.test.mjs directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs directus/extensions/deere-shop-product-editor/test/sections/home_page.test.mjs directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs` passed 154/154.
- Shared shell behavior: `node --test directus/extensions/deere-shop-product-editor/test/admin-ux.test.mjs` passed 4/4.

The owner/lead owns real Directus desktop/mobile interaction, focus traversal, runtime fixture, and final `verify-local` acceptance. No runtime or production data was modified by this worker.

## Runtime-closure regressions

- RED: mounted Pages cancel test initially failed because the harness searched outside the active `SectionTabs` slot; corrected the test to exercise the rendered title field and inspect the active sections slot.
- GREEN: `node --test --test-name-pattern="parent cancel keeps" directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs` passed. The child editor remains mounted during parent-only reload after cancelling parent changes.
- GREEN: `node --test --test-name-pattern="media references|fresh status snapshot|supported custom section choices|standalone block editor" directus/extensions/deere-shop-product-editor/test/page-sections.test.mjs` passed 4/4. Includes post-save reactive status snapshot, known metadata-supported custom label vs unknown type, confirmation behavior, and media reference redaction in comparison.
- GREEN: `node --test --test-name-pattern="native field validation errors" directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs` passed 1/1. Native validation now forwards only Directus-supported translation types; unsupported `validationError.*` entries remain in the editor's own readable summary.
- `git diff --check` passed. Modified `src`/`dist` pairs were byte-identical after synchronization.
- Latest bounded suite: `node --test directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs directus/extensions/deere-shop-product-editor/test/page-sections.test.mjs directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs directus/extensions/deere-shop-product-editor/test/sections/home_page.test.mjs directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs` passed 164/164.
- Installed Directus component contract was checked by the lead: VForm translates `type`, not a custom `message`. Unsupported `FAILED_VALIDATION` types are therefore omitted from native errors and remain represented by the editor's own field-level validation summary. Known Directus translation types retain their recognized `type` values.
- Supported section labels include live metadata-confirmed choices `company_trust`, `featured_products`, `advantages`, `steps`, `catalog_preview`, `seo_text`, `lead_form`, `parts_request`, `recent_supplies`, `contacts`, and `articles`; no label is inferred when the value is absent from metadata choices.
- Mobile Home toolbar status is no longer hidden; media identifiers are replaced with a fixed description only for known media fields in comparison views. Ordinary UUID-like content remains unchanged.
