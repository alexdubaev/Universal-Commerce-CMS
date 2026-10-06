# Local Directus integration — final handoff

Date: 2026-10-07. **Local synthetic integration: PASS. Production: NOT READY. Merge: NOT RECOMMENDED yet.**

Repository: `alexdubaev/Universal-Commerce-CMS`. Local integration branch: `feat/storefront-directus-acceptance`. Continue [Draft PR #1](https://github.com/alexdubaev/Universal-Commerce-CMS/pull/1), source branch `feat/storefront-nextjs-dark`; do not merge main or deploy production. Verified starting PR SHA: `0f883b26e5003cb00bfad1ed7dc2586268182052`. Tested implementation SHA: `8535da036c5f2286a01e61a382589ea1864394f9`. Subsequent closeout commits contain documentation only; obtain the exact final repository SHA with `git rev-parse HEAD` or the PR head. The final user report supplies it.

## Accepted scope

The owner authorized synthetic local products now and the real catalog later. There is one human CMS operator, the owner as Administrator. No content-manager, sales-manager or other staff accounts/roles were installed. A separate non-admin technical storefront identity is required for server access and has zero generic business/file grants. Administrator credentials are used only by local provisioning/read-only acceptance observers, never by the storefront.

The existing Directus 12.1.1 Core rejects the custom native permission filters required by the access blueprint. No entitlement bypass, unrestricted grants or Administrator storefront token were used. A default-off fixed `/commerce/storefront` extension gateway authorizes the exact configured technical user before internal elevated service calls. Its fixed DTO/query bounds, current publication/parent/category gates, configured public folder and RFQ ownership constraints are the local authorization boundary. Native transport remains default and requires an instance with appropriately enforced permissions; native compatibility has unit coverage, while this local live acceptance uses the explicit gateway transport.

## Runtime and data

- Integration checkout: `C:/Users/Alexandr/.codex/worktrees/storefront-directus-acceptance/Universal Commerce CMS`.
- Only Compose project: `universal-commerce-cms-dev`, `dev/compose.yml`; Directus `http://127.0.0.1:18056`, PostgreSQL17.11 (`postgres:17-alpine`). Existing database, images, network and named volumes retained; no second CMS/database or schema migration.
- Directus was recreated to mount this reviewed checkout's extensions. Keep this checkout available while that bind mount is active. The original bootstrap checkout is unchanged.
- Published synthetic data: 15 products, 3 dynamically discovered unknown brands, 3 categories, home content, CMS page/sections and header/footer/legal navigation. Draft parents, non-indexable product, optional-field/long-title/SKU and price/availability variants support negative coverage. Seven owned files include PNG, public PDF, active HTML, private PDF, draft-only and unreferenced media.
- `commerce_profile`: RUB, `parts_request=true`, `cart=false`. Gateway orders and attachments disabled; RFQ stays primary. Browser CSV/TXT/XLSX imports convert article/quantity only.
- Mock=false and fictional fallback=false. `DIRECTUS_TOKEN` stays server-only. Gateway enabled only in ignored local configuration.
- Private ownership manifest, snapshots, service token and RFQ journal: ignored `dev/.storefront-acceptance/`. The final observer verified15 journaled durable leads, exactly one row per key with matching acknowledgement ID and technical creator. Test records are deliberately retained for local inspection. Do not erase evidence or clean by a prefix; use exact owned manifests and one sequential operator. System-record cleanup and overlapping tool runs are not atomic (P3).
- Directus/PostgreSQL remain running. Browser/probe Next processes were temporary and stopped; run the existing `npm run start:live` from storefront when a local preview is needed.

## Fixes and severity

No unresolved implementation P0/P1/P2 after independent review and final local acceptance. Exact historical findings are in [09-FINDINGS](09-FINDINGS.md).

P1 fixes: real `updated_at` adapter mapping; installed Directus deferred async asset-stream contract; actual aggregate parser/service grouping contract; relation-nested boolean filters silently ignored by Directus (now root boolean groups with relation paths), closing draft-parent child/asset disclosure.

P2 fixes: explicit live-mode fail-closed configuration; streamed byte bounds; brand-label preservation; product sitemap indexability/count consistency; fresh asset authorization and private-folder/active-content protection; native hidden-category asset reference checks; transactional navigation fixture cleanup; real HTTP404 before Next streaming. Hydration input protection and explicit keyboard skip-link behavior preserve existing browser expectations. Live harness captures delivered response bytes deterministically rather than reading browser-evicted resources; body inspection errors and strict status/token assertions remain failures.

Remaining P3: local fixture concurrency/system-record cleanup limits, bounds/tied-sort questions needing a larger real dataset. True catalog and production controls are outstanding gates, not accepted features.

## Verification

| Check | Final result |
| --- | --- |
| `npm ci` | PASS; lockfile/dependency versions unchanged |
| Storefront Vitest | 62/62 PASS |
| TypeScript | PASS |
| Mock production build | PASS |
| Live production build | PASS |
| Full Directus suite | 205/205 PASS |
| Explicit commerce races | 4/4 PASS |
| Unchanged mock Playwright | 30/30 PASS, serial24.2s |
| Real Directus Playwright | 21/21 PASS,22.0s |
| Production/full critical dependency audits | 0 vulnerabilities |
| Client token canary | PASS |
| Real technical token scan | Absent from all19 client-static files; browser request/delivered-body checks PASS |
| Tracked local secret scan | 0 matches |
| RFQ database observer/restart/conflict/invalid persistence | PASS |
| Directus outage: search500, health503, no mock fallback | PASS |
| Asset revocation and guarded restoration | PASS |
| Fresh independent whole-change closeout review | No unresolved P0/P1/P2; [15-CLOSEOUT-REVIEW](15-CLOSEOUT-REVIEW.md) |

Both browser suites cover1440px desktop Chromium and390x844 mobile Chromium/WebKit. Live coverage: home/content/navigation, all3 brands/categories, facet/sort/pagination oracle, normalized SKU/MPN plus combined facets/sort, product/gallery/codes/specifications/documents/relationships, nonindexable SEO/sitemap, strict404, actual RFQ imports/edit/remove/submit and concurrent retries, native access denials, MIME/download/private/draft/unreferenced files, keyboard menu/Escape/focus and horizontal overflow. New brand discovery is proven by three fixture brands unknown to static metadata; no route/application was added.

Native access probes return403 on business/files/assets/admin/mutation/native-write surfaces. Public PNG/PDF/HTML gateway bytes200; HTML uses octet-stream attachment. Private, draft-only and unreferenced files404; draft-parent child query0. Each observer run verified exact acknowledged DB rows and invalid input produced no row. Prior transient native Windows WebKit worker crash was followed by successful isolated and full serial runs; the final full browser run above passed without changing assertions/timeouts.

Full logs and journals remain ignored locally; expected same-key changed-payload409 messages in server logs are successful negative-test evidence.

## Small-dataset performance

Loopback, sequential requests,15 published synthetic products; warm samples. These are smoke measurements, not load acceptance or stable production p95 estimates.

| Surface | Samples | p50 ms | p95 ms |
| --- | --- | --- | --- |
| Direct gateway SKU |20|11.3|15.5|
| Direct gateway MPN |20|10.6|13.0|
| Direct gateway brand aggregate |20|10.3|12.9|
| Next catalog, desktop final live run |5|12.8|22.0|
| Next search API, desktop final live run |5|3.1|8.3|
| Next brand page, desktop final live run |5|10.4|11.7|
| Next product SSR, desktop final live run |5|11.9|12.5|
| Sitemap index, desktop final live run |5|2.7|3.1|
| Next asset proxy, desktop final live run |5|25.1|26.2|

Exact SKU/MPN search keeps the global200-candidate ceiling. Additional `product_codes` search remains disabled; codes are displayed, alias-only search is not promised. Product sitemap chunk remains1000 URLs. Architecture is prepared; **real100k load acceptance pending**. PostgreSQL query plans, larger aggregation/chunk costs, cold-cache/concurrency/p95/SSR load and crawler behavior were not accepted. No Meilisearch/OpenSearch was added.

## Remaining before production

1. Load the genuine catalog/content/contact/legal values and accept real-data quality, currency and relationships.
2. Review the selected gateway architecture and provision an own production technical identity/asset folder, or an entitled native permission setup. Never reuse local fixture credentials.
3. Determine domain/host/reverse proxy/TLS/secrets, health checks/logs/backups/resource/cache topology and decide whether a storefront Compose service is needed. This stage used the existing CMS Compose plus temporary native Next processes.
4. Add deployment CSP and distributed edge rate/abuse controls after topology is known; no guessed site-wide CSP/in-memory multi-replica limiter was added.
5. Perform real100k/concurrency/SQL/sitemap/performance/security acceptance. Keep RFQ<=100 items, exact search, no fake stock/customer prices. Orders/attachments require a separate reviewed capability stage.
6. Obtain owner production/merge approval. Draft must remain Draft until that acceptance is explicitly authorized.

## Reproduction

In the integration checkout, use ignored active local configuration and existing runtime; never print or commit its values:

```text
cd storefront
npm ci
npm test
npm run typecheck
npm run build:live
npm run test:e2e:live
npm run probe:live -- --runtime-approved
```

The probe additionally requires `DIRECTUS_URL=http://127.0.0.1:18056` in its process environment and uses only the existing isolated CMS. It writes unique synthetic keys and restores the owned document with CAS. Run fixture/probe/write tools sequentially. Full server checks: `npm test` from directus and `node --test test/commerce-races.test.mjs`. For mock E2E build with mock=true and then `npm run test:e2e -- --workers=1`; final local mock verification used a canary token and never the administrator token.

## Logical commits through tested code

```text
f203169 fix(storefront): align Directus product timestamp mapping
644ec9c fix(storefront): honor explicit live mode without CMS URL
c728306 docs(integration): record baseline audits and isolated workstreams
bcda8a4 docs(integration): lock guarded Core transport and ownership
a4a8848 Guard storefront request bodies and asset revocation
4d0b69b Add optional storefront gateway transport
4ace621 Preserve stored brand labels in catalog filters
706d5af Guard interactive controls until hydration
4b3897f Allow page sections through storefront gateway
1f24590 docs(integration): record integrated frontend verification
df0f205 docs(integration): record browser regression acceptance
2cee417 Exclude non-indexable products from sitemap
c32d06d Align mock sitemap count and chunks
9aa07cd docs(integration): constrain operator roles and live acceptance scope
e3e9abc docs(integration): record transactional fixture probe and SEO checks
18e58b1 Add guarded Directus storefront gateway
371a3f3 Fix storefront gateway adapter edge cases
5db421e Allow bounded 1000-row product sitemap reads
1613a82 feat(dev): add default-off storefront gateway config
a5732e7 feat(dev): add owned storefront acceptance fixtures
bc41d79 Harden storefront acceptance fixture ownership
3f1ec89 Use native Directus system endpoints for fixture reads
68f3f77 Enforce category publication in gateway asset reads
5bc9eb5 docs(integration): record review fix and provisioning checkpoint
fb649f8 Use valid reserved email for service fixture
700499e Reconcile known legacy fixture page ownership
8ff7240 docs(integration): record singleton blocker and activation scope
7ce3b73 Add isolated live storefront acceptance suite
47ec055 Add isolated live durability and revocation probes
a196a9f Harden live probe ownership and rollback guards
1f54483 Harden live acceptance evidence and probes
61d1509 Use concrete live auth denial probes
e7f97a6 Preserve unreadable live evidence journals
f0e76c2 fix storefront deferred asset streaming
7453f84 Verify live fixture facets and gallery interactions
0232da7 Safely resume storefront fixture configuration
5b7e81e docs(integration): record live media and singleton findings
5d4f9c7 Read home singleton ownership through projection
8ded88a Create home singleton through collection update
7999db1 Complete required synthetic homepage fields
f5a068e Guard navigation fixture cleanup with snapshot checks
b38daaf fix storefront brand aggregate query parsing
e38f94e accept Directus aggregate count array shape
e055ea6 pass brand grouping to Directus query service
95e2eaf enforce published product asset references
8325d65 Preserve real 404 status for unknown CMS slugs
f1483cf Avoid async request inspection after test teardown
a9e78d6 allow scoped category visibility asset filters
d8fea8c Prevent asset authorization through draft categories
a72ac3e docs(integration): reconcile baseline and runtime findings
9680294 Drain live browser token checks between navigations
8535da0 Inspect live response bodies before browser delivery
```
