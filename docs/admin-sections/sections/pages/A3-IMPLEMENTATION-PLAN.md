# A3 Pages Editor — Implementation Plan

**Goal:** implement the approved collection list and four-tab page editor inside the existing Directus module.
**Spec:** owner request dated 2026-10-18 and verified A3_Pages_Editor_REVIEW_2026-10-18.zip (SHA256 `10bf71dc1991349b88664905a6555026be23063483284fcc46363aea4c71b2a6`). Archive extracted outside sources; all 24 manifest entries match.
**Base:** fresh origin/main `9a0b55fd17f2b7f58d2889ff0c2e4e033ce64ab7`; own branch `codex/a3-pages-editor`, worktree `/workspace/a3-pages-editor`.
**Architecture:** pages.js owns server queries and collection-specific state and views. Reuse accepted A0 state/shell/native fields and A2 PageSectionEditor; no shared implementation changes. Source is shipped verbatim to dist.
**Execution:** inline, autonomously as instructed by the owner; one fresh independent final review.

## Scope and constraints

Allowed: src/sections/pages.js, dist/sections/pages.js, test/sections/pages.test.mjs, optional verification/a3-pages-runtime.mjs, pages documentation. Minimal src/index.js and dist/index.js registration in a separate integration commit after fresh-main check. All paths are in directus/extensions/deere-shop-product-editor unless documentation.
Protected: shared admin-shell/admin-state/page-sections/version contracts, products/categories/home editor, API/hooks, schema, permissions, secrets, dependencies/manifests, infrastructure, storefront and other data.
A2 accepted commits a4cf43a and 6f94264 are already in base. Use PageSectionEditor.labels/displayFields and existing state-change/saved events. No accepted shared version adapter exists: version/save/promote/preview stay explicitly unavailable.

## Task 1: server queries and controller

- [ ] Add behavior tests to test/sections/pages.test.mjs, run RED before implementation.
- [ ] Implement buildPagesQuery({page,search,sort,filters}) with explicit fields, 25 rows, filtered count, stable id order; createPageListController(api,{onChange}) rejects stale responses and unconfirmed permissions.
- [ ] Implement createPageController(api,{onChange}): native draft+standard create, manual slug protection, guarded delta update, hooks refetch, explicit compare/reconcile, source-page check and separate status update.
- [ ] Test denied/malformed/partial access, required/unique fields, double submit, uncertain POST, missing ID/version, races, published confirmation, parent/child updates retaining edits and separate status payload.
- [ ] Run node --test directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs (also direct execution for visible per-case results), expect all cases PASS.

## Task 2: views and registration

- [ ] Build PagesSection list/card/create using actual useApi and accepted native components, explicit per-tab subsets, native OG picker, scoped styles matching the approved HTML/PNGs. Keep child editor mounted across tabs and aggregate dirty/saving flags.
- [ ] Compact pending filter dialog: Apply/Cancel/Reset, removable chips, Escape/focus/Tab boundaries. Actual anchors preserve modified clicks/new tabs. Mobile hides secondary table columns, shares queries.
- [ ] Register pages minimally after fetch/check of origin/main. Preserve categories and home_page.
- [ ] Compare first actual screen with reference if an authorized runtime exists. Do not fabricate runtime acceptance from a harness.

## Task 3: final verification and handoff

- [ ] Run pages tests and relevant A0/products/categories/home/children regressions; src/dist parity and git diff --check.
- [ ] Run node scripts/verify-local.mjs on final candidate; no hosted CI.
- [ ] One independent final code review; reviewer opens actual/reference screenshots if available; fix blocking findings and rerun affected checks.
- [ ] Live Directus/PostgreSQL tests only in confirmed owned runtime with exact-ID ledger and exclusive write lock. Current environment has no containers, dev/.env or ownership manifest: RUNTIME/VISUAL NOT VERIFIED. Do not create infrastructure.
- [ ] Without real UI acceptance publish only a draft PR (no merge). Without safe target report DEPLOY BLOCKED. Keep unfinished branch/worktree for continuation; never remove other work.

## Review focus

- Unknown create outcome must never repeat POST or adopt a found record.
- Child saves can advance parent version; preserve local parent changes until explicit reconciliation.
- Refetch after hook writes must not overwrite staged edits or falsely clear uncertain state.
- Home source check/partial permissions fail closed; ordinary pages remain a collection.
- Native interfaces and responsive geometry require real Directus acceptance; local code tests are insufficient.

## Progress

Baseline A0/category/home tests: successful direct A2 execution (22 cases); node --test reports file-level summaries on this Node build. Runtime unavailable; no data writes made. Reference PNGs inspected; no alternative design generated.
