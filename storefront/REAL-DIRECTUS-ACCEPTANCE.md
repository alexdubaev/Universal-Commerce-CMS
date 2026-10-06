# Real Directus local acceptance — 2026-10-07

**PASS on explicitly authorized synthetic records; real catalog and production pending.** Tested code: `8535da036c5f2286a01e61a382589ea1864394f9`.

The initial empty local CMS and unsupported Core permission-rule path are recorded in [01-BASELINE](../docs/storefront-live-integration/01-BASELINE.md) and the historical audits. The supported local resolution uses the reviewed fixed extension gateway, exact non-admin technical identity with zero generic grants, and existing isolated Directus/PostgreSQL. The sole human operator remains the Administrator; no staff roles were configured.

Actual CMS acceptance:15 published products,3 dynamically discovered unknown brands,3categories, site settings/navigation/home/pages/sections, PNG/PDF/HTML files, product children/relationships and persisted RFQs. Mocks and fictional fallback are disabled. Strict live browsers21/21 and unchanged mock browsers30/30 PASS across desktop Chromium/mobile Chromium/WebKit. Full suites: storefront62, Directus205, races4 PASS; TypeScript/builds/audits/token scans PASS.

Actual database observer verified15 journaled RFQs, one row per key and matching service ownership/ack IDs. Identical retry after Next restart replays the durable record; changed same-key payload409, invalid input400/zero rows. Directus outage fails closed, revoked asset is denied and CAS restoration verified. Draft-only/private/unreferenced files404, published PNG/PDF/HTML200 with hardened active-content download. Missing CMS page returns HTTP404.

These results do not establish genuine catalog/100k load, production CSP/rate limiting/topology or deployment approval. Small synthetic timings, complete commit list, security findings, retained fixtures, recovery rules and next-stage gates are in [11-FINAL-HANDOFF](../docs/storefront-live-integration/11-FINAL-HANDOFF.md). Independent review is in [15-CLOSEOUT-REVIEW](../docs/storefront-live-integration/15-CLOSEOUT-REVIEW.md).
