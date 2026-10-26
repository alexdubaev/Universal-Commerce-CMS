# Commercial storefront readiness

Owner direction: complete the existing storefront autonomously with Luna 6 implementers. Business model: cart → RFQ → manager confirmation. Preserve the approved industrial v3 visual language and existing site routes. Existing October UX plan is completed history, not unfinished work.

Approach: improve the existing Next.js/Directus application end to end. A cosmetic-only pass leaves search/lead defects; replacing the application would discard tested contracts. The owner explicitly delegated decisions instead of further design approval.

Deliverables:
1. Reliable cart and contact submission: bounded quantities, no empty parts RFQ, reload-safe pending idempotency, validated acknowledgements, no loss of concurrent edits. Cart terminology describes selection; final action remains an RFQ. Preserve quick contact without items.
2. Search: exact normalized SKU/MPN precedence, Russian title/brand discovery, honest bounded additional-code behavior, product-level filtering before pagination, accessible race-safe suggestions. Do not imply fuzzy compatibility or enable disabled code rollout. Return real product counts using Directus queries where supported, never silently treat a 200-result window as the catalogue.
3. SEO/GEO: consistent canonical/indexability/sitemaps; crawlable public images; accurate structured Product/Offer/Organization/WebSite/Article/Breadcrumb entities, and appropriate collection markup. No invented reviews, authors, company facts, stock or prices. GEO means clear machine-readable factual content, not guaranteed AI recommendations. Production URLs validated while explicit mock/local builds remain supported.
4. Performance: reduce suggestion payload/work and unnecessary client work; preserve publication gates and server-only secrets. Measure local evidence; do not claim 100k capacity without real database measurement.
5. Local integration/build/E2E, browser desktop/mobile and independent code review. Document concrete production prerequisites.

Allowed: storefront source/tests/styles, commerce-api search handler and storefront gateway search validation with src/dist parity, corresponding backend tests, documentation. Protected: schema, access roles, credentials, deployment/Docker, dependency manifests/lockfiles, live CMS data and G1/G2 mutation workflows. No real lead submission or production deployment.

Verification: meaningful handler/domain/route tests; the existing two critical Chromium E2E journeys; scoped browser checks at 1440/1024/390px using synthetic data and intercepted submissions. Full node scripts/verify-local.mjs on final candidate. Main integration only after review and the local gate, subject to available remote write access.
