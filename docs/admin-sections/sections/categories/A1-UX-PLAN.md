# A1-UX Categories Implementation Plan

> For agentic workers: use teamlead-development and subagent-driven-development, with the owner's one independent review policy. Explicit approval was received on 2026-10-23; do not request another routine implementation, merge or local deployment approval.

Goal: implement the approved category proposal, verify real Windows Directus, merge and deploy to local Directus 127.0.0.1:18056. A2 is excluded.

Architecture: retain the existing Vue/Directus section and shared A0 contracts. Category-local metadata adapters, controlled publication intent, guarded controller writes and in-session list state provide the changes. Keep scalar SEO inputs/readback already accepted in A0. No backend or schema changes.

Tech stack: existing Vue extension, Directus 12.1.1, Node test runner, Windows local runtime.

Spec: issues #17 and #22; approved `ux-proposal/PROPOSAL.md`, `prototype.html` and after-* screenshots. Approval: user explicitly approved the shown A1-UX-FIX and authorized autonomous checked merge and deployment to local 127.0.0.1:18056.

## Global constraints

- Base is ca03a0bb619b55e24b0084e4c84950c587b9ee61; origin/main refreshed at implementation start and unchanged.
- Use existing isolated worktree D:/codex/ucms-a1-ux-issue17, branch codex/a1-ux-categories-issue17.
- Production file scope: category source/dist pair and focused category test only; narrow category-only helper if essential. Documentation/evidence/runtime verification artifacts stay under this category directory.
- Protected: shared A0/index, other sections, backend/SQL/schema/permissions/credentials/dependencies/CI, infrastructure configuration and storefront source. Preserve parent readonly, no delete, CAS, unknown values, routes and asset files.
- Owner-approved exception on 2026-10-23: update only storefront/package.json and storefront/package-lock.json from Next.js 16.3.8 to 16.4.1, with install, audit, build and regression checks. The pinned version failed the mandatory security gate; no storefront behavior or infrastructure change is authorized by this exception.
- No competing writer: one production worker. Runtime writes only by lead, exact owned synthetic fixture IDs, journal before create, guarded cleanup. Never print secrets. Actual restricted-role availability determines RBAC claims.
- Preserve A1-UI-FIX layout, native shell/components, 25-row server pagination, ID tie-breaker and stale-response guards. No local current-page sort.
- One fresh independent review with one bounded fix pass; no repeated whole-change review for formality.

## Review focus

1. Dirty form and unknown status/SEO/hidden data survive failed readback, 409 and uncertain create; no automatic resubmission or false saved success.
2. Field permissions and metadata readonly apply to publication and media as well as ordinary fields; no client permission expansion.
3. Context remains correct across list/card navigation and async responses, with no form drafts in storage.
4. Unsupported settings show truthful readonly summaries, not raw JSON or data loss; SEO projections remain synchronized.
5. Real native fields, focus and dialogs work at 1536x1024 and 390x844; approved geometry and readable statuses are preserved.

## Task 1 — category implementation and narrow regressions

Files: src/sections/categories.js, matching dist/sections/categories.js, test/sections/categories.test.mjs inside directus/extensions/deere-shop-product-editor; category-only helper only if necessary and declared. Do not edit the proposal.

- [x] Add meaningful failing boundary tests before fixes: explicit publication intent/draft creation/unknown status, hidden and unknown fields preserved, SEO readback failure retaining dirty input, clear rejected address versus uncertain create, stable allowed query/context behavior where testable without incidental markup.
- [x] Implement the approved list: retain layout; remove parent/status/homepage sorts and ineffective homepage filter/column; eight honest title/address/modified/order sorts; keep server paging/search/filter; preserve list search/filter/sort/page in the current session; meaningful empty/denied/error states; stronger 12px badges (published #17643f on #edf7f0, draft #43546a on #f2f4f7, archived #805015 on #fff4e8).
- [x] Implement the approved card: human labels, readonly parent name or top level, one scalar SEO title/description input plus existing preview, explicit publication dialog pending until Save; new draft, unknown statuses retained. Errors target field/tab/focus; duplicate address identifies address without leaking record. Comparison and recovery use A0 meanings.
- [x] Keep editable image and image description with accurate no-renderer limitation; keep media library and unlink semantics. Unsupported content/flag/icon/OG/redirect/translations become human readonly summaries; read them but never dirty them through ordinary save. Unknown JSON preserved. No fabricated site preview or consumer.
- [x] Narrow check: node --test directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs, relevant A0/SEO tests if changed boundary, src/dist parity and git diff --check. Provide actual RED/GREEN evidence, change summary and risks; do not commit/publish yet.

## Task 2 — Windows runtime and final review

Lead owns runtime writes. Install/test candidate only in confirmed own Windows Directus; backup exact affected artifacts and verify mount/ownership first. Preserve other mounted worktree changes. Use existing installation procedure; category-only update is permitted by owner.

- [x] Record field→hook→query→component effects in FIELD-CONSUMERS.md with links to current source. Public category limit 200 remains an existing separate limitation; current collection has 21 records before fixtures.
- [x] Record runtime ownership, installed hashes, backup/artifact rollback. Start existing local storefront safely if needed using existing own environment; do not print env or alter infrastructure.
- [x] Use synthetic fixtures to verify all retained sorts across >25 rows; list context; name/description/media persistence; published/draft/archived intent; unknown/hidden values; SEO scalar/JSON readback; real CAS409; uncertain responses and rejected address; native file detach without file deletion. Journal and clean exact IDs only. Real manager-role checks only if existing role exists.
- [x] Compare installed candidate desktop/mobile screens with approved proposal, keyboard/focus, contrast and messages. Record limitations accurately.
- [x] Lead runs relevant deterministic checks, inspects actual diff. Fresh reviewer receives spec/base/active diff, checks security/correctness/visual evidence and fixes confirmed safely in-scope P0/P1/P2 findings. One narrow closure check after fixes.
- [x] Run node scripts/verify-local.mjs on exact publication source. No GitHub Actions.

## Task 3 — publication and local release

- [ ] Refresh origin/main; if advanced, merge safely into task branch and recheck affected candidate. Commit/push, create/attach PR, merge after all required checks pass.
- [ ] Confirm main contains candidate and source tree, synchronize clean local main. Update local target with exact verified merged artifact if needed; confirm installed category hash and services/scenarios, actual installed screenshots. Merge alone is not deploy.
- [ ] Preserve rollback artifacts, clean all owned fixtures; remove only own merged temporary branch and clean unused worktree. Preserve mounted runtime worktree and unrelated changes. Keep review/evidence/HANDOFF in main; stop preview process only if it still belongs to this task.
- [ ] Final HANDOFF: base/candidate/merge/release SHAs, PR, deploy address, tests/review, backup/rollback, actual installed screenshots, cleanup and limitations. Do not start A2.

## Progress ledger

- 2026-10-23: owner approved shown variant and local deployment. Fresh main unchanged. Proposal-only work exists; implementation not started. One production worker to be dispatched.
- 2026-10-23: category worker delivered initial implementation and narrow tests. Lead acceptance inspection requested completion of approved labels/dialog/grouping and recovery semantics before runtime installation. Exact installed category source/dist backups verified at D:/codex/ucms-release-backups/a1-ux-a237a557-60c0-4348-b985-9b5b827b21d9; other mounted artifacts remain protected.
- 2026-10-23: owner explicitly approved the narrow Next.js 16.4.1 exception after reviewing the prepared patch and clean temporary audit. Security worker applies the two-manifest patch and performs install/audit/build checks. A1 runtime verifier is prepared separately; no PASS is inferred from preparation.

- 2026-10-23: approved implementation, independent review and bounded fixes completed. Exact product source hash 3b5813fa18212865c6e950c2c457e84c81635575e867971a0acab408fb23ac75. Final local gate PASS (309 backend, 36 storefront, build/TypeScript, audit zero, two E2E). Installed visual comparison and live site-effects verified. Runtime closure and publication receipts are reported in UX-ACCEPTANCE.md and final release HANDOFF.
