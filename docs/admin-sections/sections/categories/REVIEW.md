# Independent review: A1 categories

Review scope: active A1 category changes on `codex/a1-ux-categories-issue17`, including the approved category UX, its guarded edit/create paths, and the separately authorized Next.js security patch. This was a source review plus a comparison of current installed desktop captures for publication and saved settings against the approved desktop mockups. It was not a full runtime acceptance run.

## Finding fixed

- **P2 — Site-effect notice omitted real storefront changes.** The editor announced that site-impacting fields had changed for title, slug, status, heading, SEO fields and indexability, but omitted `description`, `intro`, and `sort_order`. The category page reads `description` and `intro`; category listings order by `sort_order`. Added those fields to `EFFECTS` in source and deployed bundle so the existing notice appears for these edits.

## Review result and limits

No other confirmed P0/P1/P2 issue was found in the reviewed source paths. The approved publication dialog is visually clear in the current installed desktop capture. The saved-settings view is legible; it omits the mockup's explicit sentence that these values remain unchanged on save, a non-blocking P3 polish difference.

## Narrow closure check

The later bounded review examined only `comparisonValue` and its focused boundary test. Status values are presented in Russian, unknown statuses use a generic label, booleans use human labels, and null/media values remain safe; ordinary user text is returned unchanged. The comparison test covers those cases and the deployed bundle remains aligned with source.

Verification command: `node --test directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs` — **61 passed, 0 failed** (including source/dist parity). `git diff --check` passed.

The site-impact notice condition was not exercised in the installed browser during this review; the lead should check it during the authorized runtime probe. At review time that probe was still under investigation; no runtime/data result is claimed by this independent review. The later lead-owned acceptance is documented separately in UX-ACCEPTANCE.md.

## Lead closure after review

The final native-field error mapping uses existing adapter-supported error types; the lead ran 62 category/A0 boundary tests and the final root verification gate successfully. Real native validation and recovery screenshots were inspected. This later closure is lead evidence, not an additional independent review.
