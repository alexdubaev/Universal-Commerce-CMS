# Storefront integration handoff

## Current state

The storefront is now a substantially complete frontend shell. It runs end-to-end in mock mode and is wired to the current Universal Commerce CMS contracts.

Final review details and fixed findings are recorded in `FINAL-REVIEW.md`.

Directus schema, database, roles/permissions, Docker and deployment remain intentionally untouched.

## Route matrix

- `/`
- `/catalog`
- `/catalog?q=RE568158`
- `/catalog?brand=caterpillar`
- `/catalog?category=filters&availability=in_stock&partType=original&sort=price_asc`
- `/brands`
- `/brand/[brand]`
- `/category/[slug]`
- `/product/[slug]`
- `/request`
- `/delivery`
- `/payment`
- `/about`
- `/contacts`
- `/robots.txt`
- `/sitemap.xml`
- `/sitemaps/static.xml`
- `/sitemaps/products-[n].xml`
- `/api/search`
- `/api/lead`
- `/api/order`
- `/api/assets/[id]`
- `/api/health`

## CMS mapping

### Brands and navigation

In mock mode the storefront uses synthetic brand metadata. In live Directus mode the visible brand list is derived from published products through Directus aggregation/grouping. Known brands reuse richer descriptions; any future brand gets a deterministic slug and the same dynamic `/brand/[brand]` template. Do not create copied per-brand page trees.

Published `navigation_items` drive header/footer/legal navigation. URLs are allowlisted to internal paths, http(s), mailto and tel; script/data/protocol-relative URLs are rejected.

### Pages and home content

Published `pages` plus visible `page_sections` feed the shared CMS page renderer. Delivery, payment, about and contacts use CMS content when it exists. New standard pages can be created in Directus and served by `/[slug]` without a new React route.

Published `home_page` may override hero/SEO content and append visible page sections while catalog/category/product blocks continue using commerce data.

### Catalog

Published `products` feed the catalog and product pages. Filtering supports brand, category, availability and part type. Sorting supports popularity, price ascending/descending and title.

### Product detail

The storefront reads the existing:

- `product_codes`;
- `product_images`;
- `product_specifications`;
- `product_documents`;
- `products_analogs`.

Missing/unauthorized optional child collections degrade to empty sections, not fictional live data.

### Search

The exact SKU/OEM path keeps using `GET /commerce/search`. Search suggestions call the storefront `/api/search` proxy.

The existing backend search has a bounded candidate window of 200 candidates. When search is combined with catalog filters or explicit sorting, the storefront now evaluates the whole bounded candidate set before pagination/sorting. A dedicated full-text engine for broad natural-language search is still a later performance/search-quality decision, not faked here.

### RFQ / parts list

Users can:

- add product cards;
- change quantity/remove items;
- paste article lists;
- load CSV/TXT;
- load XLSX in the browser.

The current commerce lead API permits at most 100 `request_items`, so the UI explicitly caps a request at 100 rather than silently sending an invalid payload.

File attachment upload to Directus is deliberately separate from XLSX parsing. The CMS has a strict private attachment manifest contract; do not bypass it.

### Public asset proxy

`/api/assets/:id` accepts only UUID file IDs and checks that the file is referenced by published products, published product child records, published categories, or storefront site settings before proxying it with the server token.

Authorization checks short-circuit in expected-use order so normal product images do not fan out across every possible CMS reference check. Potentially active non-image/non-PDF document types are forced to download instead of rendering inline.

This is defense-in-depth. Production still requires least-privilege Directus file permissions.

### SEO

Implemented:

- dynamic product/brand/category metadata;
- canonical URLs;
- OpenGraph metadata;
- Organization/Product/BreadcrumbList JSON-LD;
- robots;
- sitemap index;
- product sitemap chunks of 1,000 URLs;
- brand/category/static sitemap.

### Mock safety

`STOREFRONT_MOCK_MODE=true` is development mode.

When connecting live Directus use:

```env
STOREFRONT_MOCK_MODE=false
STOREFRONT_ALLOW_MOCK_FALLBACK=false
```

Do not enable mock fallback in production.

## Remaining integration / production work

1. Create and review a least-privilege server identity for storefront reads/writes.
2. Configure the real site profile and contacts.
3. Verify every collection/asset permission with real Directus.
4. Set `commerce_profile.features.parts_request=true`.
5. Decide whether Company / INN / KPP become first-class B2B entities.
6. Verify production search behavior with the real large catalog; decide whether to add Meilisearch/OpenSearch.
7. Add warehouse inventory before displaying numeric stock.
8. Add price lists before customer-specific B2B pricing.
9. Verify sitemap throughput against the real 100k+ catalog and Directus query limits.
10. Add production rate limiting / abuse controls at the deployment edge for form/API routes.
11. Add CSP/security headers after final deployment topology is known.
12. Wire Docker/services/deployment only in a separately scoped infrastructure task.
13. Run real-Directus E2E and performance/load tests before production acceptance.

## Acceptance already automated

CI covers:

- storefront unit/TDD regression tests;
- TypeScript;
- production build;
- production dependency audit;
- server-token client-bundle leak canary;
- public asset-id validation and API guard-rail tests;
- Playwright desktop Chromium;
- Playwright 390px mobile Chromium;
- Playwright 390px mobile WebKit;
- route overflow checks;
- search;
- brands/categories;
- catalog facets;
- RFQ add/edit/import/submit;
- sitemap/robots;
- concurrent retry behavior;
- full existing Directus test suite;
- explicit lead/order race tests.

## Design contract

Read `AGENTS.md` and `DESIGN-CONTRACT.md` before redesign work.

A visual-only redesign must not rewrite catalog/search/API/RFQ contracts. One theme system feeds every route, with intentional desktop/tablet/mobile layouts.


## Review handoff

See `FINAL-REVIEW.md` for the final P0/P1/P2 review, fixes, exact automated acceptance results and remaining non-frontend production work.
