# A1-UI-FIX acceptance

Baseline: `9b810ff63e363c17c288f409cff6a25d9cc3de7d`, fresh `origin/main`. Work branch: `codex/a1-ui-fix`, separate managed worktree. One owner implemented; one independent reviewer inspected code and actual screenshots. The original dirty checkout and all other worktrees remain unchanged.

## Scope and preserved contracts

Only the existing categories list and filters are reshaped. Allowed changes: categories source/dist; minimal backward-compatible AdminShell list mode and CollectionList slots; two focused A0 behavioral tests; the existing opt-in runtime verifier; this report; the requested root AGENTS visual-acceptance rule; and the task materials directory.

`buildCategoriesQuery`, `createCategoryController`, `categoryPermissions`, `validateCategory` and the category editor logic are unchanged. The editor receives only a CSS scope class. Routes, native draft creation, CAS `{expected, changes}`, field permissions, readonly parent, absence of deletion, API/hooks, schema, credentials, dependencies, Docker, storefront and other editors are preserved. Source inspection confirmed the protected prefix is identical to baseline and the editor differs only by its scope class.

## Source materials

The three files in `ui-fix/` were restored solely from `origin/docs/a1-ui-fix-materials-20261017`, without using that branch as the development base. The ZIP SHA-256 is:

`a2def2dae8dba60cefa4fd05d13cccfebc02a9e05dba6843b6dab7c98c67c86d`

The ZIP was extracted outside Git; every MANIFEST file hash was verified. Five fresh visual references were rendered from the unchanged HTML: desktop, mobile, filters, mobile filters and long values. Python Playwright was unavailable, so the already installed Node Playwright/Chromium rendered the same HTML. No application dependency was added. The historical `reference-checks.json` is not used as current CMS acceptance. No sample catalogue data, navigation, logo or demo dialogs were imported.

## Before and after

Before: CategoryList passed record-oriented readonly state into AdminShell, so an ordinary list displayed misleading editor messages. Filters were split between two layouts. Parent search and its pager were permanently exposed. Flex/grid stretching produced **86.5 px** select controls; global category CSS could affect other collection controls.

After: one heading/count and a permission-gated primary create action; one row for search, status, Filters and combined field/direction sorting. All 14 existing sort variants remain. A compact 380 px native modal holds parent/home/indexation filters, with a full-width touch layout. Draft choices do not alter results until Apply. Escape/cancel leaves the applied query unchanged and returns focus. Explicit Tab/Shift+Tab boundaries cooperate with Directus shortcuts. Active additional filters have removable chips and reset.

Parent search loads only while its choice is open, uses exact UUID values, server-side search and 25-row pages, and replaces the visible page rather than accumulating the catalogue. Delayed responses and responses after closing the choice are ignored.

The existing CollectionList renders a combined title/slug cell, parent, textual status, homepage flag, order and real date/null dash. Long names/parents clamp to two lines, slug to one; focus reveals the full value, and actual links open the existing card. Modified clicks retain native new-tab behavior; ordinary clicks use the existing SPA route. Mobile reuses the same rows and requests, showing title/slug, status and parent. There is one main pager. CSS is confined to categories-specific classes; native form overrides no longer leak into other screens.

The actual Directus shell/logo/navigation/AI panel are preserved. Both AI-panel states were checked. The create action inherits the installed Directus primary color; the reference's fake shell and purple global theme are not copied.

## Verification

- `node --test directus/extensions/deere-shop-product-editor/test/sections/categories.test.mjs directus/extensions/deere-shop-product-editor/test/admin-state.test.mjs`: **44 PASS / 0 FAIL**. The two added cases verify list-mode message behavior and controlled CollectionList slots; existing editor defaults remain tested.
- `node scripts/verify-local.mjs`: **PASS**, **179 backend cases**, **36 storefront cases**, dependency audit **0 vulnerabilities**, production build/client-token canary and **2 Chromium journeys**. This command checked the final production source. The later change to the runtime verifier only corrected its browser-event observer; product source stayed identical. No GitHub Actions are introduced.
- `node --env-file='<approved-own-dev-env>' verification/a1-categories-runtime.mjs --synthetic-probe`: **52 PASS / 0 FAIL**, comprising **21 live/browser checks and 31 exact-ID cleanup checks**. It includes normal and Control-click navigation, pending/applied/cancelled filters, chips/reset, all sort options, main and parent paging, stale responses, modal keyboard/focus, empty/loading, a real anonymous API read denial, and a controlled create-permission denial. Actual category card saves/create/CAS409/uncertain responses/media and product routes remain verified.
- Actual browser measurements at **1536×1024**, closed AI panel: first row **y=246.5 px**, all four toolbar controls **40 px**. Long synthetic rows are **87 px**, with the required two-line name bound. Normal-data screenshots separately confirm compact ordinary rows. At **390×844**, search/status controls are **44 px**, mobile rows hide secondary columns and the filter modal fills the viewport. No document overflow, uncaught Vue exceptions, unresolved components or invalid props were observed.
- Six served bundle SHA-256 hashes match the checked dist; all six source/dist pairs match. `git diff --check` passes. The scoped Impeccable mechanical scan returned no findings; it is supporting evidence, not a substitute for screenshot review.
- Final runtime reserved 31 IDs, created 30 fixtures and cleaned all exact IDs. The independent cleanup read across this task's four development/closure runs checked **124 reserved IDs**, with **0 remaining records/files**, all journals marked clean. Existing records were never changed or removed. No prefix cleanup occurred.

Runtime uses only the approved own `http://127.0.0.1:18056` Directus 12.1.1/PostgreSQL stack. Authenticated tests use the existing Administrator; no user/role/policy is created. Anonymous read denial comes from the actual API, while create-permission denial is a controlled UI scenario and is labelled accordingly.

## Actual screenshot evidence and review

Reference/before/normal-after artifacts, outside Git:

`%TEMP%/categories-ui-fix-3310a2c9c3c9429e844b658277395149/categories-ui-fix/`

- Reference: `categories-desktop.png`, `categories-mobile.png`, `categories-filters.png`, `categories-filters-mobile.png`, `categories-long-values.png`.
- Before, rendered from baseline modules in actual Directus: `actual/before-desktop.png`, `actual/before-mobile.png`, `actual/before-desktop-open-panel.png`.
- Final normal data: `actual/after-final-desktop.png`, `actual/after-final-mobile.png`, `actual/after-final-filters.png`, `actual/after-final-filters-mobile.png`, `actual/after-final-desktop-open-panel.png` and `actual/after-final-hashes.json`.

Final runtime/stress/state evidence:

`%TEMP%/universal-cms-a1/a1-2bded372-7a8a-47b7-b989-5e901fe442cf/`

Includes `ui-after-desktop.png`, `ui-after-desktop-open-panel.png`, `ui-after-mobile.png`, `ui-after-filters-desktop.png`, `ui-after-filters-mobile.png`, `ui-filters-parent-options-1536.png`, `ui-empty.png`, `ui-loading.png`, `ui-real-anonymous-denial.png`, `ui-create-denied.png`, editor regression screenshots, `ui-metrics.json`, `results.json` and the exact `owned-fixtures.json` ledger.

One fresh independent reviewer actually opened all five references, three before screenshots, six initial candidate/stress screenshots and five final normal-data screenshots. **Visual verdict: PASS** for layout, density, readability, table, filters, long values and mobile. One confirmed P2 (modified anchor clicks being intercepted) was fixed; narrow closure confirmed native modified-click behavior in the code. A real Control-click test then verified a new browser tab and an unchanged original list. Chromium reports that native tab through the context `page` event rather than the opener's `popup` event; the probe observes the appropriate event. No unresolved P0/P1/P2 remains.

## Bundle loading, deployment and continuation

Screenshots are actual Directus renders with live API/PostgreSQL. The checked dist is substituted only in the verification browser context, including native new tabs; bare imports reuse the installed Directus runtime. Both visual and functional artifacts record the served file hashes. This is explicitly **test-browser bundle loading**, not installation into the permanently running container and not production deployment. The container's unrelated mounted checkout and Compose configuration are unchanged; removing this task worktree does not break its mount.

**DEPLOY BLOCKED:** no confirmed own production target with safe update, backup and rollback is available. No infrastructure is created and no other project's environment is used.

Before closing PR #6 as superseded, verify that the restored materials tree in final main is identical to the materials branch. Preserve that other task's branch. Publish only after both functional and visual acceptance; verify merged ancestry/tree, synchronize local main, then remove only this task's merged branch and clean worktree.

Continuation rules: one task for one implementation owner; independent checks may run in parallel; each task starts on a new temporary branch/worktree from fresh origin/main; green functional AND visual acceptance authorizes autonomous push/PR/review/merge; deploy only to a confirmed safe own environment; remove only own merged branches/worktrees. All specifications, prompts and self-contained handoffs must be copyable blocks. Stop after A1-UI-FIX; no next editor without a new assignment.
