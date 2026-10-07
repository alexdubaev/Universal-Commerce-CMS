> Historical Wave 1 audit. Its statuses and test counts describe discovery before implementation. Current results and resolved findings are in [11-FINAL-HANDOFF.md](11-FINAL-HANDOFF.md) and [09-FINDINGS.md](09-FINDINGS.md).

# Storefront security review

STATUS: AUDIT COMPLETE; live security acceptance remains blocked.
FINDINGS: P0 none; P1 supported least-privilege path absent (existing blocker); P2 asset folder isolation, asset revocation caching, and unbounded request-body buffering (existing code, not introduced by the active fixes).
CHANGED: This report only. Production/runtime code, permissions, schema, credentials, Compose, and deployments remain read-only.
TESTED: 8/8 storefront security/asset unit tests; 6/6 Directus race/isolation tests; synthetic folder-gate and streamed-body probes; unauthenticated lead/order denial probes.
BLOCKERS: No approved live storefront service identity; Core cannot store the required custom row/file rules; proposed endpoint bridge is not implemented or verified.
NEXT: Adjudicate the P2 findings; implement only separately approved scoped corrections/bridge, then prove native API denial with its actual non-admin identity.
DETAILS: Findings, proposed bridge acceptance criteria, and safe denial cases below.

## Scope and evidence

Reviewed worktree `feat/storefront-directus-acceptance`, base/HEAD `0f883b26e5003cb00bfad1ed7dc2586268182052`, with the previously reviewed uncommitted explicit-live configuration and timestamp adapter fixes. Those fixes introduce no confirmed security regression. Their discovery was not repeated.

Read root/storefront agent instructions, ADR-002, status/decisions, permissions matrix, and infrastructure map. Inspected `storefront/lib/directus.ts`, `assets.ts`, `content.ts`, API routes, CMS renderer/SEO/header/footer/product sinks, commerce lead/order handlers and related mutation/search entry points, access blueprint, and `dev/compose.yml`. Requested behavior: evidence-based security assessment and acceptance cases. Allowed write surface: this report only. Protected surfaces: all runtime/production files, all identities/permissions, secrets, schema, infrastructure, and source-site resources. No Docker commands, generated env reads, service-token issuance, database writes, network attack traffic, or source-site inspection occurred.

## Findings

### SEC-01 — P1: Current native adapter cannot satisfy Core least privilege

This is the existing integration blocker, not a new exploit or active-diff regression. The current adapter calls native `/items/*` and `/assets/:id`; the commerce handlers use caller-accountable ItemsService for lookup/create. As recorded in `04-PERMISSIONS-MATRIX.md`, this installed Core cannot persist the required custom publication, field, ownership, and folder rules. Plain collection access grants native access beyond the adapter's selected filters; Administrator would expose the whole instance. Public query filters are not an authorization boundary.

Do not issue a token with Administrator, broad native collection/file access, or permissions with filters stripped. The endpoint-only bridge described below is a conditional architectural alternative, not an accepted implementation. Existing native commerce routes cannot work with a zero-grant caller without a separate guarded bridge path; granting native lead/order reads or writes to make them work defeats that isolation.

### SEC-02 — P2: Published reference gate does not enforce the public asset folder

Evidence: `storefront/lib/assets.ts:43` checks published/visible references and settings, then returns true without reading `directus_files.folder`. `storefront/app/api/assets/[id]/route.ts:16` subsequently fetches bytes using the server token. The default frontend file-read blueprint (`directus/access/blueprint.mjs:57`) permits both public-folder files and the identity's own private lead uploads. A private upload accidentally referenced by published content/settings can therefore satisfy this gate when the upstream identity can read that file. This also becomes an immediate boundary failure if a new privileged bridge reuses the gate without adding folder enforcement.

Synthetic in-memory probe: a published product reference produced `allowed=true`, one query, and no file-folder lookup. No private file or production data was accessed. Existing asset tests deliberately assert this short circuit; they do not prove private-folder denial.

Acceptance: require the site's configured public folder plus a currently published storefront reference before fetching asset bytes. Reject missing metadata, private-folder files, wrong-site folder IDs, unpublished parents/children, and inaccessible metadata. A published reference must never override private-file isolation. The bridge service identity itself must have zero native file permissions, including access to its own private uploads. Attachment support remains outside this minimal bridge unless explicitly scoped.

### SEC-03 — P2: Asset authorization and response caching delay revocation

Evidence: reference/settings authorization reads use `revalidate: 300` (`assets.ts:27,105,114`). Successful asset responses use `public, max-age=300, stale-while-revalidate=86400` (`app/api/assets/[id]/route.ts:25`). After unpublishing the only reference, cached positive authorization may still fetch/serve bytes; caches honoring stale-while-revalidate may also return an already cached success while revalidation denies access. The stale window can reach a day after freshness expires. The precise deployed-cache behavior is not proven locally, but the configured authorization and response windows are explicit.

This is a revocation gap in the published-only contract, not recovery of content already downloaded by a visitor. Establish an intentional revocation bound. Do not apply stale success caching to a denial-sensitive asset gate without a documented invalidation mechanism or bounded, accepted delay. Folder checks in a new bridge must not be cached as unconditional permission.

Safe acceptance: serve one synthetic public file, unpublish its only reference, and repeat the same URL through both origin and any actual configured cache. A fresh request after the accepted revocation bound must return 404 and no bytes. Do not claim this test passed from mocked publication predicates alone.

### SEC-04 — P2: Request size guard buffers the entire stream before enforcing its limit

Evidence: lead/order routes check a supplied `Content-Length`, then call `request.json()` before the fallback limit (`lead/route.ts:30–36`, `order/route.ts:9–15`). Requests without Content-Length can stream beyond the declared 512,000-byte limit; the body is fully buffered and parsed before rejection. `JSON.stringify(body).length` counts JavaScript code units, not received bytes. These public endpoints have no code-level rate control; topology-specific edge controls are already recorded as pending, so their protection cannot currently be assumed.

Synthetic lead-route probe used a Web Request stream with no Content-Length and a mock upstream that must never run: response 413, **600,056 bytes consumed**, configured limit 512,000, upstream not called. This proves the resource guard operates after consumption; it was a bounded in-process probe, not a load attack. Order has the same buffering pattern.

Acceptance: enforce received-byte limits during streaming, cancel over-limit bodies before JSON parsing/upstream calls, and prove the deployment's API abuse controls separately. Test missing/dishonest Content-Length and multibyte UTF-8. Malformed JSON should produce a controlled client error without secrets. Rate limiting alone does not correct per-request unbounded buffering.

## Controls and practical limits

- **Tokens:** Only server adapter code reads `DIRECTUS_TOKEN`; no reviewed response returns it and no `NEXT_PUBLIC_` token exists. Current client components do not import the adapter; historical build-canary evidence is recorded in FINAL-REVIEW and was not re-run here. A `server-only` boundary would provide preventive import protection, but its absence alone is not a confirmed leak. Do not log whole fetch options, headers, process env, or upstream bodies in new bridge code.
- **SSRF/path traversal:** Asset IDs are UUID validated before upstream fetching and encoded by `directusAsset`; collection names/query structures in current readers are fixed by code. No user-controlled fetch origin was found. CMS HTTP URLs are rendered as links/metadata, not fetched by the server. Keep the configured Directus origin trusted; do not turn bridge parameters into upstream URLs, filesystem paths, or arbitrary collection/query selectors.
- **XSS/CMS text:** CMS text/descriptions/section items currently render as React text, not raw rich-text HTML. JSON-LD's only reviewed raw-HTML sinks use `safeJsonLd`, which escapes `<`; XML output uses escaping. JavaScript/data and ordinary protocol-relative link/canonical inputs are rejected. HTTP(S), mailto/tel links are permitted intentionally. Backslash/control-character URL normalization deserves parser-based hardening if an internal-origin invariant is later required, but no executable-scheme bypass was demonstrated, so it is not promoted to a significant finding here. Rich-text HTML rendering would require a separately reviewed sanitizer.
- **MIME/downloads/CSP:** Assets force non-image/non-PDF types to octet-stream attachment and set nosniff, same-origin resource policy, and `sandbox; default-src 'none'`. SVG remains inline, but sandboxed; no execution exploit was shown. Main-document CSP is not configured in next.config; this is known deployment work, not evidence of a current XSS. Verify exact response headers in a real bridge path, including errors and HEAD behavior. Do not forward upstream cookies, authorization, Location, or arbitrary content-disposition headers.
- **Guards/idempotency:** Existing commerce lead/order endpoints reject unauthenticated callers before schema/database work. All ItemsService operations retain caller accountability. Transactions and advisory locks serialize same-key writes; product prices/currency/status are checked server-side, and lead attachment validation checks private folder, uploader, manifest metadata, and fingerprint. Public storefront routes intentionally act through a server identity; browser callers are not CMS users. Replay responses contain IDs/replay state, not customer records. Caller scope must become an explicit server predicate before privileged bridge reads, rather than relying on old native permissions.
- **Race/errors:** 4 race harness tests pass for identical/conflicting order/lead submissions, but the harness is an in-memory lock simulation, not PostgreSQL/live RBAC/rollback acceptance. Database unique constraints and transaction wiring still need actual local verification. Errors are generally bounded client-safe status/message responses; current route logs are server-side. Browser-facing 5xx responses do not include upstream bodies or credentials. Do not broaden error forwarding in the bridge.
- **Compose:** The development project remains `universal-commerce-cms-dev`, Directus binds `127.0.0.1:18056`, Postgres has no host port, and volumes are isolated named volumes. No deployment security is inferred from this local boundary; do not target another Compose project.

## Conditional endpoint-only bridge assessment

The lead's proposed explicit, default-off local bridge is feasible as application authorization, provided its endpoint operations are fixed and narrowly authenticated. Directus publicly documents extension endpoints and internal service initialization; current official documentation states omission/null accountability gives administrator permissions. Older docs conflict on null semantics, so verify against installed 12.1.1 and use deliberate, tested elevated context only after authorization. [Current Directus Services source](https://github.com/directus/docs/blob/main/content/guides/09.extensions/2.api-extensions/4.services.md), [Directus endpoint documentation](https://docs.directus.io/extensions/endpoints). This is an inference about technical feasibility, not licensing/legal approval or a verified runtime design.

Required invariants:

1. Feature flag defaults off. Missing/malformed configured service-user ID, absent caller, wrong authenticated user, disabled configuration, and invalid parameters deny before privileged service construction. Check the exact configured user ID from Directus-authenticated accountability; a role/name or client-supplied identity is insufficient. No storefront Administrator token.
2. Service user has **zero native business/system/file collection grants**. Prove this rather than trusting a creation script. Include REST, GraphQL, native asset delivery, writes, and pre-existing custom commerce routes in denial tests. No stored custom-rule gate changes, license flag modifications, patching entitlements, or broad policy substitution.
3. Each bridge operation owns an explicit collection/field allowlist, bounded limits, accepted sort/filter parameters, and publication/visibility predicates. Client input cannot replace/merge server predicates or introduce arbitrary fields, deep expansions, aggregates, collections, writes, filters, or upstream destinations. Nested relations/analogs must independently exclude unpublished records; site settings project only public fields. Profile settings may be read internally for feature validation but not returned wholesale.
4. Assets enforce configured public folder **and** current allowed reference/parent publication before bytes. Native service-token `/assets/*` stays denied. No directus_files listing/import/upload/delete or private attachment access is exposed.
5. The guarded lead bridge accepts only the existing validated contact/request payload, fixes status/new ownership server-side, uses caller-scoped key+fingerprint lookup/create inside one transaction, and returns only acknowledgement IDs/replay state. User-created ownership/audit fields must be set deliberately when elevated service semantics would otherwise omit the authenticated caller. Do not return lead/customer details. Native generic lead/order writes stay denied. Keep attachment and order features disabled if they are not part of the scoped bridge acceptance.
6. Preserve existing public URLs/contracts and commerce extension identifiers. Explicit transport configuration may select the bridge, but existing caller-accountable routes must not silently gain privilege. No generic privileged query proxy or reusable exported bypass factory callable by unguarded routes.
7. Review hooks/audit metadata, final built extension closure, frontend token-canary, maximum body/request timing, errors, and revocation behavior. Storefront health success must exercise actual permitted bridge capability; native server/health denial with a zero-grant token must not be "fixed" by granting system access.

## Safe local denial matrix (pending live identity)

Use only synthetic instance-local records/files and a newly reviewed service identity. Capture status, safe response shape, and predicate/query evidence; never print Authorization headers or env values.

| Case | Expected result |
| --- | --- |
| Anonymous, wrong non-admin user, missing service ID, flag off on every bridge route | 403/404 before privileged reads/writes; no data |
| Service token native business `/items/*`, sensitive singleton/lead/order reads, REST writes, GraphQL equivalent, file metadata/native `/assets/:id` | Denied even when the guessed ID is valid and synthetic |
| Native existing `/commerce/leads`, `/commerce/orders`, mutations/version/preview routes with zero-grant service identity | Denied by current accountability/permissions; no elevation |
| Draft product/category/page/home, hidden or draft section, published child with unpublished parent, draft analog target | Absent/404, no nested draft fields or file references |
| Invalid UUID, traversal, encoded separators, unreferenced public file, private file, private file deliberately referenced by synthetic published content, wrong-site folder | 404/no bytes; arbitrary IDs never become paths |
| Published public PNG/PDF; HTML/JS/SVG fixtures | Only allowed references serve; download/CSP/nosniff/CORP policy preserved; no inline active-document execution |
| Unknown query/operation/collection, custom fields/filter/deep/aggregate, `limit=-1` or oversized limits | Controlled rejection or explicitly ignored unsupported parameters; fixed server predicates/field allowlists remain intact |
| Oversize streamed/multibyte body without Content-Length, invalid JSON, >100 items, malformed quantities/contact/keys | Bounded consumption; controlled 4xx; no privileged write |
| Same key+same payload concurrently; same key+different payload; another owner with same key | One committed result/replay; conflict for changed payload; no cross-owner result disclosure |
| Last reference unpublished after initial successful asset response | Denial/no bytes within explicitly accepted revocation bound through origin and actual cache |
| Upstream 403/404/500, timeout, failed transaction acknowledgement | Safe response; no token/raw query/PII; retry with the same key; no partial write |

## Verification performed

`storefront`: `npm test -- --run tests/security.test.ts tests/assets-live.test.ts` — 2 files, 8 tests passed. These are mocked adapter/helper tests, despite the assets test filename containing "live".

`directus`: `node --test test/commerce-races.test.mjs test/dev-isolation.test.mjs` — 6 tests passed (4 in-memory race tests, 2 isolation tests).

Additional no-file, no-network probes: both commerce factories return 403 for unauthenticated requests before database/schema access; transpiled asset helper approves a synthetic published reference without any folder lookup; transpiled lead route consumes 600,056 streamed bytes before 413 with no Content-Length and no upstream call. No fixture persistence or live identity access was performed. The live denial matrix remains pending, and production acceptance is not claimed.
