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

Implementation and candidate-specific evidence will be recorded here after the final local checks. Until then, this document is a release checklist, not a production acceptance certificate.
