# Real Directus integration acceptance — 2026-10-06–07

Status: baseline complete; real-catalog acceptance blocked. This is not production acceptance.

## Scope and plan before implementation

Requested behavior: connect the existing storefront to its own real Directus with a least-privilege server identity, mocks/fallback disabled, preserving routes, design, search and RFQ semantics.

1. Confirm PR/worktree and collect read-only runtime baseline.
2. Prove contract mismatches against the running CMS before fixing adapters.
3. Fix only the proven timestamp mismatch in `storefront/lib/catalog.ts`, with regression coverage in `storefront/tests/catalog-timestamps-live.test.ts`.
   Scope extension after a separate reproduction: fix explicit `STOREFRONT_MOCK_MODE=false` falling back to mock when `DIRECTUS_URL` is absent, in `storefront/lib/directus.ts` with `storefront/tests/directus-config.test.ts`.
4. Run relevant deterministic checks, inspect the diff, and obtain independent review.
5. Resume service identity and real-data E2E only after real content and an instance capable of enforcing the required permissions are available.

Allowed files for the current code change: the two adapters and tests above, this report, `storefront/FINAL-REVIEW.md`, and `storefront/INTEGRATION-HANDOFF.md`.

Protected in this change: Directus schema/extensions/access, credentials, profiles, Compose/deployment, visual components/styles and public route contracts. Runtime credentials remain in memory during read-only diagnostics; they are not written into the storefront. No source-site content or identifiers are copied. Stop if a change needs another surface.

## Baseline

- Repository: `alexdubaev/Universal-Commerce-CMS`.
- Initial checkout: clean `codex/bootstrap-standalone-cms`, HEAD `933f8a6b257202a51697a6821f9d128ba074d019`.
- After `git fetch origin`, open Draft PR #1 head is `0f883b26e5003cb00bfad1ed7dc2586268182052`, branch `feat/storefront-nextjs-dark`, base `main`.
- All six GitHub checks at that SHA succeeded (push and PR workflows). These checks use mock storefront data, not the local CMS.
- New managed worktree, branch `feat/storefront-directus-acceptance`, based on that PR head. Original checkout untouched.
- Only inspected Compose project: `universal-commerce-cms-dev`, from the original checkout's `dev/compose.yml` and ignored `dev/.env`.
- Running services: `db` (healthy), `directus` (running). PostgreSQL is `17.11`; Directus server API reports `12.1.1`.
- URL: `http://127.0.0.1:18056`; database has no published host port.
- Authenticated health: HTTP 200, `status=ok`. Anonymous health and product reads: HTTP 403.
- Repository profile: `commerce`; runtime currency `RUB`, `cart=false`, `parts_request=false`.
- Users: one. Roles: only Administrator. Policies: Administrator and Public. No business collection permissions/service identity installed; permission API returns 20 system defaults.
- Products: one synthetic draft, zero published. Published brand groups: zero. Categories: zero. Files: zero.
- Pages: one draft. Home singleton: draft. Navigation: zero.
- Strict access setup is not installed. ADR-002 and prior local acceptance record Directus Core rejection of required custom permission rules. No new access apply or rule stripping attempted.

## Proven issue

P1 — the catalog/product/sitemap adapter requests `products.date_updated`, which is absent from both the canonical blueprint and live fields API. Directus rejects even an Administrator query containing it with HTTP 403 / FORBIDDEN. Querying `id,slug,updated_at` with the same publication filter and popularity sort succeeds with HTTP 200 (empty published dataset).

Minimal repair: query `updated_at` and map it to the existing storefront `date_updated` property, including sitemap output. Do not add a CMS field or alter consumers.

Fixed and regression-tested. Replaying the adapter's complete product field list against the real CMS now returns HTTP 200; the corrected sitemap query also returns HTTP 200. Both return zero rows because there are no published products.

P2 — explicit live mode could silently become mock mode when the Directus URL was missing. A runtime probe with `STOREFRONT_MOCK_MODE=false`, `STOREFRONT_ALLOW_MOCK_FALLBACK=false`, and no `DIRECTUS_URL` returned `isMockMode()=true`. Explicit live mode must remain live and report a configuration error on fetch; retain existing implicit developer-mode defaults.

Fixed and regression-tested. Explicit live mode now stays live; missing URL rejects before network access. Default developer-mode behavior is preserved.

No new P0 finding. No P3 code change was needed. Local WebKit failures below are unresolved acceptance failures; their cause has not been established as a storefront defect.

## Permission capability evidence

Read-only inspection of the installed Directus API `dist/services/permissions.js` and `dist/license/entitlements/lib/custom-permission-rules-enabled.js` confirms the `custom_permission_rules_enabled` gate. A nonempty row filter, validation/presets, or a field list excluding `*` counts as custom; recommended app defaults are exempt. Plain collection-wide access is not equivalent to published-only catalog access or private-file isolation.

The project's prior local acceptance documents the Core rejection. No new permissions were created, and no entitlement bypass or broad-access fallback was attempted. The target instance must be capable of enforcing the policy before service identity acceptance proceeds.

## Blockers and acceptance limits

- No real published catalog or content/media exists here. Publishing synthetic seeds would not satisfy real-data acceptance.
- No least-privilege service identity exists. Administrator is used only for read-only diagnostics and is not a storefront solution.
- Required strict permission rules need a supported/entitled instance or an explicitly reviewed alternative architecture. Do not broaden file access or bypass edition controls.
- RFQ profile is disabled; real RFQ persistence/retry acceptance has not run. Cart stays disabled.
- Existing Playwright configuration forces mock mode. Existing `*-live.test.ts` tests stub Directus requests; their names do not prove real-Directus E2E.
- No 100k catalog, SSR/API p95, concurrency/load, query-plan or sitemap throughput acceptance is available.
- Deployment topology, CSP and edge abuse controls remain unresolved. No production changes, merge or deployment performed.

## Verification

Fresh local verification on Node 24.15.0 / Windows:

| Check | Result | Scope |
| --- | --- | --- |
| `npm ci` | PASS, lockfile unchanged | Storefront dependency install |
| Storefront Vitest | 43/43 PASS | Includes 10 new timestamp/config tests; Directus requests are stubbed |
| TypeScript | PASS | `npm run typecheck` |
| Next production build | PASS | Explicit mock build, not live deployment acceptance |
| Production and full critical dependency audits | 0 vulnerabilities | Both audit commands completed |
| Client-bundle token canary | PASS | Non-secret canary absent from `.next/static`; no real token used in build |
| Directus full suite | 170/170 PASS | Offline regression suite |
| Explicit commerce race suite | 4/4 PASS | Offline concurrency tests, not real database submissions |
| Playwright full local suite | 27/30 PASS, 3 FAIL | Mock server; desktop/mobile Chromium 20/20, mobile WebKit 7/10 |
| WebKit serial repeat | 7/10 PASS, same 3 FAIL | `npx playwright test --project=mobile-webkit --workers=1` |
| Live CMS query probes | HTTP 200 after timestamp fix | Diagnostic Administrator; zero published rows |
| Real storefront/Directus E2E | NOT RUN | Real data and least-privilege identity missing |
| 100k performance/load | NOT RUN | No real catalog |

WebKit failures: suggestions after filling article search, bulk list import after filling textarea, and Tab focusing the skip link. The serial repeat reproduces all three. The original PR's Linux CI at the baseline SHA was green; that does not establish Windows WebKit acceptance. No test was skipped, weakened, or given a longer timeout to obtain a pass. Preserve these failures as pending investigation.

Single empty-catalog diagnostic timings: corrected complete catalog query 11.55 ms, corrected sitemap query 7.25 ms. These are individual local HTTP observations, not p95, load measurements, or 100k acceptance.

First independent review found no P0/P1/P2 in the bounded adapter changes and reran 43 unit tests and TypeScript successfully. Full production security/permission acceptance remains open. Final review and commit identifiers are reported separately after finalization.

Recommendation: keep PR #1 Draft and do not merge. Continue with real data, enforceable least-privilege permissions and deployment acceptance.
