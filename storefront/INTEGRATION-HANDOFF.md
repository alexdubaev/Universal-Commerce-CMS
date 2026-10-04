# Storefront integration handoff

## Scope already completed

This branch adds a new `storefront/` only. Existing Directus code, schema, Docker, credentials and permissions are intentionally untouched.

The UI works without infrastructure in mock mode and is already wired to the current CMS contracts for a later real-data pass.

## Expected route matrix

- `/`
- `/catalog`
- `/catalog?q=RE568158`
- `/catalog?brand=caterpillar`
- `/brands`
- `/brand/caterpillar`
- `/brand/komatsu`
- `/brand/jcb`
- `/brand/john-deere`
- `/brand/cnh`
- `/brand/claas`
- `/brand/perkins`
- `/brand/sany`
- `/product/[slug]`
- `/request`
- `/delivery`
- `/payment`
- `/about`
- `/contacts`
- `/api/search`
- `/api/lead`
- `/api/order`
- `/api/assets/[id]`
- `/api/health`

## Directus mapping

### Product listing

Reads published `products` fields already present in the CMS:

`id, slug, title, sku, mpn, brand, descriptions, price, currency, price_status, availability_status, part_type, main_image, specifications, delivery_status, category`.

### Search

Uses the existing `GET /commerce/search` normalized SKU/OEM endpoint, then loads product card data from `products`.

For 100k+ general text search, this is intentionally not pretending to be Meilisearch/OpenSearch. Keep the exact article/OEM route and add a separate full-text search service only after performance acceptance.

### Lead / RFQ

`/api/lead` converts the storefront form into the existing `POST /commerce/leads` contract. Company name is currently prepended to `message` because the baseline lead schema has no company field.

The active Directus commerce profile must set `features.parts_request=true` before list RFQs are accepted.

File upload is not implemented in this storefront branch. The CMS already has a strict private attachment manifest contract; implement uploads only after the service-account/folder permission design is approved.

### Orders

`/api/order` is a thin server-side proxy for the current atomic `POST /commerce/orders` endpoint. The UI is RFQ-first and does not expose retail checkout yet.

The active commerce profile must have `features.cart=true` and matching currency before the endpoint accepts an order.

### Media

Browser requests `/api/assets/:id`; the Next server adds `DIRECTUS_TOKEN` when talking to Directus. Review cache policy and file authorization before production.

## Required work before production

1. Run `npm install`, `npm run typecheck`, `npm run build`.
2. Review Next/React dependency versions against the deployment target and lock them.
3. Create a least-privilege server identity for storefront reads and commerce writes.
4. Configure the site commerce profile and real site settings.
5. Verify asset permissions with real public/private files.
6. Decide whether company/INN/KPP belong in the lead schema or a future B2B company model.
7. Add real content for delivery/payment/about/contact pages from Directus page sections.
8. Add catalog facets (availability, category, type) server-side; current disabled controls are intentional UI placeholders.
9. Add production pagination/count behavior for search. The current CMS search has a bounded candidate window.
10. Add inventory/warehouse model before displaying numeric stock.
11. Add price lists before promising customer-specific B2B pricing.
12. Add sitemap generation in chunks for large catalogs.
13. Add browser E2E: desktop + 390px mobile, search, brand navigation, product, request.
14. Add security review: token exposure, SSRF/path handling, rate limits, CSP, form abuse, request size limits.
15. Add Docker/service wiring only in an explicitly scoped infrastructure task.

## Design behavior

One header is shared by every route. Desktop and mobile are responsive states of the same site, not separate implementations. At <=820px navigation becomes a drawer-like overlay; catalog and product layouts collapse; at <=520px search and forms become touch-oriented full-width controls.

The storefront uses no external UI framework, so the next agent can change visual tokens in `app/globals.css` without fighting a component library.
