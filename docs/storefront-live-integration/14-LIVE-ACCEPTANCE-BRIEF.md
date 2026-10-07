# Live acceptance implementation brief

Scope: a separate real-HTTP local synthetic suite, preserving the existing mock suite. Own only new live Playwright config/spec/helpers, minimal package scripts and necessary test-output ignore rules. No production/schema/permissions/Docker changes. Gateway, fixture and SEO workstreams remain separately owned.

## Inputs and preconditions

- Exact CMS URL `http://127.0.0.1:18056`; only the existing isolated project.
- Ignored fixture manifest `dev/.storefront-acceptance/manifest.json`; use named references, not guessed records/UUIDs. Its service token must remain server-side.
- Explicit gateway on, mock false, fictional fallback false; separate live build/start and storefront port from mock regression.
- Administrator is provisioning/read-only durability observer only. Use Node fetch for diagnostic CMS requests; never put its token in browser context, traces, screenshots or output.
- Missing prerequisites fail, rather than skip or quietly run mocks. Orders and attachments remain disabled; do not enable cart to create a positive order test.

## Required evidence

1. Actual CMS home/settings/navigation/pages/sections, three brands/categories, catalog pagination/facets/sort and exact/normalized SKU plus canonical MPN search.
2. Product children: image/gallery, codes/specifications/documents and analog/compatible/supersession. Negative draft parent/child and private file UUIDs. Indexability: noindex product remains browsable, absent from sitemap, metadata noindex.
3. Asset bytes and safe MIME/disposition/nosniff/CSP/no-store headers; valid referenced private-file denial, absent/unreferenced/draft-reference denial; known owned reference revocation with CAS restore when safe.
4. Native items/files/assets/roles/mutations/native commerce access denied for service identity; wrong/anonymous gateway callers denied. No arbitrary collections/fields/queries accepted.
5. RFQ browser add/edit/remove/manual/CSV/TXT/XLSX flows, actual durable lead; same-key concurrent replay has one committed row, changed same-key payload conflicts, invalid payload creates none. Unique run keys. Edited retry rotates key. A retry after storefront process restart proves durability separately.
6. Desktop Chromium 1440px, mobile Chromium/WebKit 390x844; navigation/menu/Escape/focus/skip-link/no document overflow/404. Avoid shared mutable fixture tests in parallel.
7. Token absence in public HTML/network/client assets; Directus failure never returns mock products. Do not stop unrelated services to simulate failure.
8. Bounded synthetic timings with counts/sample size/p50/p95 for catalog/search/brand/product/sitemap/assets. Clearly label the small fixture; real 100k pending.

Return concise results and paths to ignored logs/data. Report uncovered cells explicitly; never equate mock/offline tests with live database evidence. Commits must contain no manifest, generated env, credentials, trace or raw logs.
