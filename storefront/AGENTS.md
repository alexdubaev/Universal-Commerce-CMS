# Storefront agent instructions

This file applies to `storefront/` and all descendants.

## Primary rule

The storefront is **headless and design-swappable**.

A design/redesign task MUST NOT change commerce behavior, data contracts, Directus integration, URLs, query semantics, request/lead logic, storage keys, or API routes unless the user explicitly asks for those changes.

Think in four layers:

1. **Data** — Directus / commerce APIs / mock adapters.
2. **Domain** — product, brand, category, RFQ/request behavior.
3. **View model** — stable data passed into UI components.
4. **Presentation** — layout, typography, colors, spacing, animation, imagery.

A normal redesign should touch layer 4 only.

## Protected storefront contracts

Do not casually change:

- `lib/directus.ts`
- `lib/catalog.ts`
- `lib/types.ts`
- `hooks/**` — search, request storage/import and lead submission behavior
- `app/api/**`
- Directus endpoint paths
- product/brand route params
- `smtechno-request` localStorage key
- request idempotency behavior
- product identity/search semantics
- URL structure

If a design cannot be implemented without changing one of these, stop and explain why before editing it.

## Design surfaces

For design work, prefer changing only:

- `app/theme.css` — canonical visual tokens
- `app/globals.css`
- `components/Header.tsx`
- `components/Footer.tsx`
- presentational components such as ProductCard/SearchBox
- page composition in `app/**/page.tsx`
- static visual assets

Keep data reads and writes intact.

## One design system, all pages

Every route must use the same visual language:

- header
- footer
- typography
- color tokens
- radius
- spacing
- buttons
- form controls
- product cards
- empty/error/loading states

Do not invent a new header or unrelated visual system per page.

## Desktop and mobile are mandatory

Every redesign must be reviewed at minimum at:

- 1440px desktop
- 1024px tablet
- 390px mobile

Mobile is not a shrunken desktop. Navigation, catalog, filters, forms, product page, and request flow may recompose while preserving the same data and routes.

## CMS-driven content

Do not hard-code business data into visual components if it belongs in CMS or catalog data.

Examples:

- product name
- SKU/article
- brand
- price
- availability
- images
- descriptions
- SEO
- company contacts
- page content

A design must accept the same dynamic values even when text lengths, image aspect ratios, prices, or stock states differ.

## Redesign workflow

When the user says "change the design", "new visual style", "make it like X", or similar:

1. Read this file and `DESIGN-CONTRACT.md`.
2. Inspect the current design and the user's reference.
3. Preserve all protected contracts.
4. Define/update visual tokens.
5. Redesign shared components first.
6. Apply the system to every route.
7. Verify desktop + mobile.
8. Verify long/short content and missing images.
9. Verify search, brand links, product links, request list, and forms still work.
10. Report any business/data change separately from visual changes.

## Definition of a safe design-only change

A design-only PR should ideally show:

- no changes under `app/api/**`
- no changes to Directus schema or CMS
- no changes to database/infrastructure
- no changes to data adapters unless explicitly required
- visual/component/page-layout files only

## Local checks

Follow the root local-only verification policy: run `node scripts/verify-local.mjs` from the repository root before pushing or merging into `main`. Do not add GitHub Actions or CI-specific browser matrices. Keep only short critical Chromium E2E journeys, backend/route integration coverage and a minimal set of domain unit tests; avoid tests of source strings, visual markup and helper call counts. Additional browser/visual checks are scoped to the change, not a permanent copy of every test in every browser.

## Dynamic-data stress cases

Any design must remain usable with:

- SKU of 4 to 40+ characters
- title of 20 to 160+ characters
- price hidden / fixed / on request
- in stock / on request / out of stock
- no image
- portrait image
- wide image
- 0, 1, or many specifications
- long descriptions
- 1 to many brands/categories
- empty search results
- 100k+ product catalog

## Never do this

- clone data into UI files just to make a design easier
- create brand-specific duplicated page code when a dynamic route can serve all brands
- duplicate desktop and mobile apps
- put Directus tokens in client code
- redesign by replacing real UI with screenshots
- rewrite the commerce layer during a visual-only task
