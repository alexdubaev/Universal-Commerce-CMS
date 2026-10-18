# A4 Articles Editor — acceptance record

**Draft implementation: public runtime acceptance blocked; no merge or deploy.**

## Delivery and boundaries

Articles is registered beside Products, Categories, Home and Pages. A4 provides server pagination (25), title/slug/excerpt search, staged filters, sorting, modifier-click links and five native tabs. It reuses A0 AdminShell, CollectionList, NativeFieldGroup, MediaPicker and createEditorState. No shared primitives, schema, API/hooks, permissions, storefront, dependencies or Docker configuration changed. The index registration is a separate integration commit.

HTML uses native `input-rich-text-html`. Updates send changed allowed fields through guarded CAS. Publication is separate. Native create always posts a validated draft; duplicate and uncertain retries are blocked. There is no invented preview, revision workflow, canonical/noindex field or block conversion.

The original approved ZIP is preserved; SHA-256 matches `e437744fc3aece1312c36e427e92bd27f140e548e25d358126655e71d7fcf203` and all 30 internal manifest entries match. Approved A4 and `docs/content/articles.md` supersede stale generic Flexible Editor wording in CONTRACTS.md for Articles.

## Environment and verification

Windows 10.0.26200, Git 2.54, Node 24.15. Baseline/main `f98b5209602eed273fc46fda2ec441b6f0620d6a` includes A3 PR #10. Branch `codex/a4-articles-editor` has its own worktree; the original checkout's unrelated dirty work is preserved.

The existing own Docker project `universal-commerce-cms-dev` was verified by project/service labels, `dev/compose.yml` source, loopback port, extension bind and named volumes. Versions: Directus **12.1.1**, PostgreSQL **17.11**. Localhost alone was not ownership evidence. Acceptance uses **browser module substitution in actual Directus at 127.0.0.1:18056**. The mounted extension belongs to the separate storefront-directus-acceptance worktree; nothing was installed, restarted or reconfigured.

Product gate: `node scripts/verify-local.mjs` — **262 backend/extension checks, 36 storefront checks, zero audit vulnerabilities, production build/type checks/token canary, two critical Chromium journeys**. Focused command: `node --test directus/extensions/deere-shop-product-editor/test/sections/articles.test.mjs` — **22/22**. Source/dist parity and `git diff --check` pass. New logic received RED/GREEN checks. No GitHub Actions were added. Logs/provenance are in [runtime evidence](a4-runtime-evidence/README.md).

The first clean-worktree baseline stopped because Vitest was unavailable. Installing the existing lockfile with `npm ci --prefix storefront --no-audit --no-fund` changed no manifests; the complete baseline then passed. Missing infrastructure was not reported as a product pass.

## Actual runtime and data

Seven synthetic backend checks passed in run `e5241829-0c16-4d2a-99c3-637bec391d6a`, including concurrent CAS (one winner/one 409), SEO hook projection and anonymous mutation denial. Actual UI runs `83d9dc59-8684-4458-98e5-c99833ea9def` plus narrow closure `8122679d-7303-4bd9-ae68-d04b4b7976df` collectively close 15 scenarios. The earlier run exposed writing width and two harness issues (incomplete synthetic product fields and expecting an anchor for a navigation button); the narrow closure passed those cases. This is broad-plus-narrow evidence, not one uninterrupted final run.

Actual checks cover native HTML typing/delayed source dialog, mount/cover-only and cross-tab preservation, file library/detach, relations, native/scalar SEO, isolated status, real CAS409, lost update/create acknowledgements, native draft create/double click and UTC serialization. Exact opaque HTML, `content_blocks`, `editor_nodes`, unknown/long relationship arrays, source JSON and publication instant remain unchanged on unrelated saves. Native HTML changes only after user action. New relations remain identifier arrays; unknown source shapes stay readonly. SEO retains unknown JSON keys and arbitrates projections. Detaching media does not delete the file.

The actual acceptance administrator has full article read/create/update fields. Anonymous guarded mutations return 403. Item readonly and list503/retry scenarios use **controlled browser responses**, not a newly tested restricted role. Credentials and exact IDs stay in private journals outside Git; only synthetic records/files were mutated, under one named Windows writer mutex.

Drafts require `published_at` under the real schema; the UI explains that date does not mean publication. Local datetime serializes to UTC; unrelated saves do not replace it. Draft/published/archived remain the actual statuses. Future publication is a derived label, and published saves warn of immediate website effects.

**Public draft/future/due availability remains unverified.** Existing service credentials confirm health/products200, while `/commerce/storefront/items/articles` returns **404 invalid_request**. Read-only inspection confirms the mounted older gateway excludes Articles; current main supports them. Updating this protected backend/runtime is outside A4 scope. Deterministic publication tests pass but cannot replace the live gate.

## Visual acceptance and review

Real Directus captures cover 1536×1024, 1024 wide and 390×844; native right panel open/closed; list, main, material, relations, SEO, additional, create, filters, readonly/error/conflict and long values. No document-width overflow was detected. Native chrome/theme/metadata controls explain differences from the offline reference.

One fresh independent reviewer found no confirmed P0/P1/P2 code issue. Desktop/mobile comparison accepted the main/material/list/relations/SEO/create/readonly/conflict layouts. It found one material visual mismatch: filters at the viewport corner instead of desktop center/mobile bottom sheet. The reviewer made one scoped CSS fix; run `bc13cf65-0fd1-4c3a-8a9c-a629f8a0dff7` passed narrow geometry/interaction checks, and the reviewer accepted its actual desktop/mobile screenshots. The mobile sheet retains 16px side gutters instead of the reference's full bleed. The final full local gate passed on product commit `144c26b`; later changes are documentation/evidence only.

The stock native HTML editor independently requests a `langs/ru-RU.js` URL that returns HTML, producing `Unexpected token '<'` without A4 too. The harness records this baseline error separately and fails other unexplained page errors. Protected runtime/dependencies were not changed to hide it.

## Cleanup and remaining gate

Final exact-ID audit across **18 journals** confirmed zero remnants: **129 article IDs, nine files, two categories, two products**. One crashed early probe was recovered using exact journal IDs. No prefix deletion or real-content mutation occurred.

Keep branch/worktree while the PR is Draft. Main is unchanged; documentation PR #11 remains open until its exact materials reach main. **DEPLOY BLOCKED:** no installed candidate or confirmed production backup/update/rollback procedure.

Next: separately authorize a safe update of the existing confirmed test runtime's commerce API to the current Articles contract, then run real draft/future/due public probes. Close the missing gate before ready/merge. Do not create infrastructure or start the next section.
