# A4 final independent review

**Verdict: accepted for integration.** No unresolved P0, P1, or P2 findings remain. This review covers the final A4 source and distribution bundle at `198e1904edbce83f433b7c4f4f03cf4a7a49d266`; it does not imply installation or production deployment.

## Findings and closure

The review confirmed two P2 issues in installed screenshots and closed both within A4:

- At 390px, list rows showed only title and slug. The title cell now includes category, status, and publication date on narrow screens. The actual installed closure shows the summary within the 390px viewport and hidden at 1024px and 1536px.
- A structured 409 compare-and-swap conflict was also rendered as a field validation error. The save handler now maps only field-specific HTTP 400/422 responses to native validation. The updated 409 test reproduced the old behavior before the fix; the installed desktop and mobile captures no longer show the false validation block.

The independent code review covered list filters, pagination and stale responses; permissions and draft-only creation; UTC date handling; guarded CAS writes, conflict reconciliation and unknown acknowledgements; native HTML preservation; SEO JSON projections; relationship identifiers; and safe text rendering. No additional P0/P1/P2 issue was confirmed.

## Verification evidence

- `node --test directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs`: 22/22 passed.
- `node scripts/verify-local.mjs`: passed on the final source, with 263 backend/extension checks, 36 storefront checks, zero audit findings, build/type/token checks, and two Chromium journeys.
- Source/distribution byte parity and `git diff --check`: passed.
- Installed native Directus captures and interaction checks covered desktop, 1024px, and 390px list/editor views, filters, all five tabs, HTML and structured-data preservation, media, SEO, draft creation, publication lifecycle, CAS conflict, and uncertain create. Sixteen scenarios passed cumulatively across the final runtime runs; this was not one uninterrupted all-green run. The final targeted closure passed all four scenarios, and synthetic fixtures were cleaned.

The stock TinyMCE `ru-RU.js` request returns HTML and logs `Unexpected token '<'`. The issue is isolated to the native locale request; actual HTML typing and save passed. No A4 P0/P1/P2 blocker remains.
