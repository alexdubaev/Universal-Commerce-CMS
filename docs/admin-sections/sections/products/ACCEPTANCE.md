# PRODUCTS-UX #16 — candidate acceptance

Base: `97c3339178f1febee5ed3c23f3b2e6dd2417f5c8`. Own branch/worktree: `codex/products-ux-16-review`.

Owner approved implementation with «Делай», then explicitly authorized finishing the backend blocker: «Не, давай до конца доводи, надо в бекэнд, лезь в бекэнд». The narrow backend closure is implemented, reviewed and verified. All technical acceptance is complete. On 22 October 2026 the owner accepted the installed desktop/mobile result with «Принимаю» after the final before/after screenshots. Publication is authorized and proceeds through the checked PR workflow; production and next-stage work remain excluded.

## Evidence boundaries

Runtime is the confirmed own Windows Directus 12.1.1 on loopback port 18056, Compose project `universal-commerce-cms-dev`. Source/dist artifacts are installed only after checking the previous installed manifest. Only exact-ID synthetic fixtures in `evidence/runtime-journal.json` may be mutated. Existing neutral media files are referenced read-only; file content, metadata and ownership are not changed.

Actual native Administrator checks and controlled transport faults are recorded separately. There is no pre-existing manager role in this runtime; no role, credential or permission configuration is created or expanded. Administrator behavior and injected permission responses do not establish native manager-role acceptance.

## Required results

| Area | Status | Evidence |
|---|---|---|
| List filters, search, return context, reversed responses, empty/error states | PASS; final desktop/mobile screenshots use synthetic fixtures only | `evidence/list-*-results.json`, `after-list-*.png` |
| Card grouping, field labels, conditional price retention, native validation/focus | PASS; zero retained after hidden mode and actual saves | `evidence/card-runtime-results.json` |
| Save/readback, status intent, confirmation, cancellation | PASS on actual Directus; ordinary Save preserves draft/published/archived; Escape retains input and confirmed cancel does not write | `evidence/card-runtime-results.json` |
| Conflict comparison, second conflict, unknown result, incomplete acknowledgement, double click | PASS; two actual competing writes, comparison/keep use reads only; one POST after double click; committed update with aborted response verifies using GET only | `evidence/card-runtime-results.json`, `after-conflict-desktop.png`, `after-pending-save-desktop.png` |
| Native create and lost-create response; no unsafe repeat | PASS with disclosed limit; ordinary create produces draft and canonical route; lost entire response blocks repeat and performs no article search; known returned ID reconciles to canonical route | `evidence/card-runtime-results.json` |
| Gallery main image/order/description; legacy and managed documents/specifications; unknown-value retention | PASS; actual writes preserve child statuses/translations and unsupported product values; incomplete child read disables gallery | `evidence/card-runtime-results.json` |
| Gallery image detachment | **PASS after authorized backend closure**; native main-photo and last-photo removal, accepted save/readback, shared file/reference retained, stale CAS rejected, later nested failure rolls back deletion | `evidence/backend-runtime-results.json`, `backend-after-delete-rollback.json`, explanation below |
| Desktop/mobile, targeted widths, keyboard/focus/contrast | PASS at 1536×1024, 1024, 390×844 and targeted 320; actions stay within viewport; table scrolls internally; keyboard arrow selects/focuses tab; measured changed normal text minimum 6.33:1 | `evidence/after-*.png`, `responsive-list.json`, `responsive-card.json`, `final-responsive.json`, `contrast.json` |
| Fresh independent review and bounded fix closure | PASS; frontend review plus fresh backend review and bounded native-discovered FK fix; final narrow closure has no open findings | `REVIEW.md` |
| Focused behavior tests | PASS, 14/14 on final source | `node --test directus/extensions/deere-shop-product-editor/test/editor-state.test.mjs directus/extensions/deere-shop-product-editor/test/products-ux.test.mjs` |
| `node scripts/verify-local.mjs` | PASS on final source: 295 backend tests, 36 storefront tests, audit 0 vulnerabilities, production build/token exclusion, 2 Chromium journeys | `evidence/verify-local.log` |
| Exact installed/served hashes and unchanged A0 | PASS; 4 product files match source/runtime, 12 other A0 manifest files unchanged; actual served bundle recorded | `evidence/final-runtime-hashes.json` |
| Guarded own-fixture cleanup and zero remaining IDs | PASS; 9 earlier implementation records plus 6 backend records absent. Two backend images removed through native guarded parent saves; remaining records removed through guarded cleanup. No media files created/deleted; file records and raw bytes still match baseline after cleanup | `evidence/cleanup.json`, `backend-cleanup.json`, `backend-final-verification.json` |
| Owner final installed UI acceptance | ACCEPTED, 22 October 2026: «Принимаю» | Chat, after final real desktop/mobile screenshots |

## Known contract limit

Native product creation has no client-known ID or idempotency key. If the entire response is lost, the UI retains input and blocks repeat creation; it cannot prove record authorship by matching an article or address. Deterministic automatic recovery would require separately authorized backend work. This scope preserves that boundary and does not claim automatic recovery.

## Gallery-detach blocker and authorized resolution

Actual removal of one own child returned HTTP 500 `WRITE_FAILED`. A fresh independent GET showed both child IDs still attached and the child's product ID unchanged; the transaction rolled back. The UI correctly retained input and did not report success. Main image, order and description changes had already succeeded.

Read-only investigation traced Directus 12.1.1 `PayloadService.processO2M` in the installed own container: array omission and detailed `{ delete: [id] }` both follow `one_deselect_action`. `directus/schema/apply-schema.mjs` selects `nullify` for the non-translation relation; `product_images.product` is required. Nullification therefore fails. The gallery builder's array contract predates this change. A separate child DELETE uses a separate transaction and changes the parent through the integrity hook, so it does not preserve an atomic parent CAS sequence. It is not a safe UI workaround.

The owner then explicitly authorized the required backend work. `blueprint.mjs` now opts only `product_images.product` into delete-on-deselect. The scoped `--relation-deselect-only` applier changes this opted-in existing relation, preserving its full identity, live FK actions and all other metadata; it does not run broader schema/seed operations. Ordinary relation defaults remain unchanged. The native parent CAS transaction removes the child row while retaining `directus_files` and file bytes.

The first real migration exposed a Directus 12.1.1 edge: a PATCH without full relation identity can return HTTP 200 while dropping the FK through an ignored async schema-builder failure. Lead immediately restored the exact original 105-relation graph before any content writes. The bounded independent-review fix now sends full identity and requires a fresh accepted readback of FK identity/actions, desired policy and unchanged unrelated metadata. A regression models the HTTP-200/schema-null failure. The corrected CLI passed native dry-run/apply/idempotence, exact full metadata rollback and reapply; required/nullability and all other relations stayed unchanged.

Native UI removal now passes for the current main image and last image on mobile. A shared neutral file and another own product's reference are unchanged. Stale parent CAS returns 409 without child loss. A subsequent invalid `product_specifications` nested write, processed after image deletion, returns 400 and restores the parent, deleted image and other own children exactly. Both file metadata and raw uploads-volume SHA-256 remain identical after fixture cleanup. The earlier FAIL is closed by these actual checks, not waived. Production was never touched.

Evidence: `BACKEND-CLOSURE.md`, `evidence/backend-migration.json`, `backend-initial-migration-recovery.json`, `backend-after-delete-rollback.json`, `backend-runtime-results.json`, `backend-final-verification.json`, and `backend-gallery-*.png`.

## Evidence chronology

The runtime journal retains failed investigative attempts. A 400 uniqueness response initially produced the generic validation message; the final candidate recognizes `RECORD_NOT_UNIQUE` and its native rerun passes. One create test used a closure referring to a closed test page and one gallery comparison hit cross-realm JavaScript object prototypes; corrected harness runs are explicitly labeled and pass. The original gallery FAIL and first migration recovery remain recorded as history; both are resolved by the authorized backend closure. The readonly render regression and its narrow correction are recorded in `REVIEW.md`.

Frontend scenarios were exercised as fixes stabilized; its final change switches Save/Publish visual hierarchy. The later backend closure adds only the declared three schema/applier/test files. Final installed frontend hashes still match, the native migration manifest records the exact final applier hash, and the complete local gate corresponds to the combined final source. No unchanged product tests were represented as native role acceptance.
