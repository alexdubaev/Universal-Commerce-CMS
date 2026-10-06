# Decisions

D001 — Preserve CMS schema, registered extensions, public routes and visual design. Prefer adapters for proven field mismatches.

D002 — Directus credentials stay server-side and ignored. Administrator is diagnostic/provisioning only, never the storefront identity.

D003 — Keep exact SKU/OEM `/commerce/search` and its 200-candidate ceiling; no search engine added.

D004 — Explicit live mode stays live if configuration is missing; fictional fallback remains disabled for integration/production.

D005 — Reuse only the existing `universal-commerce-cms-dev` stack via the original checkout's `dev/compose.yml`. Do not replace Directus/PostgreSQL, networks or volumes. Source-site instances/content are read-only and excluded.

D006 — User approved specially created synthetic fixtures in the local CMS on 2026-10-07. Real catalog/100k production acceptance remains a later stage. Label synthetic content and test results explicitly; no invented legal/company facts.

D007 — Do not bypass Core licensing or strip permission filters into unrestricted access. Establish a supported least-privilege path before running storefront with a service token.

D008 — Preserve reviewed timestamp/config fixes. Do not repeat completed discovery; reuse evidence in reports and ask agents only unresolved questions.

D009 — PR #1 stays Draft. Main, merge and production deployment are outside authorization.

D010 — Three child slots are available. Schedule independent audits immediately as slots free; file ownership is exclusive. Full logs remain local/ignored, summaries stay compact.

D011 — For this local Core integration, implement an explicit default-off `/commerce/storefront` gateway using supported custom extension authorization. The dedicated service identity has ZERO generic business/file grants. Authenticate its exact configured user ID before deliberate internal elevated queries; no Core entitlement checks are modified. Native adapter mode remains available for an entitled instance. This is not production acceptance or licensing advice.

D012 — Gateway reads force published/visible predicates and parent publication, fixed field/query allowlists and bounded pagination. No arbitrary privileged query proxy. Assets additionally require the configured public folder and a current allowed reference. Missing configuration and unknown callers deny before elevated service construction.

D013 — Gateway RFQ reuses the existing validation/transaction/idempotency contract with explicit caller-owned lookup/write context. Attachments and orders stay disabled in this local gateway. Native commerce routes keep original accountability. The browser receives acknowledgement IDs only, never credentials/customer records.

D014 — Fix hydration and explicit skip tabindex in presentation components only as necessary functional corrections, preserving design. Keep browser assertions and timeouts; do not add private React-property waits to committed tests.

D015 — Enforce request limits in bytes while streaming; fresh asset authorization and no-store delivery are the initial safe local revocation policy. Production cache topology remains a separate acceptance stage.

D016 — Keep `COMMERCE_ENABLE_ADDITIONAL_CODES=false` in the existing stack. Verify canonical MPN/OEM search and display product_codes; alias-only search is not promised. Gateway global candidate ceiling stays200.

D017 — Allow the small Vitest alias configuration needed to import actual presentation components for hydration regression tests. This is test support within the frontend workstream, not a design or runtime contract change.

D018 — Honor existing product `is_indexable` in sitemap counts/chunks while keeping non-indexable published products browsable. Verify count/chunk consistency; no CMS migration is needed.
