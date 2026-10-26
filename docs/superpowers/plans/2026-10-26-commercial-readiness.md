# Commercial readiness implementation plan

> For agentic workers: use superpowers:subagent-driven-development. Execute tasks sequentially with independent task review; Luna 6 per owner preference.

**Goal:** Complete a reliable searchable B2B storefront that converts catalogue visits into manager-confirmed RFQs.
**Architecture:** Existing Next.js storefront and Directus commerce endpoints, retaining industrial v3 and stable routes/storage. Add focused helpers rather than framework replacements.
**Tech Stack:** Next.js 16, React 19, TypeScript, Directus, Node tests, Vitest, Playwright.
**Spec:** ../specs/2026-10-26-commercial-readiness.md

## Global Constraints
- Cart → RFQ → manager confirmation; no payment integration or invented commercial facts.
- Preserve industrial v3, public routes, smtechno-request, existing lead payload and server publication/access gates.
- No schema, roles, secrets, infrastructure, dependency manifests/lockfiles or real runtime mutations.
- Search changes are authorized behavior changes, not a visual-only redesign. Optional aliases remain opt-in; gateway still disables aliases.
- Keep deployed commerce-api src/dist identical. No hosted CI. Meaningful local tests and two short E2E journeys.

## Review Focus
- Lost acknowledgement followed by reload must reuse a key; malformed success must never clear a cart.
- Storage corruption, unavailable storage and edits during an in-flight request must not lose selected items.
- Exact product beyond the former 200-candidate window, Russian query, facets and later pages must agree.
- Hidden/unpublished products and assets never become searchable/indexable through new paths.
- External canonicals, malformed site URLs and unknown availability never create misleading markup.

### Task 1: Cart and lead reliability
Files: storefront/lib/request-store.ts, lib/idempotency.ts (or focused new pending-lead helper), hooks/useLeadSubmission.ts, hooks/useRequestForm.ts, hooks/useRequestItems.ts, relevant cart/form components and existing tests, hooks/useFormDraft.ts only if required for concurrent-edit preservation.
Interfaces: preserve RequestItem, REQUEST_STORAGE_KEY and lead API body. Add MAX_REQUEST_QUANTITY=100000. Pending submission state uses sessionStorage with no plaintext contact payload persisted; scoped by form type to avoid cross-form interference. Fingerprint may use Web Crypto hash; no new dependency.
- [ ] Add regression tests: finite integer quantity 1..100000 on read/merge/update; lost-ack remount reuses key for identical payload; edits produce new key; malformed acknowledgement is failure; empty RFQ blocked, quick contact allowed.
- [ ] Implement domain normalization and bounded controls; refuse empty RFQ at hook and UI level. Preserve selected items and form draft on failure and concurrent changes on success. Make double submit safe before React rerender. Handle blocked storage gracefully.
- [ ] Align selection labels with «Корзина» / «В корзину» while final CTA remains «Отправить заявку»; preserve route /request and current layout. Add clear next-step confirmation, no unsupported response-time promises.
- [ ] Run npm test --prefix storefront and npm run typecheck --prefix storefront; report RED/GREEN and self-review; commit only owned files.

### Task 2: Search quality and efficiency
Files: directus/extensions/commerce-api/src/index.js and dist/index.js, src/storefront.mjs and dist/storefront.mjs search-only validation, relevant directus tests; storefront/lib/catalog.ts, lib/types.ts, lib/directus.ts only search mapping if needed, app/api/search/route.ts, hooks/useCatalogSearch.ts, components/SearchBox.ts, search styles, tests; app/catalog/page.tsx only query parsing/partial messaging if needed.
Interfaces: keep /commerce/search and /api/search. New bounded optional filters brand (actual display name from resolved storefront slug), category slug, availability, partType, sort. Data/meta remain backwards compatible; optional partial indicates incomplete alias window. Gateway fixed allowlist and published category protection remain.
- [ ] Add handler/adapter regressions for exact SKU before prefix regardless of popularity; Russian title query; category/brand facets and pagination beyond 200; published-only results and invalid params denied.
- [ ] Implement database-filtered product search with disjoint exact-SKU / exact-MPN / remaining matching tiers and aggregate counts for accurate pagination; apply same facets to counts and rows. For explicit sort, use combined product filter. Bound returned rows, validate parameters, avoid scanning all products in application memory. Preserve optional code behavior with honest partial reporting; never enable gateway codes.
- [ ] Remove storefront fan-out over 200 IDs for native product search, pass supported filters to endpoint, hydrate only current page and preserve rank. Preserve previous endpoints/client response fields used by cart price resolution; expose incomplete lookup honestly.
- [ ] Fix stale suggestions immediately on input changes and failed requests. Add combobox/listbox semantics, Arrow keys/Enter/Escape, unique IDs and safe history storage. Query a lightweight suggestion mode only when explicitly requested; keep cart search response compatible.
- [ ] Run backend/frontend tests and typecheck; record database index/performance limitation, src/dist parity; commit owned files.

### Task 3: SEO/GEO and rendering efficiency
Files: storefront/lib/seo.ts, optional lib structured-data helper, app/robots.ts, app/sitemaps/[name]/route.ts, lib/content.ts sitemap helper only, app/layout.tsx, app/catalog/page.tsx metadata, app/product/[slug]/page.tsx, app/brand/[brand]/page.tsx, app/category/[slug]/page.tsx, article pages if needed, relevant tests; data mapping only to expose existing public fields needed in markup.
Interfaces: getSiteUrl/absoluteUrl/safeCanonicalUrl remain. Explicit mock mode may use local site URLs; production live missing/invalid URL fails clearly. No arbitrary localhost fallback for malformed configured URLs.
- [ ] Add regressions for pagination/facet canonical and noindex, public image robots exception, canonical sitemap agreement, accurate Offer availability and no fabricated price/ratings.
- [ ] Implement self-canonical unfiltered page 2+, noindex follow for search/facets/sort, normalized invalid page values. Align CMS page/home canonical with sitemap filtering. Allow /api/assets/ crawling while keeping other /api/ disallowed.
- [ ] Link factual JSON-LD entities by stable @id; include known product URL/specifications and accurate offer values, no PreOrder for ambiguous on_request. Use existing CMS company fields only; collection/breadcrumb markup matches visible content. Maintain safe JSON escaping and published article gates. No speculative llms.txt or fake FAQ content.
- [ ] Reduce avoidable work only with evidence; preserve current visual design and dynamic content. Test metadata/rendered route behavior rather than source snapshots.
- [ ] Run frontend tests/typecheck; commit owned files. Document indexing/real-content prerequisites.

### Task 4: Integration and acceptance
Files: existing e2e/storefront.spec.ts only short flow updates where needed, docs/development/commercial-readiness.md and this plan checkboxes.
- [ ] Run node scripts/verify-local.mjs and resolve genuine regressions.
- [ ] Browser flow: search → product → cart quantities → intercepted failure → retry → success. Check empty cart, reload recovery, keyboard suggestions, Russian search, facets and metadata. Desktop 1440, tablet 1024, mobile 390; inspect screenshots against industrial v3/current baseline. Save screenshots outside repository.
- [ ] Independent whole-branch review, fix findings, rerun affected tests/full gate if changed. Report measured evidence and production blockers separately from code completion.
- [ ] Integrate via reviewed PR only if remote write access is available and gate passes; do not deploy.
