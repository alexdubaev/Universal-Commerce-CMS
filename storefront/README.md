# Universal Commerce Storefront

Responsive Next.js storefront prepared for the existing Universal Commerce CMS.

## Implemented

- one responsive desktop/mobile codebase;
- search-first B2B home page;
- multi-brand catalog;
- live brand discovery from published Directus products, using one shared brand template;
- working brand, category, availability and part-type filters;
- price/title/popularity sorting and pagination;
- dynamic brand routes at `/brand/[brand]`;
- dynamic category routes at `/category/[slug]`;
- dynamic product routes at `/product/[slug]`;
- search suggestions and local recent-search history;
- product codes / OEM numbers, child specifications, documents, gallery and analog/supersession UI;
- local RFQ list stored in the browser;
- manual bulk article input;
- XLSX / CSV / TXT request-list import;
- delivery, payment, about, contacts and request pages;
- CMS-driven header/footer/legal navigation;
- CMS-driven page rendering for published `pages` + visible `page_sections`;
- generic `/[slug]` route for future standard CMS pages;
- optional CMS-driven home hero and extra home sections;
- dynamic SEO metadata for product/brand/category pages;
- Organization, Product and BreadcrumbList JSON-LD;
- robots.txt;
- chunked product sitemap plus brand/category/static sitemap;
- server-side Directus adapter;
- explicit mock mode for development;
- `/commerce/search` integration;
- `/commerce/leads` proxy with durable request-key reuse;
- `/commerce/orders` proxy prepared for later cart/account work;
- Directus asset proxy with UUID validation and allowlisting of files referenced by published storefront content; the server token never reaches the browser;
- health endpoint without upstream error-detail leakage;
- request-size/search guard rails and sanitized public API errors;
- Vitest regression tests, Playwright desktop/mobile E2E and Directus race tests in CI.

The storefront does **not** change Directus schema, roles, permissions, Docker, database or deployment configuration.

## Run in mock mode

```powershell
Set-Location storefront
Copy-Item .env.example .env.local
npm install
npm run dev
```

`.env.example` defaults to `STOREFRONT_MOCK_MODE=true`, so Directus is not required.

Open `http://localhost:3000`.

## Connect Directus

Set:

```env
DIRECTUS_URL=http://127.0.0.1:18056
DIRECTUS_TOKEN=<server-side service token>
STOREFRONT_MOCK_MODE=false
STOREFRONT_ALLOW_MOCK_FALLBACK=false
NEXT_PUBLIC_SITE_URL=https://your-store.example
```

The token is server-side only. Do not rename it to a `NEXT_PUBLIC_*` variable.

When `STOREFRONT_MOCK_MODE=false`, catalog errors fail closed instead of silently substituting fictional products. `STOREFRONT_ALLOW_MOCK_FALLBACK=true` exists only for controlled development/testing.

The current Directus baseline keeps anonymous access closed. Production should use a reviewed least-privilege storefront service identity rather than an Administrator token.

## Existing CMS contracts used

- `GET /items/products`
- `GET /items/categories`
- `GET /items/product_codes`
- `GET /items/product_images`
- `GET /items/product_specifications`
- `GET /items/product_documents`
- `GET /items/products_analogs`
- `GET /items/site_settings`
- `GET /items/navigation_items`
- `GET /items/pages`
- `GET /items/page_sections`
- `GET /items/home_page`
- `GET /commerce/search?q=...`
- `POST /commerce/leads`
- `POST /commerce/orders`
- `GET /assets/:id`

The storefront preserves the current CMS schema. No duplicate storefront-only catalog schema is introduced.

## Quality checks

```powershell
npm install
npm test
npm run typecheck
npm run build
npm run test:e2e
```

GitHub Actions also runs the existing Directus suite and explicit concurrent lead/order race tests.

## Fast design changes

The storefront is intentionally design-swappable.

Before any redesign, read:

- `AGENTS.md`
- `DESIGN-CONTRACT.md`

Global visual tokens are isolated in `app/theme.css`. A normal design-only task should preserve `lib/**`, `app/api/**`, Directus contracts, routes and RFQ/order behavior.

A future agent can therefore take a screenshot/Figma/reference and replace the presentation layer while the same catalog, search, SEO entities and commerce flows continue feeding it.
