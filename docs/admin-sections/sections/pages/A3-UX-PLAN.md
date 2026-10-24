# A3-UX-FIX Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Execute tasks with one writer in this worktree. Owner policy requires one useful whole-change review, a bounded fix pass and narrow closure; no formal repeated-review loop.

**Goal:** Implement the A3 proposal explicitly approved by the owner on 2026-10-24, including the narrow storefront URL configuration bridge, then verify, merge and deploy to the confirmed local Windows runtime.

**Architecture:** Keep the existing Vue/Directus editor, native fields, A0 state machine and independent child controllers. An authenticated read-only commerce endpoint supplies an instance-local validated public base. Pages alone adapts form grouping, copy, URL composition, slug suggestion and list navigation context.

**Tech Stack:** Existing zero-dependency commerce endpoint, Vue/Directus 12.1.1, Node integration tests, Windows PostgreSQL/Directus runtime; existing storefront unchanged.

**Spec:** issue #19, order #22, `ux-proposal/PROPOSAL.md`, approved `ux-proposal/after-*.jpg`; approval is the owner's explicit «Утверждаю» after the paired images and URL scope explanation. No second routine implementation/publication permission is required.

## Global Constraints

- BASE `22c2892e3ee632e0a08e0f9ba27bc47b7dc649bc`; worktree `C:/Users/Alexandr/.codex/worktrees/a3-pages-ux-issue19/Universal Commerce CMS`; branch `codex/a3-pages-ux-issue19-20261024`.
- Only A3. No A4, shared A0 rewrite, schema/SQL/access/credentials/dependencies/CI/storefront changes, new builder or preview/version flow. Source/system page safety, CAS, child buffers/saves and server SEO hooks remain.
- Additional approved URL-only files: commerce API src/dist index, new `src/storefront-config.mjs` and paired dist, `directus/test/storefront-config.test.mjs`, one passthrough in `dev/compose.yml`, documented empty key in `dev/.env.example`. No hardcoded public URL default.
- Pages source/dist/test; existing `verification/a3-pages-runtime.mjs`; page-specific docs/evidence. Runtime installer/backup/ledger scripts may live privately under `D:/codex/ucms-release-backups/a3-ux-*`; no secrets in repo/logs.
- Confirmed target: own Windows Directus 12.1.1 `http://127.0.0.1:18056`, Compose `universal-commerce-cms-dev`. Existing bind is `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS/directus/extensions`. Preserve its unrelated files/worktree. Public local storefront from this same project uses `http://127.0.0.1:3000`; verify provenance/launch and keep loopback availability after release. No production target inferred.

## Review Focus

- Unsafe or unavailable public base must not create a misleading link; URL derives from configured instance base and saved published route, including a base path prefix.
- Scalar-only SEO editing must preserve JSON-first projections, null/false inversion, unknown keys and unchanged hydration.
- Route navigation must retain list search/filter/sort/page without leaking dirty buffers across identities or bypassing native guards.
- Parent/child saves and status changes remain independent, uncertain outcomes never repeat automatically, protected pages remain blocked.
- Installed source and served aggregate must match the verified release; artifact/config rollback must refuse foreign changes and never restore an entire DB.

## Task 1 — Instance-local storefront base

**Files:** commerce API `src/index.js`, `dist/index.js`; new `src/storefront-config.mjs`, `dist/storefront-config.mjs`; `directus/test/storefront-config.test.mjs`; `dev/compose.yml`, `dev/.env.example`.

**Interface:** `GET /commerce/config/storefront` → `{data:{public_base_url:string|null}}`, authenticated user required, no-store. `normalizeStorefrontBaseUrl(value)` validates HTTP(S), no credentials/query/hash/control characters, preserves safe path prefix; missing/invalid → null. Handler performs no outbound requests or DB mutations.

- [x] Write and run failing handler-boundary tests for anonymous denial, auth missing/invalid config, safe configured HTTP(S)/prefix and no secret echo. Actual HTTP auth is additionally checked in Task 3.
- [x] Implement and register only this route, add exact source/dist copies and one env passthrough with empty example.
- [x] Run `node --test directus/test/storefront-config.test.mjs`; lead inspected actual diff and repeated the 2 passing cases before pages depends on it.

## Task 2 — Approved pages editor

**Files:** pages source/dist, `test/sections/pages.test.mjs`, page-specific consumer documentation.

**Interfaces:** consume Task 1 endpoint once per editor context through existing useApi; expose `pagePublicUrl(base, savedRecord)` and a small local Cyrillic slug generator for behavior tests. Reuse categories' current list-query route context pattern and A2 opt-in block presentation without modifying shared files.

- [x] Add failing behavior cases for Russian slug/manual override, saved published URL/prefix/unsafe/missing base, list context round-trip and empty-state distinction, scalar SEO + unknown JSON/readback, protected system/source records.
- [x] Implement approved four tabs/grouping/copy; `seo_text` moves to content without storage transformation; sole scalar SEO inputs and native media; rare disclosures auto-open for validation, focus required field.
- [x] Retain draft-only standard create, separate publication/status dialog, fallback warnings, buffers and uncertain-write recovery. Remove only misleading type/status alphabetical choices, preserve server paging. All visible errors/comparison/aria labels human-readable.
- [x] Run `node --test directus/extensions/deere-shop-product-editor/test/sections/pages.test.mjs` and relevant page-sections/admin-state tests. Lead inspects diff, src/dist equality and evidence.

## Task 3 — Windows installed runtime acceptance and recovery

**Files:** existing `verification/a3-pages-runtime.mjs`; docs/evidence under pages; private operations artifacts under own A3 backup directory.

- [x] Prepare private baseline/hash manifests, exact own fixture journal, project/mount/volume/port checks and runtime mutex. Never print env or credentials.
- [x] Prepare guarded artifact/config installer and rollback. Back up pages, changed commerce artifacts, exact compose/env configuration before alteration. Rehearsal returned exact original artifact/config hashes and served aggregate `28eedfd568f3d9228bef6b70ee1bd6fdaaac5a2049c0673d99e77e4b41eb9349`; no DB restore. First preflight failure (missing final newline in original env) was fixed and rechecked before successful rollback.
- [x] Install candidate on own runtime; add only approved env passthrough/config from known storefront runtime; restart/recreate only own Directus as required. Candidate 4 endpoint auth/anonymous 200/403, health ok, Directus 12.1.1, source/dist artifact hashes and served aggregate checked. Further visual corrections require a new receipt; this is candidate acceptance, not final release.
- [x] Launch unchanged project storefront with existing own gateway, verify provenance and split-origin saved page URL; write only exact journal-owned synthetic pages/blocks/files, clean exactly those IDs.
- [x] Native form create with Russian name, manual slug, independent h1/text/image, SEO unknown-key preservation/readback, list context/empty/errors, two child buffers, parent stale/CAS/uncertain outcomes, source/system protections, public link/status/fallback. Distinguish real API behavior from controlled transport faults; do not claim missing manager role coverage.
- [x] Capture installed desktop 1536×1024/mobile390×844 and targeted1024/320/focus/last fields; compare with approved proposal. Fix concrete mismatches within scope.

## Task 4 — Review, local gate, publication and release

- [x] Lead runs relevant checks, launches one fresh independent reviewer with original spec/BASE/diff; confirmed in-scope findings fixed in bounded pass, then narrow closure.
- [x] `node scripts/verify-local.mjs` on exact final source; no hosted CI. Preserve failing evidence while recovering infrastructure; never claim syntax is runtime acceptance.
- [ ] Fetch origin; incorporate changed main if any without reset/rebase/force push, recheck relevant resulting changes. Commit, push, create/attach PR, merge after required checks. Verify ancestry/tree equality and synchronize clean local main.
- [ ] Deploy exact merged artifacts through guarded installer to the confirmed target, verify health/version/served aggregate/config/saved URL/UI, collect final installed screenshots.
- [ ] Verify own fixture cleanup; remove only own merged branch and clean unused task worktree. Do not delete runtime bind. Save durable HANDOFF with base/candidate/merge/release SHA, PR, tests/review, deployment address/version, backup/rollback, screenshots, cleanup and limitations.

## Rulings and STOP conditions

Owner approval explicitly includes the URL bridge/backend/config surface above. No repeated permission request for those routine steps. Stop only for substantial design deviation, new protected scope, ambiguous target/ownership, missing safe access/rollback, foreign changes or unresolved significant failures. Diagnose ordinary technical failures and continue. No product test or review is reported before it actually runs.

Ruling: list context uses the existing categories' module-local query-only memory pattern rather than introducing new router query machinery. It covers the requested card/back journey, contains no item data, and still reloads permissions/metadata on every mount. Browser refresh persistence is not promised.
