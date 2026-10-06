# E2E acceptance and Windows WebKit diagnosis

Date: 2026-10-07. Baseline: `0f883b26e5003cb00bfad1ed7dc2586268182052`; work branch: `feat/storefront-directus-acceptance`.

## Scope and acceptance boundary

Requested behavior: define evidence-backed acceptance for a real local Directus integration and identify the three reproducible Windows WebKit failures before fixing them. This report owns only `docs/storefront-live-integration/08-E2E-ACCEPTANCE.md`. Application, test, CI, credentials, schema, roles, Docker, deployments, and source-site data were not changed by this audit. Diagnostic scripts and JSON live only under ignored `storefront/.next/acceptance-evidence/`.

User-approved synthetic records may be created in the existing isolated local CMS. They prove local integration against that CMS, not real-catalog or production readiness. The storefront must use a supported least-privilege identity, explicit `STOREFRONT_MOCK_MODE=false`, and `STOREFRONT_ALLOW_MOCK_FALLBACK=false`. Administrator remains diagnostic/provisioning only. The Directus Core permission capability issue is still a hard precondition; fixtures alone do not resolve it.

## Existing evidence and what it proves

The existing suite has ten tests across desktop Chromium, mobile Chromium, and mobile WebKit. The recorded full Windows run passed 27/30: Chromium 20/20; WebKit 7/10. A single-worker WebKit rerun reproduced the same three failures. These are mock-server runs. Neither full suite was rerun in this audit because the existing reproduction was stable; the audit ran smaller diagnostic controls instead.

`storefront/playwright.config.ts` always starts the production server with mock mode enabled and `reuseExistingServer=false`. The CI E2E job also builds and runs with mock mode on Ubuntu. Current `*-live.test.ts` files replace `directusFetch` with a stub: they validate request shape and adapter behavior, not real HTTP, RBAC, database persistence, or file authorization. The existing mock lead/order endpoints derive an ID directly from the request key and always return `replayed:false`; matching IDs under concurrency are consequently not proof of durable deduplication. The offline Directus race tests use a transaction/service harness rather than the local PostgreSQL instance.

| Acceptance area | Existing coverage | Required live evidence / current status |
| --- | --- | --- |
| Home, catalog, category, brand routes | Mock browser renders eleven named brand routes; content adapter unit tests stub CMS | Render the fixture manifest's actual three brands/categories and published CMS content; assert draft/archived content absent. NOT RUN |
| SKU/OEM search, suggestions, normalized punctuation | Mock browser search and unit normalization; live-named search tests stub candidate requests | Actual `/commerce/search` through storefront `/api/search`, exact and normalized SKU/OEM, ambiguous articles across brands, absent query, filters/sort/pagination. NOT RUN |
| Product detail and child data | Mock codes/compatible heading; mapping regression tests | Actual specifications, images, documents, codes and relations, including unpublished child records and unpublished parents. NOT RUN |
| Facets, price sort, pagination | Mock filters; stubbed 40-candidate tests | Fixture expected IDs/order/count, query parameters, page boundaries and query+facet combinations. NOT RUN |
| CMS media proxy | Mock invalid UUID returns 404; stubbed first reference and MIME policy | Known published file bytes/headers, unpublished/private/unreferenced UUID denial, missing file, cross-parent cases, no upstream credentials. NOT RUN |
| RFQ browser list | Mock add, quantities, manual import, submit | Preserve `smtechno-request` across reload, remove/clear, same-article/brand ambiguity, CSV/TXT/XLSX, real submitted lead. NOT RUN |
| Lead persistence and retries | Mock concurrent same-key IDs; client key unit tests; offline race harness | Real HTTP response + one committed lead row per key, retry after lost acknowledgement/server restart, changed-payload conflict, denied role and atomic failure. NOT RUN |
| Orders | Mock concurrent same-key IDs; offline handler tests | API-only positive persistence when cart profile is explicitly enabled, snapshots/totals, conflict/price/role rejection and zero partial rows. Runtime cart is false; positive case is NOT APPLICABLE until separately approved |
| Robots, sitemap, SEO | Mock sitemap URLs; timestamp mapping regression | Actual fixture URLs and `updated_at` mapping, drafts excluded, child chunks and missing timestamps; CMS titles/descriptions/canonical/JSON-LD. NOT RUN |
| Public API guard rails | Mock long query, >100 items, invalid asset ID | Repeat guards in live mode plus upstream validation/conflict/denied-role error mapping; no successful writes on rejected requests. NOT RUN |
| Browser/accessibility/layout | Chromium passes; WebKit has three recorded failures | Functional hydration/skip-link repair and unchanged full browser suite; then live routes on required viewports. Diagnosis below; source fixes NOT APPLIED by this audit |
| Server secrets/configuration | Canary absent from client bundle; explicit-live config unit tests | Separate live build/run with no token in `.next/static`, HTML, browser requests, logs, or returned errors; missing config/upstream failure must never produce mock content. NOT RUN |
| Scale/100k | Bounded 200-candidate contract has unit coverage | Real 100k workload, query plans, p95, concurrency/load, large sitemap throughput. DEFERRED; small synthetic fixture does not establish it |

## Windows WebKit: two distinct root causes

Environment: Windows, Node `24.15.0`, repository Playwright `1.63.0`, existing production mock build. Read-only diagnostic browser probes used both mobile and desktop WebKit, with mobile Chromium as a control. No source, test timeout, retry, or assertion was changed.

### Search and manual import: interaction before hydration

`SearchBox` has controlled `query` initialized to `initial` (empty at home); `BulkRequestImport` has controlled `manual` initialized empty. Both SSR controls are enabled while their React event handlers are not yet attached. `page.goto()` awaiting load and Playwright fill actionability do not establish hydration readiness.

Evidence:

1. Existing serial search trace shows `goto` finishing at 4667.304 ms, `fill("RE-56")` completing at 4751.393 ms, no `/api/search` request, then suggestions timing out. The bulk trace shows fill completing before the add-list click and the application subsequently rendering its empty-parser error. This localizes the search failure before the API.
2. Plain HTML input and textarea accept the same fill payloads on both WebKit modes. This rejects a general Windows WebKit inability to fill the controls or multiline text.
3. Immediate home fill in WebKit fired `beforeinput` and `input` with correct `RE-56`, while the element lacked React props at those events; the value was empty again immediately after fill/hydration. Thus Playwright inserted text successfully before the component could record it in `query`.
4. Immediate bulk fill delivered the full multiline DOM value. The first input event occurred before React attachment; the component's state remained empty and add-list reported `Не удалось найти артикулы...`. The textarea may temporarily retain its DOM value after hydration, so DOM `inputValue()` alone cannot prove React state received it. Existing failure screenshots returning to placeholders are consistent with the later controlled render.
5. Waiting conditionally for diagnostic React attachment before the identical fill made WebKit search show suggestions and manual import report `Список: добавлено 2, всего 2.` on mobile and desktop. The wait did not lengthen test assertion timeouts. In Chromium the immediate events already had React props and both actions succeeded.

Conclusion: two failures expose an SSR/hydration interaction race, with this WebKit timing revealing it consistently. It is a storefront readiness defect, not a search API or parser defect and not mobile-emulation-specific. Passing Chromium does not make early interaction safe.

Recommended bounded functional repair: initialize a local hydration-ready state false, set it true after client mount, and keep the identified interactive controls/actions disabled until ready. Cover `SearchBox` input/submit and `BulkRequestImport` textarea/add-list action; assess its file input under the same readiness contract. Playwright's existing enabled/editable actionability then exercises the actual user-facing guard. Keep visual design and domain/storage/API behavior unchanged. Do not commit waits based on private `__reactProps$` internals, arbitrary sleeps, larger suggestion timeouts, or forced fills. A test-only readiness wait would hide the user-visible lost-input defect.

### Skip link: implicit-link keyboard navigation in this WebKit build

The existing test presses ordinary Tab and expects `.skip-link` focused. The link is `<a href="#main-content">`; main already has `tabIndex={-1}`.

Evidence:

| Local probe | Windows WebKit | Chromium control |
| --- | --- | --- |
| Plain implicit anchor then input; ordinary Tab | Focuses input | Focuses anchor |
| App implicit skip link; ordinary Tab | Focuses `.menu-toggle` | Focuses `.skip-link` |
| Plain/app implicit anchor; Alt+Tab | Still skips link | Not a useful replacement sequence |
| Plain anchor with explicit `tabindex="0"`; ordinary Tab | Focuses anchor | Not required to explain baseline difference |
| App skip link with explicit `tabindex="0"`; ordinary Tab | Focuses `.skip-link` | Existing ordinary Tab behavior already passes |
| Explicit `tabindex="0"`; Alt+Tab | Also focuses link | No reason to substitute this key |
| Programmatic skip-link focus then Enter | Focuses `#main-content` | Focuses `#main-content` |

Conclusion: ordinary keyboard navigation skips implicit anchors in this Windows WebKit build, independently of the application and hydration. The anchor destination/activation contract works. Explicit `tabIndex={0}` is the smallest demonstrated functional compatibility repair; retain the existing ordinary-Tab-and-Enter acceptance test across all projects. Do not remove the WebKit accessibility assertion or replace keyboard reachability with programmatic focus. Alt+Tab does not fix the implicit-link case here.

### Local evidence inventory

- `storefront/.next/acceptance-evidence/first-run/` and `serial-run/`: original failures, screenshots, error contexts, trace archives.
- `probe-input.mjs` / `probe-input.json`: plain HTML, immediate versus hydration-ready input, desktop/mobile WebKit and Chromium controls.
- `probe-boundary.mjs` / `probe-boundary.json`: input event values and React attachment at the event boundary; skip activation and ordinary/Alt+Tab behavior.
- `probe-tabindex.mjs` / `probe-tabindex.json`: plain/app implicit versus explicit `tabindex=0`, ordinary Tab and Alt+Tab.

Private React-property inspection is diagnostic evidence only. These ignored artifacts contain synthetic/mock UI observations, no credentials. They are not portable CI tests or proof of Safari on a real iOS device.

## Required synthetic fixture manifest

Use one fresh run label, for example `acceptance-<run UUID>`, and a manifest recording exact created IDs, slugs, SKU/OEM expectations, statuses, relations, files and timestamps. All content must say synthetic/test where relevant. Never borrow source-site names, media, content or instance IDs. Provisioning may use an authorized diagnostic identity; the storefront may not.

Minimum useful data set:

- Three synthetic brands and three published categories, including a parent/child category relation if supported by the current schema. Include one extra draft category/brand-bearing draft product to establish visibility denial.
- At least 13 published synthetic products (satisfies the approved 10+ requirement and crosses the catalog's 12-item page boundary), plus draft and archived controls. Include fixed/on-request/hidden prices, all existing availability/part-type variants, products without images, long title/SKU, exact and punctuation-varied OEM codes, and an article duplicated across two distinct brands without violating brand+normalized-SKU identity.
- Child record variants on selected published products: published and draft specifications/codes/images/documents/relations; a child linked to a draft parent; zero/one/multiple specifications; published compatible relation and a private/unpublished counterpart. Define expected exposure from the current adapter contract before asserting it.
- Small neutral locally generated images and a PDF; no-image product; a private file and an unreferenced file with valid UUIDs. Optional active MIME document tests use harmless synthetic bytes. Record publication references and file hashes. No lead attachment upload path should be invented: this storefront sends empty attachments and only imports request-list files in-browser.
- Published synthetic home/page sections/settings/navigation sufficient for homepage and delivery/payment/about/contacts; invisible/draft sections and unsafe-link controls. No invented real legal/company facts.
- Explicitly approved profile supporting `parts_request=true` for positive RFQ tests. Positive order tests additionally need `cart=true` and matching currency; do not silently enable cart merely to make an API test pass.

A 13-product fixture establishes one page boundary, not the 200-candidate ceiling. Broader search pagination needs an additional authorized synthetic set above 24 and around/above 200 candidates, or remains a documented gap. A real 100k set is a later separate stage.

## Live run design, write isolation, and persistence oracles

Implement a separate live config/suite after access is enforceable. It must not inherit the current forced-mock webServer environment. Assert live mode/fallback flags before startup and fail closed if local URL, supported service identity, fixture manifest, or expected profile is absent. Use the selected loopback CMS and a separate storefront port/process; keep current mock suite intact. Use run-scoped request keys rather than the existing hard-coded mock keys. Browser contexts get isolated storage, with reloads inside a context only where persistence is under test.

Record pre-run and post-run counts for fixture IDs/request keys. A diagnostic read-only CMS/DB observer can verify storage separately from the storefront service; do not give the browser or storefront an observer/admin token. Prefer exact-key/ID queries. Log only method/path/status, redacted errors, timings, request keys and expected/observed counts; never dump `.env`, auth headers or credentials. Preserve failed-write evidence before any cleanup. Cleanup, if separately authorized, deletes only manifest-owned records/files in dependency order; never reset tables, volumes, roles or unrelated work. A restarted process and a real PostgreSQL count are required durability oracles.

| Case | HTTP/browser assertion | Database / CMS observation |
| --- | --- | --- |
| RFQ positive | Browser adds/edits/imports quantities; `/api/lead` returns real ID, no `mock` flag; success then list clears | Exactly one `leads` row for run key; contact/company-message normalization and `request_items` match; `status=new`; attachments empty |
| Identical concurrent lead retries | 12 calls with identical key/body return one real ID; one creation and remaining replays | Exactly one row and fingerprint; no duplicates across another retry or server restart |
| Lost acknowledgement | Suppress/drop response only after real commit, retry same body/key | Retry returns committed ID; row count remains one |
| Changed body same key | Lead/order proxy returns 409 and generic public conflict text | Original row unchanged, no extra lead/order/items |
| Edited client payload | UI rotates key after changing payload; successful new submission | Two intended rows with distinct keys, each matching its payload |
| Invalid contact/items/limits | Existing 400/413 guards; upstream invalid quantity/article/contact handling | Zero new rows; no private files created by this storefront |
| Denied service role | Direct CMS endpoint denies with 403; storefront shows failure (lead/order proxy maps forbidden to 502) and no mock success | Zero new lead/order/item records; retry/list retained as applicable |
| API-only order positive, when enabled | `/api/order` returns real ID; same key retries replay | One order + expected item count; immutable SKU/title/brand/price snapshots and exact minor-unit total/currency |
| Disabled cart / stale price / unpublished or foreign product | 409 from actual CMS/order proxy; no successful acknowledgement | Zero new order/item rows; no partial transaction |
| Write denied or invalid item after header stage | Role-specific denial or controlled invalid request, no public success | Header and items both absent; test real rollback without changing schema/permissions during a run |
| Files allow/deny | Published referenced UUID -> byte hash and safe headers; private, unreferenced, draft-child/draft-parent UUID -> 404 through proxy | No data changes; direct service access also conforms to selected supported policy |
| Content publication changes | CMS-owned synthetic publish/unpublish under declared provisioning scope, observe after known cache window/restart | Storefront reflects allowed state; do not mistake 300s data/asset authorization caching for immediate revocation |

File access denial needs known valid fixture UUIDs: `/api/assets/not-a-uuid` returning 404 is insufficient. Check the upstream service identity's denied reads separately from proxy reference checks. File cache/revocation behavior and unrelated sensitive collections remain explicit acceptance checks once the supported policy is selected.

## Exit criteria and remaining gates

1. Apply narrowly scoped functional hydration and explicit skip-tabindex fixes with regression evidence, then rerun the unweakened complete mock suite on Windows and relevant CI browsers. Existing full/serial results remain failures until that happens.
2. Establish the supported enforceable least-privilege access path. Do not bypass Core entitlement controls, remove filters/presets, broaden private files, or run the storefront as Administrator.
3. Provision authorized synthetic fixtures and supporting profile/settings inside the existing isolated local CMS with an exact manifest, then run separate live browser/API/DB acceptance with mocks/fallback disabled.
4. Report live synthetic, offline/unit, mock browser, and later real-catalog/scale results separately. Keep the Draft PR and production/merge boundaries from `10-DECISIONS.md`.

No live storefront writes, fixture provisioning, credential changes, permission changes, production fixes, or deployment occurred during this audit. Root causes are established for the local failures; the fixes and real integration acceptance remain to be performed by the lead's subsequent bounded tasks.
