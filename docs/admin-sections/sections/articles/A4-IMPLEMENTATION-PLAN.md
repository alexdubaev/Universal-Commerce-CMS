# A4 Articles Editor — implementation plan

Baseline: `f98b5209602eed273fc46fda2ec441b6f0620d6a`; branch `codex/a4-articles-editor`.
The owner approved the design and autonomous execution. The unchanged approved ZIP and its SHA-256 live in `a4-approved/`; extracted review files remain outside the checkout.

## Scope and architecture

Implement only the existing Directus articles section. Reuse A0 AdminShell, CollectionList, NativeFieldGroup, MediaPicker and createEditorState. Article-specific orchestration, query/date/SEO helpers and scoped layout belong in `src/sections/articles.js`, mirrored byte-for-byte in `dist/sections/articles.js`. Boundary tests belong in `test/sections/articles.test.mjs`. The optional live harness belongs in `verification/a4-articles-runtime.mjs`. Documentation stays in this articles directory. Minimal imports/registry/navigation in src/dist index.js form a separate integration commit.

Schema, migrations, permissions, API/hooks, storefront, dependencies, Docker configuration and other sections are read-only. No shared component changes or duplicate shared primitives. A protected-file dependency stops that part for lead adjudication. Existing working-tree changes and other worktrees remain untouched.

## Deliverables and acceptance

1. **First real screen and safe controller** (one worker): use TDD for bounded server list query (25 rows, title/slug/excerpt search, status/category_label/is_featured, stable sort), pending filters, stale responses, permissions, native draft create, required/date/Unicode validation, and guarded field-only updates. Preserve HTML on mount/cover-only save; never write content_blocks/editor_nodes. Cover 409/unknown acknowledgements and explicit reconciliation. Render the list and Main tab first, matching approved geometry. Stop for actual Directus screenshot comparison before implementing remaining tab bodies.
2. **Remaining native tabs** (same implementation owner): Material uses native input-rich-text-html and writing mode; cover/OG use MediaPicker; Relations preserves JSON identifiers and unknown values; SEO retains native JSON and server scalar projection, snippet is informational; Other has native translations and readonly identity/timestamps. Status transitions are separate confirmed clean-baseline actions. Published saves explicitly explain immediate site effects. Tabs preserve all staged values.
3. **Runtime and visual evidence** (same worker for harness, lead execution): verify installed metadata/effective permissions, actual guarded mutation, native create and text/media/SEO behavior using only durable exact-ID synthetic journals and one runtime writer mutex. Capture real Directus at 1536×1024, 1024 wide and 390×844, native right panel open/closed, all named screens and failure/readonly/conflict states. Controlled browser responses must be distinguished from real API permissions. Candidate browser substitution is not installed bundle or deployment. Cleanup only owned IDs and verify no remnants.
4. **Integration and review**: fetch current main, worker makes minimal src/dist index.js registration separately, preserving products/categories/home_page/pages. Lead inspects actual diff and personally runs final focused tests, parity, diff check and `node scripts/verify-local.mjs`. One fresh reviewer evaluates final code and actual/reference PNG; one bounded fix pass plus narrow closure check. Missing core or actual visual acceptance means Draft PR and no merge. Otherwise commit/push/PR/merge autonomously, verify main tree, synchronize local main safely and remove only own merged clean branch/worktree. Do not close docs PR #11 until its exact approved directory is in main.

## Verification commands and review focus

- TDD RED then GREEN: `node --test directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs`.
- Final publication gate: `node scripts/verify-local.mjs` (real dependency installation from existing lockfile first; do not misreport infrastructure failure as pass).
- Addressed A0/A3 regression tests, src/dist byte parity, `git diff --check`.
- Review HTML normalization without user input; cross-tab resets; null/UTC timestamp preservation; ambiguous POST duplicate prevention; stale async loads; per-field permissions; native SEO hydration and hook projection; unknown JSON values; long mobile values; native editor/media usability.
- Archive SHA-256 `e437744fc3aece1312c36e427e92bd27f140e548e25d358126655e71d7fcf203` and all 30 manifest entries verified before implementation.

## Runtime constraints

Confirmed Windows, own Compose project `universal-commerce-cms-dev`, loopback 18056, named uploads/PostgreSQL volumes. Directus 12.1.1 and PostgreSQL 17.11. Directus currently mounts extensions from the separate storefront-directus-acceptance worktree; do not edit that worktree, change mounts or restart containers without an established scoped update procedure. Production target/backup/update/rollback are not established: production deployment blocked.

Final HANDOFF must distinguish implemented/partial, tests, real runtime and controlled responses, screenshots/reviewer, source/data preservation, publication dates, SHA/PR/merge/deploy and exact fixture/branch/worktree cleanup. After A4 stop.
