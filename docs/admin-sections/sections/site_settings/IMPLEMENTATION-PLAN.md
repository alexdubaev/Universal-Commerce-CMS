# A5 Site Settings Implementation Plan

> For agentic workers: use superpowers:subagent-driven-development. Owner-approved execution proceeds autonomously; no second permission gate for routine release steps.

**Goal:** Ship the approved v3/A0 settings editor inside the existing Directus and safely release it to the confirmed local Windows instance.

**Architecture:** Reuse A0 native fields/media/state and the existing section router. One confirmed singleton, one shared draft, one dirty-only guarded save across five tabs. A narrow site_settings policy at the existing mutation boundary enforces protected fields, cardinality, and new file eligibility while keeping caller RBAC/CAS.

**Tech stack:** Existing Vue/Directus12.1.1 module, Node/ESM, PostgreSQL17; no new dependencies.

**Spec:** #21/#22; a5-v3-handoff/A5_IMPLEMENTATION_TZ.md; ux-proposal/proposal.html and captured images. Owner approved the shown proposal and explicit backend scope with “Реализуй” on 25.10.2026.

## Global constraints and scope

- BASE 6bbfd3cdbc06fc17fa91251f92218480778bb44f, branch codex/a5-settings-issue21-20261025, current isolated worktree.
- UI files: deere-shop-product-editor/src/sections/site_settings.js, dist/sections/site_settings.js, test/sections/site_settings.test.mjs, sequential minimal src/index.js/dist/index.js registration, this documentation directory.
- Approved backend exception: commerce-api/src/mutations.mjs, dist/mutations.mjs, focused directus/test/site-settings-mutations.test.mjs (or exact adjacent existing guarded mutation tests).
- Preserve schema/SQL, roles, secrets, dependencies, storefront, other sections and infrastructure configuration. No second singleton, no native PATCH fallback, no arbitrary JSON editor, no source Deereshop data.
- Preserve old dirty A5 worktree. Carry only useful section/controller/tests into this fresh branch; never replace current shared A0 or index with historical copies.
- Target only Windows http://127.0.0.1:18056, universal-commerce-cms-dev, existing runtime bind. :3000 is read-only storefront smoke. Backup and expected-hash rollback precede installation; no global DB restore.

## Review focus

- Unauthorized/unknown fields, nested relation writes, empty/multiple/unconfirmed singleton, denied accountability: reject before write, no leaked records.
- Unchanged unavailable files/unknown JSON survive other edits; new private or unreadable files cannot be linked; unlink does not delete files.
- Tab changes, native resets and async metadata callbacks do not clear edits or use stale identity; partial permissions never justify global count.
- 409/timeout/lost acknowledgement/readback failure preserve edits and require explicit reconciliation, without hidden retry.
- Current A0 and accepted A1–A4 bytes, license manifests, native metadata/required constraints, Russian copy, mobile Save/focus remain intact.

## Task 1 — server boundary

- [x] Add meaningful failing handler regressions for exact29 editable scalar/file fields, protected/unknown/repeater JSON denial, delete denial, identity/version/expected requirements, full transactional singleton proof, RBAC, private/unreadable/malformed file denial, valid public image/unlink and normal CAS behavior.
- [x] Implement site_settings-only policy in existing mutation handler; no semantics change for other collections. Use caller ItemsService, transaction and table/row locks for cardinality/write serialization. A valid existing configured public folder is required for a NEW image link; absence denies file linkage, not unrelated text updates. Preserve unchanged inaccessible relations. No administrative file service override.
- [x] Keep source/dist identical. Run new tests plus existing guarded mutation/concurrency boundaries. Real PostgreSQL/native API checks occur during installed acceptance, not misreported as handler harness tests.

## Task 2 — editor and registration

- [x] Inspect old A5 section/tests, write focused regressions for missing approved behavior, transfer/adapt useful code into current A0.
- [x] Five tabs/compact overview/inline edits/main-area forms, native image pickers for four fields, one29-field whitelist, readable local labels, unknown/repeater data preserved readonly. No service JSON/UUID/analytics/profile in manager UI.
- [x] Confirm live singleton metadata/count/object shape, collection/item/field permissions; full read needed for global proof; missing/partial metadata blocks writes. Actual accepted server contract is deployed as the matched release; errors fail closed.
- [x] Reuse createEditorState and correct reactive bridge. Dirty-only one-record CAS, required strings/requisites string, no automatic create/delete/publish. One Save for all settings tabs, confirmed discard, navigation guard, truthful comparison/reconcile/uncertain.
- [x] Sequential minimal current-index import/registry/singleton route guard/one discoverable link. Source/dist equal; do not copy historical index or redesign navigation.
- [x] Run focused section/A0/router/backend checks, inspect actual diff/scope and forbidden data.

## Task 3 — installed acceptance and release

- [ ] Build guarded private installer/backup/rollback and owned-data journal. Verify exact target/image/labels/port/mount/volumes and non-A5 artifact inventory, serialize writers. Test installer safety on disposable paths before actual install.
- [ ] Save exact current singleton baseline privately, change only journaled test fields through guarded endpoint with compare-before-restore, preserve unrelated changes. No second row or role creation. Use PostgreSQL-backed isolated test transactions for invalid cardinality without modifying live singleton cardinality.
- [ ] Install actual candidate, inspect native picker/select/unlink, limited access, CAS/409/two-window/lost ACK, errors/readback/unknown-data preservation, cross-tab save and frontend consumer effects. Distinguish controlled transport responses from actual RBAC and user study. Native screenshots desktop1536x1024/mobile390x844, targeted keyboard/overflow/contrast and approved-reference comparisons.
- [ ] One fresh independent code/visual reviewer; one bounded confirmed fix pass and narrow closure per owner policy.
- [ ] Run node scripts/verify-local.mjs on exact final candidate and security/artifact checks. No remote CI. Fetch main; incorporate changes if any with required rechecks.
- [ ] Commit/push/create and attach PR/merge autonomously, verify tree/ancestry and synchronize local main. Backup current runtime and install clean merged source with rollback, exact installed hashes/aggregate/health/native smoke/screenshots.
- [ ] Restore only owned changed test values/files safely, verify exact cleanup. Remove only clean own branch/worktree after successful merge/release. Final HANDOFF includes approval, base/candidate/merge/deploy SHA, target/version, tests/review, screenshots, backup/rollback, cleanup and limits. Do not continue beyond A5.

## Execution ledger

- Preparation complete: current A0–A4 installed/main verified; native singleton count1, Administrator-only, no existing Manager role. Proposal approved. Product edits were absent until this approval.
- Baseline narrow checks:43 PASS (37 A0 state/UI boundaries,6 guarded mutations), 25.10.2026.
- Task1 code complete, lead inspected actual diff and personally repeated19 handler/concurrency checks PASS. A real Directus getSchema read confirmed internal singleton/generated/alias shape; initial REST-shape mismatch was corrected with a regression. Source/dist guard SHA256 `0c75a6aa5f98f760d8131224dbab26a52e731365644493b7540e61372723b190`. PostgreSQL/native acceptance remains Task3.
- Private release tooling inspected;9 disposable safety checks personally repeated PASS. Target preflight PASS. Original6-artifact baseline (4 present/2 absent) and59 unrelated extension hashes captured at `D:/codex/ucms-release-backups/a5-settings-20261025/a5-pre-a5-baseline.json`. No candidate installation or singleton mutation yet.

- Final code verification: verify-local-release-pass.log full PASS (374 backend,36 storefront, audit0, build/TypeScript/canary,2 Chromium). Final A5 src/dist SHA256 f3c5a68250009f6fdfca31db97b4916aa631689f02f47e5c8a3979b52ff83e02. Native API20 PASS, isolated PostgreSQL16 PASS/cleaned, reviewer code+5-image visual closure clean. Native4-file selection/save/unlink and desktop/mobile409 passed; own UI values restored and fixtures deleted. Original artifact rollback rehearsed and baseline aggregate restored exactly. Publication/deployment cleanup remains until recorded in final HANDOFF.

