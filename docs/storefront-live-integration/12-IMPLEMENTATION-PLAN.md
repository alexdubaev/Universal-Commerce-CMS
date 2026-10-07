# Implementation plan after Wave 1 synthesis

Goal: real API/database integration against explicitly synthetic local Directus records. Preserve schema/version/visual system/public routes; do not claim genuine catalog or production readiness.

## Ownership and dependencies

| Stream | Exclusive allowed files | Outcome / verification | Dependencies / stop |
| --- | --- | --- | --- |
| Backend gateway | commerce-api src/dist new storefront gateway and registration; scoped leads factory adaptation; directus/test gateway tests | Exact configured nonadmin user gate, zero native grants, fixed read DTO/predicates/query limits, public-folder asset gate, caller-owned atomic RFQ, disabled attachments/orders; deterministic tests + source/dist parity | Stop on schema, entitlement bypass, arbitrary privileged query proxy or changed native route semantics |
| Frontend | storefront/lib/directus.ts/catalog.ts; necessary SearchBox/BulkRequestImport components and skip link layout; new hydration helper and targeted tests | Explicit gateway transport flag off by default; stored brand label preserved; hydration-disabled controls; tabIndex=0. Unit/typecheck + unchanged browser tests | Read gateway fixed path interface; do not modify theme, request identity/search cap/public API contracts |
| API security | storefront/lib/assets.ts; app/api/assets/[id], lead, order routes; bounded-body helper + tests | Cancel over-limit byte streams before parse; 400 malformed JSON; preserve current validation/idempotency; fresh reference authorization and no-store assets | No transport/visual changes or native role grants |
| Local fixture/provisioning | new dev acceptance script(s), minimal optional gateway env in dev/compose.yml, acceptance test manifest tooling | Guard exact local URL/project; create synthetic owned content/files/user with no native grants; preserve old draft/metadata; enable only parts_request; ignored token/manifest; safe exact-record cleanup | Start script coding independently; runtime gateway config/restart only after backend integration. No second stack, schema change, version upgrade, printed/resolved secrets |
| Live E2E/performance | separate live Playwright config/spec and test helpers; minimal package scripts/gitignore if necessary | All required synthetic routes/children/assets/RFQ/retries/denials across browsers; serial isolated write tests; timings labeled synthetic; no unbounded load | Working gateway/fixtures first. No mocked data or Administrator storefront. No weakened browser assertions |
| Focused SEO | adapter/types/metadata only after frontend ownership released | Nonindexable products excluded from chunks/count consistently; regression coverage | Confirm fixture evidence before edits |

Independent implementation streams use managed worktrees from the integration branch. Each worker makes small scoped commits after targeted checks. The lead inspects each diff and evidence before cherry-picking, then verifies the integrated result.

## Final gates

Run lockfile install, unit/typecheck/build, existing mock browser suite, Directus/race suites, audits and token canary. Separately build/run live mode with gateway service token and mocks/fallback false, verify `/api/health` and actual data, native API denials, asset revocation/private-folder rejection, durable RFQ identity, all three browser projects and bounded synthetic performance. Preserve logs/manifests ignored; update numbered status/findings/final handoff. Fresh independent reviews cover the whole active change, with no production authorization inferred from local passes.
