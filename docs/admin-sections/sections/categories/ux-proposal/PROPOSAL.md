# A1-UX-FIX #17 — proposal awaiting owner approval

Historical proposal record: the owner explicitly approved this shown variant on 2026-10-23 and authorized autonomous checked merge/deployment to local Directus 127.0.0.1:18056. Statements below describe the state at capture time, before implementation. Current execution and the separately approved Next.js security exception are recorded in ../A1-UX-PLAN.md.

Date: 2026-10-23. Base: `ca03a0bb619b55e24b0084e4c84950c587b9ee61`.
Branch: `codex/a1-ux-categories-issue17`; isolated worktree: `D:/codex/ucms-a1-ux-issue17`.

This directory contains current installed UI captures and a separately rendered HTML proposal. It is not an installed fix. Product source, dist, database, installed extensions and deployment remain unchanged. No test fixtures were created.

Preview gallery: `http://127.0.0.1:18117/index.html`; standalone mock: `prototype.html`. The temporary loopback-only documentation preview is Python HTTP server PID 59312. Preserve it/worktree while awaiting approval. Native Directus shell/logo remain unchanged in implementation; the mock uses a neutral shell placeholder.

Final mock checks: inline JavaScript syntax PASS; 16 proposed screens captured at both requested sizes, no document horizontal overflow measured; all 46 screenshot dimensions verified. Proposed badge contrast: published 6.54:1, draft 7.02:1, archived 6.29:1. These are prototype checks only. Application tests, real write scenarios, review, release gate, publication and deployment have NOT RUN and must follow explicit approval. Current `git diff --exit-code -- directus storefront scripts dev AGENTS.md` passes with only this isolated proposal directory untracked.

## Grounding and predecessors

Read issue #17 and order #22 completely, including comment feeds (both empty), local AGENTS, ADR-002, admin CONTRACTS/DESIGN-SYSTEM, testing policy, A1 integration/UI-FIX acceptance and A0/products HANDOFF. A0 PR #23 merged as `97c3339178f1febee5ed3c23f3b2e6dd2417f5c8`; products PR #24 merged as current main. Owner acceptance is recorded in their HANDOFF/PRs. Installed product src/dist index and editor state match final products manifest. A0 shared modules and categories match current main. Existing single scalar SEO title/description inputs and preview are already an A0 fix; do not implement that again.

Current installed categories SHA256: `a76fed9f3125e6107aca407478bfa4f7406befbb2896c6106041a9209d239ed8`.
Installed products index SHA256: `db4e030e00be2cd8eb84c70900c68cb8ff5602967bf0e6e10f72aa8b4e1af9f6`.
Installed products editor state SHA256: `89e23bdf963f45af74069a5cde068ecadccd063c32f664fe780b2a1bc2a0f40e`.
HTTP-served `/extensions/sources/index.js` returns 200 and SHA256 `6369f43ea733132526c6d6520104142dbda5d4165bb8df8b26fa72306e22706e`, matching products final runtime evidence. Current authenticated UI is usable. Unauthenticated `/server/health` returns 403, so this is not recorded as a health-check PASS.

## Confirmed target

Windows local development Directus 12.1.1 at `http://127.0.0.1:18056`, Compose project `universal-commerce-cms-dev`; associated storefront `http://127.0.0.1:3000` must be rechecked before release. Running Directus extension bind points to `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions`, rather than local main. Existing database and uploads are the project's isolated named volumes. This is the proposed deployment target after approval. No public or production target has been established.
Read-only check of storefront port 3000 returned ECONNREFUSED during proposal preparation. It was not started before approval; after approval, inspect its existing safe local run configuration before verifying category effects. No site screenshot or runtime storefront effect is claimed in this proposal.

Before any later deployment: recheck ownership, no competing writer/deploy, candidate/merge artifact hashes; back up affected installed extension artifacts and record exact hashes; prepare artifact-only rollback and post-release checks. Do not recreate Compose or roll back database contents over concurrent records.

## Proposed changes

- Preserve accepted list layout, toolbar/filter dialog, 25-row server paging, bounded parent lookup, stale-response guards and stable ID tie-breaker. Retain only honest name/address/modified/order sorting; remove parent/status sorts and ineffective homepage flag from normal list/filter/sort.
- Preserve list search, filters, sort and page across card navigation within the current session; no form drafts in persistent storage. Current return from a synthetic category card reset the search.
- Use readable 12px or larger status badges on mobile with stronger status colors; distinguish empty catalogue, no results, denied and network failure.
- Keep form tabs and native field/media components. Use human labels and field errors with tab/focus navigation. Show parent name or top level read-only with a plain limitation. No parent mutation or delete.
- Display publication status in Russian and make change an explicit separate intent, confirmed in the form before Save. Creation stays draft, unknown statuses remain unchanged. Ordinary field saves retain current publication.
- Keep A0's one SEO title/description input and preview. Preserve server scalar/JSON synchronization, unknown SEO keys, permissions and readback. Rename section to «Поиск и ссылки»; no second editor or shared dictionary.
- Keep image selection and «Описание изображения» with the precise limitation that the current site does not render category images. Unlinking retains the file.
- Move inactive stored settings out of normal editing into a readable read-only summary in «Дополнительно»; never clear or serialize over their values. These include homepage flag, icon/alt, OG image, redirect, FAQ, selection guide, internal links, SEO text and translations. No raw JSON/UUID in the ordinary manager flow.

## Field effects checked in current main

Chain inspected: category editor → commerce-integrity SEO hook → commerce-api category allowlist → storefront `getCategories`/`mapCategory` → homepage/header/catalog/about/category/sitemap consumers.

Active: title/slug/status, heading, intro/description, SEO title/description, indexability and sort order. Homepage shows first eight published categories ordered by sort order/title, without consulting homepage flag. Category images are fetched and asset access exists, but current renderer does not display them. Icon/alt, OG image, FAQ/guide/links/SEO text, redirect and translations have no current category renderer. SEO OG synchronization alone does not create an OpenGraph-image tag. Public route remains `/category/{slug}`.

Current UI reports 21 categories, below existing public query limit 200. Above 200, getCategory can miss published categories; this remains a separate storefront/API issue, not a UI filter fix.

## Scope after approval

Allowed production changes only: `directus/extensions/deere-shop-product-editor/src/sections/categories.js`, matching `dist/sections/categories.js`, focused `test/sections/categories.test.mjs`; a narrow category-only helper if demonstrated necessary; category documentation/evidence. Shared A0/index, other sections, storefront, schema/SQL/backend/permissions/secrets/dependencies/CI/infrastructure and unrelated worktrees remain protected.

After explicit approval: bounded worker implementation, narrow meaningful tests, actual Windows Directus checks using only owned synthetic fixtures/exact-ID journals, fresh independent review, bounded fixes, visual match, `node scripts/verify-local.mjs` on the exact candidate, commit/push/PR/merge, safe local installation, post-release checks and screenshots. A2 remains excluded.

## Capture limits

All `before-*` images are captured in this run from current installed Directus, using existing synthetic categories or a no-match search; desktop 1536×1024, mobile 390×844. No current empty collection, native denied role, conflict or uncertain write was manufactured before approval. Such additional states are clearly proposed mock states only, with no fabricated «До». Administrator session does not establish manager RBAC acceptance. This proposal is not a functional release test or WCAG certification.
