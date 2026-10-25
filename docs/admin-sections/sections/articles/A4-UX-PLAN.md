# A4 Articles UX Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development. The owner requires one independent review, one bounded confirmed-fix pass and narrow closure. Do not add repeated formal reviews or pause for another approval.

**Goal:** Implement the A4 screenshots approved by the user's “Реализуй”, then verify, merge and deploy to the confirmed local Windows Directus.

**Architecture:** Keep the registered Vue module, native fields/rich HTML editor, A0 state machine and guarded mutation API. Articles alone supplies a stable bounded relation resolver, one scalar SEO surface, safe comparison and clear dates/copy. Runtime publication backend is unchanged.

**Tech Stack:** Existing Vue/Directus 12.1.1, Node behavior tests, Windows PostgreSQL/Directus, existing Playwright. No dependency changes.

**Spec:** GitHub issues #20/#22, user task and explicit approval, `ux-proposal/PROPOSAL.md`, `ux-proposal/proposal.html`, paired canonical PNGs. Historical TZ/CONTRACTS are read in light of current issue/owner decisions.

## Global Constraints

- BASE/fresh main: `6db7cb33f0ed240d0445ba7a90cfbc21a9fec382`; branch `codex/a4-articles-ux-issue20` in its existing isolated worktree.
- Production application allowlist: `directus/extensions/deere-shop-product-editor/{src,dist}/sections/articles.js`; test allowlist: `directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs`; evidence/docs: this articles directory. Keep helper/controller exports within articles.js; no shared A0 edits or new library.
- Preserve HTML bytes for non-content edits, trusted native authorization, unknown structures/keys/legacy forms, CAS/readback, server accountability and separate status transitions.
- Publication backend, schema/SQL, roles/permissions, credentials, dependencies/locks, native vendor/interfaces, storefront and Docker/deploy configuration remain protected. Standard artifact installation/restart to the confirmed target is authorized. No A5.
- Target: Windows Directus `http://127.0.0.1:18056`, project `universal-commerce-cms-dev`, existing extension bind in storefront-directus-acceptance worktree. Source clean-main checkout is separate. Preserve all foreign dirty work, mounted worktrees and volumes.
- Runtime writes only own synthetic journaled fixtures, exact IDs, one writer. No global database restore, prune/down -v, reset/stash/clean/rebase/force push.

## Review Focus

1. Selected IDs/slugs outside candidate page, deleted/unreadable records, field-denied title/sku/brand, stale responses: preserve original values and disclose no identifiers or inaccessible labels.
2. Legacy JSON strings/unknown arrays and records with inconsistent SEO projections: opening/searching/hydrating must never normalize or create dirty data.
3. Complex HTML, embedded image/link markup and native dialog/keyboard formatting: non-content saves retain exact bytes while intentional trusted edits remain possible.
4. Draft/future/due/invalid date and timezone differences: display matches existing server publication predicate; ordinary save never publishes.
5. Conflict/lost ACK/readback failure: comparison is safe plain text, limited to relevant differences, and reconcile does not silently write or retry.

## Task 1 — Article implementation and regressions (worker)

**Files:** articles.js src/dist, focused article tests only.

**Interfaces:** Preserve all existing exports/contracts. A bounded `createArticleRelationsController` (or equivalently named export documented in the report) may live inside articles.js for meaningful async/API behavior tests; the Vue field must actually use it. Its selection reads are independent from candidate search and honor native permission fields and stale-response generations. No new dependencies.

- [ ] Add a failing existing-record SEO contradiction regression: save yields validation, no POST, saving=false, change correction and successful guarded save/readback. Run before production edits and retain red output privately.
- [ ] Add a failing relation regression through the actual resolver/component boundary: selected value outside first 25 retains label and permitted removal after search; stale candidate and selected responses ignored; failed reads/retry preserve selection; inaccessible/unknown values cannot be silently removed. Verify query fields/limits without source-text tests.
- [ ] Move/release save busy state correctly for all early validation returns, preserving consistency validation.
- [ ] Implement selected resolution independently from search, explicit bounded fields/queries and current accountability. Do not feed non-UUID slugs to UUID id filters. Preserve legacy containers on read and unknown elements on intentional edits. No full catalog read or arbitrary-value deletion.
- [ ] Implement approved article-only rendering/copy: existing native editor and writing mode; stable products/categories labels; one SEO title/description/image scalar surface with JSON-first fallback and intent-aware edits, no duplicate native panel; clear date/timezone/status; hidden raw structures/translations/IDs; field errors focus the right tab/field without erasing other input.
- [ ] Comparison: only meaningful changed business fields, bounded safe plain-text material excerpts, no untrusted HTML insertion/raw JSON/IDs, no implicit write. Keep A0 recovery controls.
- [ ] Add narrow preservation/projection/date/access/async regressions for changed boundaries; retain existing valuable tests. Run `node --test directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs`, relevant A0 checks, src/dist byte equality and `git diff --check`. Report commands/results and exact product hashes. Do not commit/push/install from worker.

## Task 2 — Installed Windows acceptance and backup/rollback (lead)

**Files:** private `D:/codex/ucms-release-backups/a4-ux-20261025/` tooling/receipts/fixture ledgers; public sanitized results and screenshots only under this articles docs directory. No product test-harness changes outside allowlist.

- [ ] Inspect actual diff and personally run relevant deterministic checks.
- [ ] Build an A4-specific guarded two-file src/dist installer, verifying target labels/mount/port/volumes, source and expected runtime hashes, unrelated extension inventory, one-writer mutex, baseline backup integrity and write-ahead recovery journal. Never reuse A3's broader allowlist/config writes.
- [ ] Record baseline; install exact candidate, address only own service restart, verify served aggregate and health. Rehearse candidate → baseline → candidate artifact rollback without restoring database/uploads. Keep receipts immutable.
- [ ] Run actual native installed Directus (no module/bundle interception) on own fixtures: validation recovery; separate selected/search relations, unavailable/legacy/races; media unlink without file deletion; complex HTML preservation for cover/alt/relations/SEO and hydration/tab/dialog; real typing/paste/keyboard formatting and writing mode; Russian dialogs; normal save/status/create, CAS409, uncertain response and readback failures; unchanged publication filter across draft/future/due/archive/invalid dates.
- [ ] Desktop1536×1024/mobile390×844 plus targeted1024/320, focus/keyboard/overflow/contrast and compare to approved PNGs. Controlled transport/permission responses explicitly distinguished from real native access. Do not invent manager-role coverage if no role exists.
- [ ] Exact fixture cleanup/audit and native release smoke. Record failures honestly and only rerun affected narrow cases after fixes.

## Task 3 — Independent review, local gate and release (lead/reviewer)

- [ ] One fresh reviewer over original requirements, full diff and installed visuals; confirmed scoped P0/P1/P2 fixes owned by reviewer, then lead narrow closure. No mandatory second broad review.
- [ ] `node scripts/verify-local.mjs` on final product candidate; keep real dependencies/build/E2E evidence. No CI setup.
- [ ] Fetch main again; synchronize with merge if changed and run checks justified by actual changes. Commit scoped files, push, create and attach PR, merge after green checks. Verify merge tree and clean main checkout.
- [ ] Create fresh baseline before release, install artifacts from exact clean merge SHA using guarded expected candidate/baseline receipt, health/bundle/native read-only smoke, installed screenshots. Preserve rollback against the pre-A4 baseline and current release hashes.
- [ ] Persist HANDOFF with base/candidate/merge/release SHA, PR, target/version, tests/review, backup/rollback, screenshots and limitations. Remove only merged own branch/worktree after preserving all non-reproducible evidence. Stop own proposal/test servers as appropriate; leave mounted runtime/foreign work untouched.

## Progress

- Approved proposal: user “Реализуй”, 2026-10-25; no further routine approval needed.
- Task 1: implemented, including visible safe validation summary and final scoped date/mobile layout closure. Shared A0 remains unchanged.
- Task 2: installer guards, backup, actual rollback, health/bundle checks and native functional scenarios passed. Required-field recovery, Writing-mode edits, cancel-only link/image/source visits, service-token denial and exact fixture cleanup passed. Final screenshots identify their actual installed artifact; see acceptance.
- Task 3: independent code review and bounded fixes closed; desktop material/contrast and required-error visual closures passed. The final local gate and Git/release identity are recorded in acceptance and HANDOFF. Commit/push/PR/merge/final release are the remaining integration steps at the time this plan was finalized.

Private operational evidence is under `D:/codex/ucms-release-backups/a4-ux-20261025/`. Native run ledgers/screenshots are under `%TEMP%/a4-native-runtime/`. In particular, `a82098f0-39f4-421e-b579-ee6d39d67401` proves relation/cover closure and the required-error red case; all its exact fixture IDs were cleaned. The known native language-asset exception was reproduced on the exact pre-A4 bundle and documented separately in `A4-NATIVE-LANGUAGE-LIMITATION.md`; it must not be confused with an A4 scenario success or hidden as a clean console.
