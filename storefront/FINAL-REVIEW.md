# Storefront final code review

Date: 2026-10-06  
Scope: `feat/storefront-nextjs-dark` / PR #1

## Verdict

No known P0/P1/P2 storefront defects remain after the review fixes below.

The storefront is considered approximately **85–90% frontend-ready**. This percentage describes the customer-facing frontend and its current CMS contracts, not total production readiness.

Do not merge to `main` until the live Directus / permissions / Docker / deployment acceptance described in `INTEGRATION-HANDOFF.md` is complete.

## Review findings fixed

### P1 — filtered search pagination

The original storefront combined `/commerce/search` with catalog filters only on the current search page. A match outside that page could disappear after filtering.

Fixed by collecting the backend's bounded candidate set (maximum 200 candidates), applying catalog filters against the whole set, and paginating the filtered result correctly.

### P1 — search sorting

Sorting a search result originally sorted only the current search page.

Fixed so an explicit sort operates across the full bounded search candidate set.

The backend's 200-candidate search ceiling is intentionally preserved and documented. Broad natural-language search / larger candidate sets remain a separate search-engine decision.

### P2 — RFQ idempotency after editing

A failed form submission correctly reused its request key for an identical retry, but editing the form before retry could reuse that same key with a different payload and cause an idempotency conflict.

Fixed: identical payload -> same key; changed payload -> new key.

### P2 — asset proxy fan-out

Asset authorization previously issued every possible reference check in parallel for each newly requested asset.

Fixed with ordered short-circuit checks. A normal published product main image is authorized by the first lookup instead of triggering the entire reference matrix.

### P2 — active-content assets

Published files are still allowlisted by CMS references, but HTML/JavaScript-like document MIME types are no longer served inline. Non-image/non-PDF assets are forced to download as `application/octet-stream`.

The asset response also carries `nosniff`, same-origin resource policy and a sandbox CSP.

### P2 — CMS canonical URLs

CMS-provided canonical URLs are restricted to internal paths or HTTP(S). Unsafe schemes and protocol-relative URLs fall back to the route-local canonical.

### P3 — mobile / accessibility

Added:

- WebKit mobile acceptance in addition to Chromium mobile;
- Escape closes the mobile menu and returns focus;
- skip-link to main content;
- visible focus rules;
- live/alert semantics for form result messages;
- interactive product gallery controls.

### P3 — test/config reproducibility

- committed `package-lock.json`;
- CI uses `npm ci`;
- storefront package is explicitly ESM;
- dependency audit remains part of acceptance.

## Final automated acceptance

Reference run after the reviewed storefront code:  
https://github.com/alexdubaev/Universal-Commerce-CMS/actions/runs/37524800286

Results:

- Storefront Vitest: **33/33 PASS**
- Explicit commerce race tests: **4/4 PASS**
- Full Directus test suite: **170/170 PASS**
- Playwright E2E: **30/30 PASS**
  - desktop Chromium
  - 390x844 mobile Chromium
  - 390x844 mobile WebKit
- TypeScript: **PASS**
- Next.js production build: **PASS**
- Production dependency audit: **0 vulnerabilities**
- Critical audit including dev dependencies: **0 vulnerabilities**
- `DIRECTUS_TOKEN` client-bundle leak canary: **PASS**

## Reviewed architecture invariants

Preserved:

- no storefront token in browser code;
- Directus remains the CMS/data source;
- one dynamic template for all brands;
- brand discovery in live mode comes from published product data;
- one dynamic category template;
- one dynamic product template;
- RFQ/list workflow is independent from visual design;
- mock mode is explicit;
- live CMS failures do not silently substitute fictional catalog data;
- design rules stay isolated from commerce/API contracts;
- Directus schema, production roles/permissions, database and Docker were not changed by this storefront work.

## Known remaining work — not accepted as complete

These require the real environment or a separate product decision:

1. Create and verify a least-privilege storefront service identity in Directus.
2. Run real-Directus E2E using actual products, files, pages, navigation and permissions.
3. Validate search latency and quality against the real 100k+ catalog. The existing exact article/OEM search remains bounded to 200 candidates.
4. Load/performance test the real deployment.
5. Add edge rate limiting / anti-abuse controls once deployment topology is known.
6. Finalize deployment-specific CSP/security headers.
7. Add warehouse inventory before showing numeric stock.
8. Add price-list/company models before showing customer-specific B2B prices.
9. Wire Docker/services/environment/deployment.
10. Validate sitemap generation against the production catalog and Directus limits.
11. If editorial articles are in launch scope, add article listing/detail rendering; the CMS article model exists but storefront article detail is not part of this PR.
12. If nested header/footer navigation is required, implement child navigation; the current storefront reads top-level published navigation items.

## Design-swap status

The redesign contract is in:

- `storefront/AGENTS.md`
- `storefront/DESIGN-CONTRACT.md`
- `storefront/app/theme.css`

A visual redesign should not modify Directus adapters, API routes, search semantics, RFQ idempotency or commerce contracts unless the user explicitly requests a behavioral change.
