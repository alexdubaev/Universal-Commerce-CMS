# PRODUCTS-UX #16 — approved implementation brief

Owner approved the before/after proposal in chat on 22 October 2026: «Делай».
Base: `97c3339178f1febee5ed3c23f3b2e6dd2417f5c8`; branch `codex/products-ux-16-review`.
Spec: GitHub issues #16 and #22; accepted A0 #15 / merged PR #23.

## Boundaries

Allowed implementation: product-only portions of `src/index.js`, `src/editor-state.mjs`, their exact `dist` pairs, `test/editor-state.test.mjs`, a small behavioral `test/products-ux.test.mjs`, and this products documentation directory. Shared A0, registry, other editors, backend, SQL/schema, permissions configuration, secrets, dependencies, CI, Docker configuration, storefront and production are read-only. Preserve gallery operations, unknown fields, native interfaces and extension/route IDs. One writer at a time.

## Task 1 — product list

- [ ] Add status/availability filters, title/updated-date sorts with stable id tie-breaker, bounded 25-row queries and honest current-page count / available totals.
- [ ] Preserve search/filter/page in the current app session when opening and returning; no product form data in localStorage.
- [ ] Guard stale responses and disposal, reset pagination on query changes; distinguish loading, no catalog, no matches, read denied and failure/retry.
- [ ] Check effective create permissions before offering creation. Reuse accepted list components/patterns without changing shared files.
- [ ] Keep search/actions usable at 1536/1024 and 390/320; short keyboard flow.
- [ ] Add meaningful async behavior regression tests first; run `node --test directus/extensions/deere-shop-product-editor/test/editor-state.test.mjs directus/extensions/deere-shop-product-editor/test/products-ux.test.mjs`.

## Task 2 — product card, actions and save acknowledgement

- [ ] Preserve existing tabs and native field contracts; add Product / Price and availability / Placement group headings, plain Russian labels, address help, conditional price retention including zero. Gallery remains unchanged and is shown where useful, primarily Basic.
- [ ] Save retains status; new records are drafts; explicit publish/unpublish/archive intents use the existing protected endpoint and confirmation. Actions require effective collection/item/field permissions.
- [ ] Use accepted A0 wording and native confirmations for discard/navigation, protect in-flight operations, keep one clear state. No raw errors, UUIDs, JSON or raw status labels.
- [ ] Conflict comparison reads business fields, preserves input, offers keep/discard without writing, retains CAS and re-conflict protection.
- [ ] Validate acknowledgement identity/version/changed fields plus accepted fresh readback before success or clearing dirty; retain partial gallery/managed-media safeguards.
- [ ] Lost/invalid response retains input and blocks unsafe repeat. Update verification only reads a known ID. Creation without returned ID has no deterministic attribution in the existing API: never infer authorship from SKU/slug, never repeat create automatically; retain a clear blocked state. This limitation was disclosed in the approved proposal; no backend/idempotency scope expansion.
- [ ] Explain unsupported storefront effects without clearing their values or advertising them as working; document field→hook→query→component map.
- [ ] Address validation focus, tab retention, double-click, numeric/relation normalization, and unknown/unreadable field retention with targeted behavior tests and real Directus checks.

## Lead verification and acceptance

- [ ] Inspect actual allowed-file diff and src/dist equality; run relevant narrow checks after fixes.
- [ ] Confirm runtime labels/mounts/port and installed hashes before copying only approved artifacts into the own Windows Directus runtime.
- [ ] One writer; synthetic fixtures only, exact-ID ownership journal, guarded cleanup, zero own leftovers; no singleton/role/file-data changes.
- [ ] Actual desktop 1536×1024/mobile 390×844; targeted 1024/320; keyboard/focus/contrast, gallery/documents/specifications regressions; record real behavior versus injected transport faults.
- [ ] One fresh independent code/visual review; bounded confirmed-fix pass; narrow closure check (owner review policy).
- [ ] `node scripts/verify-local.mjs` on the final candidate; report any unavailable checks honestly.
- [ ] Show real installed after screenshots and obtain owner acceptance BEFORE publication.
- [ ] Then fresh-main sync if necessary, commit/push/PR/merge, confirm main, local-main sync, own branch/worktree cleanup only when safe, and final HANDOFF. No production deploy; no next task.

## Progress

Pre-implementation reproduction completed in real own Windows Directus. Existing state tests: 5/5. Evidence initially lived outside source in the chat's products-ux-before visualization directory; selected original evidence is copied under `evidence/before-*`. One own reproduction fixture was removed through guarded full-snapshot/unreferenced deletion; exact-ID remaining zero.

Task 1 functional implementation was inspected by the lead, corrected for actual shared component imports/events, and passed 10 focused tests. Four approved runtime files were installed with base-content guards and recorded hashes (`evidence/installed-list-candidate.json`). Native filter/search/card-return and delayed actual-HTTP response checks passed. Intermediate screenshots identified header styling/contrast issues to close with Task 2; these first screenshots are not final visual acceptance.

Task 2 is in progress with a fresh worker, preserving Task 1. Lead runtime harness owns two synthetic products plus two image rows, one specification row and one document row, with exact IDs and initial snapshots in `evidence/runtime-journal.json`. No files were created or modified; existing neutral synthetic files are referenced read-only. Their fixture cleanup is still pending until the runtime scenarios finish.

Lead rulings: ordinary new-product Save must create draft; explicit confirmed Publish may use the existing native create contract (no hidden two-POST create/publish sequence). Existing guarded update acknowledgements are plain records and have no `changed_fields` envelope; real shape is recorded by a no-op own-fixture probe. Known update IDs must never be replaced by an unvalidated response ID. Field-limited item updates must remain usable under confirmed effective grants. Date sort labels must describe native ascending/descending order, avoiding an unsupported claim about unknown/null dates being newest/oldest.

## Final candidate status (22 October 2026)

Implementation and narrow review corrections are complete within the declared files. Actual installed source/dist equality, 14 focused tests and `node scripts/verify-local.mjs` pass. Final screenshots and measured responsive/contrast evidence are saved. Final acceptance is **not complete**: actual gallery detach fails under the pre-existing protected relation metadata, documented in `ACCEPTANCE.md`. Backend/schema and production remain untouched. No commit/push/PR/merge occurred.

All 9 own runtime records (5 products, 2 image rows, 1 specification, 1 document) were removed through guarded exact-ID/full-snapshot deletion; exact remaining IDs = 0. No media files were created, modified or deleted. The branch/worktree are retained for owner acceptance and the protected-scope decision; no next task was started.

The unchecked planning boxes above are historical work items, not assertions of current PASS. The per-scenario final statuses and remaining mandatory FAIL are in `ACCEPTANCE.md`.

## Owner-authorized backend completion

Owner subsequently instructed: «Не, давай до конца доводи, надо в бекэнд, лезь в бекэнд». The narrow three-file backend closure in `BACKEND-CLOSURE.md` resolves the historical gallery FAIL. Real Directus main/last image detachment, shared-file retention, stale CAS, a later nested failure with transaction rollback, metadata apply/rollback/reapply and final independent review all pass. The final generic gate passes on the combined source (295 backend / 36 storefront / 2 browser journeys, audit 0). All implementation, reproduction and backend fixture IDs are absent; media files and unrelated relations remain unchanged.

All technical work is complete. The only remaining acceptance is the owner's final UI acceptance required by #16; commit/push/PR/merge are still pending that response. No production or next-task action occurred. Historical blocked/pending entries above describe earlier checkpoints; current status is authoritative in `ACCEPTANCE.md` and `HANDOFF.md`.


## Owner acceptance — 22 October 2026

The owner accepted the final installed result with «Принимаю» after real desktop/mobile before/after screenshots. This supersedes historical pending-acceptance checkpoints above. No product code changed after the verified and independently reviewed candidate. Publication proceeds through the authorized checked PR workflow; production remains untouched.
