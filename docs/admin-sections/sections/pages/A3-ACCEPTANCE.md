# A3 — Pages Editor candidate and outstanding acceptance

Date: 2026-10-18. **Implementation candidate; RUNTIME / VISUAL NOT VERIFIED. Draft only, merge forbidden until real acceptance.**

## Scope and Git

Base: fresh `origin/main` `9a0b55fd17f2b7f58d2889ff0c2e4e033ce64ab7` (A2 already merged, PR #9).
Own branch: `codex/a3-pages-editor`; cloud worktree `/workspace/a3-pages-editor`.

- `51b0bb8`: collection-specific implementation, tests and plan.
- `e48af53`: minimal import/registry integration, preserving categories/home_page/products.
- Subsequent fix commit: three independent review findings closed with focused RED→GREEN regressions.

Only pages source/dist/tests/docs and two minimal index additions change. Shared shell/state/section editor, API/hooks, schema, access, dependencies/manifests, storefront and infrastructure are unchanged. The approved original ZIP is preserved in `a3-approved/` with SHA256 and approval provenance. No demonstration data are imported.

## Implemented behavior (code and controlled tests)

| Area | Candidate behavior | Live evidence |
| --- | --- | --- |
| List | One heading/count, confirmed-create action; server title/slug/h1 search, status/type/indexation filters, 10 sorts plus stable ID, 25-row pagination and filtered count. Request generation rejects stale responses. Loading/empty/denied/error/retry distinct. | Not verified |
| Filters and navigation | Pending Apply/Cancel/Reset dialog, removable chips, Escape/Tab boundaries and focus return; real anchors keep modified clicks/new tabs. Mobile uses same rows and hides type/date. | Not verified |
| Card | Four tabs retain local values; actual NativeFieldGroup with explicit subsets and live metadata; ID/dates readonly. Aggregate parent/child dirty and saving feed AdminShell guard. | Not verified |
| Create | Native POST, confirmed full permissions/core fields and draft/standard choices, no copy of existing pages, one in-flight POST, manual slug protection, confirmed ID navigation and refetch. Unknown outcome locks form; bounded exact-slug lookup never adopts/deletes results. | Not verified |
| Parent save | Existing guarded endpoint with original ID, present updated_at (null valid), dirty expected fields and only allowed deltas; native refetch after hook changes. Published save requires UI confirmation and does not change status. | Controlled API + actual SEO hook function |
| Status | Separate confirmed status-only CAS, disabled while parent/child dirty or saving; does not save child or other parent edits. | Not verified |
| Sections | Accepted PageSectionEditor, pages owner ID and opposite home owner null; separate per-row baseline/CAS. Remains mounted between tabs. Child save marks parent stale; explicit compare/reconcile retains prepared parent edits. No new builder/reorder/create/delete implementation. | Accepted shared regression tests, no live A3 |
| SEO/files | Existing scalar/native JSON storage and native file picker. Contradictory dirty JSON projections and dirty scalars are rejected before POST, retaining input. Compatible changes tested against actual production synchronizeSeoPayload. Readable fields refetched after save. Unlink never deletes a file. | Hook function tested; native interfaces unverified |
| Conflicts/errors | 409, timeout, partial acknowledgement retain input and lock repeat. Explicit comparison precedes reconciliation. Recognizes guarded top-level and native extensions error shapes; unique/known validation annotated. Definite create validation may be corrected; unknown create remains locked. | Controlled responses only |
| Versions/preview | Explicitly unavailable. A2 has no accepted shared version workflow. No version ID/page ID conflation, substitute PATCH or new snapshot storage. | BLOCKED shared workflow |

## Route/ownership checks

`pages` is a collection, never a singleton. Existing source pages referenced by `home_page.source_page` are read-only here, with a link to the registered A2 route. Failure to read/confirm the home source relationship disables parent editing, rather than guessing ownership. System types home/catalog/articles and system slugs cannot be created as ordinary pages. Checks are local UX restrictions, not new server protections.

Static consumer inspection confirmed generic one-level `[slug]` requires a published page. `about`, `delivery`, `contacts` and `payment` use pages with built-in fallbacks. Their context warns that unpublishing a CMS row may leave the URL available. Other existing system routes (catalog/articles/brands/request/API/assets/sitemaps) are excluded. `page_type` alone does not create a route. The public link uses the saved published path; it is never called preview. No production site behavior was changed or live-tested.

## Verification

Commands (from repository root; existing dependencies only):

```sh
node --test directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs
node directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs
node scripts/verify-local.mjs
git diff --check
```

Pages: **32 cases PASS**, including 10 conflicting scalar/JSON combinations over create/update, compatible production hook behavior, actual shared toolbar render with controlled Vue primitives, delayed responses, denied access, double submit, uncertain POST, CAS, parent/child and status boundaries. Controlled primitives are not native UI/runtime evidence.

Related direct-execution regressions: **96 cases PASS** (36 A0 state, 30 child, 8 categories, 22 home). Product and shared shell regressions also run in the complete gate. All eight shipped src/dist pairs match. No hosted CI/CD was created or run.

The initial full gate reached build/audit but E2E failed because this fresh cloud lacked Playwright's browser executable. The existing pinned Playwright Chromium was installed under `/tmp/a3-playwright`, without dependency/lockfile changes. The full gate was then rerun with `PLAYWRIGHT_BROWSERS_PATH=/tmp/a3-playwright` and `npm_config_cache=/tmp/a3-npm-cache`. Final results are recorded in the handoff/PR; no missing-browser failure is hidden as an application pass.

## Independent review and targeted closure

One fresh independent reviewer inspected `9a0b55f..e48af53`, production controllers, A0/child integration, actual server hook behavior and focused regressions. It reported exactly three blockers, no minor findings:

1. **P1: SEO JSON-first projection could silently overwrite a simultaneous scalar edit.** Fixed by rejecting contradictory dirty projection values before create/update POST, preserving all entered values. Matching edits remain supported. Reproduction covers seo_title, seo_description, og_image, canonical_url and is_indexable for both create and update, and an actual synchronizeSeoPayload round trip.
2. **P2: clean parent plus dirty child could show “Все изменения сохранены”.** Toolbar now receives aggregate dirty, while save remains parent-only. Test renders the actual EditorToolbar component with controlled primitives and verifies the unsaved message.
3. **P2: guarded unique/validation errors were generic and absent from fields.** Both error shapes are recognized; known fields receive validation, unique-slug is distinguished from a true CAS conflict. Existing CAS retry lock and explicit reconciliation are preserved.

The three focused tests fail against the original reviewed candidate and pass after fixes; the complete pages suite passes. This is targeted test closure, not a second full audit. No independent actual-visual verdict exists.

## Runtime / visual / deployment boundary

This task runs on a separate Linux cloud host. Read-only Docker inspection found no containers and no configured own dev environment/ownership manifest. The local project `D:\codex\Universal Commerce CMS` and prior chat “Реализовать редактор главной” are on the user's Windows host; A2 tested its own `http://127.0.0.1:18056` Directus 12.1.1/PostgreSQL 17. That loopback belongs to the Windows machine, not this cloud. The current tools expose no local command executor, browser extension JS tool or thread-handoff action. Reading previous reports does not grant live access to that host.

The approved HTML was opened using the existing Playwright in a local cloud Chromium after browser-tool discovery found no callable Browser JS runtime. All supplied PNG states were opened. Fresh `/workspace/a3-evidence/reference-opened-1536.png` is **offline reference only**. No actual candidate desktop/mobile screenshot exists. A screenshot of this HTML, a test double or previous A2 is not A3 acceptance.

Outstanding mandatory checks in the existing own local runtime: live metadata/hooks/native create and reload; actual permissions (distinguish controlled denials); parent save/409/uncertain response; correctly owned section reads/saves and parent version advancement; native SEO/file selection/unlink; actual keyboard/filter/new-tab interactions; 1536×1024, 1024px and 390×844 UI, open/closed native right panel, list/card/sections/SEO/create/filters/long/empty/loading/readonly/error/conflict. Open actual and reference screenshots together for comparison and close visual findings before merge.

Runtime writes require the existing own environment, exclusive single-writer use and a private exact-ID fixture journal established before POST. Do not create infrastructure or a second home singleton; do not alter other records or restore a shared DB. Cleanup must use only that run's exact owned IDs and confirm zero remaining fixtures.

**No code was installed into a running Directus. No test-browser bundle was injected. No production deployment occurred. DEPLOY BLOCKED:** no confirmed safe target/update/backup/rollback procedure. No runtime fixtures were created or deleted. Own branch/worktree are preserved because the candidate remains unmerged; the original checkout and other worktrees remain unchanged.

## Continuation

Continue this same A3 task locally from the draft branch, using the already running own Docker stack and existing private ownership evidence. Run the outstanding functional/native/visual acceptance and compare screenshots. Incorporate fresh main and verify the exact resulting candidate. Merge only after all mandatory checks pass and no blocking findings remain. Then verify tree/ancestry, synchronize main safely, and remove only A3's merged branch and clean worktree. Stop after A3.

Owner rules: one implementation owner per task; parallel work only when independent; new tasks start from fresh origin/main on their own temporary branch/worktree; UI requires functional AND actual visual acceptance; green checks authorize autonomous push/PR/review/merge; deployment only to confirmed safe own targets; preserve other work; all task prompts and handoffs are copyable blocks.
