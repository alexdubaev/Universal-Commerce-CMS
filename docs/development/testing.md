# Local verification

All checks run locally before each push or PR merge into `main`. GitHub Actions workflows have been removed. Historical CI and acceptance reports describe old runs; they do not require restoring hosted CI or deleted test matrices.

Install storefront dependencies when the lockfile changes, install Chromium once, then run from the repository root:

```sh
npm ci --prefix storefront
npx --prefix storefront playwright install chromium
node scripts/verify-local.mjs
```

The gate checks deployed commerce/search extension copies, backend integrations, storefront route/adapter integrations, a minimal domain-unit set, TypeScript, dependency advisories, a mock production build, client-bundle exclusion of a synthetic server-token canary, and two Chromium journeys. It uses synthetic data and no CMS writes. Fix failures and recheck the final candidate before pushing; do not substitute a remote pipeline.

## Test review

Review baseline: 216 backend cases, 96 storefront cases, 54 routine browser executions and 21 opt-in live browser executions. The lean suite keeps 98 backend cases, 9 storefront integration/route cases, 5 pure frontend domain cases and two routine Chromium journeys. Deleted tests and their exclusive helpers are removed from the repository, not skipped or hidden by test discovery.

| Removed | Reason |
| --- | --- |
| Blueprint, configuration and fake-VNode snapshots | Mirrored constants, labels and markup rather than behavior; ordinary implementation edits required test edits. |
| Source-text/JSX/CSS checks | Enforced code shape, with no user-visible failure to exercise. |
| Helper call counts and queued fake responses | Coupled tests to adapter implementation; consolidated useful behavior into HTTP/route integrations. |
| Duplicate helper/builder units | The same rule is exercised through the retained real handler or applier. |
| Separate race run and standalone TypeScript pass | Full backend tests already include races; production build already checks TypeScript. |
| Three-browser routine matrices | Repeated the same backend/API assertions; browser compatibility checks now follow a concrete change. |
| Long live browser acceptance and timing loops | Repeated backend work in every browser; the timing loop asserted no performance budget. |

Retain backend cases for authorization/publication, bounded queries, concurrent idempotent submissions, CAS conflicts, stream errors/disconnects, and safe/idempotent provisioning. These use actual handlers and appliers with isolated service/database boundaries. They do not establish native Directus permissions or PostgreSQL transaction behavior.

The remaining frontend integrations exercise actual HTTP/route boundaries and externally meaningful results. A few pure domain cases protect imports and acknowledgement reconciliation. E2E covers search → product → RFQ → submission and failed submission → preserved list → retry, including quantity edits made while awaiting acknowledgement. This keeps the previously fixed data-loss regression covered without adding another browser scenario. Keep new tests at the lowest useful integration boundary; browser tests must remain short and critical.

Extension source/dist equality remains a cheap deployment-artifact check in the local gate, rather than a set of source-string unit tests. The production build already validates TypeScript, so the gate does not repeat `tsc` separately. One dependency audit replaces separate production/dev audits. The build and a synthetic client-secret scan catch failures that smaller behavioral tests do not cover.

## Explicit runtime checks

`storefront/scripts/live-probe.mjs` remains an opt-in local integration observer for an explicitly authorized own runtime. It checks persistence across restart, persisted lead ownership/count, outage behavior and publication revocation/restoration. Its ownership journals and CAS restoration guards remain intact. It may write fixtures and restart the local storefront; do not run it as a routine push check.

Changes to schema/access/runtime-sensitive behavior require the appropriate scoped runtime verification on top of the ordinary local gate. Browser compatibility or visual review is added for a concrete frontend change, without restoring a permanent multi-browser copy of all tests.
