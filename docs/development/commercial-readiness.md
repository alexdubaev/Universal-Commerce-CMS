# Commercial storefront release acceptance

The storefront supports a cart → RFQ → manager-confirmation business model. Selecting products and submitting an RFQ does not confirm stock, final price, payment or delivery terms. The industrial v3 design remains the baseline.

## What the code can verify locally

Use `node scripts/verify-local.mjs`: backend and storefront integration tests, domain rules, dependency audit, production mock build with TypeScript, extension artifact parity/client-secret check and two short Chromium journeys. Intercept test lead requests; never send them to a real manager inbox. Supplement this gate with desktop/mobile browser checks for the changed UI.

## What must be configured for the real site

- A real canonical site URL and a dedicated Directus instance with reviewed storefront access; no Administrator token in the storefront and no public token in client bundles.
- Verified product catalogue, prices/currencies, stock wording, images, descriptions, codes and relationships. A code similarity is not proof of compatibility.
- Company contacts/legal details and actual payment/delivery terms. Published articles need verified content, authorship when known, publication dates and meaningful links to catalogue entities.
- Manager ownership of incoming RFQs: verify the lead is present in the site's CMS and a real operational process handles it. This repository change does not configure email, CRM notifications or external messages.
- Hosting/domain/TLS, backups and restore procedure, monitoring and appropriate production request controls. These are not established by a merge.
- Validate catalogue latency and query plans using the actual database and representative concurrent traffic, especially text search. A bounded response does not guarantee bounded database work or 100k performance.
- Submit the real sitemap in the chosen webmaster tools, inspect representative canonicals and structured data after deployment, and monitor indexing. Valid markup does not guarantee rich results or AI citations.

## Measurement after launch

Measure search-to-product, product-to-cart and acknowledged-RFQ conversion, no-result queries, failed/retried submissions, response times and real mobile Core Web Vitals. Reconcile accepted RFQ identifiers with the manager's qualified requests and revenue. Analytics integration and consent must use the owner's chosen production tools; this change does not invent traffic or revenue estimates.

## Verification result

Application candidate: `c406091` plus documentation-only completion. The final local verification gate covers 383 backend tests, 65 storefront tests, dependency audit, production mock build/typechecking, extension/client-secret checks and two critical Chromium E2E journeys. Independent task reviews and the whole-branch review are complete, including the final malformed-currency correction.

Responsive browser acceptance covers 360, 390, 430, 1024 and 1440 pixels: no horizontal document overflow, search keyboard/menu/facet behavior, cart persistence/quantities, long cart content, field-focus navigation hiding, canonical/robots/Product markup, and no application console/page errors. Submissions are intercepted; zero real leads were sent. Empty search does not schedule a suggestion request. The final search input/button target is 44px or larger.

Measured optimization evidence: the same mock “фильтр” query uses 617 bytes for compact suggestions versus 2547 bytes for the full response (76% less); Oswald WOFF2 is 72,028 bytes versus 172,088 bytes for the original TTF (58.1% less), preserving 883 glyphs and the wght 200–700 axis. These measurements do not establish production latency or real-user Core Web Vitals.

Cart acknowledgement preserves the established semantics: submitted 3/current 5 leaves 2 unsent units. Invalid currency never becomes an invented RUB price; missing currency retains the existing RUB default. Search aliases remain opt-in and disabled by the fixed gateway; incomplete optional alias results are identified. Related-article batching remains deferred because the existing gateway does not accept the required batch filter.

This is local synthetic-data acceptance, not production deployment or acceptance of the real 100k catalogue. The production items above remain separately verifiable.
